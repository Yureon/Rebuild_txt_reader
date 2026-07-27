#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '../..');
const source = fs.readFileSync(path.join(root, 'public/scripts/service-worker-register.js'), 'utf8');
const login = fs.readFileSync(path.join(root, 'public/login.html'), 'utf8');

(async () => {
  let fetchCalls = 0;
  let registerCalls = 0;
  let createdElements = 0;
  const messages = [];
  const swListeners = {};
  const registration = { waiting:null, installing:null, addEventListener(){}, update:async () => {} };
  const sandbox = {
    console, URL, Promise, Date, Set, Math, Headers,
    CustomEvent:function(){},
    fetch:async () => { fetchCalls += 1; throw new Error('silent login handshake must not authorize updates'); },
    location:{ protocol:'https:', hostname:'reader.test', reload(){} },
    document:{
      currentScript:{ dataset:{ updateUi:'silent' } },
      documentElement:{ dataset:{} },
      body:{ append(){ throw new Error('silent mode must not append an update banner'); } },
      createElement(){ createdElements += 1; throw new Error('silent mode must not create update UI'); },
      addEventListener(){}, dispatchEvent(){}
    },
    navigator:{ serviceWorker:{
      controller:{ postMessage(message){ messages.push(message); } },
      async register(){ registerCalls += 1; return registration; },
      addEventListener(type,fn){ swListeners[type] = fn; }
    } },
    window:{ addEventListener(){}, setTimeout, clearTimeout },
    globalThis:null, setTimeout, clearTimeout
  };
  sandbox.globalThis = sandbox;
  vm.runInNewContext(source, sandbox, { filename:'service-worker-register.js' });
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  await sandbox.__TXT_READER_REQUIRE_UPDATE__({ source:'login-silent-fixture' });
  for (let i = 0; i < 8; i += 1) await Promise.resolve();

  assert.equal(registerCalls, 1, 'login page must register/attach the coordinator');
  assert(messages.some(message => message && message.type === 'TXT_READER_CLIENT_BUILD_READY' && message.build === 'rebuild-v679'), 'login page must announce the current build');
  assert.equal(fetchCalls, 0, 'silent mode must not call update authorization');
  assert.equal(createdElements, 0, 'silent mode must not create a banner');
  assert.equal(sandbox.document.documentElement.dataset.serviceWorkerUi, 'silent');
  const coordinatorAt = login.indexOf('data-update-ui="silent"');
  const themeAt = login.indexOf('/scripts/theme-boot.js');
  const loginScriptAt = login.indexOf('/scripts/login.js');
  assert(coordinatorAt >= 0 && coordinatorAt < themeAt && themeAt < loginScriptAt, 'silent coordinator must run before login executables');

  console.log(JSON.stringify({ pass:'v638-login-silent-handshake-pass', ready:true, authorizationCalls:0, updateUi:false }));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
