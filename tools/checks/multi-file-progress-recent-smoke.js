#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const progress = read('public/scripts/rebuild/features/reader/progress.mjs');
assert.ok(progress.includes('function getFolderDocumentRatio'), 'progress must compute folder-level document ratio for multi-file novels');
assert.ok(progress.includes('episodeDocumentRatio'), 'progress snapshot must retain episode-local document ratio');
assert.ok(progress.includes('app.state.progress.byNovel[snap.novelId] = snap'), 'byNovel must store the folder-level progress snapshot');
assert.ok(progress.includes('documentRatio: snap.episodeDocumentRatio ?? snap.documentRatio'), 'readMeta and episode position snapshots must retain episode-local progress for per-episode resume');
assert.ok(progress.includes('resumeEpisodeId'), 'recent item must retain resume episode without splitting recent list by episode');
assert.ok(progress.includes('getFolderDocumentRatio(app, localRatio)'), 'safe-area progress must use folder-level ratio for multi-file novels');
const quick = read('public/scripts/rebuild/features/library-quick-list.mjs');
assert.ok(quick.includes('multi:${novelId}'), 'quick recent list must group multi-file recents by novel');
assert.ok(quick.includes('getProgressRatioForState(app.state, novel)'), 'quick progress must use folder-level progress for novel rows');
assert.ok(quick.includes('episodeNote'), 'quick recent metadata should show last episode as secondary info');
assert.ok(quick.includes('removeWholeNovel'), 'removing grouped multi-file recents must remove the whole novel recent group');
const modal = read('public/scripts/rebuild/features/bookmarks/read-data-modal.mjs');
assert.ok(modal.includes('groupRecentItemsByNovel'), 'read-data recents must be grouped by novel for multi-file novels');
assert.ok(modal.includes('작품 폴더'), 'read-data recents must label multi-file rows as folder-level rows');
const model = read('public/scripts/rebuild/features/bookmarks/read-data-model.mjs');
assert.ok(model.includes('countRecentGroups'), 'read-data recent counts must also use grouped recent units');
console.log(JSON.stringify({ pass: 'v369-multi-file-progress-recent-smoke-pass' }));
