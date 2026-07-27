const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v358-reader-scroll-buffer-patch-anchor-smoke-pass';

function read(root, relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function runReaderScrollBufferPatchAnchorSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const layout = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  assert.ok(layout.includes("READER_SCROLL_BUFFER_PATCH_ANCHOR_PASS = 'v358-reader-scroll-buffer-patch-anchor-pass'"), 'missing v358 scroll-buffer patch anchor marker');
  assert.ok(layout.includes('function resolveScrollBufferPatchAnchorGate'), 'missing patch anchor gate resolver');
  assert.ok(layout.includes('function recordScrollBufferPatchAnchor'), 'missing patch anchor diagnostics recorder');
  assert.ok(layout.includes('isForwardScrollBufferAppendSource(source)'), 'patch anchor gate must include all scroll-buffer append sources');
  assert.ok(layout.includes('native forward scroll keeps scrollTop without patch anchor restore'), 'native forward scroll must suppress patch anchor restore');
  assert.ok(layout.includes("direction !== 'backward'"), 'patch anchor gate must exclude backward/prepend intent');
  assert.ok(layout.includes('!v?.pendingScrollTarget'), 'patch anchor gate must not interfere with explicit pending scroll targets');
  assert.ok(layout.includes("const phase = patched ? 'window-patch' : 'window-replace';"), 'patched render path must use window-patch phase');
  assert.ok(layout.includes("scheduleRenderWindowAnchorRecheck(app, renderAnchor, patched ? 'window-patch-raf' : 'window-replace-raf')"), 'patched render path must schedule patch anchor recheck');
  assert.ok(layout.includes('recordScrollBufferPatchAnchor(v, { ...(patchAnchorGate || {}), result })'), 'patched render path must record diagnostics');
  assert.ok(!layout.includes('if (renderAnchor && !patched)'), 'old patched-window anchor suppression must not return');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderScrollBufferPatchAnchorSmoke()));

module.exports = { PASS, runReaderScrollBufferPatchAnchorSmoke };
