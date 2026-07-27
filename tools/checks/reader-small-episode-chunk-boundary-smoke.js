#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v383-reader-small-episode-chunk-boundary-smoke-pass';
const root = path.resolve(__dirname, '..', '..');

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function runReaderSmallEpisodeChunkBoundarySmoke() {
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const css = read('public/styles/app.css');
  const runner = read('tools/run_smoke_tests.js');

  assert.ok(layout.includes("READER_SMALL_EPISODE_CHUNK_BOUNDARY_PASS = 'v383-reader-small-episode-chunk-boundary-pass'"), 'missing v383 small episode boundary marker');
  assert.ok(layout.includes('VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_CHUNKS = 2'), 'small episode guard must be scoped to one appended final chunk');
  assert.ok(layout.includes('VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_ROWS = MAX_RENDERED_ROWS'), 'small episode guard must be limited to small rendered windows');
  assert.ok(layout.includes('const smallEpisodeFinalAppend = totalChunks <= VIRTUAL_SMALL_EPISODE_BOUNDARY_MAX_CHUNKS'), 'small final append resolver missing');
  assert.ok(layout.includes('const wideRenderedTail = renderedStart <= 0 && renderedEnd >= beforeRows'), 'wide-tail detection missing');
  assert.ok(layout.includes('const smallEpisodeBoundaryDefer = smallEpisodeFinalAppend && wideRenderedTail && renderedTouchesTail && !viewportNearSeam'), 'small boundary deferral gate missing');
  assert.ok(layout.includes('small episode boundary defers wide-tail seam render until viewport nears seam'), 'small boundary deferral reason missing');
  assert.ok(layout.includes('const immediate = !!reader && beforeRows > 0 && viewportNearSeam'), 'immediate seam rendering must require actual viewport-near seam');
  assert.ok(layout.includes('smallEpisodeBoundaryDefer,') && layout.includes('overscanTailOnly,'), 'append seam diagnostics must record boundary and overscan deferral');

  assert.ok(css.includes('.reader-virtual-spacer,\n#chunk-loading{\n  overflow-anchor:none;'), 'virtual spacers and loading marker must opt out of native scroll anchoring');
  assert.ok(css.includes('.reader-vrow{\n  overflow-anchor:auto;'), 'reader rows must remain available as browser scroll anchors');
  assert.ok(runner.includes('tools/checks/reader-small-episode-chunk-boundary-smoke.js'), 'reader smoke runner must include v383 boundary smoke');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderSmallEpisodeChunkBoundarySmoke()));

module.exports = { PASS, runReaderSmallEpisodeChunkBoundarySmoke };
