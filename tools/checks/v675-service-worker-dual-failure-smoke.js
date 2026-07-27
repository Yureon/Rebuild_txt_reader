#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/sw.js'), 'utf8');
const listeners = {};
const sandbox = {
  console, URL, Request, Response, AbortController, DOMException, Promise, Map, Set, Date, setTimeout, clearTimeout,
  fetch:async () => { throw new TypeError('network down'); },
  caches:{ async match(){ throw new Error('cache storage failed'); }, async open(){ return { async match(){return null}, async put(){}, async keys(){return[]}, async delete(){return false} }; }, async keys(){return[]}, async delete(){return false} },
  self:{ location:{origin:'https://reader.test'}, clients:{async matchAll(){return[]},async claim(){},async get(){return null}}, addEventListener(type,handler){listeners[type]=handler}, skipWaiting:async()=>{} }
};
vm.runInNewContext(source, sandbox, { filename:'sw.js' });
let responsePromise;
listeners.fetch({ request:{method:'GET',mode:'navigate',url:'https://reader.test/library.html'}, clientId:'', resultingClientId:'dual-failure', replacesClientId:'', respondWith(value){responsePromise=Promise.resolve(value)}, waitUntil(){} });
(async()=>{
  const response = await responsePromise;
  assert.equal(response.status,503);
  assert.equal(response.headers.get('X-TXT-Reader-Offline-Fallback'),'v675-offline-dual-failure-pass');
  assert.match(await response.text(),/오프라인/);
  console.log(JSON.stringify({ pass:'v675-service-worker-dual-failure-smoke-pass', status:503, networkFailed:true, cacheMatchFailed:true }));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
