#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')
  .replace('const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 1500;', 'const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 25;');

function createSharedCaches() {
  const stores = new Map();
  function keyOf(request) { return typeof request === 'string' ? request : String(request && request.url || request); }
  return {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map());
      const store = stores.get(name);
      return {
        async match(request) { const value = store.get(keyOf(request)); return value ? value.clone() : null; },
        async put(request, response) { store.set(keyOf(request), response.clone()); },
        async keys() { return Array.from(store.keys()).map(url => new Request(url)); },
        async delete(request) { return store.delete(keyOf(request)); }
      };
    },
    async keys() { return Array.from(stores.keys()); },
    async delete(name) { return stores.delete(name); },
    async match(request, options = {}) {
      if (options.cacheName && stores.has(options.cacheName)) {
        const value = stores.get(options.cacheName).get(keyOf(request));
        return value ? value.clone() : null;
      }
      for (const store of stores.values()) {
        const value = store.get(keyOf(request));
        if (value) return value.clone();
      }
      return null;
    }
  };
}

function boot(sharedCaches, clients, nowRef) {
  const listeners = {};
  const posted = [];
  const sandbox = {
    console, URL, Request, Response, AbortController, DOMException, Promise, Map, Set,
    Date:class extends Date { static now(){ return nowRef.value; } },
    setTimeout, clearTimeout,
    fetch:async request => new Response('network:' + String(request.url || request), {
      status:200,
      headers:{ 'Content-Type':'text/javascript', 'X-TXT-Reader-Build':'rebuild-v679' }
    }),
    caches:sharedCaches,
    self:{
      location:{ origin:'https://reader.test' },
      clients:{
        async matchAll(){ return Array.from(clients.values()); },
        async claim(){},
        async get(id){ return clients.get(id) || null; }
      },
      addEventListener(type, fn){ listeners[type] = fn; },
      skipWaiting:async () => {}
    }
  };
  vm.runInNewContext(source, sandbox, { filename:'sw.js' });
  for (const client of clients.values()) {
    const original = client.postMessage;
    client.postMessage = function(message) { posted.push({ id:this.id, message }); return original && original.call(this, message); };
  }
  return { listeners, posted };
}

async function dispatchMessage(listeners, data, source) {
  let task = Promise.resolve();
  listeners.message({ data, source, waitUntil(value){ task = Promise.resolve(value); } });
  await task;
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}


async function fetchNavigation(listeners, clientId, url) {
  let responsePromise;
  listeners.fetch({
    request:{ method:'GET', mode:'navigate', url },
    clientId:'', resultingClientId:clientId,
    respondWith(value){ responsePromise = Promise.resolve(value); }
  });
  assert(responsePromise, 'navigation request must be intercepted');
  return responsePromise;
}

async function fetchStatic(listeners, clientId, url) {
  let responsePromise;
  listeners.fetch({
    request:new Request(url), clientId, resultingClientId:'',
    respondWith(value){ responsePromise = Promise.resolve(value); }
  });
  assert(responsePromise, 'static request must be intercepted');
  return responsePromise;
}

(async () => {
  const sharedCaches = createSharedCaches();
  const nowRef = { value:Date.UTC(2026, 6, 24, 0, 0, 0) };
  const staleClient = { id:'stale-tab', url:'https://reader.test/site.html', postMessage(){} };
  const currentClient = { id:'current-tab', url:'https://reader.test/library.html', postMessage(){} };
  const clients = new Map([[staleClient.id, staleClient], [currentClient.id, currentClient]]);

  const first = boot(sharedCaches, clients, nowRef);
  const navigation = await fetchNavigation(first.listeners, currentClient.id, 'https://reader.test/library.html');
  assert.equal(navigation.status, 200, 'current HTML navigation must succeed');
  const gatedBeforeHandshake = fetchStatic(first.listeners, currentClient.id, 'https://reader.test/scripts/rebuild/core/api.mjs?v=rebuild-v679');
  await new Promise(resolve => setTimeout(resolve, 1));
  await dispatchMessage(first.listeners, { type:'TXT_READER_CLIENT_BUILD_READY', build:'rebuild-v679' }, currentClient);
  assert.equal((await gatedBeforeHandshake).status, 200, 'held executable request may proceed only after READY handshake');
  let response = await fetchStatic(first.listeners, currentClient.id, 'https://reader.test/scripts/rebuild/core/api.mjs?v=rebuild-v679');
  assert.equal(response.status, 200, 'handshaken current client must receive current executable assets');

  await dispatchMessage(first.listeners, { type:'TXT_READER_RELOAD_DEFERRED', build:'rebuild-v636' }, staleClient);
  response = await fetchStatic(first.listeners, staleClient.id, 'https://reader.test/scripts/rebuild/features/reader.mjs');
  assert.equal(response.status, 409, 'deferred stale client must be fail-closed');

  const noHandshakeClient = { id:'no-handshake-tab', url:'https://reader.test/site.html', postMessage(){} };
  clients.set(noHandshakeClient.id, noHandshakeClient);
  assert.equal((await fetchNavigation(first.listeners, noHandshakeClient.id, noHandshakeClient.url)).status, 200);
  response = await fetchStatic(first.listeners, noHandshakeClient.id, 'https://reader.test/scripts/rebuild/site.mjs?v=rebuild-v679');
  assert.equal(response.status, 409, 'navigation build header alone must not make the client current');

  nowRef.value += 31 * 60 * 1000;
  response = await fetchStatic(first.listeners, staleClient.id, 'https://reader.test/scripts/rebuild/features/reader.mjs');
  assert.equal(response.status, 409, 'elapsed time must not promote a deferred client to fresh');

  const restarted = boot(sharedCaches, clients, nowRef);
  response = await fetchStatic(restarted.listeners, staleClient.id, 'https://reader.test/scripts/rebuild/features/reader.mjs');
  assert.equal(response.status, 409, 'stale state must survive Service Worker restart');

  response = await fetchStatic(restarted.listeners, 'unknown-tab', 'https://reader.test/scripts/rebuild/core/utils.mjs');
  assert.equal(response.status, 409, 'unknown client executable requests must be fail-closed');

  await dispatchMessage(restarted.listeners, { type:'TXT_READER_CLIENT_BUILD_READY', build:'rebuild-v679' }, staleClient);
  response = await fetchStatic(restarted.listeners, staleClient.id, 'https://reader.test/scripts/rebuild/features/reader.mjs');
  assert.equal(response.status, 200, 'only a current-build handshake may return a client to fresh');

  const css = await fetchStatic(restarted.listeners, 'unknown-tab', 'https://reader.test/styles/app.css?v=rebuild-v636');
  assert.equal(css.status, 200, 'non-executable assets may use the separate transition policy');

  console.log(JSON.stringify({
    pass:'v637-service-worker-client-state-smoke-pass',
    restartPersistent:true,
    unknownFailClosed:true,
    ttlNoPromotion:true,
    handshakeRequired:true
  }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
