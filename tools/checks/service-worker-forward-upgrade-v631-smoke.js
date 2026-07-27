#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('server/app.js');
const sw = read('public/sw.js');
const register = read('public/scripts/service-worker-register.js');
const current = require('./current-rebuild-version.js');
const build = current.CURRENT_REBUILD_VERSION;
const aliasRoute = "app.get('/service-worker-register.js'";
const authGate = 'app.use(createAuthGate({ sessionStore, accountService }))';

assert(app.includes(aliasRoute), 'unintercepted update coordinator alias is missing');
assert(app.indexOf(aliasRoute) < app.indexOf(authGate), 'update coordinator alias must be available before the auth gate');
assert(sw.includes("if (isStaticAsset(url)) event.respondWith(cacheFirstStatic(request, event.clientId || event.resultingClientId || ''));"));
assert(!sw.includes("url.pathname === '/service-worker-register.js'"), 'the active worker must not intercept its update coordinator');
const pageEntrypoints = new Map([
  ['public/index.html', `/scripts/entry-router.js?v=${build}`],
  ['public/library.html', `type="module" src="scripts/rebuild/library-page.mjs?v=${build}"`],
  ['public/site.html', `type="module" src="scripts/rebuild/site.mjs?v=${build}"`],
  ['public/mobile.html', `type="module" src="scripts/rebuild/mobile.mjs?v=${build}"`],
  ['public/metadata.html', `type="module" src="/scripts/rebuild/metadata-page.mjs?v=${build}"`],
  ['public/admin/users.html', `/scripts/admin/core.js?v=${build}`]
]);
for (const [rel, appEntrypoint] of pageEntrypoints) {
  const html = read(rel);
  const coordinator = `/service-worker-register.js?v=${build}`;
  assert(html.includes(coordinator), `${rel} must use the unintercepted update coordinator`);
  assert(!html.includes('/scripts/service-worker-register.js?v='), `${rel} still uses the worker-intercepted coordinator path`);
  assert(html.indexOf(coordinator) < html.indexOf(appEntrypoint), `${rel} must install the update coordinator before its app entrypoint`);
}
for (const token of ['/api/system-update/authorization','authorizeSystemUpdate(true)','TXT_READER_SYSTEM_UPDATE_DENIED']) {
  assert(register.includes(token), `dual-permission update gate missing: ${token}`);
}
console.log(JSON.stringify({ pass:'v631-service-worker-forward-upgrade-smoke-pass', alias:'/service-worker-register.js' }));
