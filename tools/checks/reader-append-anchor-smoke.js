const fs = require('fs');
const path = require('path');

const READER_APPEND_ANCHOR_SMOKE_PASS = 'v355-reader-append-anchor-gate-smoke-pass';

function runReaderAppendAnchorSmoke(projectRoot) {
  const root = projectRoot || path.join(__dirname, '..', '..');
  const src = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'reader', 'virtual-layout.mjs'), 'utf8');
  function assertContains(needle) {
    if (!src.includes(needle)) throw new Error(`reader append anchor contract missing: ${needle}`);
  }
  assertContains('captureAppendRebuildAnchor(app, mode, options)');
  assertContains('READER_APPEND_ANCHOR_GATED_PASS');
  assertContains('resolveAppendAnchorGate(reader, v, options)');
  assertContains('active forward buffer append keeps native scrollTop without append anchor');
  assertContains('const allowed = nativeBottomGrowth ? false : shouldPreserve;');
  assertContains('multiEpisodeAppendAnchorPass: READER_MULTI_EPISODE_APPEND_ANCHOR_PASS');
  assertContains("mode !== 'append'");
  assertContains("appendPreservePass: 'v277-reader-append-anchor-preserve-pass'");
  assertContains("const forceRender = mode !== 'append';");
  assertContains('renderVirtual(app, { force: forceRender });');
  assertContains('scheduleAppendRebuildAnchorRecheck(app, appendAnchor)');
  assertContains('v.lastAppendScrollStability');
  return { pass: READER_APPEND_ANCHOR_SMOKE_PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendAnchorSmoke(path.join(__dirname, '..', '..'))));

module.exports = { READER_APPEND_ANCHOR_SMOKE_PASS, runReaderAppendAnchorSmoke };
