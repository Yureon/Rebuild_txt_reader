'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v606-cover-scope-'));
  try {
    const store = createMetadataStoreService({ storePath:path.join(dir, 'metadata.json') });
    const provider = { id:'provider-a', name:'Provider A', adapterKey:'a', revision:1 };
    const novels = Array.from({ length:5000 }, (_, index) => ({ id:`novel-${index}`, title:`작품 ${index}`, author:`작가 ${index}`, progressAliases:[`legacy-${index}`] }));
    const target = novels[4321];
    const candidate = store.saveCandidate(target, provider, {
      title:target.title,
      author:target.author,
      remoteId:'remote-cover',
      sourceUrl:'https://example.invalid/cover',
      coverAssetId:'a'.repeat(64),
      coverUrlLocal:'/api/metadata/covers/' + 'a'.repeat(64)
    });
    store.applyCandidate(target, candidate.id, ['cover']);
    const scope = store.createCoverAccessScope(novels);
    assert.strictEqual(scope.novelCount, 5000);
    assert.strictEqual(store.canAccessCoverWithScope('a'.repeat(64), scope), true);
    const deniedScope = store.createCoverAccessScope(novels.slice(0, 100));
    assert.strictEqual(store.canAccessCoverWithScope('a'.repeat(64), deniedScope), false);
    const started = process.hrtime.bigint();
    for (let index = 0; index < 10000; index += 1) store.canAccessCoverWithScope('a'.repeat(64), scope);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
    assert.ok(elapsedMs < 500, `cached cover checks must remain set-based, measured ${elapsedMs.toFixed(1)}ms`);

    const routeSource = fs.readFileSync(path.join(__dirname, '../../server/routes/metadata-routes.js'), 'utf8');
    assert.ok(routeSource.includes('coverAccessScopeCache'));
    assert.ok(routeSource.includes('signatureGeneration'));
    assert.ok(routeSource.includes('canAccessCoverWithScope'));
    console.log(JSON.stringify({ pass:'v606-metadata-cover-access-scope-pass', elapsedMs:Number(elapsedMs.toFixed(2)) }));
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
