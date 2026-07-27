#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const shell = read('public/fragments/app-shell.html');
const deferred = read('public/fragments/deferred-ui.html');
const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
const ui = read('public/scripts/rebuild/features/ui.mjs');
const lazy = read('public/scripts/rebuild/features/lazy-features.mjs');
const css = read('public/styles/deferred-ui.css');

assert(shell.includes('id="library-settings-page-btn"'), 'library settings entry is missing');
assert(shell.includes('aria-label="환경설정 화면 열기"'), 'library settings entry must be accessible');
assert(elements.includes("'library-settings-page-btn'"), 'library settings entry is not collected');

const requiredContextContracts = [
  ['settings-tab-general', 'data-settings-contexts="library"'],
  ['settings-tab-viewer', 'data-settings-contexts="library reader"'],
  ['settings-tab-function', 'data-settings-contexts="library reader"'],
  ['settings-tab-data', 'data-settings-contexts="library"'],
  ['settings-tab-debug', 'data-settings-contexts="reader"'],
  ['debug-panel', 'data-settings-contexts="reader"']
];
for (const [id, marker] of requiredContextContracts) {
  const at = deferred.indexOf(`id="${id}"`);
  assert(at >= 0, `${id} is missing`);
  assert(deferred.slice(at, at + 380).includes(marker), `${id} context contract is missing`);
}
assert.equal((deferred.match(/id="open-dev-debug-btn"/g) || []).length, 1, 'developer debug launcher must have one stable ID');
const dataStart = deferred.indexOf('id="data-panel"');
const debugStart = deferred.indexOf('id="debug-panel"');
assert(dataStart >= 0 && debugStart > dataStart, 'settings panel order is invalid');
assert(!deferred.slice(dataStart, debugStart).includes('id="open-dev-debug-btn"'), 'developer debug must be removed from data/account tab');
assert(deferred.slice(debugStart).includes('id="open-dev-debug-btn"'), 'developer debug must remain available');

for (const marker of [
  'app.openLibrarySettingsPage = openLibrarySettingsPage',
  'app.closeLibrarySettingsPage = closeLibrarySettingsPage',
  'app.openReaderSettings = openReaderSettings',
  "panel.dataset.settingsPresentation = 'page'",
  "setSettingsContext('reader')",
  "setSettingsContext('library')",
  "root.setAttribute('inert', '')",
  "on(window, 'popstate'",
  "onDeferred(app.els.librarySettingsPageBtn, 'library-settings-page-open'"
]) assert(ui.includes(marker), `settings runtime marker missing: ${marker}`);

assert(lazy.includes('replayClickAfterLoad(app.els?.librarySettingsPageBtn'), 'lazy loader must replay the library settings click');
assert(lazy.includes('preloadOnIntent(app.els?.librarySettingsPageBtn'), 'library settings should preload on pointer/focus intent');
assert(lazy.includes('if (app.isLibraryProfile) app.openLibrarySettingsPage?.()'), 'settings shortcut must use page mode in library profile');
assert(lazy.includes('else app.openReaderSettings?.()'), 'settings shortcut must use reader modal outside library profile');

for (const marker of [
  '.settings-panel.settings-page{',
  'position:fixed!important;',
  'width:100vw!important;',
  'height:var(--app-vh,100dvh)!important;',
  '.settings-panel[data-settings-context="reader"] .sp-tab',
  '.settings-panel .sp-tab[hidden]',
  '.settings-page-back'
]) assert(css.includes(marker), `settings layout CSS missing: ${marker}`);

const ids = [...deferred.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'deferred settings UI contains duplicate IDs');

console.log(JSON.stringify({
  pass:'v650-library-reader-settings-smoke-pass',
  contexts:['library','reader'],
  tabs:4,
  duplicateIds:0
}));
