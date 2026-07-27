#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v373-reader-append-seam-render-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runReaderAppendSeamRenderSmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  assert.ok(layout.includes("READER_APPEND_SEAM_RENDER_PASS = 'v373-reader-append-seam-render-pass'"), 'missing v373 append seam render marker');
  assert.ok(layout.includes('function resolveAppendSeamRenderGate('), 'append seam render gate must exist');
  assert.ok(layout.includes('overscanTailOnly'), 'must detect overscan-only rendered tail seam');
  assert.ok(layout.includes('viewport is near append seam'), 'must detect viewport-near seam');
  assert.ok(layout.includes('append seam near viewport renders immediately'), 'deferred append must be overridden near actual viewport seam');
  assert.ok(layout.includes('appendSeamImmediateRender: !!appendSeamRender?.immediate'), 'append diagnostics must record seam immediate rendering');
  assert.ok(layout.includes('lastAppendSeamRender'), 'virtual state must retain seam render diagnostics');
  assert.ok(runner.includes('tools/checks/reader-append-seam-render-smoke.js'), 'reader smoke runner must include v373 seam render smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderAppendSeamRenderSmoke()));
module.exports = { PASS, runReaderAppendSeamRenderSmoke };
