#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const diag = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs', 'utf8');
assert.ok(layout.includes('v481-reader-episode-bottom-anchor-strict-gate-pass'), 'strict bottom anchor gate marker missing');
assert.ok(layout.includes('function resolveEpisodeBottomAnchorStrictGate'), 'strict bottom anchor gate helper missing');
assert.ok(layout.includes('remainingBottom <= actualThresholdPx && virtualRemainingBottom <= virtualThresholdPx'), 'bottom anchor must require both DOM and virtual bottom proximity');
assert.ok(diag.includes('lastEpisodeBottomAnchorStrictGate'), 'diagnostics must expose strict bottom anchor gate');
console.log('v481-reader-episode-bottom-anchor-strict-gate-smoke-pass');
