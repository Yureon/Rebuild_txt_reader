#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const register = read('public/scripts/service-worker-register.js');
const current = require('./current-rebuild-version.js');
const build = current.CURRENT_REBUILD_VERSION;
const coordinator = `<script data-cfasync="false" src="/service-worker-register.js?v=${build}"></script>`;
const pages = new Map([
  ['public/index.html', `/scripts/entry-router.js?v=${build}`],
  ['public/library.html', `scripts/rebuild/library-page.mjs?v=${build}`],
  ['public/site.html', `scripts/rebuild/site.mjs?v=${build}`],
  ['public/mobile.html', `scripts/rebuild/mobile.mjs?v=${build}`],
  ['public/metadata.html', `/scripts/rebuild/metadata-page.mjs?v=${build}`],
  ['public/admin/users.html', `/scripts/admin/core.js?v=${build}`]
]);

assert(register.includes("startRegistration().catch(function () {});"), 'worker registration must start immediately');
assert(!register.includes("window.addEventListener('load', function () {\n    navigator.serviceWorker.register"), 'registration must not wait for a load event that Rocket Loader may have missed');
assert(register.includes("requestWorkerActivation();"), 'apply button must wait for or activate the registered worker');
assert(register.includes('waitForInstalledWorker') && register.includes('registration.update()'), 'apply must explicitly ask the registration to update and await installation');
assert(!register.includes('// There is no waiting worker to activate.'), 'no-worker apply must not fall back to a reload loop');

for (const [rel, entrypoint] of pages) {
  const html = read(rel);
  assert.equal(html.split(coordinator).length - 1, 1, `${rel} must load exactly one Cloudflare-safe coordinator`);
  assert(html.indexOf(coordinator) < html.indexOf(entrypoint), `${rel} coordinator must execute before its app entrypoint`);
  const headEnd = html.indexOf('</head>');
  assert(html.indexOf(coordinator) < headEnd, `${rel} coordinator must execute from the document head`);
}
for (const rel of ['public/index.html','public/library.html','public/site.html','public/mobile.html','public/metadata.html']) {
  const html = read(rel);
  assert(html.indexOf(coordinator) < html.indexOf(`/scripts/theme-boot.js?v=${build}`), `${rel} coordinator must precede the old-worker-intercepted theme boot`);
}
for (const [rel] of pages) {
  const appScripts = [...read(rel).matchAll(/<script\b[^>]+\bsrc=["'][^"']+["'][^>]*>/g)].map(match => match[0]);
  assert(appScripts.every(tag => tag.includes('data-cfasync="false"')), `${rel} contains a Rocket Loader-transformable app script`);
}

let registerCalls = 0;
let loadListenerCalls = 0;
const registration = {
  waiting:null,
  installing:null,
  addEventListener() {},
  update() { return Promise.resolve(); }
};
const sandbox = {
  console,
  URL,
  Promise,
  Date,
  CustomEvent:function () {},
  globalThis:null,
  location:{ protocol:'https:', hostname:'reader.test', reload() {} },
  document:{
    documentElement:{ dataset:{} },
    addEventListener() {}
  },
  navigator:{
    serviceWorker:{
      controller:{},
      addEventListener() {},
      register() {
        registerCalls += 1;
        return Promise.resolve(registration);
      }
    }
  },
  window:{
    addEventListener(type) {
      if (type === 'load') loadListenerCalls += 1;
    },
    setTimeout() { return 1; }
  }
};
sandbox.globalThis = sandbox;
vm.runInNewContext(register, sandbox, { filename:'service-worker-register.js' });
setImmediate(() => {
  assert.equal(registerCalls, 1, 'registration must run even when window.load already fired');
  assert.equal(loadListenerCalls, 0, 'registration must not depend on a future load event');
  console.log(JSON.stringify({ pass:'v632-service-worker-cloudflare-recovery-smoke-pass', pages:pages.size, immediateRegister:true }));
});
