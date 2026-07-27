#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8')
  .replace('const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 1500;', 'const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 5;')
  .replace('const CLIENT_STATE_CLEANUP_INTERVAL = 32;', 'const CLIENT_STATE_CLEANUP_INTERVAL = 4;');

function createCaches() {
  const stores = new Map();
  const keyOf = request => typeof request === 'string' ? request : String(request && request.url || request);
  return {
    stores,
    async open(name) {
      if (!stores.has(name)) stores.set(name,new Map());
      const store=stores.get(name);
      return {
        async match(request){ const value=store.get(keyOf(request)); return value ? value.clone() : null; },
        async put(request,response){ store.set(keyOf(request),response.clone()); },
        async keys(){ return Array.from(store.keys()).map(url=>new Request(url)); },
        async delete(request){ return store.delete(keyOf(request)); }
      };
    },
    async keys(){ return Array.from(stores.keys()); },
    async delete(name){ return stores.delete(name); },
    async match(request, options={}){
      const names=options.cacheName ? [options.cacheName] : Array.from(stores.keys());
      for (const name of names) { const value=stores.get(name)?.get(keyOf(request)); if (value) return value.clone(); }
      return null;
    }
  };
}

(async () => {
  const listeners={};
  const clients=new Map();
  const caches=createCaches();
  const sandbox={
    console,URL,Request,Response,AbortController,DOMException,Promise,Map,Set,Date,setTimeout,clearTimeout,caches,
    fetch:async request=>new Response('<!doctype html>',{status:200,headers:{'Content-Type':'text/html','X-TXT-Reader-Build':'rebuild-v660'}}),
    self:{
      location:{origin:'https://reader.test'},
      clients:{ async matchAll(){ return Array.from(clients.values()); }, async claim(){}, async get(id){ return clients.get(id)||null; } },
      addEventListener(type,fn){ listeners[type]=fn; }, skipWaiting:async()=>{}
    }
  };
  vm.runInNewContext(source,sandbox,{filename:'sw.js'});

  async function navigate(nextId, replacesClientId='') {
    const next={id:nextId,url:'https://reader.test/library.html',postMessage(){}};
    clients.clear(); clients.set(nextId,next);
    let responsePromise;
    listeners.fetch({
      request:{method:'GET',mode:'navigate',url:'https://reader.test/library.html'},
      clientId:'',resultingClientId:nextId,replacesClientId,
      respondWith(value){ responsePromise=Promise.resolve(value); }
    });
    assert.equal((await responsePromise).status,200);
    let task=Promise.resolve();
    listeners.message({data:{type:'TXT_READER_CLIENT_BUILD_READY',build:'rebuild-v660'},source:next,waitUntil(value){task=Promise.resolve(value);}});
    await task;
    return next;
  }

  let previous='';
  for (let index=0; index<300; index += 1) {
    const current=`client-${index}`;
    await navigate(current,previous);
    previous=current;
  }
  const stateStore=caches.stores.get('txt-reader-client-build-state-v1');
  assert(stateStore, 'persistent client state cache missing');
  const response=Array.from(stateStore.values())[0];
  const payload=await response.clone().json();
  const ids=Object.keys(payload.clients || {});
  assert(ids.length <= 1, `replaced client states must not accumulate: ${ids.length}`);
  assert.equal(ids[0], 'client-299');
  assert(source.includes('const CLIENT_STATE_MAX_RECORDS = 256;'));
  assert(source.includes('event.replacesClientId'));

  console.log(JSON.stringify({ pass:'v638-service-worker-client-state-bounds-pass', navigations:300, persistedClients:ids.length, maxRecords:256 }));
})().catch(error=>{ console.error(error && error.stack || error); process.exit(1); });
