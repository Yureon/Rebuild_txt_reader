#!/usr/bin/env node
const http = require('http');
const https = require('https');
const assert = require('assert');
const { URL } = require('url');

const PASS = 'v442-deployed-cache-header-check-pass';

function usage() {
  return [
    PASS,
    'Usage: node tools/check_deployed_cache_headers.js <base-url> [--cookie=<Cookie header>] [--version=rebuild-v500]',
    '',
    'Examples:',
    '  node tools/check_deployed_cache_headers.js https://reader.example.com --cookie="session_token=..." --version=rebuild-v500',
    '',
    'Notes:',
    '  - The script reads response headers only and never stores the cookie.',
    '  - Auth-gated reader/admin/API checks are skipped unless --cookie is supplied.',
    '  - It verifies that Cloudflare/NPM does not rewrite Cache-Control, ETag, Vary, or Content-Encoding contracts.'
  ].join('\n');
}
function parseArgs(argv) {
  const args = { baseUrl: '', cookie: '', version: 'rebuild-v500', help: false };
  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') args.help = true;
    else if (arg.startsWith('--cookie=')) args.cookie = arg.slice('--cookie='.length);
    else if (arg.startsWith('--version=')) args.version = arg.slice('--version='.length);
    else if (!arg.startsWith('--') && !args.baseUrl) args.baseUrl = arg;
    else throw new Error('Unknown argument: ' + arg);
  }
  return args;
}
function header(res, name) {
  const value = res.headers[String(name).toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}
function hasToken(headerValue, token) {
  return String(headerValue || '').toLowerCase().split(',').map(v => v.trim()).includes(String(token || '').toLowerCase());
}
function noPublicImmutable(cacheControl) {
  assert.ok(!/\bpublic\b/i.test(cacheControl), 'API/HTML must not be public cached: ' + cacheControl);
  assert.ok(!/\bimmutable\b/i.test(cacheControl), 'API/HTML must not be immutable cached: ' + cacheControl);
}
function requestHeadLike(baseUrl, requestPath, options = {}) {
  const url = new URL(requestPath, baseUrl);
  const lib = url.protocol === 'https:' ? https : http;
  const headers = Object.assign({ 'accept-encoding': options.acceptEncoding || 'identity' }, options.headers || {});
  if (options.cookie) headers.cookie = options.cookie;
  return new Promise((resolve, reject) => {
    const req = lib.request({ protocol: url.protocol, hostname: url.hostname, port: url.port || undefined, path: url.pathname + url.search, method: 'GET', headers, timeout: Number(options.timeoutMs) || 10000 }, (res) => {
      res.resume();
      res.on('end', () => resolve(res));
    });
    req.on('timeout', () => req.destroy(new Error('request timeout: ' + requestPath)));
    req.on('error', reject);
    req.end();
  });
}
function assertHtmlNoStore(label, res) {
  const cc = header(res, 'cache-control');
  assert.ok(/\bno-store\b/i.test(cc), label + ' must be no-store, got: ' + cc);
  noPublicImmutable(cc);
}
function assertApiPrivateOrNoStore(label, res) {
  const cc = header(res, 'cache-control');
  assert.ok(/\bno-store\b/i.test(cc) || (/\bprivate\b/i.test(cc) && /\bmust-revalidate\b/i.test(cc)), label + ' must be no-store or private revalidation, got: ' + cc);
  noPublicImmutable(cc);
}
function assertVersionedAsset(label, res) {
  const cc = header(res, 'cache-control');
  assert.strictEqual(cc, 'public, max-age=31536000, immutable', label + ' versioned rebuild asset cache policy');
  assert.ok(header(res, 'etag') || header(res, 'last-modified'), label + ' should expose ETag or Last-Modified');
}
function assertQuerylessRebuild(label, res) {
  const cc = header(res, 'cache-control');
  assert.strictEqual(cc, 'public, max-age=0, must-revalidate', label + ' queryless rebuild module cache policy');
  assert.ok(header(res, 'etag') || header(res, 'last-modified'), label + ' should expose ETag or Last-Modified');
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.baseUrl) { console.log(usage()); return; }
  if (!/^rebuild-v\d+$/.test(args.version)) throw new Error('--version must look like rebuild-v500');
  const baseUrl = new URL(args.baseUrl);
  const results = [];
  async function check(pathname, fn, options = {}) {
    const res = await requestHeadLike(baseUrl, pathname, Object.assign({}, options, { cookie: options.cookie === false ? '' : args.cookie }));
    fn(pathname, res);
    results.push({ path: pathname, status: res.statusCode, cacheControl: header(res, 'cache-control') });
  }
  await check('/login.html', assertHtmlNoStore, { cookie: false });
  if (args.cookie) {
    await check('/site.html', assertHtmlNoStore);
    await check('/mobile.html', assertHtmlNoStore);
    await check('/admin/users.html', assertHtmlNoStore);
    await check('/api/time', assertApiPrivateOrNoStore);
    await check('/api/novels', assertApiPrivateOrNoStore);
    await check('/scripts/rebuild/main.mjs?v=' + encodeURIComponent(args.version), assertVersionedAsset);
    await check('/scripts/rebuild/main.mjs', assertQuerylessRebuild);
    const compressed = await requestHeadLike(baseUrl, '/scripts/rebuild/main.mjs', { cookie: args.cookie, acceptEncoding: 'br, gzip' });
    assertQuerylessRebuild('/scripts/rebuild/main.mjs compressed', compressed);
    assert.ok(hasToken(header(compressed, 'vary'), 'accept-encoding'), 'compressed rebuild module must vary by Accept-Encoding');
    assert.ok(header(compressed, 'content-encoding'), 'compressed rebuild module should preserve Content-Encoding');
    results.push({ path: '/scripts/rebuild/main.mjs compressed', status: compressed.statusCode, cacheControl: header(compressed, 'cache-control'), contentEncoding: header(compressed, 'content-encoding') });
  } else {
    results.push({ skipped: 'auth-gated checks', reason: '--cookie not supplied' });
  }
  console.log(JSON.stringify({ pass: PASS, baseUrl: baseUrl.origin, version: args.version, results }, null, 2));
}
main().catch((error) => { console.error(error && error.stack || error); process.exitCode = 1; });
