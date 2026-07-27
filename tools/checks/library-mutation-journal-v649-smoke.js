#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createLibraryService } = require('../../server/services/library-service');
const { createFileopsService } = require('../../server/services/fileops-service');

const PASS = 'v649-library-mutation-journal-smoke-pass';

function makeService(libraryPath, cachePath) {
  return createLibraryService({
    libraryPath,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url'),
    catalogCachePath:cachePath,
    catalogCacheWriteDelayMs:60_000,
    libraryDeepSignatureCheckTtlMs:60_000
  });
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v649-journal-'));
  try {
    const libraryPath = path.join(root, 'library');
    const cachePath = path.join(root, 'data', 'library-catalog-cache.json.gz');
    fs.mkdirSync(libraryPath, { recursive:true });
    for (let index = 0; index < 130; index += 1) { const dir=path.join(libraryPath, `작품-${String(index).padStart(3,'0')}-고유제목`); fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'1화.txt'), `body-${index}`); }

    const service = makeService(libraryPath, cachePath);
    const initial = service.getLibraryCached();
    assert.equal(initial.length, 130);
    assert.equal(await service.flushDurableCatalogCache(), true);
    for (const novel of initial) {
      const token = await service.beginLibraryMutation({ reason:'bulk-delete-test', novelIds:[novel.id] });
      fs.rmSync(path.join(libraryPath, novel.storagePath || novel.path || novel.singlePath), { recursive:true, force:true });
      await service.commitLibraryMutation(token);
    }
    assert.equal(service.getLibraryCached().length, 0);
    const state = JSON.parse(fs.readFileSync(`${cachePath}.state.json`, 'utf8'));
    const protectedIds = new Set(state.tombstones.flatMap(item => item.novelIds || []));
    assert.equal(protectedIds.size, 130, 'all mutations must survive compaction; no 128-entry truncation');

    const restored = makeService(libraryPath, cachePath);
    assert.equal(restored.getLibraryCached().length, 0, 'durable catalog must not resurrect any of 130 deleted novels');

    const failRoot = path.join(root, 'preflight-failure');
    const failLibrary = path.join(failRoot, 'library');
    const failCache = path.join(failRoot, 'data', 'library-catalog-cache.json.gz');
    fs.mkdirSync(failLibrary, { recursive:true });
    const source = path.join(failLibrary, 'keep-me.txt');
    fs.writeFileSync(source, 'must survive');
    const failService = makeService(failLibrary, failCache);
    const [novel] = failService.getLibraryCached();
    fs.mkdirSync(`${failCache}.state.json`, { recursive:true }); // force atomic rename/write failure
    const fileops = createFileopsService({ libraryService:failService, logger:{ warn(){} } });
    await assert.rejects(
      () => fileops.deleteNovel({ novelId:novel.id }),
      error => error && error.code === 'LIBRARY_MUTATION_STATE_UNAVAILABLE' && Number(error.statusCode || error.status) === 503
    );
    assert.equal(fs.existsSync(source), true, 'filesystem mutation must not start if the journal preflight fails');

    await service.closeDurableCatalogCache();
    await restored.closeDurableCatalogCache();
    await failService.closeDurableCatalogCache();
    return { pass:PASS, protectedIds:protectedIds.size, preflightProtected:true };
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

if (require.main === module) run().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error); process.exit(1); });
module.exports = { PASS, run };
