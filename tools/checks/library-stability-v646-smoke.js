#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const {
  atomicWriteCompressedJsonAsync,
  COMPRESSED_JSON_SINGLE_SERIALIZE_PASS,
  COMPRESSED_JSON_TRUSTED_BACKUP_PASS
} = require('../../server/repositories/compressed-json-file-store');
const {
  createMetadataStoreService,
  METADATA_PRESENTATION_REVISION_PASS,
  METADATA_SINGLE_SERIALIZE_WRITE_PASS,
  METADATA_STARTUP_COMPACTION_PASS
} = require('../../server/services/metadata-store-service');
const {
  createLibraryService,
  LIBRARY_REQUEST_STABILITY_PASS,
  LIBRARY_DURABLE_CATALOG_PASS,
  LIBRARY_COLD_FAILURE_BACKOFF_PASS
} = require('../../server/services/library-service');

const PASS = 'v646-library-stability-smoke-pass';
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function checkCompressedStore(dir) {
  const file = path.join(dir, 'state.json.gz');
  const firstJson = Buffer.from(JSON.stringify({ version:1, payload:'first' }), 'utf8');
  const poison = {};
  Object.defineProperty(poison, 'toJSON', { value() { throw new Error('serializedJson contract was ignored'); } });
  const first = await atomicWriteCompressedJsonAsync(file, poison, { serializedJson:firstJson, level:6 });
  assert.equal(first.singleSerializePass, COMPRESSED_JSON_SINGLE_SERIALIZE_PASS);
  assert.equal(first.trustedBackupPass, COMPRESSED_JSON_TRUSTED_BACKUP_PASS);
  assert.equal(first.primarySha256, hash(fs.readFileSync(file)));
  assert.deepEqual(JSON.parse(zlib.gunzipSync(fs.readFileSync(file))), { version:1, payload:'first' });

  const firstBytes = fs.readFileSync(file);
  const second = await atomicWriteCompressedJsonAsync(file, { version:2 }, {
    serializedJson:Buffer.from(JSON.stringify({ version:2, payload:'second' })),
    trustedPrimarySha256:first.primarySha256
  });
  assert.equal(second.backupTrusted, true);
  assert.deepEqual(fs.readFileSync(`${file}.bak`), firstBytes, 'trusted valid primary must become backup');

  const backupBeforeTamper = fs.readFileSync(`${file}.bak`);
  const tampered = Buffer.from(fs.readFileSync(file));
  tampered[Math.max(0, tampered.length - 2)] ^= 0x01;
  fs.writeFileSync(file, tampered);
  const third = await atomicWriteCompressedJsonAsync(file, { version:3 }, {
    serializedJson:Buffer.from(JSON.stringify({ version:3, payload:'third' })),
    trustedPrimarySha256:second.primarySha256
  });
  assert.equal(third.backupTrusted, false, 'tampered primary must not replace the last known-good backup');
  assert.deepEqual(fs.readFileSync(`${file}.bak`), backupBeforeTamper);
  assert.deepEqual(JSON.parse(zlib.gunzipSync(fs.readFileSync(file))), { version:3, payload:'third' });
}

async function checkMetadataRevisions(dir) {
  const storePath = path.join(dir, 'work-metadata.json');
  const store = createMetadataStoreService({ storePath, logger:{ warn(){} } });
  assert.equal(store.presentationRevisionPass, METADATA_PRESENTATION_REVISION_PASS);
  assert.equal(store.singleSerializeWritePass, METADATA_SINGLE_SERIALIZE_WRITE_PASS);
  assert.equal(store.startupCompactionPass, METADATA_STARTUP_COMPACTION_PASS);

  const initial = {
    global:store.getRevision(),
    applied:store.getAppliedRevision(),
    candidates:store.getCandidateRevision(),
    settings:store.getSettingsRevision()
  };
  const novel = { id:'novel-a', title:'안정성 작품', author:'작가', progressAliases:[] };
  const provider = { id:'builtin-test', name:'테스트', adapterKey:'fixture', adapter:{ revision:1 } };
  const candidate = store.saveCandidate(novel, provider, {
    title:'안정성 작품', author:'작가', synopsis:'후보 변경은 서재 표시 캐시를 깨면 안 된다.', sourceUrl:'https://example.test/series/1', remoteId:'1'
  }, { matchScore:0.99, query:'안정성 작품' });
  assert.equal(store.getAppliedRevision(), initial.applied, 'candidate churn must not change presentation revision');
  assert.equal(store.getCandidateRevision(), initial.candidates + 1);

  store.setProviderSettings(provider.id, { enabled:true, priority:3 });
  assert.equal(store.getAppliedRevision(), initial.applied, 'provider settings must not change presentation revision');
  assert.equal(store.getSettingsRevision(), initial.settings + 1);

  store.applyCandidate(novel, candidate.id, ['title','author','synopsis']);
  assert.equal(store.getAppliedRevision(), initial.applied + 1, 'applied metadata must change presentation revision');
  await store.flush();
  const persistedCandidateRevision = store.getCandidateRevision();
  const persistedAppliedRevision = store.getAppliedRevision();
  await store.close();

  const compressedPath = `${storePath}.gz`;
  const persisted = JSON.parse(zlib.gunzipSync(fs.readFileSync(compressedPath)).toString('utf8'));
  assert.equal(persisted.maintenance.candidateCompactionVersion, 2);
  assert.equal(persisted.revisions.applied, persistedAppliedRevision);
  assert.equal(persisted.revisions.candidates, persistedCandidateRevision);

  const reload = createMetadataStoreService({ storePath, logger:{ warn(){} } });
  assert.equal(reload.getAppliedRevision(), persistedAppliedRevision);
  assert.equal(reload.getCandidateRevision(), persistedCandidateRevision, 'startup compaction must not rerun after marker persistence');
  await reload.close();
}

async function checkColdBuildBackpressure(dir) {
  const libraryRoot = path.join(dir, 'library');
  fs.mkdirSync(libraryRoot, { recursive:true });
  fs.writeFileSync(path.join(libraryRoot, '작품.txt'), '본문', 'utf8');
  const service = createLibraryService({
    libraryPath:libraryRoot,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
    libraryRequestColdWaitMs:250
  });

  const originalReadDir = fs.promises.readdir;
  let delayed = false;
  fs.promises.readdir = async (...args) => {
    if (!delayed && path.resolve(String(args[0])) === path.resolve(libraryRoot)) {
      delayed = true;
      await wait(450);
    }
    return originalReadDir.apply(fs.promises, args);
  };
  try {
    const settled = await Promise.allSettled([
      service.getLibraryCachedForRequestAsync({ waitMs:250 }),
      service.getLibraryCachedForRequestAsync({ waitMs:250 })
    ]);
    assert(settled.every(item => item.status === 'rejected' && item.reason?.code === 'LIBRARY_COLD_BUILD_PENDING'));
    assert(settled.every(item => item.reason?.pass === LIBRARY_REQUEST_STABILITY_PASS));
  } finally {
    fs.promises.readdir = originalReadDir;
  }

  const deadline = Date.now() + 3000;
  let library = null;
  while (!library && Date.now() < deadline) {
    try { library = await service.getLibraryCachedForRequestAsync({ waitMs:1000 }); }
    catch (error) { if (error?.code !== 'LIBRARY_COLD_BUILD_PENDING') throw error; }
  }
  assert.equal(library?.length, 1, 'single background cold build must eventually publish the catalog');
  const status = service.getCacheStatus();
  assert.equal(status.libraryCache.requestStabilityPass, LIBRARY_REQUEST_STABILITY_PASS);
  assert.equal(status.metrics.asyncBuildsStarted, 1, 'concurrent cold requests must share one build');
  assert(status.metrics.asyncBuildInflightJoins >= 1);
  assert(status.metrics.requestColdTimeouts >= 2);
}


async function checkDurableCatalogAndFailureBackoff(dir) {
  const libraryRoot = path.join(dir, 'durable-library');
  const cachePath = path.join(dir, 'library-catalog-cache.json.gz');
  fs.mkdirSync(libraryRoot, { recursive:true });
  fs.writeFileSync(path.join(libraryRoot, '마지막 정상 목록.txt'), '본문', 'utf8');
  const makeService = extra => createLibraryService({
    libraryPath:libraryRoot,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
    catalogCachePath:cachePath,
    catalogCacheWriteDelayMs:0,
    coldFailureBackoffBaseMs:1000,
    coldFailureBackoffMaxMs:4000,
    ...extra
  });

  const first = makeService();
  const built = first.getLibraryCached();
  assert.equal(built.length, 1);
  assert.equal(await first.flushDurableCatalogCache(), true);
  assert(fs.existsSync(cachePath));
  const durablePayload = JSON.parse(zlib.gunzipSync(fs.readFileSync(cachePath)).toString('utf8'));
  assert.equal(durablePayload.pass, LIBRARY_DURABLE_CATALOG_PASS);
  assert.equal(durablePayload.data.length, 1);

  const restored = makeService();
  const restoredList = restored.getLibraryCached();
  assert.equal(restoredList.length, 1, 'restart must serve the last valid durable catalog before a new SMB scan');
  assert.equal(restoredList[0].title, '마지막 정상 목록');
  const restoredStatus = restored.getCacheStatus();
  assert.equal(restoredStatus.libraryCache.durableCatalogPass, LIBRARY_DURABLE_CATALOG_PASS);
  assert.equal(restoredStatus.libraryCache.durableCatalogLoaded, true);
  assert.equal(restoredStatus.metrics.durableCatalogLoads, 1);

  const failingRoot = path.join(dir, 'failing-library');
  fs.mkdirSync(failingRoot, { recursive:true });
  const failing = createLibraryService({
    libraryPath:failingRoot,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
    libraryRequestColdWaitMs:1000,
    coldFailureBackoffBaseMs:1000,
    coldFailureBackoffMaxMs:4000
  });
  const originalStat = fs.promises.stat;
  fs.promises.stat = async candidate => {
    if (path.resolve(String(candidate)) === path.resolve(failingRoot)) {
      const error = new Error('simulated SMB cold scan failure');
      error.code = 'EIO';
      throw error;
    }
    return originalStat(candidate);
  };
  try {
    await assert.rejects(() => failing.getLibraryCachedForRequestAsync({ waitMs:1000 }), error => error && error.code === 'LIBRARY_COLD_BUILD_FAILED' && error.status === 503 && error.storageCode === 'EIO');
    await assert.rejects(() => failing.getLibraryCachedForRequestAsync({ waitMs:1000 }), error => error && error.code === 'LIBRARY_COLD_BUILD_BACKOFF' && error.pass === LIBRARY_COLD_FAILURE_BACKOFF_PASS);
    await assert.rejects(() => failing.getLibraryCachedAsync(), error => error && error.code === 'LIBRARY_COLD_BUILD_BACKOFF' && error.status === 503);
    const failedStatus = failing.getCacheStatus();
    assert.equal(failedStatus.metrics.asyncBuildsStarted, 1, 'failure backoff must block repeated full scans');
    assert.equal(failedStatus.metrics.requestColdBackoffRejects, 2);
    assert(failedStatus.libraryCache.coldFailureBackoffUntil > Date.now());
  } finally {
    fs.promises.stat = originalStat;
  }
}

async function run() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v646-stability-'));
  try {
    await checkCompressedStore(dir);
    await checkMetadataRevisions(dir);
    await checkColdBuildBackpressure(dir);
    await checkDurableCatalogAndFailureBackoff(dir);
    return { pass:PASS, gzipRetained:true, presentationRevisionSeparated:true, coldBuildCoalesced:true, durableCatalog:true, failureBackoff:true };
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
