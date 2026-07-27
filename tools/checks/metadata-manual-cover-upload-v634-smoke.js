#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

const root = path.resolve(__dirname, '../..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v634-manual-cover-'));
  const coverDir = path.join(temp, 'covers');
  const storePath = path.join(temp, 'metadata.json');
  const coverService = createMetadataCoverService({
    coverDir,
    transport:{ fetchProvider:async() => { throw new Error('manual upload must not use remote transport'); } },
    manualUploadMaxBytes:64 * 1024,
    minOrphanAgeMs:60 * 60 * 1000,
    pruneIntervalMs:60 * 60 * 1000,
    logger:{ warn(){}, error(){} }
  });
  let store = null;
  try {
    const png = Buffer.concat([
      Buffer.from([137,80,78,71,13,10,26,10]),
      Buffer.from('txt-reader-v634-manual-cover')
    ]);
    const cover = await coverService.cacheUploadedCover(png, { contentType:'image/png' });
    assert.equal(cover.mime, 'image/png');
    assert.equal(cover.ext, 'png');
    assert.equal(cover.url, `/api/metadata/covers/${cover.assetId}`);
    assert(fs.existsSync(path.join(coverDir, `${cover.assetId}.png`)));
    const duplicate = await coverService.cacheUploadedCover(png, { contentType:'application/octet-stream' });
    assert.equal(duplicate.assetId, cover.assetId, 'identical manual cover uploads must deduplicate by content hash');
    await assert.rejects(
      () => coverService.cacheUploadedCover(Buffer.from('<svg></svg>'), { contentType:'image/svg+xml' }),
      error => error && error.code === 'METADATA_COVER_INVALID'
    );

    store = createMetadataStoreService({ storePath });
    const novel = { id:'manual-cover-work', title:'수동 표지 작품', author:'사용자' };
    const applied = await store.saveManualMetadataDurably(novel, {
      coverAssetId:cover.assetId,
      coverUrlLocal:cover.url,
      fields:['cover']
    });
    assert.equal(applied.providerId, 'manual');
    assert.equal(applied.data.coverAssetId, cover.assetId);
    assert.equal(applied.data.coverUrl, cover.url);
    assert(store.canAccessCover(cover.assetId, [novel]));

    const routes = read('server/routes/metadata-routes.js');
    const api = read('public/scripts/rebuild/core/api.mjs');
    const page = read('public/scripts/rebuild/metadata-page.mjs');
    const modal = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
    const pageCss = read('public/styles/metadata-page.css');
    const appCss = read('public/styles/app.css');
    assert(routes.includes("'/novels/:novelId/metadata/manual-cover'"));
    assert(routes.includes("express.raw({ type:['application/octet-stream','image/*'], limit:manualCoverMaxBytes })"));
    assert(api.includes('uploadManualNovelCover') && api.includes('rawBody:file'));
    for (const source of [page, modal]) {
      const detailsLine = source.split(/\r?\n/u).find(line => line.includes("'details'") && line.includes('metadata-manual-editor')) || '';
      assert(detailsLine, 'manual editor must use a collapsible details element');
      assert(!/\bopen\s*:/u.test(detailsLine), 'manual editor must be collapsed by default');
      assert(source.includes('image/*,.jpg,.jpeg,.jfif,.png,.webp,.gif,.avif,.bmp'));
      assert(source.includes('BMP · 최대'));
      assert(source.includes('uploadManualNovelCover'));
      assert(source.includes('manualCoverMaxBytes'));
      assert(source.includes('formatByteLimit'));
      assert(!source.includes('coverFile.size > 5 * 1024 * 1024'));
    }
    for (const css of [pageCss, appCss]) {
      assert(css.includes('.metadata-manual-summary'));
      assert(css.includes('.metadata-manual-cover-upload'));
      assert(css.includes(".metadata-manual-editor[open]"));
    }

    console.log(JSON.stringify({
      pass:'v634-metadata-manual-cover-upload-smoke-pass',
      assetId:cover.assetId,
      collapsedByDefault:true
    }));
  } finally {
    if (store) await store.close().catch(() => {});
    await coverService.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
