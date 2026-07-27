#!/usr/bin/env node
'use strict';
const assert = require('assert');
const {
  TXT_READER_BUILD,
  applyVersionedRebuildAssetCache,
  isExecutableBuildAssetPath
} = require('../../server/middleware/cache-policy');

function response() {
  return {
    statusCode:200, headers:{}, body:'',
    setHeader(name, value){ this.headers[String(name).toLowerCase()] = String(value); },
    getHeader(name){ return this.headers[String(name).toLowerCase()]; },
    status(code){ this.statusCode = code; return this; },
    end(body=''){ this.body = String(body || ''); this.ended = true; return this; }
  };
}
function request(url){ return { method:'GET', originalUrl:url, url }; }
function run(url) {
  const res = response(); let next = 0;
  applyVersionedRebuildAssetCache(request(url), res, () => { next += 1; });
  return { res, next };
}

assert.equal(TXT_READER_BUILD, 'rebuild-v679');
for (const url of [
  '/scripts/rebuild/site.mjs?v=rebuild-v636',
  '/scripts/search-worker.js?v=rebuild-v636',
  '/fragments/deferred-ui.html?v=rebuild-v636',
  '/scripts/decoder.wasm?v=rebuild-v636'
]) {
  const { res, next } = run(url);
  assert.equal(res.statusCode, 409, `${url} must require reload`);
  assert.equal(next, 0, `${url} must not reach current static file`);
  assert.equal(res.getHeader('x-txt-reader-reload-required'), '1');
  assert(res.body.includes('reload_required'));
}
const staleCss = run('/styles/app.css?v=rebuild-v636');
assert.equal(staleCss.next, 1, 'stale non-executable CSS may be forwarded separately');
assert.equal(staleCss.res.getHeader('x-txt-reader-stale-build-forwarded'), '1');
assert(String(staleCss.res.getHeader('cache-control')).includes('no-store'));
const currentJs = run('/scripts/rebuild/site.mjs?v=rebuild-v679');
assert.equal(currentJs.next, 1);
assert(String(currentJs.res.getHeader('cache-control')).includes('immutable'));
assert(isExecutableBuildAssetPath('/fragments/deferred-ui.html'));
assert(isExecutableBuildAssetPath('/scripts/runtime.wasm'));
console.log(JSON.stringify({ pass:'v637-stale-executable-policy-smoke-pass', serviceWorkerAbsentSafe:true, staleHtmlSafe:true }));
