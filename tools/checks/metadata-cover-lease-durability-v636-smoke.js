#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function createService(coverDir) {
  return createMetadataCoverService({
    coverDir,
    transport:{ fetchProvider:async () => { throw new Error('not used'); } },
    maxCacheBytes:16 * 1024 * 1024,
    manualUploadMaxBytes:20 * 1024 * 1024,
    minOrphanAgeMs:0,
    pruneIntervalMs:60 * 60 * 1000,
    pendingAssetLeaseMs:60 * 1000,
    logger:{ warn(){}, error(){} }
  });
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v636-cover-lease-'));
  const coverDir = path.join(temp, 'covers');
  let first = createService(coverDir);
  let second = null;
  try {
    const jpeg = Buffer.alloc(17 * 1024 * 1024, 0x61);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
    const cover = await first.cacheUploadedCover(jpeg, { contentType:'image/jpeg' });
    const coverPath = path.join(coverDir, `${cover.assetId}.jpg`);
    const leasePath = path.join(coverDir, '.pending-cover-leases.json');
    assert(fs.existsSync(coverPath), 'uploaded cover must exist before restart');
    assert(fs.existsSync(leasePath), 'pending lease must be persisted before upload response');
    await first.stop();
    first = null;

    second = createService(coverDir);
    assert.equal(second.isAssetLeased(cover.assetId), true, 'pending lease must survive service restart');
    await second.pruneCache('restart-over-quota-fixture');
    assert(fs.existsSync(coverPath), 'startup/over-quota prune must preserve a restored lease');
    await second.releaseAssetLeaseDurably(cover.assetId);
    await second.pruneCache('released-after-restart-fixture');
    assert(!fs.existsSync(coverPath), 'released unreferenced over-quota cover may be pruned');

    const metadataService = read('server/services/metadata-service.js');
    const captureService = read('server/services/metadata-browser-capture-service.js');
    const manualRoutes = read('server/routes/metadata-routes.js');
    const metadataCoverBlock = metadataService.slice(metadataService.indexOf('async function cacheCandidateCover'), metadataService.indexOf('function detailMetadataScore'));
    assert(metadataCoverBlock.indexOf('await store.flush()') > metadataCoverBlock.indexOf('store.updateCandidateCover'));
    assert(metadataCoverBlock.indexOf('releaseAssetLeaseDurably') > metadataCoverBlock.indexOf('await store.flush()'));
    assert(captureService.indexOf('releaseAssetLeaseDurably') > captureService.indexOf('await store.flush()'));
    assert(manualRoutes.indexOf('releaseAssetLeaseDurably') > manualRoutes.indexOf('await metadataService.saveManualMetadata'));

    console.log(JSON.stringify({ pass:'v636-metadata-cover-lease-durability-smoke-pass', restartLease:true, flushBeforeRelease:true }));
  } finally {
    if (first) await first.stop().catch(() => {});
    if (second) await second.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
