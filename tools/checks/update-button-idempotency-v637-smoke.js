#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/scripts/service-worker-register.js'), 'utf8');

function makeElementFactory(created) {
  return function createElement(tag) {
    const listeners = new Map();
    const el = {
      tag, textContent:'', disabled:false, className:'', id:'', isConnected:true, onclick:null,
      setAttribute(){}, append(){}, remove(){ this.isConnected = false; },
      addEventListener(type, fn){ const list = listeners.get(type) || []; list.push(fn); listeners.set(type, list); },
      click(){
        if (this.disabled) return;
        const event = { type:'click', target:this, currentTarget:this };
        for (const fn of listeners.get('click') || []) fn.call(this, event);
        if (typeof this.onclick === 'function') this.onclick.call(this, event);
      }
    };
    created.push(el);
    return el;
  };
}

(async () => {
  const swListeners = {};
  const created = [];
  let authorizationRequests = 0;
  let skipWaitingMessages = 0;
  const worker = { state:'installed', addEventListener(){}, postMessage(message){ if (message && message.type === 'TXT_READER_SKIP_WAITING') skipWaitingMessages += 1; } };
  const registration = { waiting:worker, installing:null, addEventListener(){}, update:async () => {} };
  const sandbox = {
    console, URL, Promise, Date, Set, Math, CustomEvent:function(){}, Headers,
    fetch:async () => {
      authorizationRequests += 1;
      return { ok:true, status:200, text:async () => JSON.stringify({ allowed:true, libraryAccessAllowed:true, metadataAccessAllowed:true }) };
    },
    location:{ protocol:'https:', hostname:'reader.test', reload(){} },
    document:{
      documentElement:{ dataset:{} }, body:{ append(node){ node.isConnected = true; } },
      createElement:makeElementFactory(created), addEventListener(){}, dispatchEvent(){}
    },
    navigator:{ serviceWorker:{
      controller:{ postMessage(){} }, register:async () => registration,
      addEventListener(type, fn){ swListeners[type] = fn; }
    } },
    window:{ addEventListener(){}, setTimeout, clearTimeout },
    globalThis:null, setTimeout, clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'service-worker-register.js' });
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await sandbox.__TXT_READER_REQUIRE_UPDATE__({ source:'idempotency-fixture', worker });
  const button = created.find(item => item.tag === 'button' && item.textContent === '업데이트 적용');
  assert(button, 'update button must be rendered');
  const before = authorizationRequests;
  button.click();
  button.click();
  if (typeof button.onclick === 'function') button.onclick({ type:'click', target:button, currentTarget:button });
  for (let i = 0; i < 30; i += 1) await Promise.resolve();
  assert.equal(authorizationRequests - before, 1, 'rapid clicks must issue one forced authorization request');
  assert.equal(skipWaitingMessages, 1, 'rapid clicks must issue one skipWaiting message');
  assert(!source.includes("primary.addEventListener('click'"), 'primary button must not combine addEventListener and onclick');
  console.log(JSON.stringify({ pass:'v637-update-button-idempotency-smoke-pass', authorizationRequests:1, skipWaitingMessages:1 }));
  process.exit(0);
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
