#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');

const PASS = 'v360-reader-episode-bottom-anchor-smoke-pass';

assert.ok(layout.includes("READER_EPISODE_BOTTOM_ANCHOR_PASS = 'v360-reader-episode-bottom-anchor-pass'"), 'missing v360 episode bottom anchor marker');
assert.ok(layout.includes('function captureEpisodeBottomAnchor('), 'episode bottom anchor must capture last-chunk bottom distance');
assert.ok(layout.includes('function restoreEpisodeBottomAnchor('), 'episode bottom anchor must restore bottom distance');
assert.ok(layout.includes('function scheduleEpisodeBottomAnchorRecheck('), 'episode bottom anchor must RAF recheck after render/measure changes');
assert.ok(layout.includes('maxLoadedChunk < totalChunks'), 'bottom anchor must only apply after the final chunk is loaded');
assert.ok(layout.includes('v.pendingScrollTarget'), 'bottom anchor must avoid explicit search/slider/block pending target');
assert.ok(layout.includes('resolveEpisodeBottomAnchorStrictGate') && layout.includes('remainingBottom <= actualThresholdPx && virtualRemainingBottom <= virtualThresholdPx'), 'bottom anchor must be limited by strict actual and virtual bottom zones');
assert.ok(layout.includes("captureEpisodeBottomAnchor(app, { phase: 'render-capture'"), 'render path must capture episode bottom anchor');
assert.ok(layout.includes("restoreEpisodeBottomAnchor(app, episodeBottomAnchor, patched ? 'window-patch-bottom'"), 'render patch path must restore bottom anchor');
assert.ok(layout.includes("captureEpisodeBottomAnchor(app, { phase: 'measure-capture'"), 'measure path must capture bottom anchor before height changes');
assert.ok(layout.includes("restoreEpisodeBottomAnchor(app, episodeBottomAnchor, 'measure-commit-bottom'"), 'measure commit path must restore bottom distance');
assert.ok(runner.includes('reader-episode-bottom-anchor-smoke.js'), 'reader smoke runner must include v360 bottom anchor smoke');

console.log(PASS);
