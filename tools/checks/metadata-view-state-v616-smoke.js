#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');

const page = fs.readFileSync('public/scripts/rebuild/metadata-page.mjs', 'utf8');
const modal = fs.readFileSync('public/scripts/rebuild/features/library-metadata-runtime.mjs', 'utf8');
const bridge = fs.readFileSync('public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs', 'utf8');
const shelf = fs.readFileSync('public/scripts/rebuild/features/library-shelf-runtime.mjs', 'utf8');

for (const token of [
  'captureWorkListViewState',
  'restoreWorkListViewState',
  'captureDetailViewState',
  'restoreDetailViewState',
  'refreshSelectedWorkSummary',
  'page.workController?.abort?.()',
  'const serial = ++page.detailSerial',
  'const serial = ++page.overviewSerial',
  "action.dataset.metadataPending = '1'"
]) assert.ok(page.includes(token), `dedicated metadata view-state token missing: ${token}`);

assert.ok(!/applyNovelMetadata[\s\S]{0,1200}await loadWorks\(true/.test(page), 'candidate apply must not reset the whole work list');
assert.ok(!/deleteNovelMetadata[\s\S]{0,1200}await loadWorks\(true/.test(page), 'remove applied metadata must not reset the whole work list');
assert.ok(!/pageshow[\s\S]{0,300}location\.reload\s*\(/.test(page), 'BFCache restoration must not force a page reload');

for (const token of [
  'captureMetadataModalView',
  'restoreMetadataModalView',
  'const serial = ++controller.loadSerial',
  "target.dataset.metadataPending = '1'",
  'returnFocus:controller.options.returnFocus?.() || document.activeElement'
]) assert.ok(modal.includes(token), `library metadata modal view-state token missing: ${token}`);

assert.ok(bridge.includes("preserveScroll:true, source:'metadata-updated'"), 'library metadata refresh must preserve shelf scroll');
assert.ok(bridge.includes('resetScroll:false, scrollAnchor'), 'library metadata refresh must preserve catalog anchor');
assert.ok(!bridge.includes('libraryShelfItems = []'), 'metadata refresh must not clear the shelf before reloading');
assert.ok(shelf.includes('captureShelfScrollView'), 'shelf scroll capture helper missing');
assert.ok(shelf.includes('restoreShelfScrollView'), 'shelf scroll restore helper missing');
assert.ok(shelf.includes('options.preserveScroll === true'), 'shelf preserveScroll contract missing');

console.log(JSON.stringify({ pass:'v616-metadata-view-state-pass' }));
