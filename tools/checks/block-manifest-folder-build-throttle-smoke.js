#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service.js');
const {
  createBlockManifestService,
  BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS
} = require('../../server/services/block-manifest-service.js');

const PASS = 'v540-block-manifest-folder-build-throttle-pass';
assert.strictEqual(BLOCK_MANIFEST_FOLDER_BUILD_THROTTLE_PASS, PASS);

function walkJsonFiles(dirPath) {
  const files = [];
  const stack = [dirPath];
  while (stack.length) {
    const current = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch (_) { continue; }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.json')) files.push(full);
    }
  }
  return files;
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-folder-manifest-throttle-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));

const libraryPath = path.join(tmp, 'library');
const chunkIndexDir = path.join(tmp, 'chunk_indexes');
const manifestDiskCacheDir = path.join(tmp, 'block_manifests');
fs.mkdirSync(libraryPath, { recursive: true });
fs.mkdirSync(chunkIndexDir, { recursive: true });

const episodes = [];
for (let index = 1; index <= 40; index += 1) {
  const id = `e${String(index).padStart(2, '0')}`;
  const file = `${String(index).padStart(3, '0')}.txt`;
  episodes.push({ id, title: `${index}화`, path: file });
  fs.writeFileSync(path.join(libraryPath, file), `제목 ${index}\n\n본문 ${index}\n\n다음 문단 ${index}`, 'utf8');
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
  folderBuildYieldEvery: 10,
  folderManifestHotCacheTtlMs: 30000,
  folderSignatureCacheTtlMs: 30000
});

(async () => {
  const fullFolderManifestQuery = { folderManifestScope: 'full' };
  const results = await Promise.all([
    service.getSingleManifest('n1', fullFolderManifestQuery),
    service.getSingleManifest('n1', fullFolderManifestQuery),
    service.getSingleManifest('n1', fullFolderManifestQuery)
  ]);
  assert.ok(results.every(result => result.status === 200), 'concurrent folder manifest requests must succeed');
  assert.ok(results.every(result => result.body.folderSignatureHash === results[0].body.folderSignatureHash), 'concurrent requests must share one folder signature');

  const afterCold = service.getCacheStatus();
  assert.strictEqual(afterCold.folderBuildThrottleMarker, PASS, 'status must expose v540 folder throttle marker');
  assert.strictEqual(afterCold.folderBuildConfig.episodeDiskCacheDuringFolderBuild, true, 'app/service option must enable episode disk writes during folder build');
  assert.ok(afterCold.metrics.folderManifestInflightJoins >= 2, 'concurrent cold folder requests must join one in-flight build');
  assert.strictEqual(afterCold.metrics.manifestDiskWriteStored, 1, 'folder build should store one folder manifest');
  assert.ok(afterCold.metrics.episodeManifestDiskWriteStored >= episodes.length, 'folder build should store per-episode manifest files for reuse');
  assert.strictEqual(afterCold.metrics.episodeManifestDiskWriteSkippedForFolderBuild, 0, 'folder build should not skip episode disk writes when reuse cache is enabled');
  assert.ok(afterCold.metrics.folderManifestBuildYields >= 3, 'large folder build should yield between episode batches');

  const folderJsonFiles = walkJsonFiles(manifestDiskCacheDir).filter(file => !file.includes(`${path.sep}episodes${path.sep}`));
  const episodeJsonFiles = walkJsonFiles(path.join(manifestDiskCacheDir, 'episodes'));
  assert.strictEqual(folderJsonFiles.length, 1, 'cold folder build should create exactly one folder manifest JSON');
  assert.ok(episodeJsonFiles.length >= episodes.length, 'cold folder build should grow reusable episode manifest directory');

  const hot = await service.getSingleManifest('n1', fullFolderManifestQuery);
  assert.strictEqual(hot.status, 200, 'hot folder manifest request failed');
  const afterHot = service.getCacheStatus();
  assert.ok(afterHot.metrics.folderManifestHotCacheHits >= 1, 'hot folder manifest request must avoid disk/stat rebuild');

  const episode = await service.getEpisodeManifest('n1', 'e01', {});
  assert.strictEqual(episode.status, 200, 'direct episode manifest request failed');
  const afterEpisode = service.getCacheStatus();
  assert.ok(afterEpisode.metrics.episodeManifestDiskWriteStored >= 1, 'direct episode endpoint should still persist episode manifest cache');
  assert.ok(walkJsonFiles(path.join(manifestDiskCacheDir, 'episodes')).length >= 1, 'direct episode cache JSON should exist');

  const appSource = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'app.js'), 'utf8');
  assert.ok(appSource.includes('folderSignatureCacheTtlMs: 5000'), 'server app must enable short folder signature hot cache');
  assert.ok(appSource.includes('folderManifestHotCacheTtlMs: 5000'), 'server app must enable short folder manifest hot cache');
  assert.ok(appSource.includes('episodeDiskCacheDuringFolderBuild: true'), 'server app must opt out of folder-build episode disk fan-out');

  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
