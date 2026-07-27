#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');

const files = {
  tags:fs.readFileSync('public/scripts/rebuild/features/library-user-tags.mjs','utf8'),
  rollback:fs.readFileSync('public/scripts/rebuild/features/bookmarks/read-data-rollback.mjs','utf8'),
  controls:fs.readFileSync('public/scripts/rebuild/features/library-install-controls-runtime.mjs','utf8'),
  adminMetadata:fs.readFileSync('public/scripts/admin/metadata.mjs','utf8'),
  sw:fs.readFileSync('public/scripts/service-worker-register.js','utf8'),
  css:fs.readFileSync('public/styles/app.css','utf8')
};

assert.ok(files.tags.includes('preserveScroll:true'), 'user-tag save must preserve shelf scroll');
assert.ok(files.tags.includes('resetScroll:false, scrollAnchor'), 'user-tag save must preserve catalog anchor');
assert.ok(files.rollback.includes('preserveScroll:true'), 'read-data restore must preserve shelf scroll');
assert.ok(files.rollback.includes('resetScroll:false, scrollAnchor'), 'read-data restore must preserve catalog anchor');
assert.ok(files.controls.includes("source:'expand-all', scrollAnchor"), 'expand-all must preserve the current anchor');
assert.ok(files.controls.includes("source:'collapse-all', scrollAnchor"), 'collapse-all must preserve the current anchor');
assert.ok(!/source:'(?:expand|collapse)-all'[^\n]*resetScroll:true/.test(files.controls), 'expand/collapse must not force the list to the top');

for (const token of ['captureProviderListView','restoreProviderListView','providerReturnFocus','preventScroll:true']) {
  assert.ok(files.adminMetadata.includes(token), `provider settings view/focus token missing: ${token}`);
}

assert.ok(files.sw.includes("var PASS = 'v638-service-worker-update-coordination-pass'"), 'service-worker approved-update marker missing');
assert.ok(files.sw.includes('업데이트 적용'), 'explicit service-worker reload action missing');
assert.ok(files.sw.includes("dismiss.textContent = '나중에'"), 'deferred update action missing');
assert.ok(files.sw.includes('activationAttempt') && files.sw.includes('scheduleReload') && files.sw.includes('location.reload();'), 'controller reload must remain gated by an activation attempt');
assert.ok(files.sw.includes("controllerchange") && files.sw.includes('if (activationAttempt)'), 'controller reload must remain gated by explicit apply');
assert.ok(files.sw.includes('__TXT_READER_REQUIRE_UPDATE__'), 'build mismatch must surface the update notice instead of reloading');
assert.ok(files.css.includes('.txt-reader-update-banner'), 'service-worker update banner styles missing');

console.log(JSON.stringify({ pass:'v616-ui-disruption-guard-pass' }));
