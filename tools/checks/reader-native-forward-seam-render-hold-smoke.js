#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const PASS = 'v432-reader-native-forward-seam-render-hold-smoke-pass';

const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
const diagnostics = read('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
const manualSnapshot = read('public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs');
const runner = read('tools/run_smoke_tests.js');
const release = read('docs/release-history.md');

assert.ok(layout.includes("READER_NATIVE_FORWARD_SEAM_RENDER_HOLD_PASS = 'v432-reader-native-forward-seam-render-hold-pass'"), 'missing v432 seam render hold marker');
assert.ok(layout.includes('function resolveNativeForwardSeamRenderHold'), 'missing seam render hold resolver');
assert.ok(layout.includes('native forward seam transit keeps rendered leading rows and top spacer stable'), 'render hold must document leading row/top spacer retention');
assert.ok(layout.includes('VIRTUAL_NATIVE_FORWARD_SEAM_RENDER_HOLD_MAX_ROWS'), 'render hold must use a wider transient row cap');
assert.ok(layout.includes("const seamRenderLock = resolveNativeForwardSeamTransitLock(v, { phase: 'render-range', anchorType: 'render-window' });"), 'render range must inspect seam transit lock');
assert.ok(layout.includes('active: isVirtualScrollActive(v) || seamRenderLock.locked'), 'stable range must remain active while seam lock is settling');
assert.ok(layout.includes('if (seamRenderHold?.hold) {'), 'render range must apply seam render hold');
assert.ok(layout.includes('start = seamRenderHold.start;'), 'render hold must retain previous rendered start');
assert.ok(layout.includes('const patched = !force && (isVirtualScrollActive(v) || seamRenderLock.locked)'), 'render patch must stay in patch mode during seam lock settle');
assert.ok(layout.includes('native forward seam render hold blocks front row removal during inertia'), 'active patch must block front row removal if lock fails to retain start');
assert.ok(layout.includes('native forward seam render hold preserves top spacer and grows bottom spacer only'), 'spacer sync must keep top spacer stable under seam lock');
assert.ok(layout.includes('if (!seamRenderHold.locked) {\n    top.style.height'), 'active patch must not rewrite top spacer during seam lock');
assert.ok(layout.includes('nativeForwardSeamRenderHoldPass'), 'virtual state must expose seam render hold pass');
assert.ok(diagnostics.includes('nativeForwardSeamRenderHoldPass'), 'diagnostics must expose seam render hold pass');
assert.ok(diagnostics.includes('lastNativeForwardSeamRenderHold'), 'diagnostics must expose seam render hold details');
assert.ok(manualSnapshot.includes('nativeForwardSeamRenderHoldPass'), 'manual snapshot must include seam render hold pass');
assert.ok(runner.includes('tools/checks/reader-native-forward-seam-render-hold-smoke.js'), 'reader smoke runner must include v432 seam render hold smoke');
assert.ok(release.includes(PASS), 'release history must mention v432 seam render hold smoke');

console.log(PASS);
