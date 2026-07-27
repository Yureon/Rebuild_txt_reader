#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createBlockManifestService,
  BLOCK_MANIFEST_ASYNC_IO_PASS
} = require('../../server/services/block-manifest-service.js');

const PASS = 'v591-block-manifest-async-io-smoke-pass';
assert.strictEqual(BLOCK_MANIFEST_ASYNC_IO_PASS, 'v591-block-manifest-async-io-pass');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-block-manifest-async-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const libraryPath = path.join(tmp, 'library');
const manifestDiskCacheDir = path.join(tmp, 'manifests');
fs.mkdirSync(libraryPath, { recursive: true });
fs.writeFileSync(path.join(libraryPath, '1.txt'), '첫 문단\n\n둘째 문단', 'utf8');
fs.writeFileSync(path.join(libraryPath, '2.txt'), '셋째 문단\n\n넷째 문단', 'utf8');

const novel = {
  id: 'n1',
  title: '비동기 매니페스트',
  isMultiFile: true,
  episodes: [
    { id: 'e1', title: '1화', path: '1.txt' },
    { id: 'e2', title: '2화', path: '2.txt' }
  ]
};
const libraryService = {
  getLibraryCached() { return [novel]; },
  safeJoinUnderLibrary(rel) { return path.join(libraryPath, rel); }
};
const contentService = {
  parsePreprocessOptionsFromQuery() { return {}; },
  serializePreprocessOptions() { return '{}'; },
  async getCachedFileEntryAsync(filePath) {
    const stat = await fs.promises.stat(filePath);
    const text = await fs.promises.readFile(filePath, 'utf8');
    return {
      filePath,
      text,
      textHash: `hash:${path.basename(filePath)}:${text.length}`,
      statSig: `${stat.size}:${Math.floor(stat.mtimeMs)}`
    };
  },
  getTotalChunks() { return 1; },
  async getChunkByLineAsync(entry) {
    return { content: entry.text, start: 0, end: entry.text.length };
  },
  async withCachedFileHandle(_entry, callback) { return callback(null); },
  getTotalChars(entry) { return entry.text.length; }
};

const blocked = ['existsSync', 'readFileSync', 'writeFileSync', 'renameSync', 'mkdirSync', 'realpathSync', 'statSync'];
const originals = new Map();
function blockSyncIo() {
  for (const name of blocked) {
    originals.set(name, fs[name]);
    fs[name] = function blockedSyncIo() {
      throw new Error(`synchronous fs call reached request path: ${name}`);
    };
  }
}
function restoreSyncIo() {
  for (const [name, fn] of originals) fs[name] = fn;
  originals.clear();
}

(async () => {
  blockSyncIo();
  try {
    const coldService = createBlockManifestService({
      libraryPath,
      libraryService,
      contentService,
      manifestDiskCacheDir,
      folderManifestHotCacheTtlMs: 0,
      folderSignatureCacheTtlMs: 0,
      episodeDiskCacheDuringFolderBuild: true
    });
    const cold = await coldService.getSingleManifest('n1', { folderManifestScope: 'full' });
    assert.strictEqual(cold.status, 200);
    assert.strictEqual(cold.body.blockManifestAsyncIoPass, BLOCK_MANIFEST_ASYNC_IO_PASS);
    const coldStatus = coldService.getCacheStatus();
    assert.strictEqual(coldStatus.asyncIoMarker, BLOCK_MANIFEST_ASYNC_IO_PASS);
    assert.ok(coldStatus.metrics.asyncStatSignatureCalls >= 2, 'folder signature must use async stat');
    assert.ok(coldStatus.metrics.asyncDiskWriteCalls >= 3, 'folder and episode cache writes must be async');
    assert.ok(coldStatus.metrics.asyncSignatureConcurrencyPeak >= 1, 'async signature work must be measured');

    const warmService = createBlockManifestService({
      libraryPath,
      libraryService,
      contentService,
      manifestDiskCacheDir,
      folderManifestHotCacheTtlMs: 0,
      folderSignatureCacheTtlMs: 0,
      episodeDiskCacheDuringFolderBuild: true
    });
    const warm = await warmService.getSingleManifest('n1', { folderManifestScope: 'full' });
    assert.strictEqual(warm.status, 200);
    assert.strictEqual(warm.body.blockManifestAsyncIoPass, BLOCK_MANIFEST_ASYNC_IO_PASS);
    const warmStatus = warmService.getCacheStatus();
    assert.ok(warmStatus.metrics.manifestDiskHits >= 1, 'warm folder manifest must be read from async disk cache');
    assert.ok(warmStatus.metrics.asyncDiskReadCalls >= 1, 'async disk read metric must be recorded');
  } finally {
    restoreSyncIo();
  }
  console.log(JSON.stringify({ pass: PASS, marker: BLOCK_MANIFEST_ASYNC_IO_PASS }));
})().catch(error => {
  restoreSyncIo();
  console.error(error && error.stack || error);
  process.exit(1);
});
