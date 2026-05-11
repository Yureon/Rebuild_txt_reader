#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');

const reader = fs.readFileSync('public/scripts/rebuild/features/reader.mjs', 'utf8');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');

assert.ok(reader.includes("READER_VIEWPORT_TRANSITION_ANCHOR_PASS = 'v521-reader-viewport-transition-anchor-pass'"), 'v521 viewport transition anchor marker missing');
assert.ok(reader.includes('captureVirtualViewportAnchor,') && reader.includes('restoreVirtualViewportAnchor,'), 'reader must import viewport anchor helpers');
assert.ok(reader.includes('toggleFullscreenWithAnchor'), 'fullscreen toggle must capture anchor before request/exit');
assert.ok(reader.includes("fullscreen-toggle-${trigger || 'unknown'}") && reader.includes('{ force: true }'), 'fullscreen toggle must force pre-transition anchor capture');
assert.ok(reader.includes("on(document, 'fullscreenchange', () => handleViewportTransition('fullscreenchange', { capture: false }))"), 'fullscreenchange must reuse pre-captured anchor');
assert.ok(reader.includes("on(window, 'txt-reader-pseudo-fullscreen-change', () => handleViewportTransition('pseudo-fullscreen-change', { capture: false }))"), 'pseudo fullscreen change must restore pre-captured anchor');
assert.ok(reader.includes("on(window, 'txt-reader-viewport-fit', () => restoreViewportTransitionAnchor('viewport-fit'))"), 'viewport-fit refresh must re-apply transition anchor');
assert.ok(reader.includes("on(window.visualViewport, 'resize', () => handleViewportTransition('visual-viewport-resize', { capture: false }), { passive: true })"), 'visual viewport resize must not overwrite pre-transition anchor');
assert.ok(reader.includes('invalidateVirtualLayout(app, { reason: \'window-resize\', preserveViewportAnchor: true })'), 'window resize invalidation must preserve viewport anchor');
assert.ok(reader.includes('restoreVirtualViewportAnchor(app, active.anchor, {') && reader.includes("source: 'viewport-transition'") && reader.includes('explicit: true'), 'viewport transition restore must be explicit and use existing anchor restoration');
assert.ok(reader.includes('restoreTicket'), 'viewport transition restore timers must be de-duped');
assert.ok(layout.includes('export function restoreVirtualViewportAnchor'), 'restore helper must remain exported');
assert.ok(runner.includes('reader-viewport-transition-anchor-smoke.js'), 'reader smoke runner must include v521 viewport transition smoke');
console.log('v521-reader-viewport-transition-anchor-smoke-pass');
