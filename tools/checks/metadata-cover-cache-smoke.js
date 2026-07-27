#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService, detectImage } = require('../../server/services/metadata-cover-service');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-cover-'));
  try {
    const png = Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0,73,69,78,68]);
    let calls = 0;
    let receivedOptions = null;
    const transport = {
      async fetchProvider(_provider, _url, options) {
        calls += 1;
        receivedOptions = options;
        return { body:png, contentType:'image/png', finalUrl:'https://images.example/cover.png' };
      }
    };
    const service = createMetadataCoverService({ coverDir:root, transport });
    const signal = new AbortController().signal;
    const first = await service.cacheRemoteCover({ id:'p' }, 'https://images.example/cover.png', { referer:'https://example/work', cookie:'secret=1', signal });
    const second = await service.cacheRemoteCover({ id:'p' }, 'https://images.example/cover.png', { signal });
    assert.equal(first.assetId, second.assetId);
    assert.equal(calls, 2);
    assert.equal(receivedOptions.signal, signal);
    const asset = service.findAsset(first.assetId);
    assert(asset && asset.mime === 'image/png');
    if (process.platform !== 'win32') assert.equal(fs.statSync(asset.filePath).mode & 0o777, 0o600);
    assert.deepStrictEqual(detectImage(Buffer.from('<svg></svg>'), 'image/svg+xml'), null);

    const invalid = createMetadataCoverService({ coverDir:path.join(root, 'invalid'), transport:{ async fetchProvider(){ return { body:Buffer.from('<html>no</html>'), contentType:'text/html' }; } } });
    await assert.rejects(() => invalid.cacheRemoteCover({ id:'p' }, 'https://images.example/no'), error => error && error.code === 'METADATA_COVER_INVALID');
    console.log(JSON.stringify({ pass:'v576-metadata-cover-cache-smoke-pass', assetId:first.assetId, calls }));
  } finally { fs.rmSync(root, { recursive:true, force:true }); }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
