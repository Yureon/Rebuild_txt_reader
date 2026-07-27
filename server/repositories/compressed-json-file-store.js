'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');
const { fsyncDirectoryAsync } = require('./json-file-store');

const gzipAsync = promisify(zlib.gzip);
const COMPRESSED_JSON_STORE_PASS = 'v642-compressed-json-store-pass';
const COMPRESSED_JSON_SINGLE_SERIALIZE_PASS = 'v646-compressed-json-single-serialize-pass';
const COMPRESSED_JSON_TRUSTED_BACKUP_PASS = 'v646-compressed-json-trusted-backup-pass';

function assertRegularFileSync(filePath) {
  const stat = fs.lstatSync(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error('compressed JSON state path must be a regular file');
    error.code = 'COMPRESSED_JSON_STATE_PATH_INVALID';
    throw error;
  }
}

async function assertRegularFileAsync(filePath) {
  const stat = await fs.promises.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    const error = new Error('compressed JSON state path must be a regular file');
    error.code = 'COMPRESSED_JSON_STATE_PATH_INVALID';
    throw error;
  }
}

function sha256Buffer(value) { return crypto.createHash('sha256').update(value).digest('hex'); }

async function sha256FileAsync(filePath) {
  await assertRegularFileAsync(filePath);
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('error', reject);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

function readCompressedJsonSync(filePath) {
  assertRegularFileSync(filePath);
  const compressed = fs.readFileSync(filePath);
  const jsonBuffer = zlib.gunzipSync(compressed);
  return { data:JSON.parse(jsonBuffer.toString('utf8')), jsonBytes:jsonBuffer.length, compressedBytes:compressed.length, compressedSha256:sha256Buffer(compressed) };
}
function parseCompressedJsonSync(filePath) { return readCompressedJsonSync(filePath).data; }

async function readCompressedJsonAsync(filePath) {
  await assertRegularFileAsync(filePath);
  const compressed = await fs.promises.readFile(filePath);
  const jsonBuffer = await promisify(zlib.gunzip)(compressed);
  return { data:JSON.parse(jsonBuffer.toString('utf8')), jsonBytes:jsonBuffer.length, compressedBytes:compressed.length, compressedSha256:sha256Buffer(compressed) };
}
async function parseCompressedJsonAsync(filePath) { return (await readCompressedJsonAsync(filePath)).data; }

function loadCompressedJsonWithBackup(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  for (const targetPath of [filePath, `${filePath}.bak`]) {
    try {
      if (!fs.existsSync(targetPath)) continue;
      const parsed = readCompressedJsonSync(targetPath);
      return {
        ok:true,
        data:parsed.data,
        jsonBytes:parsed.jsonBytes,
        compressedBytes:parsed.compressedBytes,
        compressedSha256:parsed.compressedSha256,
        source:targetPath === filePath ? 'primary' : 'backup',
        path:targetPath,
        pass:COMPRESSED_JSON_STORE_PASS
      };
    } catch (_error) {}
  }
  return { ok:false, data:fallback, source:'fallback', path:'', pass:COMPRESSED_JSON_STORE_PASS };
}

async function loadCompressedJsonWithBackupAsync(filePath, fallbackValue) {
  const fallback = typeof fallbackValue === 'undefined' ? null : fallbackValue;
  for (const targetPath of [filePath, `${filePath}.bak`]) {
    try {
      const parsed = await readCompressedJsonAsync(targetPath);
      return {
        ok:true,
        data:parsed.data,
        jsonBytes:parsed.jsonBytes,
        compressedBytes:parsed.compressedBytes,
        compressedSha256:parsed.compressedSha256,
        source:targetPath === filePath ? 'primary' : 'backup',
        path:targetPath,
        pass:COMPRESSED_JSON_STORE_PASS
      };
    } catch (error) {
      if (error && error.code === 'ENOENT') continue;
    }
  }
  return { ok:false, data:fallback, source:'fallback', path:'', pass:COMPRESSED_JSON_STORE_PASS };
}

async function backupValidCompressedPrimaryAsync(filePath, backupPath, dir, options = {}) {
  const trustedPrimarySha256 = /^[a-f0-9]{64}$/i.test(String(options.trustedPrimarySha256 || ''))
    ? String(options.trustedPrimarySha256).toLowerCase()
    : '';
  try {
    if (trustedPrimarySha256) {
      const currentSha256 = await sha256FileAsync(filePath);
      if (currentSha256 !== trustedPrimarySha256) return false;
    } else {
      await parseCompressedJsonAsync(filePath);
    }
  } catch (_error) {
    return false;
  }
  const tmp = `${backupPath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  let handle = null;
  try {
    await fs.promises.copyFile(filePath, tmp);
    await fs.promises.chmod(tmp, 0o600);
    handle = await fs.promises.open(tmp, 'r+');
    await handle.sync();
    await handle.close();
    handle = null;
    await fs.promises.rename(tmp, backupPath);
    await fsyncDirectoryAsync(dir);
    return true;
  } catch (error) {
    try { await handle?.close(); } catch (_closeError) {}
    try { await fs.promises.rm(tmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}

async function atomicWriteCompressedJsonAsync(filePath, value, options = {}) {
  const dir = path.dirname(filePath);
  const tmp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const backupPath = `${filePath}.bak`;
  const level = Math.max(1, Math.min(9, Number(options.level) || 6));
  const provided = options.serializedJson;
  const jsonBuffer = Buffer.isBuffer(provided)
    ? provided
    : typeof provided === 'string'
      ? Buffer.from(provided, 'utf8')
      : Buffer.from(JSON.stringify(value), 'utf8');
  const compressed = await gzipAsync(jsonBuffer, { level });
  const primarySha256 = sha256Buffer(compressed);
  let handle = null;
  try {
    await fs.promises.mkdir(dir, { recursive:true });
    handle = await fs.promises.open(tmp, 'wx', 0o600);
    await handle.writeFile(compressed);
    await handle.sync();
    await handle.close();
    handle = null;
    const backupTrusted = await backupValidCompressedPrimaryAsync(filePath, backupPath, dir, { trustedPrimarySha256:options.trustedPrimarySha256 });
    await fs.promises.rename(tmp, filePath);
    await fsyncDirectoryAsync(dir);
    return {
      pass:COMPRESSED_JSON_STORE_PASS,
      jsonBytes:jsonBuffer.length,
      compressedBytes:compressed.length,
      ratio:jsonBuffer.length ? compressed.length / jsonBuffer.length : 0,
      level,
      singleSerializePass:COMPRESSED_JSON_SINGLE_SERIALIZE_PASS,
      trustedBackupPass:COMPRESSED_JSON_TRUSTED_BACKUP_PASS,
      backupTrusted,
      primarySha256
    };
  } catch (error) {
    try { await handle?.close(); } catch (_closeError) {}
    try { await fs.promises.rm(tmp, { force:true }); } catch (_cleanupError) {}
    throw error;
  }
}

module.exports = {
  COMPRESSED_JSON_STORE_PASS,
  COMPRESSED_JSON_SINGLE_SERIALIZE_PASS,
  COMPRESSED_JSON_TRUSTED_BACKUP_PASS,
  loadCompressedJsonWithBackup,
  loadCompressedJsonWithBackupAsync,
  atomicWriteCompressedJsonAsync,
  parseCompressedJsonSync,
  parseCompressedJsonAsync
};
