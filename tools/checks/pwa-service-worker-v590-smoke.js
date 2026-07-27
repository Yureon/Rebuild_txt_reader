#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isPublicAuthPath } = require('../../server/middleware/auth');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const sw = read('public/sw.js');
for (const token of [
  `BUILD = '${CURRENT_REBUILD_VERSION}'`,
  "CACHE_PREFIX = 'txt-reader-static-'",
  "OFFLINE_URL = '/offline.html'",
  "url.pathname.startsWith('/api/')",
  "request.mode === 'navigate'",
  'networkFirstNavigation',
  'cacheFirstStatic',
  'v590-service-worker-offline-shell-pass'
]) assert.ok(sw.includes(token), `service worker token missing: ${token}`);
assert.ok(!/cache\.put\(request[^\n]+\/api\//.test(sw), 'API responses must not be cached');
assert.ok(sw.includes('!response.redirected') && sw.includes('sameResource'), 'redirected login responses must never be cached as static assets');
assert.ok(sw.includes("url.pathname.endsWith('.html')"), 'authenticated HTML must be excluded from static cache');

const register = read('public/scripts/service-worker-register.js');
assert.ok(register.includes(`WORKER_URL = '/sw-${CURRENT_REBUILD_VERSION}.js'`) && register.includes('register(WORKER_URL'));
assert.ok(!register.includes("register('/sw.js?v="), 'worker updates must not depend on CDN query-string cache keys');
assert.ok(register.includes("updateViaCache: 'none'"));
assert.ok(register.includes("protocol !== 'https:'") && register.includes("host !== 'localhost'"));

for (const rel of ['public/index.html','public/library.html','public/site.html','public/mobile.html','public/metadata.html','public/admin/users.html']) {
  assert.ok(read(rel).includes(`/service-worker-register.js?v=${CURRENT_REBUILD_VERSION}`), `${rel} missing unintercepted service worker registration`);
}
const login = read('public/login.html');
assert.ok(login.includes('service-worker-register.js'), 'login must load the build handshake runtime');
assert.ok(login.includes('data-update-ui="silent"'), 'login handshake must not render update popup UI');
for (const route of ['/sw.js','/offline.html','/scripts/service-worker-register.js']) assert.equal(isPublicAuthPath(route), true, `${route} must be publicly retrievable`);

const app = read('server/app.js');
assert.ok(app.includes("app.get('/sw.js'") && app.includes("res.setHeader('Service-Worker-Allowed', '/')"));
assert.ok(app.includes('app.get(`/sw-${BUILD_ID}.js`'), 'server must expose a build-unique worker path');
assert.ok(app.includes("app.get('/service-worker-register.js'"), 'server must expose the unintercepted update coordinator alias');
const cache = read('server/middleware/cache-policy.js');
assert.ok(cache.includes("normalizedPath.endsWith('/sw.js')") && cache.includes("Service-Worker-Allowed"));
const doc = read('docs/pwa-offline.md');
for (const token of [`txt-reader-static-${CURRENT_REBUILD_VERSION}`, 'API와 인증 HTML', 'navigation은 항상 network-first', 'v590-pwa-offline-contract-pass']) assert.ok(doc.includes(token));
console.log(JSON.stringify({ pass:'v590-pwa-service-worker-pass' }));
