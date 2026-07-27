#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const importFresh = rel => import(`${pathToFileURL(path.join(root, rel)).href}?v648=${Date.now()}-${Math.random()}`);

const drag = await importFresh('public/scripts/rebuild/features/library-drag-drop.mjs');
assert.equal(typeof drag.createLibraryDragDropHandlers, 'function');
const handlers = drag.createLibraryDragDropHandlers({ state:{} }, {});
for (const name of ['handleDragStart','handleDragOver','handleDragLeave','handleDrop','finishDrag']) {
  assert.equal(typeof handlers[name], 'function', `missing drag handler ${name}`);
}
const dragSource = read('public/scripts/rebuild/features/library-drag-drop.mjs');
assert.match(dragSource, /function normalizeWithDeps\s*\(/);
assert.doesNotMatch(dragSource, /createLibraryDragDropHandlers\s*=\s*undefined/);

const installSource = read('public/scripts/rebuild/features/library-install-orchestrator.mjs');
assert.match(installSource, /import\s*\{\s*toast\s*\}\s*from\s*['"]\.\/ui\.mjs['"]/);
assert.match(installSource, /revealLibraryQuickItemInList\([^\n]+\{[^\n]*toast[^\n]*\}\)/);

const shortcuts = await importFresh('public/scripts/rebuild/features/settings/shortcuts.mjs');
assert.equal(typeof shortcuts.bindShortcuts, 'function');
const shortcutSource = read('public/scripts/rebuild/features/settings/shortcuts.mjs');
assert.match(shortcutSource, /const rerenderShortcutList\s*=\s*\(\)\s*=>/);
assert.match(shortcutSource, /const setRecording\s*=\s*id\s*=>/);
assert.doesNotMatch(shortcutSource, /renderShortcutList\(app,\s*\{\s*getRecording:\s*\(\)\s*=>\s*recordingActionId,\s*setRecording\s*\}\);\s*\n\s*}\s*;/);

const metadataSource = read('server/services/metadata-service.js');
assert.match(metadataSource, /const logger\s*=\s*options\.logger\s*\|\|\s*console\s*;/);
assert.match(metadataSource, /logger\?\.warn\?\.\('metadata cover lease release failed after durable candidate update:'/);

const enSource = read('public/scripts/rebuild/features/settings/site-language-en.mjs');
const keyMatches = [...enSource.matchAll(/^\s*'((?:\\.|[^'])+)'\s*:/gm)].map(match => match[1]);
const duplicateKeys = [...new Set(keyMatches.filter((key, index) => keyMatches.indexOf(key) !== index))];
assert.deepEqual(duplicateKeys, [], `duplicate English language keys: ${duplicateKeys.join(', ')}`);

const asyncRouteSource = read('server/utils/async-route.js');
for (const code of ['LIBRARY_COLD_BUILD_PENDING','LIBRARY_COLD_BUILD_BACKOFF','LIBRARY_COLD_BUILD_FAILED','LIBRARY_SYNC_COLD_BUILD_DISABLED','LIBRARY_SHELF_BUSY']) {
  assert(asyncRouteSource.includes(code), `async route missing ${code}`);
}
assert.match(asyncRouteSource, /Retry-After/);

console.log(JSON.stringify({
  pass:'v648-audit-runtime-fixes-smoke-pass',
  dragHandlers:Object.keys(handlers).length,
  duplicateEnglishKeys:duplicateKeys.length,
  retryableLibraryErrors:5
}));
