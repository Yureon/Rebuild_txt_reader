#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService, detectImage, detectHeifFamily } = require('../../server/services/metadata-cover-service');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

function bmpFixture() {
  const buffer = Buffer.alloc(58);
  buffer.write('BM', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length, 2);
  buffer.writeUInt32LE(54, 10);
  buffer.writeUInt32LE(40, 14);
  buffer.writeInt32LE(1, 18);
  buffer.writeInt32LE(1, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer[54] = 0x11; buffer[55] = 0x22; buffer[56] = 0x33;
  return buffer;
}

function heicFixture() {
  const buffer = Buffer.alloc(24);
  buffer.writeUInt32BE(24, 0);
  buffer.write('ftyp', 4, 'ascii');
  buffer.write('heic', 8, 'ascii');
  buffer.writeUInt32BE(0, 12);
  buffer.write('mif1', 16, 'ascii');
  buffer.write('heic', 20, 'ascii');
  return buffer;
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v665-cover-recognition-'));
  const service = createMetadataCoverService({
    coverDir:path.join(temp, 'covers'),
    transport:{ fetchProvider:async () => { throw new Error('not used'); } },
    manualUploadMaxBytes:256 * 1024,
    minOrphanAgeMs:60 * 60 * 1000,
    pruneIntervalMs:60 * 60 * 1000,
    logger:{ warn(){}, error(){} }
  });
  try {
    const bmp = bmpFixture();
    assert.deepStrictEqual(detectImage(bmp, 'text/plain'), { ext:'bmp', mime:'image/bmp' });
    const truncatedBmp = Buffer.from(bmp.subarray(0, 54));
    assert.equal(detectImage(truncatedBmp, 'image/bmp'), null, 'truncated BMP header without pixel data must be rejected');
    const uploaded = await service.cacheUploadedCover(bmp, { contentType:'text/plain', filename:'표지 이미지.bmp' });
    assert.equal(uploaded.ext, 'bmp');
    assert.equal(uploaded.mime, 'image/bmp');
    assert(fs.existsSync(path.join(temp, 'covers', `${uploaded.assetId}.bmp`)));
    assert(await service.verifyAssetAsync(uploaded.assetId), 'BMP content-addressed asset must verify');

    const jpeg = Buffer.concat([Buffer.from([0xff,0xd8,0xff,0xe0]), Buffer.alloc(128, 0x42)]);
    const mislabeled = await service.cacheUploadedCover(jpeg, { contentType:'application/json', filename:'cover.file' });
    assert.equal(mislabeled.ext, 'jpg', 'signature must win over a wrong browser MIME type');

    const heic = heicFixture();
    assert.equal(detectHeifFamily(heic), 'heic');
    await assert.rejects(
      () => service.cacheUploadedCover(heic, { contentType:'image/heic', filename:'iphone.heic' }),
      error => error && error.code === 'METADATA_COVER_UNSUPPORTED_FORMAT' && /JPEG/u.test(error.message)
    );

    const api = read('public/scripts/rebuild/core/api.mjs');
    const routes = read('server/routes/metadata-routes.js');
    const page = read('public/scripts/rebuild/metadata-page.mjs');
    const library = read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
    assert(api.includes("headers.set('Content-Type', 'application/octet-stream')"), 'manual upload must not trust File.type for parser selection');
    assert(api.includes("headers.set('X-Cover-Original-Type'"));
    assert(routes.includes("req.headers['x-cover-original-type']"));
    assert(routes.includes("status:415"));
    for (const source of [page, library]) {
      assert(source.includes('.jfif'));
      assert(source.includes('.bmp'));
      assert(source.includes('BMP · 최대'));
    }

    console.log(JSON.stringify({
      pass:'v665-manual-cover-recognition-pass',
      bmpAccepted:true,
      mislabeledMimeAccepted:true,
      heicExplained:true,
      binaryTransport:true
    }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
