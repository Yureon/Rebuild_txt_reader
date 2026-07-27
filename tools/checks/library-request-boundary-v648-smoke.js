#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLibraryService } = require('../../server/services/library-service');

const PASS = 'v648-library-request-boundary-smoke-pass';

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v648-request-'));
  try {
    fs.writeFileSync(path.join(root, 'one.txt'), 'one', 'utf8');
    const service = createLibraryService({
      libraryPath:root,
      encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
      allowSynchronousColdBuild:false,
      libraryRequestColdWaitMs:2000
    });
    assert.throws(() => service.getLibraryCached(), error => error && error.code === 'LIBRARY_SYNC_COLD_BUILD_DISABLED' && error.status === 503);
    const catalog = await service.getLibraryCachedForRequestAsync();
    assert.equal(catalog.length, 1);
    assert.equal(service.getCacheStatus().libraryCache.allowSynchronousColdBuild, false);

    const requestConsumers = [
      'server/app.js',
      'server/routes/admin-users-routes.js',
      'server/routes/block-manifest-routes.js',
      'server/routes/metadata-routes.js',
      'server/routes/novels-routes.js',
      'server/routes/user-access-routes.js',
      'server/services/admin-diagnostics-service.js',
      'server/services/block-manifest-service.js',
      'server/services/fileops-service.js',
      'server/services/library-cleanup-service.js',
      'server/services/library-organization-service.js'
    ];
    for (const file of requestConsumers) {
      const source = fs.readFileSync(path.resolve(__dirname, '../..', file), 'utf8');
      assert.ok(source.includes('getLibraryCachedForRequestAsync'), `${file} must prefer bounded catalog access`);
    }
    const app = fs.readFileSync(path.resolve(__dirname, '../../server/app.js'), 'utf8');
    assert.ok(app.includes('allowSynchronousColdBuild:false'));
    const asyncRoute = fs.readFileSync(path.resolve(__dirname, '../../server/utils/async-route.js'), 'utf8');
    assert.ok(asyncRoute.includes("LIBRARY_SYNC_COLD_BUILD_DISABLED"));
    assert.ok(asyncRoute.includes("retryAfterSeconds"));
    return { pass:PASS, consumers:requestConsumers.length, catalogCount:catalog.length };
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
