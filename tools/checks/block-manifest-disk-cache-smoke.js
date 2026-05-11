#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createContentService } = require('../../server/services/content-service.js');
const { createBlockManifestService, BLOCK_MANIFEST_DISK_CACHE_PASS } = require('../../server/services/block-manifest-service.js');
const PASS = 'v457-block-manifest-disk-cache-smoke-pass';
assert.strictEqual(BLOCK_MANIFEST_DISK_CACHE_PASS, PASS);
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-block-manifest-'));
try {
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
  const libraryService = {
    getLibraryCached() { return [novel]; },
    safeJoinUnderLibrary(rel) { return path.join(libraryPath, rel); }
  };
  const contentService = createContentService({ chunkIndexDir });
  const firstService = createBlockManifestService({ libraryPath, libraryService, contentService, manifestDiskCacheDir });
  (async () => {
    const first = await firstService.getSingleManifest('n1', {});
    assert.strictEqual(first.status, 200, 'first manifest request failed');
    assert.strictEqual(first.body.folderManifestDiskCachePass, PASS, 'manifest marker missing');
    const secondService = createBlockManifestService({ libraryPath, libraryService, contentService, manifestDiskCacheDir });
    const second = await secondService.getSingleManifest('n1', {});
    assert.strictEqual(second.status, 200, 'second manifest request failed');
    const status = secondService.getCacheStatus();
    assert.ok(status.metrics.manifestDiskHits >= 1, 'disk hit metric missing');
    assert.strictEqual(second.body.folderSignatureHash, first.body.folderSignatureHash, 'disk hit should preserve folder signature');
    fs.writeFileSync(path.join(libraryPath, '2.txt'), '변경된 문단\n\n넷째 문단', 'utf8');
    const third = await secondService.getSingleManifest('n1', {});
    assert.notStrictEqual(third.body.folderSignatureHash, second.body.folderSignatureHash, 'file stat change must miss old folder signature');
    console.log(JSON.stringify({ pass: PASS }));
  })().catch(error => { console.error(error && error.stack || error); process.exit(1); });
} finally {
  process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
}
