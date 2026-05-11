#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service.js');
const { createBlockManifestService, BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS } = require('../../server/services/block-manifest-service.js');
const PASS = 'v460-block-manifest-episode-disk-cache-smoke-pass';
assert.strictEqual(BLOCK_MANIFEST_EPISODE_DISK_CACHE_PASS, PASS, 'exported episode disk cache marker mismatch');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-episode-manifest-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const libraryPath = path.join(tmp, 'library');
const chunkIndexDir = path.join(tmp, 'chunk_indexes');
const manifestDiskCacheDir = path.join(tmp, 'block_manifests');
fs.mkdirSync(libraryPath, { recursive: true });
fs.mkdirSync(chunkIndexDir, { recursive: true });
fs.writeFileSync(path.join(libraryPath, '1.txt'), '첫 문단\n\n둘째 문단', 'utf8');
fs.writeFileSync(path.join(libraryPath, '2.txt'), '셋째 문단\n\n넷째 문단', 'utf8');
const novel = { id: 'n1', title: '묶음', isMultiFile: true, episodes: [
  { id: 'e1', title: '1화', path: '1.txt' },
  { id: 'e2', title: '2화', path: '2.txt' }
] };
const libraryService = { getLibraryCached() { return [novel]; }, safeJoinUnderLibrary(rel) { return path.join(libraryPath, rel); } };
const contentService = createContentService({ chunkIndexDir });
(async () => {
  const firstService = createBlockManifestService({ libraryPath, libraryService, contentService, manifestDiskCacheDir });
  const first = await firstService.getSingleManifest('n1', {});
  assert.strictEqual(first.status, 200, 'first folder manifest request failed');
  assert.ok(first.body.episodes.every(ep => ep.episodeManifestDiskCachePass === PASS), 'built episode manifests must carry episode cache marker');
  const secondService = createBlockManifestService({ libraryPath, libraryService, contentService, manifestDiskCacheDir });
  novel.episodes = [novel.episodes[1], novel.episodes[0]];
  const second = await secondService.getSingleManifest('n1', {});
  assert.strictEqual(second.status, 200, 'second reordered folder manifest request failed');
  const status = secondService.getCacheStatus();
  assert.ok(status.episodeDiskCacheMarker === PASS, 'status must expose episode disk marker');
  assert.ok(status.metrics.episodeManifestDiskHits >= 2, 'reordered folder should reuse episode-level manifests');
  console.log(JSON.stringify({ pass: PASS }));
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
