const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v372-reader-append-deferred-spacer-sync-smoke-pass';

function read(root, relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function runReaderAppendDeferredSpacerSyncSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const layout = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read(projectRoot, 'tools/run_smoke_tests.js');
  assert.ok(layout.includes("READER_APPEND_DEFERRED_SPACER_SYNC_PASS = 'v372-reader-append-deferred-spacer-sync-pass'"), 'missing v372 deferred spacer sync marker');
  assert.ok(layout.includes('function syncDeferredAppendSpacers('), 'deferred append must sync existing spacers before RAF render');
  assert.ok(layout.includes('syncRenderedVirtualSpacers(app, v, content)'), 'deferred append must update DOM spacer heights immediately');
  assert.ok(layout.includes('const deferredSpacerSync = renderDefer.deferred'), 'spacer sync must be scoped to deferred append rendering');
  assert.ok(layout.includes('if (renderDefer.deferred) scheduleVirtualRender(app);'), 'deferred append must keep RAF render scheduling');
  assert.ok(layout.includes('deferredSpacerSyncPass: deferredSpacerSync?.pass ||'), 'incremental append diagnostics must record spacer sync pass');
  assert.ok(layout.includes('lastAppendDeferredSpacerSync'), 'virtual state must retain deferred spacer sync diagnostics');
  assert.ok(runner.includes('tools/checks/reader-append-deferred-spacer-sync-smoke.js'), 'reader smoke runner must include v372 deferred spacer sync smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendDeferredSpacerSyncSmoke()));

module.exports = { PASS, runReaderAppendDeferredSpacerSyncSmoke };
