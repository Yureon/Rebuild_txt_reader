#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  DIRECTORY_FSYNC_ERROR_CONTRACT_PASS,
  fsyncDirectorySync,
  fsyncDirectoryAsync,
  isDirectoryFsyncUnsupportedError
} = require('../../server/repositories/json-file-store');
const {
  atomicWriteCompressedJsonAsync,
  parseCompressedJsonSync
} = require('../../server/repositories/compressed-json-file-store');
const {
  createFileopsService,
  FILEOPS_DIRECTORY_DURABILITY_PASS
} = require('../../server/services/fileops-service');
const { createLibraryService } = require('../../server/services/library-service');

const SERVER_FILESYSTEM_DURABILITY_SMOKE_PASS = 'v674-server-filesystem-durability-smoke-pass';

function fsError(code) {
  return Object.assign(new Error(`injected ${code}`), { code });
}

async function testDirectoryFsyncErrorContract() {
  for (const code of ['EIO', 'ENOSPC', 'EACCES', 'EROFS']) {
    assert.equal(isDirectoryFsyncUnsupportedError(fsError(code)), false, `${code} must not be treated as unsupported`);
  }
  for (const code of ['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS']) {
    assert.equal(isDirectoryFsyncUnsupportedError(fsError(code)), true, `${code} must be treated as unsupported`);
  }

  const originalOpenSync = fs.openSync;
  const originalFsyncSync = fs.fsyncSync;
  const originalCloseSync = fs.closeSync;
  try {
    fs.openSync = () => 91;
    fs.closeSync = () => {};
    fs.fsyncSync = () => { throw fsError('EIO'); };
    assert.throws(() => fsyncDirectorySync('injected-directory'), error => error && error.code === 'EIO');
    fs.fsyncSync = () => { throw fsError('EINVAL'); };
    assert.equal(fsyncDirectorySync('injected-directory'), false);
  } finally {
    fs.openSync = originalOpenSync;
    fs.fsyncSync = originalFsyncSync;
    fs.closeSync = originalCloseSync;
  }

  const originalOpenAsync = fs.promises.open;
  try {
    for (const code of ['EIO', 'ENOSPC', 'EACCES', 'EROFS']) {
      let closed = false;
      fs.promises.open = async () => ({
        sync:async () => { throw fsError(code); },
        close:async () => { closed = true; }
      });
      await assert.rejects(fsyncDirectoryAsync('injected-directory'), error => error && error.code === code);
      assert.equal(closed, true, `${code} path must close its directory handle`);
    }
    fs.promises.open = async () => ({
      sync:async () => { throw fsError('EINVAL'); },
      close:async () => {}
    });
    assert.equal(await fsyncDirectoryAsync('injected-directory'), false);
  } finally {
    fs.promises.open = originalOpenAsync;
  }
}

async function testCompressedStoreFsyncPropagation(root) {
  const compressedRoot = path.join(root, 'compressed');
  fs.mkdirSync(compressedRoot, { recursive:true });
  const originalOpen = fs.promises.open;
  const resolvedRoot = path.resolve(compressedRoot);
  let injectedCode = 'EIO';
  fs.promises.open = async (target, flags, ...args) => {
    if (flags === 'r' && path.resolve(String(target)) === resolvedRoot) throw fsError(injectedCode);
    return originalOpen(target, flags, ...args);
  };
  try {
    const failedPath = path.join(compressedRoot, 'failed.json.gz');
    await assert.rejects(
      atomicWriteCompressedJsonAsync(failedPath, { value:'renamed-before-directory-fsync' }),
      error => error && error.code === 'EIO'
    );
    assert.equal(fs.existsSync(failedPath), true, 'rename must have happened before injected directory fsync failure');
    assert.deepEqual(parseCompressedJsonSync(failedPath), { value:'renamed-before-directory-fsync' });

    injectedCode = 'EINVAL';
    const unsupportedPath = path.join(compressedRoot, 'unsupported.json.gz');
    const result = await atomicWriteCompressedJsonAsync(unsupportedPath, { value:'platform-unsupported-is-allowed' });
    assert.equal(result.backupTrusted, false);
    assert.deepEqual(parseCompressedJsonSync(unsupportedPath), { value:'platform-unsupported-is-allowed' });
  } finally {
    fs.promises.open = originalOpen;
  }
}

function createLibraryStub(libraryPath, journal) {
  return {
    libraryPath,
    getLibraryCachedAsync:async () => [],
    getLibraryCachedForRequestAsync:async () => [],
    invalidateLibraryCache:() => ({ ok:true }),
    beginLibraryMutation:journal.begin,
    commitLibraryMutation:journal.commit,
    abortLibraryMutation:journal.abort,
    sanitizeNodeName:value => String(value || '').trim(),
    normalizeTxtBaseName:value => String(value || '').trim(),
    safeJoinUnderLibrary:rel => path.join(libraryPath, rel || ''),
    categoryPathToRelDir:value => String(value || ''),
    sendFsError() {},
    clearFileCachePath() {},
    clearAllFileCache() {},
    isSubPath:(parent, child) => path.resolve(child).startsWith(`${path.resolve(parent)}${path.sep}`),
    getNovelStorageInfo() { throw new Error('unused'); },
    getEpisodeStorageInfo() { throw new Error('unused'); },
    clearNovelCachesByInfo() {}
  };
}

async function testFileopsFsyncBeforeCommit(root) {
  const libraryPath = path.join(root, 'fileops-order');
  fs.mkdirSync(path.join(libraryPath, 'Source'), { recursive:true });
  fs.mkdirSync(path.join(libraryPath, 'Target'), { recursive:true });
  const events = [];
  const service = createFileopsService({
    libraryService:createLibraryStub(libraryPath, {
      begin:options => {
        assert.equal(Object.prototype.hasOwnProperty.call(options, 'affectedDirectories'), false);
        events.push('begin');
        return { id:'ordered-token' };
      },
      commit:() => {
        events.push('commit');
        return { statePersisted:true };
      },
      abort:() => {
        events.push('abort');
        return true;
      }
    }),
    directoryFsync:async directory => {
      const relative = path.relative(libraryPath, directory) || '.';
      events.push(`fsync:${relative}`);
      return true;
    }
  });

  await service.moveFolder({ categoryPath:'Source', targetCategoryPath:'Target' });
  assert.deepEqual(events, ['begin', 'fsync:.', `fsync:Target`, 'commit']);
  assert.equal(fs.existsSync(path.join(libraryPath, 'Target', 'Source')), true);
  assert.equal(service.getStatus().directoryDurabilityPass, FILEOPS_DIRECTORY_DURABILITY_PASS);
}

async function testFileopsFsyncFailureKeepsPendingJournal(root) {
  const libraryPath = path.join(root, 'fileops-failure');
  fs.mkdirSync(path.join(libraryPath, 'Before'), { recursive:true });
  const pending = new Set();
  let commits = 0;
  let aborts = 0;
  const service = createFileopsService({
    libraryService:createLibraryStub(libraryPath, {
      begin:() => {
        pending.add('pending-token');
        return { id:'pending-token' };
      },
      commit:token => {
        commits += 1;
        pending.delete(token.id);
        return { statePersisted:true };
      },
      abort:token => {
        aborts += 1;
        pending.delete(token.id);
        return true;
      }
    }),
    directoryFsync:async () => { throw fsError('EIO'); }
  });

  await assert.rejects(
    service.renameFolder({ categoryPath:'Before', newName:'After' }),
    error => error
      && error.code === 'LIBRARY_MUTATION_DIRECTORY_FSYNC_FAILED'
      && error.statusCode === 503
      && error.retryAfterSeconds === 5
      && error.recoveryRequired === true
      && error.operationApplied === true
      && error.fileOperationApplied === true
      && error.mutationId === 'pending-token'
      && error.affectedDirectoryCount === 1
      && error.cause
      && error.cause.code === 'EIO'
      && error.pass === FILEOPS_DIRECTORY_DURABILITY_PASS
  );
  assert.equal(fs.existsSync(path.join(libraryPath, 'Before')), false);
  assert.equal(fs.existsSync(path.join(libraryPath, 'After')), true);
  assert.equal(commits, 0, 'journal must not commit after a directory fsync failure');
  assert.equal(aborts, 0, 'an applied operation must not have its pending journal aborted');
  assert.deepEqual([...pending], ['pending-token']);
}

function testPublicRecoveryErrorContract(root) {
  const libraryPath = path.join(root, 'public-error-contract');
  fs.mkdirSync(libraryPath, { recursive:true });
  const service = createLibraryService({
    libraryPath,
    encodeStableId:value => Buffer.from(String(value)).toString('base64url')
  });
  const response = {
    statusCode:0,
    headers:{},
    body:null,
    status(value) { this.statusCode = value; return this; },
    setHeader(name, value) { this.headers[name] = value; },
    json(value) { this.body = value; return value; }
  };
  service.sendFsError(response, Object.assign(new Error('directory durability barrier failed'), {
    code:'LIBRARY_MUTATION_DIRECTORY_FSYNC_FAILED',
    statusCode:503,
    retryAfterSeconds:5,
    recoveryRequired:true,
    operationApplied:true,
    fileOperationApplied:true,
    pass:FILEOPS_DIRECTORY_DURABILITY_PASS
  }));
  assert.equal(response.statusCode, 503);
  assert.equal(response.headers['Retry-After'], '5');
  assert.deepEqual(response.body, {
    error:'LIBRARY_MUTATION_DIRECTORY_FSYNC_FAILED',
    message:'directory durability barrier failed',
    retryable:true,
    recoveryRequired:true,
    operationApplied:true,
    fileOperationApplied:true,
    pass:FILEOPS_DIRECTORY_DURABILITY_PASS
  });
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v674-durability-'));
  try {
    await testDirectoryFsyncErrorContract();
    await testCompressedStoreFsyncPropagation(root);
    await testFileopsFsyncBeforeCommit(root);
    await testFileopsFsyncFailureKeepsPendingJournal(root);
    testPublicRecoveryErrorContract(root);
    process.stdout.write(`${JSON.stringify({
      pass:SERVER_FILESYSTEM_DURABILITY_SMOKE_PASS,
      directoryFsyncPass:DIRECTORY_FSYNC_ERROR_CONTRACT_PASS,
      fileopsPass:FILEOPS_DIRECTORY_DURABILITY_PASS,
      propagatedCodes:['EIO', 'ENOSPC', 'EACCES', 'EROFS'],
      unsupportedCodes:['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS'],
      journalPendingOnFailure:true,
      operationAppliedContract:true
    })}\n`);
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
}

main().catch(error => {
  process.stderr.write(`${error && error.stack || error}\n`);
  process.exitCode = 1;
});
