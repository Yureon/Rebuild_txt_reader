import assert from 'node:assert/strict';
import fs from 'node:fs';
import current from './current-rebuild-version.js';
const { CURRENT_REBUILD_VERSION } = current;

const read = rel => fs.readFileSync(rel, 'utf8');
const libraryShell = read('public/fragments/library-shell.html');
const readerShell = read('public/fragments/app-shell.html');
const runtime = read('public/scripts/rebuild/core/app-shell.mjs');
const libraryPage = read('public/library.html');
const indexPage = read('public/index.html');

for (const token of ['id="app"','id="sidebar"','id="search"','id="novel-list"','id="library-quick-list"','id="list-action-overlay"','id="user-tag-overlay"']) {
  assert.ok(libraryShell.includes(token), `library shell missing ${token}`);
}
assert.ok(libraryShell.includes('data-library-shell-isolation-pass="v668-library-shell-isolation-pass"'));
for (const forbidden of ['id="main"','id="loading"','id="reader"','id="toolbar"','id="continue-reading-bar"','id="chunk-jumper-panel"','reader-load-skeleton','offline-download-status']) {
  assert.ok(!libraryShell.includes(forbidden), `library shell must exclude ${forbidden}`);
}
for (const required of ['id="main"','id="loading"','id="reader"','id="toolbar"','reader-load-skeleton']) {
  assert.ok(readerShell.includes(required), `reader shell missing ${required}`);
}
assert.ok(runtime.includes(`library: '/fragments/library-shell.html?v=${CURRENT_REBUILD_VERSION}'`));
assert.ok(runtime.includes(`site: '/fragments/app-shell.html?v=${CURRENT_REBUILD_VERSION}'`));
assert.ok(runtime.includes("const shellPromises = new Map()"));
assert.ok(runtime.includes("서재 셸에 Reader 전용 DOM이 포함되어 있습니다."));
assert.ok(!libraryPage.includes('reader-load-skeleton'));
assert.ok(indexPage.includes('data-entry-router-blocking-pass="v668-entry-router-before-paint-pass"'));
const routerIndex = indexPage.indexOf('/scripts/entry-router.js');
const styleIndex = indexPage.indexOf('/styles/entry-router.css');
assert.ok(routerIndex > 0 && styleIndex > routerIndex, 'entry redirect script must block parsing before route-card CSS/body');
assert.ok(!/entry-router\.js[^>]*\bdefer\b/.test(indexPage), 'entry router must not be deferred');
console.log(JSON.stringify({ pass:'v668-library-shell-isolation-smoke-pass', libraryBytes:Buffer.byteLength(libraryShell), readerBytes:Buffer.byteLength(readerShell) }));
