#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLibraryService, LIBRARY_STALE_WHILE_REVALIDATE_PASS, LIBRARY_SHELF_INDEX_PASS, LIBRARY_COMPLETE_SCAN_PASS } = require('../../server/services/library-service');

const PASS = 'v567-library-stale-while-revalidate-smoke-pass';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v567-library-'));
  try {
    fs.writeFileSync(path.join(root, 'B 작품.txt'), 'b', 'utf8');
    fs.writeFileSync(path.join(root, 'A 작품.txt'), 'a', 'utf8');
    const service = createLibraryService({
      libraryPath: root,
      encodeStableId: value => Buffer.from(String(value)).toString('base64url'),
      libraryCacheTtlMs: 5,
      libraryDeepSignatureCheckTtlMs: 5
    });

    const first = service.getLibraryCached();
    assert.equal(first.length, 2);
    assert.equal(service.getCacheStatus().libraryCache.buildCount, 1);
    assert.deepEqual(service.getShelfTitleCatalog().map(item => item.title), ['A 작품', 'B 작품']);
    assert.ok(first.every(item => typeof item.shelfSearchKey === 'string' && item.shelfSearchKey.includes('작품')));

    await wait(15);
    const unchanged = service.getLibraryCached();
    assert.strictEqual(unchanged, first, 'elapsed compatibility TTL must not force a rebuild');
    assert.equal(service.getCacheStatus().libraryCache.buildCount, 1, 'unchanged library must retain one build');

    fs.writeFileSync(path.join(root, 'C 작품.txt'), 'c', 'utf8');
    await wait(15);
    const stale = service.getLibraryCached();
    assert.strictEqual(stale, first, 'change-triggering request must receive the last known-good snapshot');
    const pending = service.getCacheStatus();
    assert.equal(pending.libraryCache.staleWhileRevalidatePass, LIBRARY_STALE_WHILE_REVALIDATE_PASS);
    assert.equal(pending.libraryCache.shelfIndexPass, LIBRARY_SHELF_INDEX_PASS);
    assert.ok(pending.metrics.staleSnapshotServes >= 1);
    assert.ok(
      pending.libraryCache.signatureCheckScheduled || pending.libraryCache.signatureCheckInProgress ||
      pending.libraryCache.refreshScheduled || pending.libraryCache.refreshInProgress,
      'changed library must schedule asynchronous inspection or refresh'
    );

    const deadline = Date.now() + 2000;
    let refreshed = service.getLibraryCached();
    while (refreshed.length !== 3 && Date.now() < deadline) {
      await wait(20);
      refreshed = service.getLibraryCached();
    }
    assert.equal(refreshed.length, 3, 'asynchronous inspection must eventually publish the rebuilt snapshot');
    const done = service.getCacheStatus();
    assert.equal(done.libraryCache.buildCount, 2);
    assert.ok(done.metrics.backgroundRefreshCompleted >= 1);
    assert.deepEqual(service.getShelfTitleCatalog().map(item => item.title), ['A 작품', 'B 작품', 'C 작품']);

    // A transient SMB/stat failure must preserve the last-known-good snapshot.
    const originalStat = fs.promises.stat;
    fs.promises.stat = async (candidate) => {
      if (path.resolve(String(candidate)) === path.resolve(root)) {
        const error = new Error('simulated SMB disconnect');
        error.code = 'EIO';
        throw error;
      }
      return originalStat(candidate);
    };
    try {
      await wait(15);
      const duringFailure = service.getLibraryCached();
      assert.strictEqual(duringFailure, refreshed);
      await wait(80);
      const failedStatus = service.getCacheStatus();
      assert.equal(failedStatus.libraryCache.buildCount, 2, 'transient stat failure must not publish an empty snapshot');
      assert.equal(service.getLibraryCached().length, 3);
      assert.ok(failedStatus.metrics.asyncSignatureChecksFailed >= 1);
    } finally {
      fs.promises.stat = originalStat;
    }

    // A transient error in one nested SMB directory must abort the entire rebuild.
    const nestedA = path.join(root, 'nested-a');
    const nestedB = path.join(root, 'nested-b');
    fs.mkdirSync(nestedA);
    fs.mkdirSync(nestedB);
    fs.writeFileSync(path.join(nestedA, 'A nested.txt'), 'a', 'utf8');
    fs.writeFileSync(path.join(nestedB, 'B nested.txt'), 'b', 'utf8');
    await service.invalidateLibraryCache({ reason:'nested-fixture-added' });
    let nestedSnapshot = service.getLibraryCached();
    const nestedDeadline = Date.now() + 2000;
    while (nestedSnapshot.length !== 5 && Date.now() < nestedDeadline) {
      await wait(20);
      nestedSnapshot = service.getLibraryCached();
    }
    assert.equal(nestedSnapshot.length, 5);
    const nestedBuildCount = service.getCacheStatus().libraryCache.buildCount;
    const originalReadDirSync = fs.readdirSync;
    fs.readdirSync = (candidate, options) => {
      if (path.resolve(String(candidate)) === path.resolve(nestedB)) {
        const error = new Error('simulated nested SMB read failure');
        error.code = 'EIO';
        throw error;
      }
      return originalReadDirSync(candidate, options);
    };
    try {
      assert.throws(() => service.refreshLibraryCacheNow('nested-smb-failure'), error => error && error.code === 'LIBRARY_SCAN_INCOMPLETE');
      const preserved = service.getLibraryCached();
      assert.strictEqual(preserved, nestedSnapshot, 'nested scan failure must retain the last known-good snapshot object');
      const nestedStatus = service.getCacheStatus();
      assert.equal(nestedStatus.libraryCache.buildCount, nestedBuildCount, 'incomplete nested scans must not increment build count');
      assert.equal(nestedStatus.libraryCache.completeScanPass, LIBRARY_COMPLETE_SCAN_PASS);
      assert.match(nestedStatus.libraryCache.lastRefreshError, /library scan failed/);
    } finally {
      fs.readdirSync = originalReadDirSync;
    }
    return { pass: PASS, builds: service.getCacheStatus().libraryCache.buildCount, staleServes: done.metrics.staleSnapshotServes };
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
