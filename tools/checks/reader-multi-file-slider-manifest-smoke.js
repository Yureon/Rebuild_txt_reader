#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const PASS = 'v379-reader-multi-file-slider-manifest-smoke-pass';
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function runReaderMultiFileSliderManifestSmoke() {
  const service = read('server/services/block-manifest-service.js');
  const reader = read('public/scripts/rebuild/features/reader.mjs');
  const coords = read('public/scripts/rebuild/features/reader/coordinates.mjs');
  const progress = read('public/scripts/rebuild/features/reader/progress.mjs');
  const runner = read('tools/run_smoke_tests.js');
  const release = read('docs/release-history.md');
  assert.ok(service.includes('async function buildMultiFileManifest('), 'server must build aggregate multi-file block manifests');
  assert.ok(service.includes("sourceType: 'multi'"), 'aggregate manifest must be marked as multi sourceType');
  assert.ok(service.includes('episodes: episodeManifests'), 'aggregate manifest must include episode manifests');
  assert.ok(service.includes('folderBlockStart'), 'aggregate manifest chunks must expose folder block offsets');
  assert.ok(coords.includes('applyFolderBlockManifest'), 'client must apply aggregate folder manifest');
  assert.ok(coords.includes('episodeRatioToFolderDocumentRatio'), 'client must convert episode ratio to folder ratio');
  assert.ok(coords.includes('folderRatioToEpisodeTarget'), 'aggregate manifest coordinate helper must remain available');
  assert.ok(reader.includes("READER_MULTI_FILE_LOCAL_SLIDER_PASS = 'v380-reader-multi-file-local-slider-pass'"), 'reader must preserve the current episode-local slider contract');
  assert.ok(reader.includes('ensureFolderBlockManifest(app'), 'reader must request windowed aggregate manifests for overall progress');
  assert.ok(reader.includes("goPercent(app, safeRatio, { source: 'nav-slider'"), 'nav slider change must target the current episode ratio');
  assert.ok(!reader.includes('folderRatioToEpisodeTarget(app, safeRatio)'), 'superseded whole-folder slider targeting must not return');
  assert.ok(progress.includes('episodeRatioToFolderDocumentRatio'), 'safe-area progress must use exact folder ratio when an aggregate manifest is available');
  assert.ok(progress.includes("dataset.readerSliderScope = c.episode ? 'current-episode'"), 'nav slider scope must remain episode-local');
  assert.ok(runner.includes('tools/checks/reader-multi-file-slider-manifest-smoke.js'), 'audit runner must include the slider contract smoke');
  assert.ok(release.includes(PASS) && release.includes('v380-reader-multi-file-local-slider-smoke-pass'), 'release history must preserve the v379 architecture and v380 policy override');
  return { pass: PASS, currentPolicy:'episode-local-v380' };
}
if (require.main === module) console.log(JSON.stringify(runReaderMultiFileSliderManifestSmoke()));
module.exports = { PASS, runReaderMultiFileSliderManifestSmoke };
