#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

async function verifyMixedBuildFailClosed() {
  const listeners = {};
  let cacheHits = 0;
  const cache = {
    async match(){ cacheHits += 1; return new Response('cached-current'); },
    async put(){}, async keys(){ return []; }, async delete(){ return true; }
  };
  const clients = new Map([['client-1', { id:'client-1', postMessage(){} }]]);
  const sandbox = {
    console, URL, Request, Response, AbortController, DOMException, Date, Map, Set, Promise,
    setTimeout, clearTimeout,
    fetch:async () => new Response('network', { status:200, headers:{ 'X-TXT-Reader-Build':'rebuild-v679' } }),
    caches:{ async open(){ return cache; }, async keys(){ return []; }, async delete(){ return true; }, async match(){ return null; } },
    self:{
      location:{ origin:'https://reader.test' },
      clients:{ async matchAll(){ return Array.from(clients.values()); }, async claim(){}, async get(id){ return clients.get(id) || null; } },
      addEventListener(type, fn){ listeners[type] = fn; },
      skipWaiting:async () => {}
    }
  };
  vm.runInNewContext(read('public/sw.js'), sandbox, { filename:'sw.js' });
  async function run(url, clientId) {
    let promise;
    listeners.fetch({ request:new Request(url), clientId, resultingClientId:'', respondWith(value){ promise = Promise.resolve(value); } });
    return promise;
  }
  const unknown = await run('https://reader.test/scripts/rebuild/main.mjs?v=rebuild-v999', 'client-1');
  assert.equal(unknown.status, 409, 'unknown client must not receive a future-build entry');
  assert(cacheHits >= 1, 'client-state persistence must be consulted before executable access');

  let readyTask = Promise.resolve();
  listeners.message({ data:{ type:'TXT_READER_CLIENT_BUILD_READY', build:'rebuild-v679' }, source:clients.get('client-1'), waitUntil(value){ readyTask = Promise.resolve(value); } });
  await readyTask;
  const staleRequest = await run('https://reader.test/scripts/rebuild/main.mjs?v=rebuild-v636', 'client-1');
  assert.equal(staleRequest.status, 409, 'current client must not receive a stale executable build');
  const current = await run('https://reader.test/scripts/rebuild/dependency.mjs', 'client-1');
  assert.equal(await current.text(), 'cached-current', 'current handshaken client may use current queryless dependencies');
}

async function verifyUpdateActivation() {
  const source = read('public/scripts/service-worker-register.js');
  const registrationListeners = {};
  const swListeners = {};
  let updateCalls = 0;
  let postMessages = 0;
  let reloads = 0;
  const workerListeners = {};
  const worker = {
    state:'installing',
    addEventListener(type, fn){ workerListeners[type] = fn; },
    postMessage(){
      postMessages += 1;
      setTimeout(() => swListeners.controllerchange?.({}), 0);
    }
  };
  const registration = {
    waiting:null, installing:null,
    addEventListener(type, fn){ registrationListeners[type] = fn; },
    update(){
      updateCalls += 1;
      if (updateCalls === 1) return Promise.resolve();
      this.installing = worker;
      registrationListeners.updatefound?.({});
      setTimeout(() => { worker.state = 'installed'; workerListeners.statechange?.({}); }, 0);
      return Promise.resolve();
    }
  };
  const created = [];
  function element(tag) {
    const listeners = {};
    const el = {
      tag, textContent:'', disabled:false, className:'', id:'', isConnected:true, onclick:null,
      setAttribute(){}, append(){}, remove(){ this.isConnected = false; },
      addEventListener(type, fn){ listeners[type] = fn; },
      click(){ if (this.disabled) return; const event={ type:'click', target:this, currentTarget:this }; const value=listeners.click?.(event); if (typeof this.onclick === 'function') return this.onclick(event); return value; }
    };
    created.push(el); return el;
  }
  const sandbox = {
    console, URL, Promise, Date, Set, CustomEvent:function(){},
    fetch:async () => ({ ok:true, status:200, text:async () => JSON.stringify({ allowed:true, libraryAccessAllowed:true, metadataAccessAllowed:true }) }),
    location:{ protocol:'https:', hostname:'reader.test', reload(){ reloads += 1; } },
    document:{
      documentElement:{ dataset:{} },
      body:{ append(node){ node.isConnected = true; } },
      createElement:element,
      addEventListener(){}, dispatchEvent(){}
    },
    navigator:{ serviceWorker:{
      controller:{},
      register:async () => registration,
      addEventListener(type, fn){ swListeners[type] = fn; }
    } },
    window:{ addEventListener(){}, setTimeout, clearTimeout },
    globalThis:null, setTimeout, clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'service-worker-register.js' });
  await new Promise(resolve => setTimeout(resolve, 5));
  await sandbox.__TXT_READER_REQUIRE_UPDATE__({ source:'fixture' });
  const apply = created.find(item => item.tag === 'button' && item.textContent === '업데이트 적용');
  assert(apply, 'update apply button must be rendered');
  apply.click();
  await new Promise(resolve => setTimeout(resolve, 30));
  assert(updateCalls >= 2, 'button must actively check the registration for a new worker');
  assert.equal(postMessages, 1, 'installed worker must receive skip-waiting request');
  assert.equal(reloads, 1, 'controller change after explicit apply must reload exactly once');
  assert(!source.includes("showUpdateNotice({ source:'controller-changed' })"), 'controller changes must not create a false update banner');
}

(async () => {
  await verifyMixedBuildFailClosed();
  await verifyUpdateActivation();
  console.log(JSON.stringify({ pass:'v637-service-worker-update-activation-smoke-pass', mixedBuildFailClosed:true, activationReload:true }));
  process.exit(0);
})().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
