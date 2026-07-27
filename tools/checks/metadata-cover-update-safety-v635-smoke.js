#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const { getMetadataSiteAdapter } = require('../../server/services/metadata-site-adapters');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v635-cover-'));
  const coverDir = path.join(temp, 'covers');
  const service = createMetadataCoverService({
    coverDir,
    transport:{ fetchProvider:async () => { throw new Error('not used'); } },
    maxCacheBytes:16 * 1024 * 1024,
    manualUploadMaxBytes:20 * 1024 * 1024,
    minOrphanAgeMs:0,
    pruneIntervalMs:60 * 60 * 1000,
    pendingAssetLeaseMs:60 * 1000,
    logger:{ warn(){}, error(){} }
  });
  try {
    const jpeg = Buffer.alloc(17 * 1024 * 1024, 0x61);
    jpeg[0] = 0xff; jpeg[1] = 0xd8; jpeg[2] = 0xff;
    const cover = await service.cacheUploadedCover(jpeg, { contentType:'image/jpeg' });
    const coverPath = path.join(coverDir, `${cover.assetId}.jpg`);
    assert(fs.existsSync(coverPath), 'new cover must be persisted');
    assert.equal(service.isAssetLeased(cover.assetId), true, 'new cover must be leased before metadata linkage');
    await service.pruneCache('lease-race-fixture');
    assert(fs.existsSync(coverPath), 'leased over-quota cover must survive pruning');
    service.releaseAssetLease(cover.assetId);
    await service.pruneCache('lease-released-fixture');
    assert(!fs.existsSync(coverPath), 'released unreferenced over-quota cover may be pruned');
    assert.equal(service.getStatus().manualUploadMaxBytes, 20 * 1024 * 1024);

    const adapter = getMetadataSiteAdapter('novelpia-webnovel-v1');
    const metaAdult = `<!doctype html><html><head>
      <link rel="canonical" href="https://novelpia.com/novel/282407">
      <meta property="og:title" content="성인 작품">
      <meta property="og:image" content="https://novelpia.com/img/novel/adult_cover_img.jpg">
      </head><body><div class="epnew-novel-title">성인 작품</div></body></html>`;
    assert.throws(() => adapter.parseDetail(metaAdult, 'https://novelpia.com/novel/282407', 8000), error => error?.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED');
    const linkedImage = `<!doctype html><html><head><link rel="canonical" href="https://novelpia.com/novel/282407"></head><body>
      <div class="epnew-cover-box"><a href="/novel/282407"><img src="//images.novelpia.com/imagebox/cover/real-cover.file"></a></div>
      <div class="epnew-novel-title">표지 작품</div></body></html>`;
    const parsed = adapter.parseDetail(linkedImage, 'https://novelpia.com/novel/282407', 8000);
    assert.equal(parsed.coverUrl, 'https://images.novelpia.com/imagebox/cover/real-cover.file');

    const routes = read('server/routes/metadata-routes.js');
    const app = read('server/app.js');
    const page = read('public/scripts/rebuild/metadata-page.mjs');
    const modal = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
    assert(routes.includes("limit:manualCoverMaxBytes") && !routes.includes("limit:'5mb'"), 'manual upload parser must use configured byte limit');
    assert(app.includes('manualUploadMaxBytes: METADATA_COVER_MAX_BYTES'));
    for (const source of [page, modal]) {
      assert(source.includes('manualCoverMaxBytes'));
      assert(source.includes('formatByteLimit'));
      assert(!source.includes('coverFile.size > 5 * 1024 * 1024'));
    }
    const coverSource = read('server/services/metadata-cover-service.js');
    assert(coverSource.includes('await syncCoverDirectory()'), 'cover rename must fsync the parent directory');

    console.log(JSON.stringify({ pass:'v635-metadata-cover-update-safety-smoke-pass', leaseProtected:true, novelpiaMetaAdultRejected:true }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
