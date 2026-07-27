#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const path = require('path');
const root = path.join(__dirname, '../..');
const PASS = 'v568-lazy-feature-loading-smoke-pass';
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const main = read('public/scripts/rebuild/main.mjs');
const lazy = read('public/scripts/rebuild/features/lazy-features.mjs');
const periodic = read('public/scripts/rebuild/features/sync/periodic-device-sync.mjs');
const library = read('public/library.html');
const site = read('public/site.html');
const mobile = read('public/mobile.html');
for (const forbidden of [
  "from './features/reader.mjs'",
  "from './features/search.mjs'",
  "from './features/bookmarks.mjs'",
  "from './features/theme-settings.mjs'",
  "from './features/sync-devtools.mjs'"
]) assert.ok(!main.includes(forbidden), `main boot must not statically import ${forbidden}`);
assert.ok(main.includes("import('./features/lazy-features.mjs')"), 'main must install lazy feature runtime');
for (const target of ["import('./reader.mjs')", "import('./search.mjs')", "import('./bookmarks.mjs')", "import('./bookmarks/read-data-modal.mjs')", "import('./theme-settings.mjs')", "import('./sync-devtools.mjs')"]) {
  assert.ok(lazy.includes(target), `lazy runtime missing ${target}`);
}
assert.ok(lazy.includes('LAZY_READER_INTENT_PRELOAD_PASS'), 'reader intent preload marker missing');
assert.ok(lazy.includes('installLazyShortcutBridge'), 'lazy shortcut bridge missing');
assert.ok(lazy.includes("runtime.getApi('search')?.[method]"), 'reader changes must not force-load search');
assert.ok(lazy.includes('handler === lazyOpenRecoveryCenter'), 'lazy recovery facade must guard against self-recursion');
assert.ok(periodic.includes('maybeRefreshLoadedSyncUi(app, app.state.syncPolicySummary, { notify:false })'), 'initial hydrated remote-resume summary must be evaluated without waiting for the first push');
const devtools = read('public/scripts/rebuild/features/sync-devtools.mjs');
assert.ok(devtools.includes('updateKnownDeviceSeen(app, app.state.syncPolicySummary, { notify:false })'), 'devtools first install must restore known-device tracking');
assert.ok(devtools.includes('handleRemoteResumeOffer(app, app.state.syncPolicySummary, { notify:false })'), 'devtools first install must render an existing remote-resume offer');
for (const html of [library, site, mobile]) {
  for (const heavy of ['/features/reader.mjs','/features/search.mjs','/features/theme-settings.mjs']) {
    assert.ok(!html.includes(`<link rel="modulepreload" href="/scripts/rebuild${heavy}">`), `heavy feature preload must be removed: ${heavy}`);
  }
  assert.ok(html.includes('/scripts/rebuild/features/lazy-features.mjs'), 'lazy runtime must be preloaded so reader navigation installs promptly');
  assert.ok(html.includes('/scripts/rebuild/features/library.mjs'), 'library runtime must be preloaded so card navigation installs promptly');
  assert.ok(!html.includes('/scripts/rebuild/features/settings/appearance.mjs'), 'appearance runtime must load after scoped state bootstrap');
}
assert.ok(!periodic.includes("from './device-management.mjs'"), 'periodic sync must not statically load device management UI');
assert.ok(!periodic.includes("from './remote-resume.mjs'"), 'periodic sync must not statically load remote resume UI');
assert.ok(periodic.includes("import('./remote-resume.mjs')"), 'remote resume must load only when an offer exists');
console.log(JSON.stringify({ pass:PASS }));
