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
  assert.ok(coords.includes('folderRatioToEpisodeTarget'), 'client must convert folder slider ratio to episode target');
  assert.ok(reader.includes("READER_MULTI_FILE_SLIDER_MANIFEST_PASS = 'v379-reader-multi-file-slider-manifest-pass'"), 'reader must expose v379 slider manifest marker');
  assert.ok(reader.includes('ensureFolderBlockManifest(app'), 'reader must request aggregate manifest for multi-file works');
  assert.ok(reader.includes('folderRatioToEpisodeTarget(app, safeRatio)'), 'nav slider change must target aggregate folder ratio');
  assert.ok(progress.includes('episodeRatioToFolderDocumentRatio'), 'progress must use exact folder ratio when aggregate manifest is available');
  assert.ok(progress.includes('전체 위치'), 'nav slider title must describe whole-folder position for multi-file works');
  assert.ok(runner.includes('tools/checks/reader-multi-file-slider-manifest-smoke.js'), 'reader smoke runner must include v379 slider manifest smoke');
  assert.ok(release.includes(PASS), 'release history must mention v379 smoke pass');
  return { pass: PASS };
}
if (require.main === module) console.log(JSON.stringify(runReaderMultiFileSliderManifestSmoke()));
module.exports = { PASS, runReaderMultiFileSliderManifestSmoke };
