#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const PASS = 'v380-reader-multi-file-local-slider-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function runReaderMultiFileLocalSliderSmoke() {
  const reader = read('public/scripts/rebuild/features/reader.mjs');
  const progress = read('public/scripts/rebuild/features/reader/progress.mjs');
  const coords = read('public/scripts/rebuild/features/reader/coordinates.mjs');
  const layout = read('public/scripts/rebuild/features/reader/virtual-layout.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');
  assert.ok(reader.includes("READER_MULTI_FILE_LOCAL_SLIDER_PASS = 'v380-reader-multi-file-local-slider-pass'"), 'reader must expose v380 local slider marker');
  assert.ok(!reader.includes('folderRatioToEpisodeTarget(app, safeRatio)'), 'bottom slider must not target aggregate folder ratio');
  assert.ok(reader.includes("mode: c?.episode ? 'current-episode' : 'single'"), 'slider preview must be scoped to current episode');
  assert.ok(reader.includes("await goPercent(app, safeRatio, { source: 'nav-slider', forceBlockTarget: true, directBlockScroll: true });"), 'slider change must keep current-episode local ratio while using v465 direct block target');
  assert.ok(reader.includes('READER_SLIDER_BLOCK_DIRECT_ANCHOR_PASS'), 'v465 slider direct-anchor marker must be present');
  assert.ok(!reader.includes('const folderManifestPromise = openState.current?.episode ? ensureFolderBlockManifest'), 'openNovel must not eagerly request aggregate folder manifest');
  assert.ok((progress.includes('resolveNavSliderProgress(app, address, localDocRatio)') || progress.includes('resolveNavSliderProgress(app, displayAddress, localDocRatio)')) && progress.includes('READER_SLIDER_FILE_CHAR_PROGRESS_PASS'), 'bottom slider value must use current-episode fileChar/local document ratio policy');
  assert.ok(progress.includes('현재 화 위치'), 'slider title must describe current episode position');
  assert.ok(coords.includes('applyFolderBlockManifest'), 'aggregate folder manifest support must remain available for non-slider consumers');
  assert.ok(layout.includes('resolveVisibleBodyChunkRatio'), 'current-file progress must use visible body row ratio before chunk-bound fallback');
  assert.ok(layout.includes('resolveViewportFileCharProgress') && layout.includes('fileCharDocumentRatio'), 'document ratio must be derived from visible fileChar position');
  assert.ok(runner.includes('tools/checks/reader-multi-file-local-slider-smoke.js'), 'reader smoke runner must include v380 local slider smoke');
  assert.ok(release.includes(PASS), 'release history must mention v380 smoke pass');
  return { pass: PASS };
}
if (require.main === module) console.log(JSON.stringify(runReaderMultiFileLocalSliderSmoke()));
module.exports = { PASS, runReaderMultiFileLocalSliderSmoke };
