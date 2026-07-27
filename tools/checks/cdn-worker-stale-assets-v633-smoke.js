#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const {
  TXT_READER_BUILD,
  applyVersionedRebuildAssetCache,
  applyStaticCachePolicy
} = require('../../server/middleware/cache-policy');
const app = read('server/app.js');
const register = read('public/scripts/service-worker-register.js');
const sw = read('public/sw.js');
const authRoutes = read('server/routes/auth-routes.js');
const authGate = 'app.use(createAuthGate({ sessionStore, accountService }))';
const workerRoute = 'app.get(`/sw-${BUILD_ID}.js`';

assert.equal(TXT_READER_BUILD, 'rebuild-v679');
assert(app.includes(workerRoute), 'build-unique worker route is missing');
assert(app.indexOf(workerRoute) < app.indexOf(authGate), 'build-unique worker must be retrievable before auth');
assert(register.includes("WORKER_URL = '/sw-rebuild-v679.js'") && register.includes('register(WORKER_URL'), 'coordinator must register the build-unique worker path');
assert(!register.includes("register('/sw.js?v="), 'coordinator still relies on a CDN query-string cache key');
assert(authRoutes.includes('redirectTo = `/library-${BUILD_ID}.html`'), 'reader login must use a build-unique entry path');
assert(authRoutes.includes('redirectTo = `/admin/users-${BUILD_ID}.html`'), 'owner login must use a build-unique entry path');
assert(app.includes('app.get(`/library-${BUILD_ID}.html`'), 'reader recovery entry route is missing');
assert(app.includes('app.get(`/admin/users-${BUILD_ID}.html`'), 'owner recovery entry route is missing');
for (const token of ['CDN-Cache-Control','Cloudflare-CDN-Cache-Control','Surrogate-Control']) {
  assert(read('server/middleware/cache-policy.js').includes(token), `CDN no-store header missing: ${token}`);
}

function response() {
  return {
    headers:{},
    statusCode:200,
    body:'',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    getHeader(name) { return this.headers[String(name).toLowerCase()]; },
    type(value) { this.setHeader('content-type', value); },
    end(body = '') { this.body = String(body); this.ended = true; return this; }
  };
}
function staleRequest(url) {
  const res = response();
  let next = false;
  applyVersionedRebuildAssetCache({ method:'GET', url, originalUrl:url }, res, () => { next = true; });
  return { res, next };
}
const staleCss = staleRequest('/styles/app.css?v=rebuild-v628');
assert.equal(staleCss.next, true, 'stale CSS may reach the current file under no-store');
assert.equal(staleCss.res.statusCode, 200);
assert.equal(staleCss.res.getHeader('x-txt-reader-stale-build-forwarded'), '1');
applyStaticCachePolicy(staleCss.res, path.join(root, 'public/styles/app.css'));
assert(String(staleCss.res.getHeader('cache-control')).includes('no-store'));
assert.equal(staleCss.res.getHeader('cloudflare-cdn-cache-control'), 'no-store');

const staleScript = staleRequest('/scripts/rebuild/main.mjs?v=rebuild-v628');
assert.equal(staleScript.next, false, 'stale executable must not reach the current file');
assert.equal(staleScript.res.statusCode, 409);
assert.equal(staleScript.res.getHeader('x-txt-reader-reload-required'), '1');
assert(staleScript.res.body.includes('reload_required'));

const policy = read('server/middleware/cache-policy.js');
assert(policy.includes('isExecutableBuildAssetPath'), 'server must classify executable assets separately');
assert(policy.includes("error:'reload_required'"), 'server must return an explicit reload-required response');
assert(sw.includes('CLIENT_STATE_CACHE'), 'worker client-build state must be persistent');
assert(sw.includes("status:'unknown'"), 'unknown client state must be represented explicitly');
assert(sw.includes("state.status !== 'current'"), 'unknown/stale clients must be fail-closed for executable assets');
assert(!sw.includes('BUILD_BYPASS_TTL_MS'), 'runtime asset mixing bypass must be removed');

console.log(JSON.stringify({
  pass:'v637-cdn-worker-stale-assets-smoke-pass',
  workerPath:'/sw-rebuild-v679.js',
  staleNonExecutableForwarded:true
}));
