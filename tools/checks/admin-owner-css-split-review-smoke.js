#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const legacyPass = 'v440-admin-owner-css-split-review-pass';
const pass = 'v503-owner-css-split-pass';
const smokePass = 'v506-owner-css-residual-split-smoke-pass';
const version = 'rebuild-v564';

const adminHtml = read('public/admin/users.html');
const siteHtml = read('public/site.html');
const mobileHtml = read('public/mobile.html');
const adminCss = read('public/styles/admin-users.css');
const appCss = read('public/styles/app.css');
const ownerCss = read('public/styles/owner.css');
const ownerLoader = read('public/scripts/rebuild/features/owner-style-loader.mjs');
const syncDevtools = read('public/scripts/rebuild/features/sync-devtools.mjs');
const smokeDocs = read('docs/smoke-tests.md');
const performanceDocs = read('docs/performance-cache.md');
const releaseHistory = read('docs/release-history.md');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');

assert.ok(adminHtml.includes(`/styles/admin-users.css?v=${version}`), 'owner console must load cache-busted admin-users.css');
assert.ok(!adminHtml.includes('/styles/app.css') && !adminHtml.includes('styles/app.css'), 'owner console must not load reader app.css');
assert.ok(!adminHtml.includes('/styles/login.css') && !adminHtml.includes('/styles/entry-router.css'), 'owner console must not load unrelated entry/login CSS');
assert.ok(siteHtml.includes(`styles/app.css?v=${version}`), 'site reader shell must load cache-busted app.css');
assert.ok(mobileHtml.includes(`styles/app.css?v=${version}`), 'mobile reader shell must load cache-busted app.css');
assert.ok(!siteHtml.includes('admin-users.css') && !mobileHtml.includes('admin-users.css'), 'reader shells must not load owner/admin console CSS');
assert.ok(!siteHtml.includes('owner.css') && !mobileHtml.includes('owner.css'), 'owner tools CSS must not be part of the initial reader shell');

['.admin-nav', '.operation-grid', '.diagnostics-io-table', '.folder-picker', '.user-row'].forEach((selector) => {
  assert.ok(adminCss.includes(selector), `admin CSS must retain ${selector}`);
  assert.ok(!appCss.includes(selector), `reader app.css must not absorb admin selector ${selector}`);
});
['#content', '#novel-list', '.reader', '#safe-area-bar', '#search-nav-remote'].forEach((selector) => {
  assert.ok(appCss.includes(selector), `reader app.css must retain ${selector}`);
  assert.ok(!adminCss.includes(selector), `admin CSS must not absorb reader selector ${selector}`);
});

assert.ok(ownerCss.includes(pass), 'owner.css split marker missing');
assert.ok(ownerCss.includes('#devdbg-modal-overlay{display:none;position:fixed') && ownerCss.includes('#recovery-center-modal{display:none;position:fixed'), 'owner.css must own rich devtools/recovery modal base rules');
assert.ok(ownerCss.includes('.recovery-cache-management-panel .recovery-cache-controls'), 'owner.css must own recovery cache management layout');
assert.ok(appCss.includes('v505-owner-modal-hidden-bootstrap-pass'), 'app.css must keep the lazy owner modal hidden bootstrap guard');
assert.ok(appCss.includes('#devdbg-modal-overlay,#devdbg-modal,#recovery-center-overlay,#recovery-center-modal{display:none}'), 'app.css must hide owner tool DOM before owner.css lazy-loads');
assert.ok(appCss.includes('v506-owner-css-residual-split-pass'), 'app.css must retain the v506 residual split boundary marker');
assert.ok(ownerCss.includes('v506-owner-css-residual-split-pass'), 'owner.css must retain the v506 residual split marker');
assert.ok(!appCss.includes('#recovery-center-modal{display:none;position:fixed') && !appCss.includes('#devdbg-modal{display:none;position:fixed'), 'app.css must not keep rich owner modal positioning/layout rules');
assert.ok(!appCss.includes('.recovery-cache-management-panel .recovery-cache-controls'), 'app.css must not keep recovery cache management layout');
['.recovery-chunk-overlay{position:fixed', '.recovery-log-box{', '.recovery-trial-filterbar{', '.recovery-action-button-row{', '#devdbg-modal[data-devdbg-quality-pass] .devdbg-output{'].forEach((selector) => {
  assert.ok(!appCss.includes(selector), `app.css must not keep residual owner selector ${selector}`);
  assert.ok(ownerCss.includes(selector), `owner.css must own residual owner selector ${selector}`);
});
assert.ok(appCss.includes(pass), 'app.css must retain split boundary marker');
assert.ok(ownerLoader.includes(`const OWNER_STYLE_HREF = '/styles/owner.css?v=${version}'`), 'owner style loader must cache-bust owner.css');
assert.ok(ownerLoader.includes('ensureOwnerStylesLoaded') && ownerLoader.includes(pass), 'owner style loader must expose split loader marker');
assert.ok(syncDevtools.includes("import { ensureOwnerStylesLoaded } from './owner-style-loader.mjs';"), 'sync-devtools must import owner style loader');
assert.ok(syncDevtools.includes('await ensureOwnerStylesLoaded();\n    syncDevtoolsReportControlState(app);'), 'devtools open path must load owner.css first');
assert.ok(syncDevtools.includes('await ensureOwnerStylesLoaded();\n  return renderRecoveryCenter(app, options);'), 'recovery open path must load owner.css first');

assert.ok(!adminCss.includes(legacyPass), 'review marker must stay in docs/smoke, not in admin CSS');
assert.ok(smokeDocs.includes('admin-owner-css-split-review-smoke.js'), 'smoke docs must list CSS split review smoke');
assert.ok(performanceDocs.includes(legacyPass) && performanceDocs.includes(pass), 'performance/cache docs must record CSS split decisions');
assert.ok(releaseHistory.includes(pass), 'release history must record v503 owner CSS split marker');
assert.ok(runSmoke.includes('admin-owner-css-split-review-smoke.js'), 'run_smoke_tests must include CSS split review smoke');
assert.ok(releaseVerify.includes('admin-owner-css-split-review-smoke.js'), 'release verify must include CSS split review smoke');
console.log(JSON.stringify({ pass: smokePass, version }));
