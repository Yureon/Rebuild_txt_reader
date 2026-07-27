#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const version = JSON.parse(fs.readFileSync(path.join(root, 'public/version.json'), 'utf8'));
const buildId = String(version && version.buildId || '');
assert(/^rebuild-v\d+$/.test(buildId), 'public/version.json must provide a valid buildId');
const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')
  .replace('const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 1500;', 'const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 5;');
assert(source.includes(`const BUILD = '${buildId}';`), 'Service Worker BUILD must match public/version.json');
const PASS = 'v674-service-worker-navigation-state-best-effort-pass';

function createFailingCaches(failure) {
  let openCalls = 0;
  let putCalls = 0;
  return {
    get openCalls() { return openCalls; },
    get putCalls() { return putCalls; },
    async open() {
      openCalls += 1;
      if (failure === 'open') {
        throw Object.assign(new Error('cache storage unavailable'), { name:'InvalidStateError' });
      }
      return {
        async match() { return null; },
        async put() {
          putCalls += 1;
          if (failure === 'put' || failure === 'quota') {
            const quota = failure === 'quota';
            throw Object.assign(
              new Error(quota ? 'cache quota full' : 'cache write unavailable'),
              { name:quota ? 'QuotaExceededError' : 'InvalidStateError' }
            );
          }
        },
        async keys() { return []; },
        async delete() { return false; }
      };
    },
    async keys() { return []; },
    async delete() { return false; },
    async match() { return null; }
  };
}

function boot(failure) {
  const listeners = {};
  const caches = createFailingCaches(failure);
  const sandbox = {
    console, URL, Request, Response, AbortController, DOMException, Promise, Map, Set, Date,
    setTimeout, clearTimeout, caches,
    fetch:async () => new Response('<!doctype html>', {
      status:200,
       headers:{
         'Content-Type':'text/html; charset=utf-8',
         'X-TXT-Reader-Build':buildId
       }
     }),
    self:{
      location:{ origin:'https://reader.test' },
      clients:{
        async matchAll() { return []; },
        async claim() {},
        async get() { return null; }
      },
      addEventListener(type, handler) { listeners[type] = handler; },
      skipWaiting:async () => {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename:'sw.js' });
  return { listeners, caches };
}

async function navigate(listeners, clientId) {
  let responsePromise = null;
  let lifetimePromise = Promise.resolve(null);
  listeners.fetch({
    request:{ method:'GET', mode:'navigate', url:'https://reader.test/library.html' },
    clientId:'',
    resultingClientId:clientId,
    replacesClientId:'',
    respondWith(value) { responsePromise = Promise.resolve(value); },
    waitUntil(value) { lifetimePromise = Promise.resolve(value); }
  });
  assert(responsePromise, 'navigation request must be intercepted');
  const response = await responsePromise;
  const lifetime = await lifetimePromise;
  return { response, lifetime };
}

async function fetchExecutable(listeners, clientId) {
  let responsePromise = null;
  listeners.fetch({
    request:new Request(`https://reader.test/scripts/rebuild/main.mjs?v=${encodeURIComponent(buildId)}`),
    clientId,
    resultingClientId:'',
    respondWith(value) { responsePromise = Promise.resolve(value); }
  });
  assert(responsePromise, 'executable request must be intercepted');
  return responsePromise;
}

(async () => {
  const results = [];
  for (const failure of ['open', 'put', 'quota']) {
    const runtime = boot(failure);
    const navigation = await navigate(runtime.listeners, `client-${failure}`);
    assert.equal(navigation.response.status, 200, `${failure} failure must not reject a valid navigation`);
    assert.equal(navigation.lifetime?.ok, false, `${failure} failure must be reported as best-effort state persistence failure`);
    assert.equal(navigation.lifetime?.pass, PASS);
    assert.equal((await fetchExecutable(runtime.listeners, `client-${failure}`)).status, 409, 'navigation must remain fail-closed until the client handshake');
    assert(runtime.caches.openCalls >= 1, `${failure} scenario must exercise CacheStorage.open`);
    if (failure !== 'open') assert.equal(runtime.caches.putCalls, 1, `${failure} scenario must exercise the failing cache write`);
    results.push({
      failure,
      navigationStatus:navigation.response.status,
      statePersisted:navigation.lifetime.ok,
      executableBeforeHandshake:409,
      openCalls:runtime.caches.openCalls,
      putCalls:runtime.caches.putCalls
    });
  }
  assert(source.includes(PASS), 'Service Worker best-effort navigation state marker missing');
  console.log(JSON.stringify({ pass:'v674-service-worker-navigation-state-failure-smoke-pass', results }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
