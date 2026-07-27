#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function makeElementFactory(created) {
  return function element(tag) {
    const listeners = {};
    const el = {
      tag, textContent:'', disabled:false, className:'', id:'', isConnected:true, onclick:null,
      setAttribute(){}, append(){}, remove(){ this.isConnected = false; },
      addEventListener(type, fn){ listeners[type] = fn; },
      click(){ if (this.disabled) return; const event={ type:'click', target:this, currentTarget:this }; const value=listeners.click?.(event); if (typeof this.onclick === 'function') return this.onclick(event); return value; }
    };
    created.push(el);
    return el;
  };
}

async function verifyDelayedActivationStillReloads() {
  const source = read('public/scripts/service-worker-register.js');
  const swListeners = {};
  const timers = [];
  let reloads = 0;
  let skipWaitingMessages = 0;
  const worker = {
    state:'installed',
    addEventListener(){},
    postMessage(message){ if (message?.type === 'TXT_READER_SKIP_WAITING') skipWaitingMessages += 1; }
  };
  const registration = {
    waiting:worker,
    installing:null,
    addEventListener(){},
    update:async () => {}
  };
  const created = [];
  const controllerMessages = [];
  const sandbox = {
    console, URL, Promise, Date, Set, Math, CustomEvent:function(){},
    fetch:async () => ({ ok:true, status:200, text:async () => JSON.stringify({ allowed:true, libraryAccessAllowed:true, metadataAccessAllowed:true }) }),
    location:{ protocol:'https:', hostname:'reader.test', reload(){ reloads += 1; } },
    document:{
      documentElement:{ dataset:{} },
      body:{ append(node){ node.isConnected = true; } },
      createElement:makeElementFactory(created),
      addEventListener(){}, dispatchEvent(){}
    },
    navigator:{ serviceWorker:{
      controller:{ postMessage(message){ controllerMessages.push(message); } },
      register:async () => registration,
      addEventListener(type, fn){ swListeners[type] = fn; }
    } },
    window:{
      addEventListener(){},
      setTimeout(fn, delay){ const token = { fn, delay, cleared:false }; timers.push(token); return token; },
      clearTimeout(token){ if (token) token.cleared = true; }
    },
    globalThis:null,
    setTimeout(fn){ Promise.resolve().then(fn); }, clearTimeout(){}
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'service-worker-register.js' });
  await Promise.resolve(); await Promise.resolve();
  await sandbox.__TXT_READER_REQUIRE_UPDATE__({ source:'fixture-waiting', worker });
  const apply = created.find(item => item.tag === 'button' && item.textContent === '업데이트 적용');
  assert(apply, 'waiting worker must render the update button');
  apply.click();
  for (let index = 0; index < 12; index += 1) await Promise.resolve();
  assert.equal(skipWaitingMessages, 1, 'explicit apply must request skipWaiting');
  const slowTimer = timers.find(item => item.delay === 15000);
  assert(slowTimer, 'activation watchdog must be installed');
  slowTimer.fn();
  assert.equal(reloads, 0, 'slow activation warning must not reload early');
  assert.equal(apply.disabled, false, 'slow activation must permit a status retry');
  swListeners.controllerchange?.({});
  assert.equal(reloads, 1, 'late controllerchange must still reload exactly once');
  assert(controllerMessages.some(message => message?.type === 'TXT_READER_CLIENT_BUILD_READY' && message?.build === 'rebuild-v679'));
}

async function verifySecondaryTabDefersReload() {
  const source = read('public/scripts/service-worker-register.js');
  const swListeners = {};
  let reloads = 0;
  const controllerMessages = [];
  const created = [];
  const registration = { waiting:null, installing:null, addEventListener(){}, update:async () => {} };
  const sandbox = {
    console, URL, Promise, Date, Set, Math, CustomEvent:function(){},
    fetch:async () => ({ ok:true, status:200, text:async () => JSON.stringify({ allowed:true, libraryAccessAllowed:true, metadataAccessAllowed:true }) }),
    location:{ protocol:'https:', hostname:'reader.test', reload(){ reloads += 1; } },
    document:{
      documentElement:{ dataset:{} },
      body:{ append(node){ node.isConnected = true; } },
      createElement:makeElementFactory(created),
      addEventListener(){}, dispatchEvent(){}
    },
    navigator:{ serviceWorker:{
      controller:{ postMessage(message){ controllerMessages.push(message); } },
      register:async () => registration,
      addEventListener(type, fn){ swListeners[type] = fn; }
    } },
    window:{ addEventListener(){}, setTimeout, clearTimeout },
    globalThis:null, setTimeout, clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'service-worker-register.js' });
  await Promise.resolve(); await Promise.resolve();
  swListeners.message?.({ data:{ type:'TXT_READER_RELOAD_REQUIRED', activeBuild:'rebuild-v679' } });
  assert.equal(reloads, 0, 'secondary tab must not be force-reloaded by the coordinator');
  assert(controllerMessages.some(message => message?.type === 'TXT_READER_RELOAD_DEFERRED'), 'secondary tab must acknowledge deferred reload');
  const switchButton = created.find(item => item.tag === 'button' && item.textContent === '새 버전으로 전환');
  assert(switchButton, 'secondary tab must render an explicit reload action');
  switchButton.click();
  assert.equal(reloads, 1, 'secondary tab reload action must reload exactly once');
}

async function verifyWorkerStaleClientGate() {
  const source = read('public/sw.js');
  const listeners = {};
  const timers = [];
  const posted = [];
  let oldNavigations = 0;
  let deferredNavigations = 0;
  const oldClient = { id:'legacy-tab', url:'https://reader.test/library.html', postMessage(message){ posted.push({ id:this.id, message }); }, async navigate(){ oldNavigations += 1; } };
  const deferredClient = { id:'aware-tab', url:'https://reader.test/site.html', postMessage(message){ posted.push({ id:this.id, message }); }, async navigate(){ deferredNavigations += 1; } };
  const clients = new Map([[oldClient.id, oldClient], [deferredClient.id, deferredClient]]);
  const cache = { async match(){ return null; }, async put(){}, async keys(){ return []; }, async delete(){ return true; } };
  const sandbox = {
    console, URL, Request, Response, AbortController, DOMException, Date, Map, Promise,
    setTimeout(fn, delay){ const token = { fn, delay }; timers.push(token); return token; }, clearTimeout(){},
    fetch:async request => new Response('network', { status:200, headers:{ 'Content-Type':'text/javascript' } }),
    caches:{ async open(){ return cache; }, async keys(){ return []; }, async delete(){ return true; }, async match(){ return null; } },
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
  let activationPromise = null;
  listeners.activate({ waitUntil(value){ activationPromise = Promise.resolve(value); } });
  for (let i = 0; i < 50; i += 1) await Promise.resolve();
  await new Promise(resolve => setImmediate(resolve));
  assert(posted.filter(item => item.message?.type === 'TXT_READER_RELOAD_REQUIRED').length >= 2, 'activation must notify all existing tabs');
  let deferredTask = Promise.resolve();
  listeners.message({ data:{ type:'TXT_READER_RELOAD_DEFERRED', build:'rebuild-v636' }, source:deferredClient, waitUntil(value){ deferredTask = Promise.resolve(value); } });
  await deferredTask;
  const grace = timers.find(item => item.delay === 3000);
  assert(grace, 'legacy reload grace timer must be scheduled');
  grace.fn();
  await activationPromise;
  assert.equal(oldNavigations, 1, 'legacy tab without protocol support must be reloaded after grace');
  assert.equal(deferredNavigations, 0, 'aware tab that deferred reload must not be force-reloaded');

  let responsePromise = null;
  listeners.fetch({
    request:new Request('https://reader.test/scripts/rebuild/dependency.mjs'),
    clientId:deferredClient.id,
    resultingClientId:'',
    respondWith(value){ responsePromise = Promise.resolve(value); }
  });
  const blocked = await responsePromise;
  assert.equal(blocked.status, 409, 'stale aware tab must not receive executable modules from the new build');

  let readyTask = Promise.resolve();
  listeners.message({ data:{ type:'TXT_READER_CLIENT_BUILD_READY', build:'rebuild-v679' }, source:deferredClient, waitUntil(value){ readyTask = Promise.resolve(value); } });
  await readyTask;
  responsePromise = null;
  listeners.fetch({
    request:new Request('https://reader.test/scripts/rebuild/dependency.mjs'),
    clientId:deferredClient.id,
    resultingClientId:'',
    respondWith(value){ responsePromise = Promise.resolve(value); }
  });
  const ready = await responsePromise;
  assert.equal(ready.status, 200, 'fresh v636 client must leave the stale-client gate');
}

(async () => {
  await verifyDelayedActivationStillReloads();
  await verifySecondaryTabDefersReload();
  await verifyWorkerStaleClientGate();
  console.log(JSON.stringify({ pass:'v637-service-worker-update-coordination-smoke-pass', delayedActivation:true, multiTab:true, staleModuleGate:true }));
})().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
