const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIRECTORY_FSYNC_ERROR_CONTRACT_PASS = 'v674-directory-fsync-error-contract-pass';
const DIRECTORY_FSYNC_UNSUPPORTED_CODES = new Set(['EINVAL', 'ENOTSUP', 'EOPNOTSUPP', 'ENOSYS']);

function isDirectoryFsyncUnsupportedError(error) {
  const code = String(error && error.code || '').toUpperCase();
  if (DIRECTORY_FSYNC_UNSUPPORTED_CODES.has(code)) return true;
  // Windows does not expose a portable directory handle on every filesystem.
  // Do not generalize these permission-shaped errors to other platforms.
  return process.platform === 'win32' && (code === 'EISDIR' || code === 'EPERM');
}

function assertRegularJsonFileSync(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error('JSON state path must be a regular file');
    error.code = 'JSON_STATE_PATH_INVALID';
    throw error;
  }
}

async function assertRegularJsonFileAsync(filePath) {
  const stat = await fs.promises.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error('JSON state path must be a regular file');
    error.code = 'JSON_STATE_PATH_INVALID';
    throw error;
  }
}

function parseJsonFileSync(filePath) {
  assertRegularJsonFileSync(filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(text);
}

async function parseJsonFileAsync(filePath) {
  await assertRegularJsonFileAsync(filePath);
  const text = await fs.promises.readFile(filePath, 'utf8');
  return JSON.parse(text);
}

function loadJsonWithBackup(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  const targets = [filePath, `${filePath}.bak`];
  for (const targetPath of targets) {
    try {
      if (!fs.existsSync(targetPath)) continue;
      return {
        ok: true,
        data: parseJsonFileSync(targetPath),
        source: targetPath === filePath ? 'primary' : 'backup',
        path: targetPath
      };
    } catch (_error) {}
  }
  return {
    ok: false,
    data: fallback,
    source: 'fallback',
    path: ''
  };
}

async function loadJsonWithBackupAsync(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  const targets = [filePath, `${filePath}.bak`];
  for (const targetPath of targets) {
    try {
      return {
        ok: true,
        data: await parseJsonFileAsync(targetPath),
        source: targetPath === filePath ? 'primary' : 'backup',
        path: targetPath
      };
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
    }
  }
  return {
    ok: false,
    data: fallback,
    source: 'fallback',
    path: ''
  };
}

function fsyncDirectorySync(dir) {
  let dirFd;
  try {
    dirFd = fs.openSync(dir, 'r');
  } catch (error) {
    if (isDirectoryFsyncUnsupportedError(error)) return false;
    throw error;
  }
  let supported = true;
  try {
    fs.fsyncSync(dirFd);
  } catch (error) {
    if (!isDirectoryFsyncUnsupportedError(error)) throw error;
    supported = false;
  } finally {
    fs.closeSync(dirFd);
  }
  return supported;
}

async function fsyncDirectoryAsync(dir) {
  let dirHandle;
  try {
    dirHandle = await fs.promises.open(dir, 'r');
  } catch (error) {
    if (isDirectoryFsyncUnsupportedError(error)) return false;
    throw error;
  }
  let supported = true;
  try {
    await dirHandle.sync();
  } catch (error) {
    if (!isDirectoryFsyncUnsupportedError(error)) throw error;
    supported = false;
  } finally {
    await dirHandle.close();
  }
  return supported;
}


async function durableRenameAsync(sourcePath, targetPath) {
  const sourceDir = path.dirname(sourcePath);
  const targetDir = path.dirname(targetPath);
  await fs.promises.rename(sourcePath, targetPath);
  await fsyncDirectoryAsync(targetDir);
  if (sourceDir !== targetDir) await fsyncDirectoryAsync(sourceDir);
}

async function durableRemoveAsync(filePath, options = { force:true }) {
  const dir = path.dirname(filePath);
  try {
    await fs.promises.rm(filePath, options);
    await fsyncDirectoryAsync(dir);
    return true;
  } catch (error) {
    if (options && options.force && error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function durableRenameSync(sourcePath, targetPath) {
  const sourceDir = path.dirname(sourcePath);
  const targetDir = path.dirname(targetPath);
  fs.renameSync(sourcePath, targetPath);
  fsyncDirectorySync(targetDir);
  if (sourceDir !== targetDir) fsyncDirectorySync(sourceDir);
}

function durableRemoveSync(filePath, options = { force:true }) {
  const dir = path.dirname(filePath);
  try {
    fs.rmSync(filePath, options);
    fsyncDirectorySync(dir);
    return true;
  } catch (error) {
    if (options && options.force && error && error.code === 'ENOENT') return false;
    throw error;
  }
}

function backupValidPrimarySync(filePath, bakPath, dir) {
  try {
    parseJsonFileSync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    return false;
  }
  const bakTmp = `${bakPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.copyFileSync(filePath, bakTmp);
    fs.chmodSync(bakTmp, 0o600);
    // Windows rejects fsync on a read-only file descriptor with EPERM.
    // The backup is already private and regular, so open it read/write only
    // for the durability barrier before the atomic rename.
    const fd = fs.openSync(bakTmp, 'r+');
    try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(bakTmp, bakPath);
    fsyncDirectorySync(dir);
    return true;
  } catch (error) {
    try { fs.rmSync(bakTmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}

async function backupValidPrimaryAsync(filePath, bakPath, dir) {
  try {
    await parseJsonFileAsync(filePath);
  } catch (error) {
    if (error && error.code === 'ENOENT') return false;
    return false;
  }
  const bakTmp = `${bakPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let handle = null;
  try {
    await fs.promises.copyFile(filePath, bakTmp);
    await fs.promises.chmod(bakTmp, 0o600);
    handle = await fs.promises.open(bakTmp, 'r+');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(bakTmp, bakPath);
    await fsyncDirectoryAsync(dir);
    return true;
  } catch (error) {
    try { await handle?.close(); } catch (_closeError) {}
    try { await fs.promises.rm(bakTmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}


async function atomicWriteFileAsync(filePath, data, options = {}) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const mode = options.mode == null ? 0o600 : options.mode;
  let handle = null;
  try {
    await fs.promises.mkdir(dir, { recursive:true });
    handle = await fs.promises.open(tmp, 'wx', mode);
    await handle.writeFile(data, options.encoding ? { encoding:options.encoding } : undefined);
    await handle.sync();
    await handle.close(); handle = null;
    await durableRenameAsync(tmp, filePath);
  } catch (error) {
    try { await handle?.close(); } catch {}
    try { await fs.promises.rm(tmp, { force:true }); } catch {}
    throw error;
  }
}

function atomicWriteFileSync(filePath, data, options = {}) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const mode = options.mode == null ? 0o600 : options.mode;
  let fd = null;
  try {
    fs.mkdirSync(dir, { recursive:true });
    fd = fs.openSync(tmp, 'wx', mode);
    if (options.encoding) fs.writeFileSync(fd, data, { encoding:options.encoding });
    else fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
    fs.closeSync(fd); fd = null;
    durableRenameSync(tmp, filePath);
  } catch (error) {
    if (fd != null) try { fs.closeSync(fd); } catch {}
    try { fs.rmSync(tmp, { force:true }); } catch {}
    throw error;
  }
}

async function atomicWriteJsonPromise(filePath, value) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const bak = `${filePath}.bak`;
  const body = JSON.stringify(value, null, 2);
  let handle = null;
  try {
    await fs.promises.mkdir(dir, { recursive:true });
    handle = await fs.promises.open(tmp, 'wx', 0o600);
    await handle.writeFile(body, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    await backupValidPrimaryAsync(filePath, bak, dir);
    await fs.promises.rename(tmp, filePath);
    await fsyncDirectoryAsync(dir);
  } catch (error) {
    try { await handle?.close(); } catch (_closeError) {}
    try { await fs.promises.rm(tmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}

function atomicWriteJson(filePath, value, callback) {
  const done = typeof callback === 'function' ? callback : () => {};
  atomicWriteJsonPromise(filePath, value).then(() => done(null), done);
}

function atomicWriteJsonSync(filePath, value) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const bak = `${filePath}.bak`;
  const body = JSON.stringify(value, null, 2);
  let fd = null;
  try {
    fs.mkdirSync(dir, { recursive:true });
    fd = fs.openSync(tmp, 'wx', 0o600);
    fs.writeFileSync(fd, body, 'utf8');
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = null;
    backupValidPrimarySync(filePath, bak, dir);
    fs.renameSync(tmp, filePath);
    fsyncDirectorySync(dir);
  } catch (error) {
    if (fd != null) { try { fs.closeSync(fd); } catch (_closeError) {} }
    try { fs.rmSync(tmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}

function atomicWriteJsonAsync(filePath, value) {
  return atomicWriteJsonPromise(filePath, value);
}

module.exports = {
  DIRECTORY_FSYNC_ERROR_CONTRACT_PASS,
  isDirectoryFsyncUnsupportedError,
  loadJsonWithBackup,
  loadJsonWithBackupAsync,
  atomicWriteJson,
  atomicWriteJsonSync,
  atomicWriteJsonAsync,
  fsyncDirectorySync,
  fsyncDirectoryAsync,
  durableRenameAsync,
  durableRemoveAsync,
  durableRenameSync,
  durableRemoveSync,
  atomicWriteFileAsync,
  atomicWriteFileSync
};
