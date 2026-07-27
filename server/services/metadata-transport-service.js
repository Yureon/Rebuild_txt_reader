const https = require('https');
const net = require('net');
const iconv = require('iconv-lite');
const jschardet = require('jschardet');
const { isHostAllowed, isPathAllowed } = require('./metadata-provider-registry');

const { resolvePinnedAddress, isPublicAddress } = require('./network-address-policy');

const METADATA_TRANSPORT_SECURITY_PASS = 'v622-metadata-transport-security-pass';

const DESKTOP_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36';

function profileHeaders(profile = 'default', referer = '', deviceProfile = 'desktop') {
  const headers = {
    'user-agent':deviceProfile === 'mobile' ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
    'accept-language':'ko-KR,ko;q=0.9,en-US;q=0.7,en;q=0.5',
    'cache-control':'no-cache',
    pragma:'no-cache'
  };
  if (profile === 'browser-json' || profile === 'kakaopage-json' || profile === 'novelpia-json') {
    headers.accept = 'application/json, text/plain, */*';
    headers['x-requested-with'] = 'XMLHttpRequest';
  } else if (profile === 'browser-image') headers.accept = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8';
  else headers.accept = 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.5';
  if (profile === 'kakaopage-json') {
    headers['apollo-require-preflight'] = 'true';
    headers['x-apollo-operation-name'] = 'SearchKeyword';
  }
  if (referer) headers.referer = referer;
  return headers;
}

function readResponseBuffer(res, maxBytes) {
  return new Promise((resolve, reject) => {
    const declared = Number(res.headers['content-length'] || 0);
    if (Number.isFinite(declared) && declared > maxBytes) {
      res.destroy();
      reject(Object.assign(new Error('metadata response exceeded byte limit'), { code:'METADATA_RESPONSE_TOO_LARGE', maxBytes }));
      return;
    }
    const chunks = [];
    let bytes = 0;
    res.on('data', chunk => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        res.destroy(Object.assign(new Error('metadata response exceeded byte limit'), { code:'METADATA_RESPONSE_TOO_LARGE', maxBytes }));
        return;
      }
      chunks.push(chunk);
    });
    res.on('error', reject);
    res.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

function normalizeCharset(value) {
  const charset = String(value || '').trim().toLowerCase().replace(/["']/g, '');
  if (!charset) return '';
  if (['utf-8','utf8'].includes(charset)) return 'utf8';
  if (['euc-kr','euckr','ks_c_5601-1987','ks-c-5601','windows-949','cp949','uhc'].includes(charset)) return 'cp949';
  if (['utf-16','utf-16le','utf16le'].includes(charset)) return 'utf16le';
  return iconv.encodingExists(charset) ? charset : '';
}

function decodeResponseBody(buffer, contentType = '') {
  if (!Buffer.isBuffer(buffer)) return String(buffer || '');
  const declared = normalizeCharset(String(contentType || '').match(/charset\s*=\s*([^;\s]+)/i)?.[1] || '');
  if (declared) return iconv.decode(buffer, declared);
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) return buffer.subarray(3).toString('utf8');
  try { return new TextDecoder('utf-8', { fatal:true }).decode(buffer); } catch {}
  const sample = buffer.length > 128 * 1024 ? buffer.subarray(0, 128 * 1024) : buffer;
  const detected = jschardet.detect(sample);
  const encoding = normalizeCharset(detected && detected.confidence >= 0.6 ? detected.encoding : '');
  return iconv.decode(buffer, encoding || 'cp949');
}

function createPinnedLookup(pinned = {}) {
  const address = String(pinned.address || '').trim();
  const family = Number(pinned.family) || net.isIP(address);
  if (!address || !family) {
    throw Object.assign(new Error('metadata pinned DNS result is invalid'), { code:'METADATA_DNS_INVALID' });
  }
  return function pinnedLookup(_hostname, lookupOptions, callback) {
    if (typeof lookupOptions === 'function') {
      callback = lookupOptions;
      lookupOptions = {};
    }
    if (typeof callback !== 'function') throw new TypeError('metadata pinned lookup callback is required');
    // Node 20+ enables autoSelectFamily for outbound sockets and invokes custom
    // lookup functions with { all:true }. In that mode the callback must receive
    // an array of address records; returning the legacy scalar signature causes
    // ERR_INVALID_IP_ADDRESS with `undefined` before any HTTP request is sent.
    if (lookupOptions && lookupOptions.all) {
      callback(null, [{ address, family }]);
      return;
    }
    callback(null, address, family);
  };
}

function requestPinnedHttps(url, options, pinned) {
  return new Promise((resolve, reject) => {
    const headers = options.rawHeaders === true
      ? { ...(options.headers || {}) }
      : { ...profileHeaders(options.profile, options.referer, options.deviceProfile), ...(options.headers || {}) };
    let settled = false;
    let abortListener = null;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (abortListener && options.signal) options.signal.removeEventListener('abort', abortListener);
      callback(value);
    };
    const req = https.request({
      protocol:'https:',
      hostname:url.hostname,
      port:443,
      method:options.method || 'GET',
      path:`${url.pathname}${url.search}`,
      headers,
      servername:url.hostname,
      timeout:options.timeoutMs,
      lookup:createPinnedLookup(pinned)
    }, async res => {
      try {
        const buffer = await readResponseBuffer(res, options.maxBytes);
        finish(resolve, { statusCode:Number(res.statusCode) || 0, headers:res.headers, buffer });
      } catch (error) { finish(reject, error); }
    });
    req.on('timeout', () => req.destroy(Object.assign(new Error('metadata request timed out'), { code:'METADATA_TIMEOUT' })));
    req.on('error', error => finish(reject, error));
    if (options.signal) {
      abortListener = () => req.destroy(options.signal.reason instanceof Error ? options.signal.reason : Object.assign(new Error('metadata request cancelled'), { code:'METADATA_JOB_CANCELLED' }));
      if (options.signal.aborted) abortListener();
      else options.signal.addEventListener('abort', abortListener, { once:true });
    }
    req.end();
  });
}

function validateUrlForProvider(provider, rawUrl, kind = 'request') {
  let url;
  try { url = new URL(String(rawUrl || '')); }
  catch { throw Object.assign(new Error('invalid metadata URL'), { code:'METADATA_URL_INVALID' }); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) {
    throw Object.assign(new Error('metadata URL must be credential-free HTTPS 443'), { code:'METADATA_URL_BLOCKED' });
  }
  if (!isHostAllowed(provider, url.hostname, kind)) throw Object.assign(new Error('metadata URL host is not allowlisted'), { code:'METADATA_HOST_BLOCKED' });
  if (kind !== 'cover' && !isPathAllowed(provider, url.pathname)) throw Object.assign(new Error('metadata URL path is not allowlisted'), { code:'METADATA_PATH_BLOCKED' });
  return url;
}

function createMetadataTransportService(options = {}) {
  const timeoutMs = Math.max(1000, Math.min(30000, Number(options.timeoutMs) || 10000));
  const maxBytes = Math.max(64 * 1024, Math.min(16 * 1024 * 1024, Number(options.maxBytes) || 2 * 1024 * 1024));
  const maxImageBytes = Math.max(64 * 1024, Math.min(20 * 1024 * 1024, Number(options.maxImageBytes) || 5 * 1024 * 1024));
  const maxRedirects = Math.max(0, Math.min(5, Number(options.maxRedirects) || 3));

  async function fetchProvider(provider, rawUrl, requestOptions = {}) {
    const kind = requestOptions.kind || 'request';
    let url = validateUrlForProvider(provider, rawUrl, kind);
    let redirects = 0;
    while (true) {
      if (requestOptions.signal && requestOptions.signal.aborted) throw requestOptions.signal.reason || Object.assign(new Error('metadata request cancelled'), { code:'METADATA_JOB_CANCELLED' });
      const pinned = await resolvePinnedAddress(url.hostname);
      const result = await requestPinnedHttps(url, {
        timeoutMs,
        maxBytes:requestOptions.binary ? maxImageBytes : maxBytes,
        method:requestOptions.method || 'GET',
        profile:requestOptions.profile || 'default',
        referer:requestOptions.referer || '',
        deviceProfile:requestOptions.deviceProfile === 'mobile' ? 'mobile' : 'desktop',
        signal:requestOptions.signal || null
      }, pinned);
      if ([301, 302, 303, 307, 308].includes(result.statusCode)) {
        if (redirects >= maxRedirects) throw Object.assign(new Error('metadata redirect limit exceeded'), { code:'METADATA_REDIRECT_LIMIT' });
        const location = Array.isArray(result.headers.location) ? result.headers.location[0] : result.headers.location;
        if (!location) throw Object.assign(new Error('metadata redirect had no location'), { code:'METADATA_REDIRECT_INVALID' });
        url = validateUrlForProvider(provider, new URL(location, url).toString(), kind);
        redirects += 1;
        continue;
      }
      if (result.statusCode < 200 || result.statusCode >= 300) {
        const error = new Error(`metadata request failed with HTTP ${result.statusCode}`);
        error.code = 'METADATA_HTTP_ERROR';
        error.statusCode = result.statusCode;
        throw error;
      }
      const contentType = String(result.headers['content-type'] || '').toLowerCase();
      return {
        statusCode:result.statusCode,
        headers:result.headers,
        body:requestOptions.binary ? result.buffer : decodeResponseBody(result.buffer, contentType),
        finalUrl:url.toString(),
        contentType,
        pass:METADATA_TRANSPORT_SECURITY_PASS
      };
    }
  }

  return { fetchProvider, validateUrlForProvider, resolvePinnedAddress, isPublicAddress, decodeResponseBody, pass:METADATA_TRANSPORT_SECURITY_PASS };
}

module.exports = {
  METADATA_TRANSPORT_SECURITY_PASS,
  createMetadataTransportService,
  isPublicAddress,
  validateUrlForProvider,
  resolvePinnedAddress,
  decodeResponseBody,
  createPinnedLookup,
  requestPinnedHttps
};
