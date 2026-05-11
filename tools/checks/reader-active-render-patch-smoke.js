const fs = require('fs');
const path = require('path');

const READER_ACTIVE_RENDER_PATCH_SMOKE_PASS = 'v289-reader-active-render-window-patch-smoke-pass';

function runReaderActiveRenderPatchSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const virtualLayout = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout-diagnostics.mjs'), 'utf8');
  const manualSnapshot = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'manual-diagnostics-snapshot.mjs'), 'utf8');
  function assertContains(src, needle) {
    if (!src.includes(needle)) throw new Error(`reader active render patch contract missing: ${needle}`);
  }
  assertContains(virtualLayout, 'READER_ACTIVE_RENDER_PATCH_PASS');
  assertContains(virtualLayout, 'v289-reader-active-render-window-patch-pass');
  assertContains(virtualLayout, 'VIRTUAL_ACTIVE_RENDER_PATCH_MAX_EDGE_ROWS');
  assertContains(virtualLayout, 'patchActiveVirtualRenderWindow(app, v, content');
  assertContains(virtualLayout, "reason: 'active overlap patch'");
  assertContains(virtualLayout, 'resolveScrollBufferPatchAnchorGate(v)');
  assertContains(virtualLayout, "const phase = patched ? 'window-patch' : 'window-replace';");
  assertContains(virtualLayout, 'return null;');
  assertContains(diagnostics, 'activeRenderPatchPass');
  assertContains(diagnostics, 'lastActiveRenderPatch');
  assertContains(manualSnapshot, 'lastActiveRenderPatch');
  return { pass: READER_ACTIVE_RENDER_PATCH_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderActiveRenderPatchSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_ACTIVE_RENDER_PATCH_SMOKE_PASS, runReaderActiveRenderPatchSmoke };
