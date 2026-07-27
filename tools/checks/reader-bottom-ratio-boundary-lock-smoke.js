#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const reader = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader.mjs'), 'utf8');
const state = fs.readFileSync(path.join(root, 'public/scripts/rebuild/state/app-state.mjs'), 'utf8');

const PASS = 'v359-reader-bottom-ratio-boundary-lock-smoke-pass';

assert.ok(layout.includes("READER_RATIO_SCROLL_TARGET_PASS = 'v359-reader-ratio-scroll-target-pass'"), 'missing v359 ratio scroll target marker');
assert.ok(layout.includes('const pureRatioTarget = target.ratio != null'), 'ratio target must be detected explicitly');
assert.ok(layout.includes('v.pendingScrollTarget = null;'), 'pure ratio target must clear pending scroll target');
assert.ok(layout.includes("bottom ratio uses direct scroll without row scrollIntoView"), 'bottom ratio must avoid row scrollIntoView follow-up');
assert.ok(layout.includes('chunkTop + chunkHeight - viewport'), 'ratio=100% must align chunk bottom against viewport instead of row start/center');
assert.ok(reader.includes("READER_EPISODE_BOUNDARY_LOCK_PASS = 'v359-reader-episode-boundary-lock-pass'"), 'missing v359 episode boundary lock marker');
assert.ok(reader.includes('readerEpisodeBoundaryOpening'), 'episode boundary opening lock must be tracked');
assert.ok(reader.includes('readerEpisodeBoundaryCooldownUntil'), 'episode boundary cooldown must be tracked');
assert.ok(reader.includes('isEpisodeBoundaryTransitionLocked(app)'), 'boundary open must be globally locked');
assert.ok(reader.includes('transition already opening or cooling down'), 'duplicate boundary transitions must be blocked while opening/cooling down');
assert.ok(state.includes('readerEpisodeBoundaryOpening: false'), 'app state must initialize boundary opening lock');
assert.ok(state.includes('readerEpisodeBoundaryCooldownUntil: 0'), 'app state must initialize boundary cooldown');

console.log(PASS);
