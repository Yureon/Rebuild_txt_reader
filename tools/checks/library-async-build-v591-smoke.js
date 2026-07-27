#!/usr/bin/env node
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createLibraryService,
  LIBRARY_ASYNC_BUILD_PASS
} = require('../../server/services/library-service.js');

const PASS = 'v591-library-async-build-smoke-pass';
assert.strictEqual(LIBRARY_ASYNC_BUILD_PASS, 'v591-library-async-build-pass');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-library-async-build-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const libraryPath = path.join(tmp, 'library');
fs.mkdirSync(path.join(libraryPath, '판타지', '연재작'), { recursive: true });
fs.mkdirSync(path.join(libraryPath, '현대'), { recursive: true });
fs.writeFileSync(path.join(libraryPath, '판타지', '단권.txt'), '단권', 'utf8');
fs.writeFileSync(path.join(libraryPath, '판타지', '연재작', '1화.txt'), '첫 화', 'utf8');
fs.writeFileSync(path.join(libraryPath, '판타지', '연재작', '2화.txt'), '둘째 화', 'utf8');
fs.writeFileSync(path.join(libraryPath, '현대', '작품 001.txt'), '1', 'utf8');
fs.writeFileSync(path.join(libraryPath, '현대', '작품 002.txt'), '2', 'utf8');
fs.writeFileSync(path.join(libraryPath, '현대', '작품 003.txt'), '3', 'utf8');

const encodeStableId = value => crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 20);
const syncService = createLibraryService({ libraryPath, encodeStableId, libraryDeepSignatureCheckTtlMs: 60_000 });
const expected = syncService.getLibraryCached();

const blocked = ['existsSync', 'readFileSync', 'writeFileSync', 'readdirSync', 'statSync', 'lstatSync', 'realpathSync'];
const originals = new Map();
function blockSyncIo() {
  for (const name of blocked) {
    originals.set(name, fs[name]);
    fs[name] = () => { throw new Error(`synchronous library scan call reached async path: ${name}`); };
  }
}
function restoreSyncIo() {
  for (const [name, fn] of originals) fs[name] = fn;
  originals.clear();
}

(async () => {
  const asyncService = createLibraryService({ libraryPath, encodeStableId, libraryDeepSignatureCheckTtlMs: 60_000 });
  blockSyncIo();
  try {
    const [first, joined] = await Promise.all([
      asyncService.getLibraryCachedAsync(),
      asyncService.getLibraryCachedAsync()
    ]);
    assert.deepStrictEqual(first, expected, 'async build must preserve the synchronous catalog contract');
    assert.strictEqual(joined, first, 'concurrent cold requests must share the committed snapshot');
    const status = asyncService.getCacheStatus();
    assert.strictEqual(status.libraryCache.asyncBuildPass, LIBRARY_ASYNC_BUILD_PASS);
    assert.strictEqual(status.metrics.synchronousColdBuilds, 0, 'async route path must not use the synchronous cold scan');
    assert.strictEqual(status.metrics.asyncBuildsStarted, 1, 'only one cold async build may start');
    assert.strictEqual(status.metrics.asyncBuildsCompleted, 1);
    assert.ok(status.metrics.asyncBuildInflightJoins >= 1, 'concurrent callers must join the in-flight build');
    assert.strictEqual(status.libraryCache.asyncBuildInProgress, false);
  } finally {
    restoreSyncIo();
  }
  console.log(JSON.stringify({ pass: PASS, marker: LIBRARY_ASYNC_BUILD_PASS, novels: expected.length }));
})().catch(error => {
  restoreSyncIo();
  console.error(error && error.stack || error);
  process.exit(1);
});
