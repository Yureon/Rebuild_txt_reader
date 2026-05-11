#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service.js');
const {
  createBlockManifestService,
  FOLDER_BLOCK_MANIFEST_WINDOW_PASS
} = require('../../server/services/block-manifest-service.js');

const PASS = 'v544-folder-block-manifest-window-cache-pass';
assert.strictEqual(FOLDER_BLOCK_MANIFEST_WINDOW_PASS, PASS);

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-folder-manifest-window-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const libraryPath = path.join(tmp, 'library');
const chunkIndexDir = path.join(tmp, 'chunk_indexes');
const manifestDiskCacheDir = path.join(tmp, 'block_manifests');
fs.mkdirSync(libraryPath, { recursive: true });
fs.mkdirSync(chunkIndexDir, { recursive: true });

const episodes = [];
for (let index = 0; index < 30; index += 1) {
  const number = index + 1;
  const id = `ep${String(number).padStart(2, '0')}`;
  const file = `${String(number).padStart(3, '0')}.txt`;
  episodes.push({ id, title: `${number}화`, path: file });
  fs.writeFileSync(path.join(libraryPath, file), `제목 ${number}\n\n본문 ${number}\n\n다음 문단 ${number}`, 'utf8');
}

const novel = { id: 'n1', title: 'multi', isMultiFile: true, episodes };
const libraryService = {
  getLibraryCached() { return [novel]; },
  safeJoinUnderLibrary(rel) { return path.join(libraryPath, rel); }
};
const contentService = createContentService({ chunkIndexDir });
const service = createBlockManifestService({
  libraryPath,
  libraryService,
  contentService,
  manifestDiskCacheDir,
  episodeDiskCacheDuringFolderBuild: true,
  folderBlockManifestRadius: 2
});

(async () => {
  const windowResult = await service.getSingleManifest('n1', { centerEpisodeId: 'ep11' });
  assert.strictEqual(windowResult.status, 200, 'window folder manifest request failed');
  const windowManifest = windowResult.body;
  assert.strictEqual(windowManifest.folderBlockManifestWindowPass, PASS, 'window pass marker missing');
  assert.strictEqual(windowManifest.sourceType, 'multi', 'manifest must remain multi source');
  assert.strictEqual(windowManifest.scope, 'window', 'default folder manifest scope must be window');
  assert.strictEqual(windowManifest.partial, true, 'default folder manifest must be partial');
  assert.strictEqual(windowManifest.totalEpisodes, 30, 'total episode count must be retained as metadata');
  assert.strictEqual(windowManifest.manifestedEpisodes, 5, 'radius 2 should materialize five episodes');
  assert.strictEqual(windowManifest.windowStartIndex, 8, 'window start must be center - radius');
  assert.strictEqual(windowManifest.windowEndIndex, 12, 'window end must be center + radius');
  assert.strictEqual(windowManifest.centerEpisodeIndex, 10, 'center episode id must resolve to its zero-based index');
  assert.deepStrictEqual(windowManifest.episodes.map(row => row.index), [8, 9, 10, 11, 12], 'window should only include nearby episode indices');
  assert.strictEqual(windowManifest.totalsRepresent, 'window', 'partial totals must be explicitly window-scoped');

  const byIndexResult = await service.getSingleManifest('n1', { centerEpisodeIndex: 29 });
  assert.strictEqual(byIndexResult.status, 200, 'index-centered window request failed');
  assert.deepStrictEqual(byIndexResult.body.episodes.map(row => row.index), [27, 28, 29], 'end-of-folder window must clamp safely');

  const fullResult = await service.getSingleManifest('n1', { folderManifestScope: 'full' });
  assert.strictEqual(fullResult.status, 200, 'explicit full folder manifest request failed');
  assert.strictEqual(fullResult.body.scope, 'full', 'explicit full request must keep full scope');
  assert.strictEqual(fullResult.body.partial, false, 'explicit full request must not be partial');
  assert.strictEqual(fullResult.body.manifestedEpisodes, 30, 'explicit full request must still be available');
  assert.strictEqual(fullResult.body.totalsRepresent, 'full', 'full totals must be marked full');

  const status = service.getCacheStatus();
  assert.strictEqual(status.folderBlockManifestWindowMarker, PASS, 'cache status must expose v544 window marker');
  assert.strictEqual(status.folderBuildConfig.folderBlockManifestRadius, 2, 'cache status must expose configured radius');
  assert.ok(status.metrics.folderManifestWindowBuilds >= 2, 'window builds should be counted separately');
  assert.ok(status.metrics.folderManifestFullBuilds >= 1, 'explicit full builds should be counted separately');

  const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'app.js'), 'utf8');
  const envSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'config', 'env.js'), 'utf8');
  const envExampleSource = fs.readFileSync(path.join(__dirname, '..', '..', '.env.example'), 'utf8');
  const apiSource = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'scripts', 'rebuild', 'core', 'api.mjs'), 'utf8');
  const readerSource = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'scripts', 'rebuild', 'features', 'reader.mjs'), 'utf8');
  const coordinatesSource = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'scripts', 'rebuild', 'features', 'reader', 'coordinates.mjs'), 'utf8');
  assert.ok(appSource.includes('folderBlockManifestRadius: FOLDER_BLOCK_MANIFEST_RADIUS'), 'server app must wire radius env into service');
  assert.ok(envSource.includes('FOLDER_BLOCK_MANIFEST_RADIUS'), 'env config must parse folder radius');
  assert.ok(envExampleSource.includes('FOLDER_BLOCK_MANIFEST_RADIUS=5'), '.env.example must document CPU-light default radius');
  assert.ok(apiSource.includes("qs.set('centerEpisodeId'"), 'frontend API must send center episode id');
  assert.ok(readerSource.includes("folderManifestScope: 'window'"), 'reader must request window folder manifest');
  assert.ok(readerSource.includes('shouldRefreshFolderManifestWindow'), 'reader must lazily refresh existing folder windows near edges');
  assert.ok(readerSource.includes('shouldPreserveFolderManifestForOpen'), 'reader must preserve usable folder windows across episode opens');
  assert.ok(coordinatesSource.includes('preserveFolderManifest'), 'coordinate reset must be able to retain reusable folder windows');
  assert.ok(coordinatesSource.includes('manifest.partial === true'), 'coordinate code must distinguish partial manifests');

  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
