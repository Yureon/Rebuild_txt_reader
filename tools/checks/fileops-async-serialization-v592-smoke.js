#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createFileopsService,
  FILEOPS_ASYNC_IO_PASS,
  FILEOPS_MUTATION_SERIALIZATION_PASS
} = require('../../server/services/fileops-service');

const PASS = 'v627-fileops-stable-path-lock-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-fileops-v592-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));
const libraryPath = path.join(tmp, 'library');
fs.mkdirSync(path.join(libraryPath, 'A'), { recursive:true });
fs.mkdirSync(path.join(libraryPath, 'B'), { recursive:true });

const service = createFileopsService({
  libraryService:{
    libraryPath,
    getLibraryCached:() => { throw new Error('synchronous catalog lookup must not be used'); },
    getLibraryCachedAsync:async () => [],
    invalidateLibraryCache() {},
    sanitizeNodeName:value => String(value || '').trim(),
    normalizeTxtBaseName:value => String(value || '').trim(),
    safeJoinUnderLibrary:rel => path.join(libraryPath, rel || ''),
    categoryPathToRelDir:value => String(value || ''),
    sendFsError() {},
    clearFileCachePath() {},
    clearAllFileCache() {},
    isSubPath:(parent, child) => path.resolve(child).startsWith(path.resolve(parent) + path.sep),
    getNovelStorageInfo() { throw new Error('unused'); },
    getEpisodeStorageInfo() { throw new Error('unused'); },
    clearNovelCachesByInfo() {}
  }
});

(async () => {
  assert.strictEqual(FILEOPS_ASYNC_IO_PASS, 'v592-fileops-async-io-pass');
  assert.strictEqual(FILEOPS_MUTATION_SERIALIZATION_PASS, 'v627-fileops-stable-path-lock-pass');
  const originalRename = fs.promises.rename;
  let active = 0;
  let maxActive = 0;
  fs.promises.rename = async (...args) => {
    active += 1;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 50));
    try { return await originalRename(...args); }
    finally { active -= 1; }
  };
  try {
    const first = service.renameFolder({ categoryPath:'A', newName:'A1' });
    const second = service.renameFolder({ categoryPath:'B', newName:'B1' });
    const [a, b] = await Promise.all([first, second]);
    assert.strictEqual(a.pass, FILEOPS_ASYNC_IO_PASS);
    assert.strictEqual(b.pass, FILEOPS_ASYNC_IO_PASS);
  } finally {
    fs.promises.rename = originalRename;
  }
  assert.strictEqual(maxActive, 2, 'disjoint filesystem paths should run concurrently while ancestor conflicts remain locked');
  assert.strictEqual(fs.existsSync(path.join(libraryPath, 'A1')), true);
  assert.strictEqual(fs.existsSync(path.join(libraryPath, 'B1')), true);
  const status = service.getStatus();
  assert.strictEqual(status.pendingMutations, 0);
  assert.strictEqual(status.completedMutations, 2);
  assert.strictEqual(status.serializationPass, FILEOPS_MUTATION_SERIALIZATION_PASS);
  assert.strictEqual(status.maxConcurrentMutations, 2);
  assert.strictEqual(status.activeMutations, 0);
  assert.strictEqual(status.waitingMutations, 0);
  console.log(JSON.stringify({ pass:PASS, maxActive }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
