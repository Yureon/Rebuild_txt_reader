#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibraryHeaderScrollState } from '../../public/scripts/rebuild/features/library-header-scroll-state.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shelf = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-shelf-runtime.mjs'), 'utf8');
const explorer = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-explorer-renderer.mjs'), 'utf8');

const state = createLibraryHeaderScrollState({ revealHoldMs:700 });
let result = state.update(100, 1000);
assert.equal(result.compact, true, 'downward scroll should compact the header');
result = state.update(90, 1100);
assert.equal(result.compact, false, 'upward scroll should reveal the command row');
result = state.update(108, 1200);
assert.equal(result.compact, false, 'layout compensation during reveal hold must not hide the row again');
result = state.reveal(108, 1250);
assert.equal(result.compact, false, 'an upward touch gesture at a scroll boundary must reveal the row');
result = state.update(130, 2050);
assert.equal(result.compact, true, 'later deliberate downward scrolling may compact again');
result = state.update(0, 2150);
assert.equal(result.compact, false, 'top of list must always reveal the command row');

for (const source of [shelf, explorer]) {
  assert(source.includes('createLibraryHeaderScrollState'), 'library view is not using the direction-aware header controller');
  assert(source.includes('applyLibraryHeaderCompactState'), 'library view does not apply the shared compact state');
  assert(source.includes('.reveal('), 'library view does not reveal the header from an upward gesture');
}
assert(!shelf.includes("classList.toggle('library-header-compact', (Number(app.els.novelList?.scrollTop) || 0) > 52)"), 'legacy top-only shelf header toggle remains');
assert(!explorer.includes("classList.toggle('library-header-compact', content.scrollTop > 52)"), 'legacy top-only explorer header toggle remains');

console.log(JSON.stringify({ pass:'v653-library-mobile-header-reveal-smoke-pass', upwardReveal:true, layoutHold:true }));
