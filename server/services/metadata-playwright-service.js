const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const net = require('net');
const { isHostAllowed, isPathAllowed } = require('./metadata-provider-registry');
const { resolvePublicAddresses, isPublicAddress } = require('./network-address-policy');
const { requestPinnedHttps } = require('./metadata-transport-service');
const { loadJsonWithBackup, loadJsonWithBackupAsync } = require('../repositories/json-file-store');

const METADATA_PLAYWRIGHT_PROFILE_PASS = 'v627-metadata-playwright-pinned-dns-quota-pass';
const METADATA_PLAYWRIGHT_DNS_PIN_PASS = 'v627-metadata-playwright-dns-pin-pass';
const METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS = 'v627-metadata-playwright-truncated-quota-pass';
const METADATA_PLAYWRIGHT_LOW_CPU_PASS = 'v672-metadata-playwright-low-cpu-pass';
const METADATA_PLAYWRIGHT_DNS_PINNING_PASS = 'v674-metadata-playwright-dns-pinning-pass';
const DESKTOP_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MOBILE_USER_AGENT = 'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const MOBILE_VIEWPORT = Object.freeze({ width:412, height:915 });
const SESSION_ID_RE = /^mpl_[a-f0-9]{24}$/;
const ALLOWED_KEYS = new Set([
  'Enter','Tab','Shift+Tab','Escape','Backspace','Delete','ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
  'Home','End','PageUp','PageDown','Space'
]);

function nowIso() { return new Date().toISOString(); }
function clean(value, max = 400) { return String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
async function fsyncDirectoryAsync(dir) {
  let handle = null;
  try {
    handle = await fs.promises.open(dir, 'r');
    await handle.sync();
  } catch (_error) {
  } finally {
    try { await handle?.close(); } catch (_error) {}
  }
}
async function atomicWriteAsync(filePath, value) {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive:true, mode:0o700 });
  const temp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const backupPath = `${filePath}.bak`;
  const backupTemp = `${backupPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  let tempHandle = null;
  let backupHandle = null;
  try {
    await fs.promises.writeFile(temp, JSON.stringify(value, null, 2), { encoding:'utf8', mode:0o600, flag:'wx' });
    // Windows requires a writable descriptor for fsync.
    tempHandle = await fs.promises.open(temp, 'r+');
    await tempHandle.sync();
    await tempHandle.close();
    tempHandle = null;

    const current = await loadJsonWithBackupAsync(filePath, null);
    if (current.ok && current.source === 'primary') {
      await fs.promises.copyFile(filePath, backupTemp);
      await fs.promises.chmod(backupTemp, 0o600);
      backupHandle = await fs.promises.open(backupTemp, 'r+');
      await backupHandle.sync();
      await backupHandle.close();
      backupHandle = null;
      await fs.promises.rename(backupTemp, backupPath);
    }

    await fs.promises.rename(temp, filePath);
    await fs.promises.chmod(filePath, 0o600).catch(() => {});
    await fsyncDirectoryAsync(dir);
  } catch (error) {
    try { await tempHandle?.close(); } catch (_closeError) {}
    try { await backupHandle?.close(); } catch (_closeError) {}
    await fs.promises.rm(temp, { force:true }).catch(() => {});
    await fs.promises.rm(backupTemp, { force:true }).catch(() => {});
    throw error;
  }
}

function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, { recursive:true, mode:0o700 });
  try { fs.chmodSync(dir, 0o700); } catch {}
}
function safeDisplayUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return `${url.origin}${url.pathname}`.slice(0, 600);
  } catch { return ''; }
}
function profileHasData(dir) {
  try { return fs.readdirSync(dir).some(name => !name.startsWith('.')); }
  catch { return false; }
}
function createError(code, message, extra = {}) {
  return Object.assign(new Error(message), { code, ...extra });
}
function sanitizeProvider(provider) {
  if (!provider || !provider.id || !provider.browserProfileSupported) throw createError('METADATA_PLAYWRIGHT_PROVIDER_UNSUPPORTED', '이 공급자는 Playwright 로그인 프로필을 지원하지 않습니다.');
  return provider;
}
function classifyUrl(provider, rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || '')); } catch { return 'invalid'; }
  const host = url.hostname.toLowerCase();
  if ((provider.browserAuthHosts || []).some(item => host === String(item).toLowerCase())) return 'auth';
  if ([...(provider.searchHosts || []), ...(provider.detailHosts || [])].some(item => host === String(item).toLowerCase())) return 'provider';
  return 'external';
}
function validateInteractiveUrl(provider, rawUrl) {
  let url;
  try { url = new URL(String(rawUrl || '')); }
  catch { throw createError('METADATA_PLAYWRIGHT_URL_INVALID', '브라우저 이동 URL이 올바르지 않습니다.'); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')) throw createError('METADATA_PLAYWRIGHT_URL_BLOCKED', '브라우저 로그인 URL은 자격 증명이 없는 HTTPS 443 주소여야 합니다.');
  const kind = classifyUrl(provider, url.toString());
  if (!['provider','auth'].includes(kind)) throw createError('METADATA_PLAYWRIGHT_URL_BLOCKED', '공급자 또는 공식 인증 호스트 밖으로 이동할 수 없습니다.');
  return url.toString();
}
function validateCollectionUrl(provider, rawUrl, kind = 'request') {
  let url;
  try { url = new URL(String(rawUrl || '')); }
  catch { throw createError('METADATA_URL_INVALID', 'invalid metadata URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || (url.port && url.port !== '443')) throw createError('METADATA_URL_BLOCKED', 'metadata URL must be credential-free HTTPS 443');
  if (!isHostAllowed(provider, url.hostname, kind)) throw createError('METADATA_HOST_BLOCKED', 'metadata URL host is not allowlisted');
  if (kind !== 'cover' && !isPathAllowed(provider, url.pathname)) throw createError('METADATA_PATH_BLOCKED', 'metadata URL path is not allowlisted');
  return url;
}
function responseHeadersObject(response) {
  try { return response.headers(); } catch { return {}; }
}
function headerValues(headers, name) {
  const target = String(name || '').toLowerCase();
  if (!headers || typeof headers !== 'object') return [];
  for (const [key, value] of Object.entries(headers)) {
    if (String(key).toLowerCase() !== target) continue;
    return Array.isArray(value) ? value.map(item => String(item || '')) : [String(value || '')];
  }
  return [];
}
function parseSetCookieForContext(value, responseUrl, nowMs = Date.now()) {
  const text = String(value || '');
  const parts = text.split(';');
  const pair = String(parts.shift() || '');
  const separator = pair.indexOf('=');
  if (separator <= 0) return null;
  const name = pair.slice(0, separator).trim();
  const cookieValue = pair.slice(separator + 1).trim();
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(name) || /[\u0000-\u001f\u007f;]/u.test(cookieValue)) return null;
  const target = responseUrl instanceof URL ? responseUrl : new URL(String(responseUrl));
  const cookie = { name, value:cookieValue, domain:target.hostname.toLowerCase(), path:'/' };
  let domainExplicit = false;
  for (const rawPart of parts) {
    const attribute = String(rawPart || '').trim();
    if (!attribute) continue;
    const index = attribute.indexOf('=');
    const key = (index < 0 ? attribute : attribute.slice(0, index)).trim().toLowerCase();
    const raw = index < 0 ? '' : attribute.slice(index + 1).trim();
    if (key === 'domain') {
      const domain = raw.replace(/^\./u, '').toLowerCase();
      if (!domain || (target.hostname.toLowerCase() !== domain && !target.hostname.toLowerCase().endsWith(`.${domain}`))) return null;
      cookie.domain = `.${domain}`;
      domainExplicit = true;
    } else if (key === 'path' && raw.startsWith('/')) cookie.path = raw;
    else if (key === 'secure') cookie.secure = true;
    else if (key === 'httponly') cookie.httpOnly = true;
    else if (key === 'samesite') {
      const sameSite = raw.toLowerCase();
      if (sameSite === 'strict') cookie.sameSite = 'Strict';
      else if (sameSite === 'lax') cookie.sameSite = 'Lax';
      else if (sameSite === 'none') cookie.sameSite = 'None';
    } else if (key === 'max-age' && /^-?\d+$/u.test(raw)) {
      cookie.expires = Math.max(0, Math.floor(nowMs / 1000) + Number(raw));
    } else if (key === 'expires' && cookie.expires == null) {
      const expiresAt = Date.parse(raw);
      if (Number.isFinite(expiresAt)) cookie.expires = Math.max(0, Math.floor(expiresAt / 1000));
    }
  }
  // BrowserContext.addCookies requires domain/path or URL. A host-only cookie is
  // represented with the exact response hostname; an explicit Domain attribute
  // retains the leading dot.
  if (!domainExplicit) cookie.domain = target.hostname.toLowerCase();
  return cookie;
}
function pathMatchesLoginPrefix(pathname, prefix) {
  const value = String(pathname || '/');
  const expected = String(prefix || '/').replace(/\/+$/u, '') || '/';
  return value === expected || value.startsWith(`${expected}/`);
}

function createMetadataPlaywrightService(options = {}) {
  const profilesDir = path.resolve(String(options.profilesDir || path.join(process.cwd(), 'data', 'metadata-browser-profiles')));
  const statePath = path.resolve(String(options.statePath || path.join(profilesDir, 'profiles.json')));
  const enabled = options.enabled !== false;
  const headless = options.headless !== false;
  const timeoutMs = Math.max(5000, Math.min(120000, Number(options.timeoutMs) || 30000));
  const maxBytes = Math.max(64 * 1024, Math.min(16 * 1024 * 1024, Number(options.maxBytes) || 2 * 1024 * 1024));
  const settleInput = Number(options.settleMs);
  const settleMs = Math.max(0, Math.min(10000, Number.isFinite(settleInput) ? settleInput : 900));
  const sessionTtlMs = Math.max(60_000, Math.min(60 * 60_000, Number(options.sessionTtlMs) || 20 * 60_000));
  const collectorIdleTtlMs = Math.max(15_000, Math.min(10 * 60_000, Number(options.collectorIdleTtlMs) || 90_000));
  const viewport = { width:Math.max(800, Math.min(1920, Number(options.viewportWidth) || 1280)), height:Math.max(600, Math.min(1200, Number(options.viewportHeight) || 900)) };
  const logger = options.logger || console;
  const providerResolver = options.providerResolver;
  const sessions = new Map();
  const collectorContexts = new Map();
  const providerLocks = new Map();
  let state = { schemaVersion:1, providers:{} };
  let chromiumRef = options.chromium || null;
  let stateDirty = false;
  let persistTimer = null;
  let persistChain = Promise.resolve();
  const persistDelayMs = Math.max(0, Math.min(5000, Number(options.persistDelayMs) || 150));
  const profileMaxBytes = Math.max(64 * 1024 * 1024, Number(options.profileMaxBytes) || 512 * 1024 * 1024);
  const profileMaintenanceIntervalMs = Math.max(60_000, Number(options.profileMaintenanceIntervalMs) || 6 * 60 * 60_000);
  const resolveAddresses = typeof options.resolvePublicAddresses === 'function' ? options.resolvePublicAddresses : resolvePublicAddresses;
  const executePinnedHttps = typeof options.requestPinnedHttps === 'function' ? options.requestPinnedHttps : requestPinnedHttps;
  let profileMaintenanceTimer = null;

  if (typeof providerResolver !== 'function') throw new Error('metadata playwright providerResolver is required');
  ensurePrivateDir(profilesDir);
  const loadedState = loadJsonWithBackup(statePath, null);
  const parsedState = loadedState && loadedState.ok ? loadedState.data : null;
  if (parsedState && parsedState.schemaVersion === 1 && parsedState.providers && typeof parsedState.providers === 'object' && !Array.isArray(parsedState.providers)) {
    state = parsedState;
    if (loadedState.source === 'backup') stateDirty = true;
  }

  async function flushState() {
    if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
    if (!stateDirty) return persistChain;
    stateDirty = false;
    const snapshot = JSON.parse(JSON.stringify(state));
    const task = persistChain.catch(() => {}).then(() => atomicWriteAsync(statePath, snapshot));
    persistChain = task;
    try { await task; }
    catch (error) { stateDirty = true; throw error; }
    if (stateDirty) return flushState();
    return task;
  }
  function schedulePersist() {
    stateDirty = true;
    if (persistTimer) return;
    persistTimer = setTimeout(() => {
      persistTimer = null;
      void flushState().catch(error => logger.error?.('[metadata-playwright] profile state persist failed', clean(error && error.message || error, 500)));
    }, persistDelayMs);
    persistTimer.unref?.();
  }
  function providerFor(providerId) { return sanitizeProvider(providerResolver(String(providerId || ''))); }
  function profileDir(providerId) {
    const id = String(providerId || '');
    if (!/^builtin-[a-z0-9-]+$/.test(id)) throw createError('METADATA_PROVIDER_NOT_FOUND', 'metadata provider not found');
    const dir = path.join(profilesDir, id);
    ensurePrivateDir(dir);
    return dir;
  }
  function providerState(providerId) {
    return state.providers[String(providerId)] || null;
  }
  function updateProviderState(providerId, patch) {
    const id = String(providerId);
    state.providers[id] = { providerId:id, status:'unknown', updatedAt:nowIso(), ...(state.providers[id] || {}), ...patch, updatedAt:nowIso() };
    schedulePersist();
    return state.providers[id];
  }
  function getChromium() {
    if (chromiumRef) return chromiumRef;
    try { chromiumRef = require('playwright-chromium').chromium; return chromiumRef; }
    catch (error) { throw createError('METADATA_PLAYWRIGHT_UNAVAILABLE', 'Playwright Chromium을 불러오지 못했습니다. 이미지에 브라우저가 설치되어 있는지 확인하십시오.', { cause:error }); }
  }
  function launchOptions(hostResolverRules = '', leanCollection = false) {
    const args = ['--disable-dev-shm-usage'];
    if (leanCollection) args.push(
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-sync',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--disable-features=Translate,MediaRouter,OptimizationHints'
    );
    if (hostResolverRules) args.push(`--host-resolver-rules=${hostResolverRules}`);
    if (options.noSandbox === true) args.push('--no-sandbox');
    const result = {
      headless,
      viewport,
      locale:'ko-KR',
      timezoneId:'Asia/Seoul',
      acceptDownloads:false,
      serviceWorkers:'block',
      ignoreHTTPSErrors:false,
      args
    };
    if (options.executablePath) result.executablePath = String(options.executablePath);
    return result;
  }
  function exactBrowserHosts(provider) {
    return [...new Set([
      ...(provider.searchHosts || []), ...(provider.detailHosts || []),
      ...(provider.browserAuthHosts || []), ...(provider.coverHosts || [])
    ].map(value => String(value || '').trim().toLowerCase()).filter(host => {
      return host && !host.startsWith('.') && /^[a-z0-9.-]+$/u.test(host);
    }))];
  }
  function validatePublicAddressAnswers(hostname, input) {
    const answers = Array.isArray(input) ? input : [];
    if (!answers.length) throw createError('METADATA_DNS_EMPTY', `No public DNS address was available for ${hostname}`);
    const normalized = answers.map(item => {
      const address = String(item && item.address || '').trim();
      const actualFamily = net.isIP(address);
      const family = Number(item && item.family) || actualFamily;
      if (![4,6].includes(family) || family !== actualFamily || !isPublicAddress(address)) {
        throw createError('METADATA_SSRF_BLOCKED', `${hostname} resolved to a private, reserved, or invalid address`);
      }
      return { address, family };
    });
    return normalized;
  }
  async function resolveFreshPublicAddresses(hostname) {
    const host = String(hostname || '').trim().toLowerCase();
    return validatePublicAddressAnswers(host, await resolveAddresses(host));
  }
  function selectPinnedAddress(answers) {
    return answers.find(item => Number(item.family) === 4) || answers[0];
  }
  async function buildPinnedHostResolverRules(provider) {
    const hosts = exactBrowserHosts(provider);
    const mappings = [];
    for (const host of hosts) {
      const answers = await resolveFreshPublicAddresses(host);
      const selected = selectPinnedAddress(answers);
      const address = Number(selected.family) === 6 ? `[${selected.address}]` : selected.address;
      mappings.push(`MAP ${host} ${address}`);
    }
    // Only exact, pre-resolved public hosts are admitted. Suffix allowlists cannot
    // be safely represented by Chromium resolver rules without letting a later,
    // attacker-controlled DNS answer choose the socket destination.
    return { rules:mappings.join(','), hosts:new Set(hosts) };
  }

  async function withProviderLock(providerId, fn) {
    const key = String(providerId);
    const previous = providerLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const chain = previous.then(() => gate);
    providerLocks.set(key, chain);
    await previous;
    try { return await fn(); }
    finally {
      release();
      if (providerLocks.get(key) === chain) providerLocks.delete(key);
    }
  }
  async function closeCollector(providerId) {
    const id = String(providerId);
    const entry = collectorContexts.get(id);
    collectorContexts.delete(id);
    if (!entry) return;
    clearTimeout(entry.idleTimer);
    try { await entry.context.close(); } catch {}
    await runProfileMaintenance(id).catch(error => logger.warn?.('[metadata-playwright] collector profile cleanup warning', id, clean(error && error.message || error, 300)));
  }
  async function closeSession(session) {
    if (!session || session.closed) return;
    session.closed = true;
    clearTimeout(session.expiryTimer);
    sessions.delete(session.providerId);
    try { await session.context.close(); } catch {}
  }
  function touchSession(session) {
    session.lastActivityAt = nowIso();
    clearTimeout(session.expiryTimer);
    session.expiryTimer = setTimeout(() => { void closeSession(session); }, sessionTtlMs);
    session.expiryTimer.unref?.();
  }
  function sessionFor(providerId, sessionId) {
    const session = sessions.get(String(providerId));
    if (!session || session.closed || !SESSION_ID_RE.test(String(sessionId || '')) || session.id !== String(sessionId)) throw createError('METADATA_PLAYWRIGHT_SESSION_NOT_FOUND', 'Playwright 로그인 세션을 찾을 수 없습니다.');
    touchSession(session);
    return session;
  }
  function resolveSessionPage(session, provider = providerFor(session.providerId)) {
    let pages = [];
    try { pages = typeof session.context.pages === 'function' ? session.context.pages() : []; } catch {}
    for (let index = pages.length - 1; index >= 0; index -= 1) {
      const page = pages[index];
      if (!page || page.isClosed?.()) continue;
      const kind = classifyUrl(provider, page.url?.() || '');
      if (kind === 'provider' || kind === 'auth') { session.page = page; return page; }
    }
    if (session.page && !session.page.isClosed?.()) return session.page;
    return null;
  }
  function resourceHostAllowed(provider, hostname, pinnedHosts = null) {
    const host = String(hostname || '').trim().toLowerCase();
    if (!host) return false;
    const exact = pinnedHosts instanceof Set ? pinnedHosts : new Set(exactBrowserHosts(provider));
    return exact.has(host);
  }
  async function installContextNetworkGuard(context, provider, guardOptions = {}) {
    if (!context || typeof context.route !== 'function') return false;
    await context.route('**/*', async route => {
      const request = route.request();
      const resourceType = String(request && request.resourceType && request.resourceType() || '').toLowerCase();
      const leanCollection = guardOptions.leanCollection === true;
      if (resourceType === 'websocket' || resourceType === 'media' || (leanCollection && ['image','font','stylesheet'].includes(resourceType))) return route.abort('blockedbyclient').catch(() => {});
      let url;
      try { url = new URL(String(request && request.url && request.url() || '')); }
      catch { return route.abort('blockedbyclient').catch(() => {}); }
      if (['data:','blob:','about:'].includes(url.protocol)) return route.continue().catch(() => {});
      if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !resourceHostAllowed(provider, url.hostname, guardOptions.pinnedHosts)) {
        return route.abort('blockedbyclient').catch(() => {});
      }
      return route.continue().catch(() => {});
    });
    return true;
  }
  async function directorySizeAsync(root, maxEntries = 50_000) {
    let bytes = 0;
    let entries = 0;
    const queue = [root];
    while (queue.length && entries < maxEntries) {
      const current = queue.pop();
      let children = [];
      try { children = await fs.promises.readdir(current, { withFileTypes:true }); } catch { continue; }
      for (const child of children) {
        if (++entries > maxEntries) break;
        const full = path.join(current, child.name);
        if (child.isSymbolicLink()) continue;
        if (child.isDirectory()) queue.push(full);
        else if (child.isFile()) {
          try { bytes += Number((await fs.promises.stat(full)).size) || 0; } catch {}
        }
      }
    }
    return { bytes, entries, truncated:entries >= maxEntries };
  }
  const TRANSIENT_PROFILE_PATHS = Object.freeze([
    'Default/Cache', 'Default/Code Cache', 'Default/GPUCache', 'Default/Service Worker/CacheStorage',
    'Default/Service Worker/ScriptCache', 'ShaderCache', 'GrShaderCache', 'GraphiteDawnCache',
    'Crashpad', 'BrowserMetrics', 'component_crx_cache'
  ]);
  async function runProfileMaintenance(providerId, maintenanceOptions = {}) {
    const id = String(providerId || '');
    if (!id || sessions.has(id) || collectorContexts.has(id)) return { skipped:true, reason:'profile-active' };
    const dir = profileDir(id);
    const before = await directorySizeAsync(dir);
    const shouldClean = maintenanceOptions.force === true || before.truncated === true || before.bytes > profileMaxBytes / 2;
    let removed = 0;
    if (shouldClean) {
      for (const relative of TRANSIENT_PROFILE_PATHS) {
        const target = path.join(dir, ...relative.split('/'));
        try { await fs.promises.rm(target, { recursive:true, force:true }); removed += 1; } catch (error) { logger.warn?.('[metadata-playwright] profile cache cleanup failed', id, relative, clean(error && error.message || error, 300)); }
      }
    }
    const after = shouldClean ? await directorySizeAsync(dir) : before;
    updateProviderState(id, {
      profileBytes:after.bytes,
      profileEntries:after.entries,
      profileQuotaBytes:profileMaxBytes,
      profileQuotaExceeded:after.bytes > profileMaxBytes || after.truncated === true,
      profileMeasurementTruncated:after.truncated === true,
      profileBytesLowerBound:after.truncated === true,
      profileQuotaPass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS,
      profileLastMaintenanceAt:nowIso(),
      profileTransientPathsRemoved:removed
    });
    return { beforeBytes:before.bytes, afterBytes:after.bytes, beforeTruncated:before.truncated === true, afterTruncated:after.truncated === true, removed, quotaExceeded:after.bytes > profileMaxBytes || after.truncated === true, pass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS };
  }
  async function launchPersistent(providerId, launchOptionsInput = {}) {
    if (!enabled) throw createError('METADATA_PLAYWRIGHT_DISABLED', 'Playwright 프로필 기능이 비활성화되어 있습니다.');
    const provider = providerFor(providerId);
    await runProfileMaintenance(provider.id).catch(error => logger.warn?.('[metadata-playwright] profile maintenance warning', provider.id, clean(error && error.message || error, 300)));
    const chromium = getChromium();
    try {
      const hostResolver = await buildPinnedHostResolverRules(provider);
      const context = await chromium.launchPersistentContext(profileDir(provider.id), launchOptions(hostResolver.rules, launchOptionsInput.leanCollection === true));
      await installContextNetworkGuard(context, provider, { leanCollection:launchOptionsInput.leanCollection === true, pinnedHosts:hostResolver.hosts });
      updateProviderState(provider.id, { dnsPinned:true, dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS, dnsPinnedHostCount:hostResolver.hosts.size });
      return context;
    }
    catch (error) {
      const message = /Executable doesn't exist|browserType\.launchPersistentContext/iu.test(String(error && error.message || ''))
        ? 'Playwright Chromium 실행 파일이 없습니다. Docker 이미지를 다시 빌드하거나 METADATA_PLAYWRIGHT_EXECUTABLE_PATH를 확인하십시오.'
        : `Playwright 브라우저를 시작하지 못했습니다: ${clean(error && error.message || error, 500)}`;
      throw createError('METADATA_PLAYWRIGHT_LAUNCH_FAILED', message, { cause:error });
    }
  }
  function describe(providerId) {
    const provider = providerFor(providerId);
    const item = providerState(provider.id);
    const session = sessions.get(provider.id);
    const configured = profileHasData(profileDir(provider.id));
    return {
      supported:true,
      enabled,
      configured,
      status:session && !session.closed ? 'login_active' : configured ? (item && item.status || 'unknown') : 'not_configured',
      updatedAt:item && item.updatedAt || null,
      lastVerifiedAt:item && item.lastVerifiedAt || null,
      lastError:item && item.lastError || '',
      sessionActive:!!(session && !session.closed),
      profileBytes:Number(item && item.profileBytes) || 0,
      profileQuotaBytes:profileMaxBytes,
      profileQuotaExceeded:!!(item && item.profileQuotaExceeded),
      profileLastMaintenanceAt:item && item.profileLastMaintenanceAt || null,
      pass:METADATA_PLAYWRIGHT_PROFILE_PASS,
      lowCpuPass:METADATA_PLAYWRIGHT_LOW_CPU_PASS,
      dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS,
      profileQuotaPass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS
    };
  }
  function canFetch(providerId) {
    try {
      const item = describe(providerId);
      return item.enabled && item.configured && item.status === 'ready' && !item.sessionActive;
    } catch { return false; }
  }
  async function startLogin(providerId, input = {}) {
    const provider = providerFor(providerId);
    await closeCollector(provider.id);
    const existing = sessions.get(provider.id);
    if (existing) await closeSession(existing);
    const context = await launchPersistent(provider.id);
    const pages = context.pages();
    const page = pages[0] || await context.newPage();
    const session = {
      id:`mpl_${crypto.randomBytes(12).toString('hex')}`,
      providerId:provider.id,
      providerName:provider.name,
      context,
      page,
      createdAt:nowIso(),
      lastActivityAt:nowIso(),
      closed:false,
      expiryTimer:null
    };
    sessions.set(provider.id, session);
    touchSession(session);
    const requested = clean(input.targetUrl, 2048);
    const startUrl = requested ? validateInteractiveUrl(provider, requested) : provider.browserLoginUrl || provider.loginUrl || provider.browserHomeUrl;
    try { await page.goto(startUrl, { waitUntil:'domcontentloaded', timeout:timeoutMs }); }
    catch (error) { logger.warn?.('[metadata-playwright] login navigation warning', provider.id, clean(error && error.message || error, 300)); }
    if (settleMs) await page.waitForTimeout(settleMs).catch(() => {});
    updateProviderState(provider.id, { status:'login_active', lastError:'' });
    return sessionSummary(session, provider);
  }
  function sessionSummary(session, provider = providerFor(session.providerId)) {
    const page = resolveSessionPage(session, provider);
    const currentUrl = page ? page.url() : '';
    return {
      sessionId:session.id,
      providerId:provider.id,
      providerName:provider.name,
      status:'login_active',
      currentUrl:safeDisplayUrl(currentUrl),
      locationType:classifyUrl(provider, currentUrl),
      viewport,
      createdAt:session.createdAt,
      lastActivityAt:session.lastActivityAt,
      expiresInMs:sessionTtlMs,
      pass:METADATA_PLAYWRIGHT_PROFILE_PASS, dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS, profileQuotaPass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS
    };
  }
  function getLoginSession(providerId, sessionId) {
    const provider = providerFor(providerId);
    return sessionSummary(sessionFor(provider.id, sessionId), provider);
  }
  async function screenshot(providerId, sessionId) {
    const provider = providerFor(providerId);
    const session = sessionFor(provider.id, sessionId);
    const page = resolveSessionPage(session, provider);
    if (!page) throw createError('METADATA_PLAYWRIGHT_SESSION_CLOSED', 'Playwright 로그인 페이지가 닫혔습니다.');
    const buffer = await page.screenshot({ type:'png', fullPage:false, animations:'disabled' });
    return { buffer, summary:sessionSummary(session, provider) };
  }
  async function interact(providerId, sessionId, input = {}) {
    const provider = providerFor(providerId);
    const session = sessionFor(provider.id, sessionId);
    const page = resolveSessionPage(session, provider);
    const action = clean(input.action, 40);
    if (!page) throw createError('METADATA_PLAYWRIGHT_SESSION_CLOSED', 'Playwright 로그인 페이지가 닫혔습니다.');
    if (action === 'click') {
      const x = Math.max(0, Math.min(viewport.width, Number(input.x) || 0));
      const y = Math.max(0, Math.min(viewport.height, Number(input.y) || 0));
      await page.mouse.click(x, y);
    } else if (action === 'type') {
      const text = String(input.text == null ? '' : input.text);
      if (!text || text.length > 1024 || /[\u0000]/.test(text)) throw createError('METADATA_PLAYWRIGHT_INPUT_INVALID', '입력 문자열은 1~1024자여야 합니다.');
      await page.keyboard.insertText(text);
    } else if (action === 'key') {
      const key = String(input.key || '');
      if (!ALLOWED_KEYS.has(key)) throw createError('METADATA_PLAYWRIGHT_INPUT_INVALID', '허용되지 않은 키입니다.');
      await page.keyboard.press(key);
    } else if (action === 'scroll') {
      await page.mouse.wheel(0, Math.max(-3000, Math.min(3000, Number(input.deltaY) || 0)));
    } else if (action === 'reload') {
      await page.reload({ waitUntil:'domcontentloaded', timeout:timeoutMs });
    } else if (action === 'goto') {
      await page.goto(validateInteractiveUrl(provider, input.url), { waitUntil:'domcontentloaded', timeout:timeoutMs });
    } else {
      throw createError('METADATA_PLAYWRIGHT_INPUT_INVALID', '지원되지 않는 브라우저 동작입니다.');
    }
    if (settleMs) await page.waitForTimeout(Math.min(settleMs, 1200)).catch(() => {});
    return sessionSummary(session, provider);
  }
  async function finishLogin(providerId, sessionId) {
    const provider = providerFor(providerId);
    const session = sessionFor(provider.id, sessionId);
    const page = resolveSessionPage(session, provider);
    if (!page) throw createError('METADATA_PLAYWRIGHT_SESSION_CLOSED', 'Playwright 로그인 페이지가 닫혔습니다.');
    const url = page.url();
    if (classifyUrl(provider, url) !== 'provider') throw createError('METADATA_PLAYWRIGHT_LOGIN_INCOMPLETE', '공급자 페이지로 돌아온 뒤 로그인을 완료하십시오.');
    let body = await page.locator('body').innerText({ timeout:5000 }).catch(() => '');
    if (provider.id === 'builtin-novelpia') {
      const coverLocator = page.locator('.cover_img');
      if (coverLocator && typeof coverLocator.getAttribute === 'function') {
        const coverSource = await coverLocator.getAttribute('src', { timeout:1500 }).catch(() => '');
        if (coverSource) body += `\n<img src="${coverSource}">`;
      }
    }
    if (detectAgeVerificationRequired(provider, url, body)) {
      const error = createError('METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED', `${provider.name} 성인·본인 인증을 완료한 뒤 다시 프로필 저장을 누르십시오.`);
      markVerificationRequired(provider.id, error);
      throw error;
    }
    if (detectLoginRequired(provider, url, body)) throw createError('METADATA_PLAYWRIGHT_LOGIN_INCOMPLETE', '현재 페이지가 아직 로그인을 요구합니다.');
    updateProviderState(provider.id, { status:'ready', lastVerifiedAt:nowIso(), lastError:'' });
    await flushState();
    await closeSession(session);
    return describe(provider.id);
  }
  async function cancelLogin(providerId, sessionId) {
    const provider = providerFor(providerId);
    const session = sessionFor(provider.id, sessionId);
    await closeSession(session);
    const configured = profileHasData(profileDir(provider.id));
    updateProviderState(provider.id, { status:configured ? 'unknown' : 'not_configured' });
    return describe(provider.id);
  }
  async function clearProfile(providerId) {
    const provider = providerFor(providerId);
    await closeCollector(provider.id);
    const session = sessions.get(provider.id);
    if (session) await closeSession(session);
    await fs.promises.rm(profileDir(provider.id), { recursive:true, force:true });
    delete state.providers[provider.id];
    schedulePersist();
    await flushState();
    ensurePrivateDir(profileDir(provider.id));
    return describe(provider.id);
  }
  function markExpired(providerId, error) {
    const provider = providerFor(providerId);
    updateProviderState(provider.id, { status:'expired', lastError:clean(error && error.message || error, 500) });
  }
  function markVerificationRequired(providerId, error) {
    const provider = providerFor(providerId);
    updateProviderState(provider.id, { status:'verification_required', lastError:clean(error && error.message || error, 500) });
  }
  function touchCollectorEntry(provider, entry) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => { void closeCollector(provider.id); }, collectorIdleTtlMs);
    entry.idleTimer.unref?.();
    return entry;
  }
  async function getCollectorEntry(provider) {
    const existing = collectorContexts.get(provider.id);
    if (existing) return touchCollectorEntry(provider, existing);
    const context = await launchPersistent(provider.id, { leanCollection:true });
    const entry = { context, pages:new Map(), idleTimer:null };
    collectorContexts.set(provider.id, entry);
    return touchCollectorEntry(provider, entry);
  }
  async function getCollectorContext(provider) {
    return (await getCollectorEntry(provider)).context;
  }
  async function getReusableCollectorPage(entry, provider, key, requestOptions = {}) {
    let page = entry.pages.get(key) || null;
    if (page && page.isClosed?.()) {
      entry.pages.delete(key);
      page = null;
    }
    if (!page) {
      page = await entry.context.newPage();
      entry.pages.set(key, page);
      page.once?.('close', () => { if (entry.pages.get(key) === page) entry.pages.delete(key); });
    }
    await applyDeviceProfileToPage(page, requestOptions);
    return page;
  }
  async function discardReusableCollectorPage(entry, key, page) {
    if (entry && entry.pages && entry.pages.get(key) === page) entry.pages.delete(key);
    try { await page?.close(); } catch {}
  }
  async function createEphemeralCollectorPage(entry, requestOptions = {}) {
    const page = await entry.context.newPage();
    await applyDeviceProfileToPage(page, requestOptions);
    return page;
  }
  function shouldRenderHtmlResponse(response, requestOptions = {}) {
    if (requestOptions.renderRequired === true) return true;
    if (!response || [401,403,429,503].includes(Number(response.statusCode))) return true;
    const body = String(response.body || '');
    if (!body) return true;
    const compact = body.replace(/\s+/gu, ' ').slice(0, 32_000);
    const hasUsefulDocument = /<(?:title|meta|article|main|section|li|a)\b/iu.test(compact)
      || /__NEXT_DATA__|application\/ld\+json|og:title/iu.test(compact);
    if (hasUsefulDocument) return false;
    const shellOnly = /<div[^>]+id=["'](?:root|app|__next)["'][^>]*>\s*<\/div>/iu.test(compact)
      && !/__NEXT_DATA__|application\/ld\+json|og:title/iu.test(compact);
    return body.length < 256 || shellOnly;
  }
  async function waitForProviderRender(provider, page) {
    const selector = String(provider.browserReadySelector || '').trim();
    if (!selector || !page || typeof page.waitForSelector !== 'function') return false;
    try {
      await page.waitForSelector(selector, { state:'attached', timeout:Math.min(timeoutMs, 5000) });
      return true;
    } catch { return false; }
  }
  async function applyDeviceProfileToPage(page, requestOptions = {}) {
    if (!page) return;
    const mobile = String(requestOptions.deviceProfile || '').toLowerCase() === 'mobile';
    const targetViewport = mobile ? MOBILE_VIEWPORT : viewport;
    if (typeof page.setViewportSize === 'function') await page.setViewportSize(targetViewport).catch(() => {});
    if (typeof page.setExtraHTTPHeaders === 'function') {
      await page.setExtraHTTPHeaders({
        'accept-language':'ko-KR,ko;q=0.9,en;q=0.6',
        'user-agent':mobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT
      }).catch(() => {});
    }
  }
  function detectLoginRequired(provider, finalUrl, body) {
    if (classifyUrl(provider, finalUrl) === 'auth') return true;
    let pathname = '';
    try { pathname = new URL(String(finalUrl || '')).pathname; } catch {}
    if ((provider.browserLoginPathPrefixes || []).some(prefix => pathMatchesLoginPrefix(pathname, prefix))) return true;
    const text = String(body || '');
    if (provider.id === 'builtin-kakaopage' && /로그인 후 이용해 주세요/iu.test(text)) return true;
    if (provider.id === 'builtin-naver-series' && /nidlogin|로그인이 필요합니다/iu.test(text) && !/og:title/iu.test(text)) return true;
    if (/로그인\s*(?:후|이)\s*(?:이용|필요)|로그인이\s*필요|회원\s*로그인/iu.test(text) && !/property=["']og:title["']/iu.test(text)) return true;
    return false;
  }
  function detectAgeVerificationRequired(provider, finalUrl, body) {
    if (!provider) return false;
    let pathname = '';
    try { pathname = new URL(String(finalUrl || '')).pathname; } catch {}
    let text = String(body || '');
    const compact = text.trim();
    if (compact && compact.length <= 512 * 1024 && /^[\[{]/u.test(compact)) {
      try { text += `\n${JSON.stringify(JSON.parse(compact))}`; } catch {}
    }
    if (/\/(?:adult|age|verify)(?:\/|$)/iu.test(pathname) && !/\/(?:novel|book|content)\/\d+/u.test(pathname)) return true;
    if (provider.id === 'builtin-novelpia' && /(?:src|href)\s*=\s*["'][^"']*\/img\/novel\/adult_cover_img\.jpg(?:[?#][^"']*)?["']/iu.test(text)) return true;
    if (provider.id === 'builtin-kakaopage' && /서비스 이용을 위해 연령 확인이 필요/iu.test(text)) return true;
    return /(?:성인|연령|본인)\s*(?:인증|확인)(?:이|을|가|을\s*진행해야)?\s*(?:필요|완료|진행|요구)|19세\s*이상(?:만)?\s*(?:이용|열람)(?:할\s*수\s*있|가능)|성인\s*(?:콘텐츠|작품).*?(?:인증|확인)(?:이|을|가)?\s*(?:필요|요구)/iu.test(text);
  }
  function detectAccessBlocked(provider, finalUrl, body) {
    const text = String(body || '');
    if (!text) return false;
    return /captcha|recaptcha|cf-chl-|cloudflare\s*(?:ray|challenge)|자동화된\s*요청|비정상적인\s*접근|접근(?:이|을)?\s*제한|요청이\s*차단|잠시\s*후\s*다시\s*(?:시도|이용)/iu.test(text);
  }
  function validateFinalCollectionUrl(provider, finalUrl, kind = 'request') {
    const locationType = classifyUrl(provider, finalUrl);
    if (locationType === 'auth' || detectLoginRequired(provider, finalUrl, '')) throw createError('METADATA_PLAYWRIGHT_LOGIN_REQUIRED', `${provider.name} 로그인 또는 연령 인증이 만료되었습니다.`);
    if (locationType !== 'provider') throw createError('METADATA_PLAYWRIGHT_REDIRECT_BLOCKED', 'metadata Playwright request redirected outside the provider allowlist');
    try { validateCollectionUrl(provider, finalUrl, kind); }
    catch (error) { throw createError('METADATA_PLAYWRIGHT_REDIRECT_BLOCKED', 'metadata Playwright response URL is outside the provider request allowlist', { cause:error }); }
    return finalUrl;
  }
  function responseHeaderValue(headers, name) {
    const target = String(name || '').toLowerCase();
    if (!headers || typeof headers !== 'object') return '';
    for (const [key, value] of Object.entries(headers)) {
      if (String(key).toLowerCase() !== target) continue;
      return Array.isArray(value) ? String(value[0] || '') : String(value || '');
    }
    return '';
  }
  function isRedirectStatus(statusCode) {
    return [301,302,303,307,308].includes(Number(statusCode));
  }
  function redirectMethod(statusCode, method) {
    const current = String(method || 'GET').toUpperCase();
    if (Number(statusCode) === 303 || ([301,302].includes(Number(statusCode)) && !['GET','HEAD'].includes(current))) return 'GET';
    return current;
  }
  async function browserCookieHeader(context, url) {
    if (!context || typeof context.cookies !== 'function') return '';
    const cookies = await context.cookies([url.toString()]);
    if (!Array.isArray(cookies)) return '';
    return cookies.filter(item => {
      return item && /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u.test(String(item.name || ''))
        && !/[\u0000-\u001f\u007f;]/u.test(String(item.value || ''));
    }).sort((left, right) => String(right.path || '/').length - String(left.path || '/').length)
      .map(item => `${item.name}=${item.value}`).join('; ');
  }
  async function applyResponseCookies(context, url, headers) {
    if (!context || typeof context.addCookies !== 'function') return;
    const cookies = headerValues(headers, 'set-cookie')
      .map(value => {
        try { return parseSetCookieForContext(value, url); } catch { return null; }
      })
      .filter(Boolean);
    if (!cookies.length) return;
    for (const cookie of cookies) {
      try { await context.addCookies([cookie]); }
      catch (error) {
        // Match browser behavior for malformed or public-suffix cookies: ignore
        // only that cookie without failing the provider response or its peers.
        logger.warn?.('[metadata-playwright] response cookie import warning', clean(error && error.message || error, 300));
      }
    }
  }
  async function pinnedBrowserContextRequest(context, url, method, requestHeaders, requestOptions = {}) {
    const addresses = await resolveFreshPublicAddresses(url.hostname);
    const pinned = selectPinnedAddress(addresses);
    const headers = { ...requestHeaders };
    const cookie = await browserCookieHeader(context, url);
    if (cookie) headers.cookie = cookie;
    const result = await executePinnedHttps(url, {
      method,
      headers,
      rawHeaders:true,
      timeoutMs,
      maxBytes,
      signal:requestOptions.signal || null
    }, pinned);
    if (!result || typeof result !== 'object' || !Buffer.isBuffer(result.buffer)) {
      throw createError('METADATA_PLAYWRIGHT_FETCH_FAILED', 'metadata pinned transport returned an invalid response');
    }
    await applyResponseCookies(context, url, result.headers);
    return result;
  }
  async function guardedApiRequestFetch(context, provider, initialUrl, requestOptions = {}, requestHeaders = {}) {
    let url = validateCollectionUrl(provider, initialUrl, requestOptions.kind || 'request');
    let method = String(requestOptions.method || 'GET').toUpperCase();
    const redirectLimit = 5;
    for (let redirects = 0; redirects <= redirectLimit; redirects += 1) {
      if (requestOptions.signal?.aborted) throw requestOptions.signal.reason || createError('METADATA_JOB_CANCELLED', 'metadata request cancelled');
      // Reuse the normal metadata HTTPS transport: the public DNS answer selected
      // here is installed as the socket lookup result, so APIRequestContext cannot
      // perform a second, rebinding-sensitive lookup behind context.route().
      const response = await pinnedBrowserContextRequest(context, url, method, requestHeaders, requestOptions);
      const statusCode = Number(response.statusCode) || 0;
      const headers = response.headers && typeof response.headers === 'object' ? response.headers : {};
      if (isRedirectStatus(statusCode)) {
        if (redirects >= redirectLimit) throw createError('METADATA_REDIRECT_LIMIT', 'metadata redirect limit exceeded');
        const location = responseHeaderValue(headers, 'location');
        if (!location) throw createError('METADATA_REDIRECT_INVALID', 'metadata redirect had no location');
        const redirectedUrl = new URL(location, url).toString();
        if (classifyUrl(provider, redirectedUrl) === 'auth' || detectLoginRequired(provider, redirectedUrl, '')) {
          throw createError('METADATA_PLAYWRIGHT_LOGIN_REQUIRED', `${provider.name} login is required`);
        }
        let next;
        try { next = validateCollectionUrl(provider, redirectedUrl, requestOptions.kind || 'request'); }
        catch (error) {
          throw createError('METADATA_PLAYWRIGHT_REDIRECT_BLOCKED', 'metadata Playwright response URL is outside the provider request allowlist', { cause:error });
        }
        method = redirectMethod(statusCode, method);
        url = next;
        continue;
      }
      const declared = Number(responseHeaderValue(headers, 'content-length') || 0);
      if (Number.isFinite(declared) && declared > maxBytes) throw createError('METADATA_RESPONSE_TOO_LARGE', 'metadata response exceeded byte limit');
      if (response.buffer.length > maxBytes) throw createError('METADATA_RESPONSE_TOO_LARGE', 'metadata response exceeded byte limit');
      const finalUrl = url.toString();
      validateFinalCollectionUrl(provider, finalUrl, requestOptions.kind || 'request');
      return { statusCode, headers, body:response.buffer.toString('utf8'), finalUrl };
    }
    throw createError('METADATA_REDIRECT_LIMIT', 'metadata redirect limit exceeded');
  }
  async function ensureReusablePageOrigin(entry, provider, page, originPage, requestOptions, key) {
    const target = validateInteractiveUrl(provider, originPage);
    let currentOrigin = '';
    let targetOrigin = '';
    try { currentOrigin = new URL(page.url()).origin; } catch {}
    try { targetOrigin = new URL(target).origin; } catch {}
    if (currentOrigin === targetOrigin && classifyUrl(provider, page.url()) === 'provider') return false;
    try {
      await page.goto(target, { waitUntil:'domcontentloaded', timeout:timeoutMs });
      const ready = await waitForProviderRender(provider, page);
      if (settleMs) await page.waitForTimeout(ready ? Math.min(150, settleMs) : Math.min(500, settleMs)).catch(() => {});
      return true;
    } catch (error) {
      await discardReusableCollectorPage(entry, key, page);
      throw error;
    }
  }
  async function fetchProviderSameOriginJson(entry, provider, url, requestOptions, method) {
    const originPage = String(requestOptions.referer || provider.browserHomeUrl || `${url.origin}/search`);
    const mobile = String(requestOptions.deviceProfile || '').toLowerCase() === 'mobile';
    let originKey = '';
    try { originKey = new URL(validateInteractiveUrl(provider, originPage)).origin; }
    catch (error) { throw error; }
    const pageKey = `api:${mobile ? 'mobile' : 'desktop'}:${originKey}`;
    const page = await createEphemeralCollectorPage(entry, requestOptions);
    let abortListener = null;
    try {
      if (requestOptions.signal?.aborted) throw requestOptions.signal.reason || createError('METADATA_JOB_CANCELLED', 'metadata request cancelled');
      if (requestOptions.signal) {
        abortListener = () => { void page.close().catch(() => {}); };
        requestOptions.signal.addEventListener('abort', abortListener, { once:true });
      }
      await ensureReusablePageOrigin(entry, provider, page, originPage, requestOptions, pageKey);
      const originUrl = page.url();
      const originBody = await page.locator('body').innerText({ timeout:3000 }).catch(() => '');
      if (detectAccessBlocked(provider, originUrl, originBody)) throw createError('METADATA_PROVIDER_ACCESS_BLOCKED', `${provider.name}가 자동화 요청 또는 접근을 제한했습니다.`);
      if (detectAgeVerificationRequired(provider, originUrl, originBody)) throw createError('METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED', `${provider.name} 성인·본인 인증이 필요합니다.`);
      if (detectLoginRequired(provider, originUrl, originBody)) throw createError('METADATA_PLAYWRIGHT_LOGIN_REQUIRED', `${provider.name} 로그인이 필요합니다.`);
      if (typeof page.evaluate !== 'function') return null;
      let result;
      try {
        result = await page.evaluate(async input => {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(new Error('metadata request timed out')), input.timeoutMs);
          try {
            const headers = { accept:'application/json, text/plain, */*', 'x-requested-with':'XMLHttpRequest' };
            const response = await fetch(input.url, {
              method:input.method,
              headers,
              credentials:'include',
              redirect:'follow',
              cache:'no-store',
              signal:controller.signal
            });
            const declared = Number(response.headers.get('content-length') || 0);
            if (Number.isFinite(declared) && declared > input.maxBytes) throw new Error('METADATA_RESPONSE_TOO_LARGE');
            const decoder = new TextDecoder('utf-8');
            let body = '';
            let byteLength = 0;
            if (response.body && typeof response.body.getReader === 'function') {
              const reader = response.body.getReader();
              try {
                while (true) {
                  const part = await reader.read();
                  if (part.done) break;
                  const chunk = part.value || new Uint8Array();
                  byteLength += chunk.byteLength;
                  if (byteLength > input.maxBytes) {
                    try { await reader.cancel(); } catch {}
                    throw new Error('METADATA_RESPONSE_TOO_LARGE');
                  }
                  body += decoder.decode(chunk, { stream:true });
                }
                body += decoder.decode();
              } finally {
                try { reader.releaseLock(); } catch {}
              }
            } else {
              const buffer = await response.arrayBuffer();
              byteLength = buffer.byteLength;
              if (byteLength > input.maxBytes) throw new Error('METADATA_RESPONSE_TOO_LARGE');
              body = decoder.decode(buffer);
            }
            return {
              statusCode:response.status,
              headers:Object.fromEntries(response.headers.entries()),
              body,
              finalUrl:response.url,
              byteLength
            };
          } finally {
            clearTimeout(timer);
          }
        }, { url:url.toString(), method, timeoutMs, maxBytes });
      } catch (error) {
        const message = String(error && error.message || error);
        if (/METADATA_RESPONSE_TOO_LARGE/u.test(message)) throw createError('METADATA_RESPONSE_TOO_LARGE', 'metadata response exceeded byte limit', { cause:error });
        if (/timed out|AbortError/iu.test(message)) throw createError('METADATA_TIMEOUT', 'metadata request timed out', { cause:error });
        if (requestOptions.signal?.aborted) throw requestOptions.signal.reason || createError('METADATA_JOB_CANCELLED', 'metadata request cancelled');
        throw error;
      }
      if (!result || typeof result !== 'object') throw createError('METADATA_PLAYWRIGHT_FETCH_FAILED', `${provider.name} 동일 출처 응답이 비어 있습니다.`);
      if (Number(result.byteLength) > maxBytes) throw createError('METADATA_RESPONSE_TOO_LARGE', 'metadata response exceeded byte limit');
      return {
        statusCode:Number(result.statusCode) || 0,
        headers:result.headers && typeof result.headers === 'object' ? result.headers : {},
        body:String(result.body || ''),
        finalUrl:String(result.finalUrl || url.toString())
      };
    } finally {
      if (abortListener && requestOptions.signal) requestOptions.signal.removeEventListener('abort', abortListener);
      try { await page.close(); } catch {}
    }
  }
  async function fetchProviderPageDocument(entry, provider, url, requestOptions = {}) {
    const page = await createEphemeralCollectorPage(entry, requestOptions);
    let abortListener = null;
    try {
      if (requestOptions.signal?.aborted) throw requestOptions.signal.reason || createError('METADATA_JOB_CANCELLED', 'metadata request cancelled');
      if (requestOptions.signal) {
        abortListener = () => { void page.close().catch(() => {}); };
        requestOptions.signal.addEventListener('abort', abortListener, { once:true });
      }
      const response = await page.goto(url.toString(), { waitUntil:'domcontentloaded', timeout:timeoutMs });
      const ready = await waitForProviderRender(provider, page);
      if (settleMs) await page.waitForTimeout(ready ? Math.min(150, settleMs) : Math.min(500, settleMs)).catch(() => {});
      const body = await page.content();
      if (Buffer.byteLength(body, 'utf8') > maxBytes) throw createError('METADATA_RESPONSE_TOO_LARGE', 'metadata response exceeded byte limit');
      return {
        statusCode:response ? response.status() : 200,
        headers:response ? responseHeadersObject(response) : {},
        finalUrl:page.url(),
        body
      };
    } catch (error) {
      if (requestOptions.signal?.aborted || /Target page, context or browser has been closed/iu.test(String(error && error.message || error))) {
        try { await page.close(); } catch {}
      }
      throw error;
    } finally {
      if (abortListener && requestOptions.signal) requestOptions.signal.removeEventListener('abort', abortListener);
      try { await page.close(); } catch {}
    }
  }
  async function fetchProvider(providerInput, rawUrl, requestOptions = {}) {
    const provider = providerFor(providerInput && providerInput.id);
    if (!canFetch(provider.id)) throw createError('METADATA_PLAYWRIGHT_LOGIN_REQUIRED', `${provider.name} Playwright 로그인 프로필이 준비되지 않았습니다.`);
    const url = validateCollectionUrl(provider, rawUrl, requestOptions.kind || 'request');
    return withProviderLock(provider.id, async () => {
      const entry = await getCollectorEntry(provider);
      const context = entry.context;
      const profile = String(requestOptions.profile || 'default');
      const method = String(requestOptions.method || 'GET').toUpperCase();
      let statusCode = 0;
      let headers = {};
      let body = '';
      let finalUrl = url.toString();
      try {
        if (['novelpia-json','kakaopage-json'].includes(profile) && method === 'GET') {
          const mobile = String(requestOptions.deviceProfile || '').toLowerCase() === 'mobile';
          let response = await guardedApiRequestFetch(context, provider, url, { ...requestOptions, method }, {
            'accept-language':'ko-KR,ko;q=0.9,en;q=0.6',
            'user-agent':mobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
            accept:'application/json, text/plain, */*',
            'x-requested-with':'XMLHttpRequest'
          });
          if (requestOptions.browserSameOriginRequired === true || [401,403].includes(Number(response.statusCode))) {
            const sameOrigin = await fetchProviderSameOriginJson(entry, provider, url, requestOptions, method);
            if (sameOrigin) response = sameOrigin;
          }
          statusCode = response.statusCode;
          headers = response.headers;
          body = response.body;
          finalUrl = response.finalUrl;
        } else if (profile === 'browser-json' || profile === 'kakaopage-json' || method !== 'GET') {
          const mobile = String(requestOptions.deviceProfile || '').toLowerCase() === 'mobile';
          const requestHeaders = { 'accept-language':'ko-KR,ko;q=0.9,en;q=0.6', 'user-agent':mobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT };
          if (requestOptions.referer) requestHeaders.referer = String(requestOptions.referer);
          if (profile === 'kakaopage-json') {
            requestHeaders.accept = 'application/json, text/plain, */*';
            requestHeaders['x-requested-with'] = 'XMLHttpRequest';
            requestHeaders['apollo-require-preflight'] = 'true';
            requestHeaders['x-apollo-operation-name'] = 'SearchKeyword';
          }
          const response = await guardedApiRequestFetch(context, provider, url, { ...requestOptions, method }, requestHeaders);
          statusCode = response.statusCode;
          headers = response.headers;
          body = response.body;
          finalUrl = response.finalUrl;
        } else {
          const mobile = String(requestOptions.deviceProfile || '').toLowerCase() === 'mobile';
          const requestResponse = requestOptions.renderRequired === true ? null : await guardedApiRequestFetch(context, provider, url, { ...requestOptions, method }, {
            'accept-language':'ko-KR,ko;q=0.9,en;q=0.6',
            'user-agent':mobile ? MOBILE_USER_AGENT : DESKTOP_USER_AGENT,
            accept:'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.7'
          });
          const response = shouldRenderHtmlResponse(requestResponse, requestOptions)
            ? await fetchProviderPageDocument(entry, provider, url, requestOptions)
            : requestResponse;
          statusCode = response.statusCode;
          headers = response.headers;
          body = response.body;
          finalUrl = response.finalUrl;
        }
        if (detectAccessBlocked(provider, finalUrl, body)) throw createError('METADATA_PROVIDER_ACCESS_BLOCKED', `${provider.name}가 자동화 요청 또는 접근을 제한했습니다.`);
        if (detectAgeVerificationRequired(provider, finalUrl, body)) {
          const error = createError('METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED', `${provider.name} 성인·본인 인증이 필요합니다. 로그인 프로필에서 19세 작품을 열어 인증을 완료하십시오.`);
          markVerificationRequired(provider.id, error);
          await closeCollector(provider.id);
          throw error;
        }
        if (detectLoginRequired(provider, finalUrl, body)) {
          const error = createError('METADATA_PLAYWRIGHT_LOGIN_REQUIRED', `${provider.name} 로그인이 만료되었습니다.`);
          markExpired(provider.id, error);
          await closeCollector(provider.id);
          throw error;
        }
        validateFinalCollectionUrl(provider, finalUrl, requestOptions.kind || 'request');
        if (statusCode < 200 || statusCode >= 300) throw createError('METADATA_HTTP_ERROR', `metadata request failed with HTTP ${statusCode}`, { statusCode });
        updateProviderState(provider.id, { status:'ready', lastVerifiedAt:nowIso(), lastError:'' });
         return { statusCode, headers, body, finalUrl, contentType:String(headers['content-type'] || '').toLowerCase(), pass:METADATA_PLAYWRIGHT_PROFILE_PASS, dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS, profileQuotaPass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS, lowCpuPass:METADATA_PLAYWRIGHT_LOW_CPU_PASS };
      } catch (error) {
        if (error && error.code === 'METADATA_PLAYWRIGHT_LOGIN_REQUIRED') {
          markExpired(provider.id, error);
          await closeCollector(provider.id);
          throw error;
        }
        if (error && error.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED') {
          markVerificationRequired(provider.id, error);
          await closeCollector(provider.id);
          throw error;
        }
        if (error && error.code === 'METADATA_PROVIDER_ACCESS_BLOCKED') throw error;
        throw createError(error && error.code || 'METADATA_PLAYWRIGHT_FETCH_FAILED', clean(error && error.message || error, 700), { cause:error, statusCode:error && error.statusCode });
      }
    });
  }
  async function stop() {
    if (profileMaintenanceTimer) { clearInterval(profileMaintenanceTimer); profileMaintenanceTimer = null; }
    for (const session of Array.from(sessions.values())) await closeSession(session);
    for (const providerId of Array.from(collectorContexts.keys())) await closeCollector(providerId);
    await flushState();
  }

  profileMaintenanceTimer = setInterval(() => {
    void (async () => {
      try {
        const entries = await fs.promises.readdir(profilesDir, { withFileTypes:true });
        const ids = new Set([...Object.keys(state.providers || {}), ...entries.filter(item => item.isDirectory()).map(item => item.name)]);
        for (const id of ids) {
          try { await runProfileMaintenance(id); }
          catch (error) { logger.warn?.('[metadata-playwright] scheduled profile maintenance failed', id, clean(error && error.message || error, 300)); }
        }
      } catch (error) {
        logger.warn?.('[metadata-playwright] scheduled profile directory scan failed', clean(error && error.message || error, 300));
      }
    })();
  }, profileMaintenanceIntervalMs);
  profileMaintenanceTimer.unref?.();

  return {
    describe,
    canFetch,
    startLogin,
    getLoginSession,
    screenshot,
    interact,
    finishLogin,
    cancelLogin,
    clearProfile,
    markExpired,
    markVerificationRequired,
    fetchProvider,
    runProfileMaintenance,
    flushState,
    stop,
    pass:METADATA_PLAYWRIGHT_PROFILE_PASS, dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS, profileQuotaPass:METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS, lowCpuPass:METADATA_PLAYWRIGHT_LOW_CPU_PASS
  };
}

module.exports = {
  METADATA_PLAYWRIGHT_LOW_CPU_PASS,
  METADATA_PLAYWRIGHT_PROFILE_PASS,
  METADATA_PLAYWRIGHT_DNS_PIN_PASS,
  METADATA_PLAYWRIGHT_DNS_PINNING_PASS,
  METADATA_PLAYWRIGHT_PROFILE_QUOTA_PASS,
  createMetadataPlaywrightService,
  safeDisplayUrl,
  classifyUrl,
  validateInteractiveUrl,
  profileHasData
};
