#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const PASS = 'v507-css-html-boundary-contract-smoke-pass';
const version = 'rebuild-v679';
const appCss = read('public/styles/app.css');
const deferredCss = read('public/styles/deferred-ui.css');
const adminCss = read('public/styles/admin-users.css');
const ownerCss = read('public/styles/owner.css');
const libraryHtml = read('public/library.html');
const siteHtml = read('public/site.html');
const mobileHtml = read('public/mobile.html');
const adminHtml = read('public/admin/users.html');
const ownerLoader = read('public/scripts/rebuild/features/owner-style-loader.mjs');
const docs = read('docs/performance-cache.md') + '\n' + read('docs/handoff.md') + '\n' + read('docs/next-session-handoff-prompt.md');
const runner = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
assert.ok(docs.includes('v507-css-html-boundary-contract-pass'), 'handoff/performance docs must record v507 HTML/page CSS boundary contract');
assert.ok(docs.includes('reader/safe-area/slider/progress CSS'), 'docs must explicitly keep reader-sensitive CSS in app.css');
assert.ok(libraryHtml.includes(`styles/app.css?v=${version}`), 'library.html must load app.css with current cachebuster');
assert.ok(siteHtml.includes(`styles/app.css?v=${version}`), 'site.html must load app.css with current cachebuster');
assert.ok(mobileHtml.includes(`styles/app.css?v=${version}`), 'mobile.html must load app.css with current cachebuster');
assert.ok(!libraryHtml.includes('admin-users.css') && !siteHtml.includes('admin-users.css') && !mobileHtml.includes('admin-users.css'), 'reader shells must not load admin-users.css');
assert.ok(!libraryHtml.includes('owner.css') && !siteHtml.includes('owner.css') && !mobileHtml.includes('owner.css'), 'reader shells must not eagerly load owner.css');
assert.ok(adminHtml.includes(`/styles/admin-users.css?v=${version}`), 'admin users page must load admin-users.css with current cachebuster');
assert.ok(!adminHtml.includes('/styles/app.css') && !adminHtml.includes('styles/app.css'), 'admin users page must not load reader app.css');
assert.ok(ownerLoader.includes(`const OWNER_STYLE_HREF = '/styles/owner.css?v=${version}'`), 'owner fragment CSS must be lazy-loaded with current cachebuster');
assert.ok(appCss.includes('v505-owner-modal-hidden-bootstrap-pass'), 'app.css must keep only owner modal hidden bootstrap for initial fragment DOM');
assert.ok(deferredCss.includes('#devdbg-modal-overlay,#devdbg-modal,#recovery-center-overlay,#recovery-center-modal{display:none}'), 'deferred-ui.css must hide deferred owner tool DOM before lazy owner.css');
['#content', '#novel-list', '.reader', '#safe-area-bar', '#nav-slider'].forEach(selector => {
  assert.ok(appCss.includes(selector), `app.css must retain reader-sensitive selector ${selector}`);
});
assert.ok(deferredCss.includes('#nsearch-panel'), 'deferred-ui.css must own the deferred search shell selector');
['.user-workbench-tabs', '.user-create-card', '.user-list-card', '.user-edit-card', '.operation-grid'].forEach(selector => {
  assert.ok(adminCss.includes(selector), `admin-users.css must retain admin page selector ${selector}`);
  assert.ok(!appCss.includes(selector) && !deferredCss.includes(selector), `reader UI CSS must not absorb admin selector ${selector}`);
});
['#devdbg-modal{display:none;position:fixed', '#recovery-center-modal{display:none;position:fixed', '.recovery-cache-management-panel .recovery-cache-controls'].forEach(selector => {
  assert.ok(ownerCss.includes(selector), `owner.css must own owner fragment selector ${selector}`);
  assert.ok(!appCss.includes(selector) && !deferredCss.includes(selector), `core/deferred UI CSS must not own rich owner selector ${selector}`);
});
assert.ok(runner.includes("nodeCmd('tools/checks/css-html-boundary-contract-smoke.js')"), 'smoke runner must include CSS boundary contract smoke');
assert.ok(releaseVerify.includes("'tools/checks/css-html-boundary-contract-smoke.js'"), 'release verify must include CSS boundary contract smoke');
console.log(JSON.stringify({ pass: PASS, version }));
