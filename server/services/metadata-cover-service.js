const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const METADATA_COVER_CACHE_PASS = 'v665-metadata-cover-recognition-pass';
const METADATA_COVER_NOFOLLOW_READ_PASS = 'v677-metadata-cover-nofollow-read-pass';
const DEFAULT_CACHE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const DEFAULT_ORPHAN_MIN_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_PRUNE_INTERVAL_MS = 6 * 60 * 60 * 1000;
const DEFAULT_MAX_DELETE_PER_RUN = 200;
const DEFAULT_POST_WRITE_PRUNE_MIN_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_MANUAL_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_PENDING_ASSET_LEASE_MS = 10 * 60 * 1000;
const PENDING_ASSET_LEASE_FILE = '.pending-cover-leases.json';
const SUPPORTED_EXTENSIONS = new Set(['jpg', 'png', 'webp', 'gif', 'avif', 'bmp']);

function detectAvif(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return false;
  const max = Math.min(buffer.length, 256);
  let offset = 0;
  while (offset + 8 <= max) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    let headerBytes = 8;
    if (size === 1) {
      if (offset + 16 > max) return false;
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(large);
      headerBytes = 16;
    } else if (size === 0) {
      size = max - offset;
    }
    if (size < headerBytes || offset + size > buffer.length) return false;
    if (type === 'ftyp') {
      const payloadStart = offset + headerBytes;
      const payloadEnd = Math.min(offset + size, max);
      if (payloadEnd - payloadStart < 8) return false;
      const major = buffer.subarray(payloadStart, payloadStart + 4).toString('ascii');
      if (major === 'avif' || major === 'avis') return true;
      for (let cursor = payloadStart + 8; cursor + 4 <= payloadEnd; cursor += 4) {
        const brand = buffer.subarray(cursor, cursor + 4).toString('ascii');
        if (brand === 'avif' || brand === 'avis') return true;
      }
      return false;
    }
    offset += size;
  }
  return false;
}

function detectBmp(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 26) return false;
  if (buffer[0] !== 0x42 || buffer[1] !== 0x4d) return false;
  const declaredFileSize = buffer.readUInt32LE(2);
  const pixelOffset = buffer.readUInt32LE(10);
  const dibHeaderSize = buffer.readUInt32LE(14);
  if (![12, 16, 40, 52, 56, 64, 108, 124].includes(dibHeaderSize)) return false;
  const headerEnd = 14 + dibHeaderSize;
  if (headerEnd > buffer.length || pixelOffset < headerEnd || pixelOffset >= buffer.length) return false;
  if (declaredFileSize && (declaredFileSize > buffer.length || declaredFileSize <= pixelOffset)) return false;
  if (dibHeaderSize === 12) {
    const width = buffer.readUInt16LE(18);
    const height = buffer.readUInt16LE(20);
    const planes = buffer.readUInt16LE(22);
    const bitsPerPixel = buffer.readUInt16LE(24);
    return width > 0 && height > 0 && planes === 1 && [1, 4, 8, 16, 24, 32].includes(bitsPerPixel);
  }
  if (buffer.length < 30) return false;
  const width = buffer.readInt32LE(18);
  const height = buffer.readInt32LE(22);
  const planes = buffer.readUInt16LE(26);
  const bitsPerPixel = buffer.readUInt16LE(28);
  return width > 0 && height !== 0 && planes === 1 && [1, 4, 8, 16, 24, 32].includes(bitsPerPixel);
}

function detectHeifFamily(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return '';
  const max = Math.min(buffer.length, 256);
  let offset = 0;
  while (offset + 8 <= max) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString('ascii');
    let headerBytes = 8;
    if (size === 1) {
      if (offset + 16 > max) return '';
      const large = buffer.readBigUInt64BE(offset + 8);
      if (large > BigInt(Number.MAX_SAFE_INTEGER)) return '';
      size = Number(large);
      headerBytes = 16;
    } else if (size === 0) size = max - offset;
    if (size < headerBytes || offset + size > buffer.length) return '';
    if (type === 'ftyp') {
      const payloadStart = offset + headerBytes;
      const payloadEnd = Math.min(offset + size, max);
      if (payloadEnd - payloadStart < 8) return '';
      const brands = [buffer.subarray(payloadStart, payloadStart + 4).toString('ascii')];
      for (let cursor = payloadStart + 8; cursor + 4 <= payloadEnd; cursor += 4) brands.push(buffer.subarray(cursor, cursor + 4).toString('ascii'));
      if (brands.some(brand => ['heic','heix','hevc','hevx'].includes(brand))) return 'heic';
      if (brands.some(brand => ['mif1','msf1','heim','heis'].includes(brand))) return 'heif';
      return '';
    }
    offset += size;
  }
  return '';
}

function detectImage(buffer, contentType = '') {
  const type = String(contentType || '').split(';')[0].trim().toLowerCase();
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext:'jpg', mime:'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext:'png', mime:'image/png' };
  if (buffer.length >= 12 && buffer.subarray(0,4).toString('ascii') === 'RIFF' && buffer.subarray(8,12).toString('ascii') === 'WEBP') return { ext:'webp', mime:'image/webp' };
  if (buffer.length >= 6 && /^GIF8[79]a$/.test(buffer.subarray(0,6).toString('ascii'))) return { ext:'gif', mime:'image/gif' };
  if (detectAvif(buffer)) return { ext:'avif', mime:'image/avif' };
  if (detectBmp(buffer)) return { ext:'bmp', mime:'image/bmp' };
  if (type.startsWith('image/') && !type.includes('svg')) return null;
  return null;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(parsed)));
}

function parseCoverFileName(name = '') {
  const match = String(name).match(/^([a-f0-9]{64})\.(jpg|png|webp|gif|avif|bmp)$/i);
  if (!match) return null;
  return { assetId:match[1].toLowerCase(), ext:match[2].toLowerCase() };
}

function createMetadataCoverService(options = {}) {
  const coverDir = options.coverDir;
  const transport = options.transport;
  const logger = options.logger || console;
  const isAssetReferenced = typeof options.isAssetReferenced === 'function' ? options.isAssetReferenced : () => false;
  const maxCacheBytes = clampInteger(options.maxCacheBytes, DEFAULT_CACHE_MAX_BYTES, 16 * 1024 * 1024, Number.MAX_SAFE_INTEGER);
  const minOrphanAgeMs = clampInteger(options.minOrphanAgeMs, DEFAULT_ORPHAN_MIN_AGE_MS, 0, 365 * 24 * 60 * 60 * 1000);
  const pruneIntervalMs = clampInteger(options.pruneIntervalMs, DEFAULT_PRUNE_INTERVAL_MS, 60 * 1000, 30 * 24 * 60 * 60 * 1000);
  const maxDeletePerRun = clampInteger(options.maxDeletePerRun, DEFAULT_MAX_DELETE_PER_RUN, 1, 10000);
  const manualUploadMaxBytes = clampInteger(options.manualUploadMaxBytes, DEFAULT_MANUAL_UPLOAD_MAX_BYTES, 64 * 1024, 20 * 1024 * 1024);
  const pendingAssetLeaseMs = clampInteger(options.pendingAssetLeaseMs, DEFAULT_PENDING_ASSET_LEASE_MS, 30 * 1000, 60 * 60 * 1000);
  if (!coverDir || !transport) throw new Error('metadata cover service requires coverDir and transport');
  fs.mkdirSync(coverDir, { recursive:true });

  let pruneInflight = null;
  let stopped = false;
  let lastPrune = null;
  let lastPruneStartedAt = 0;
  const postWritePruneMinIntervalMs = Math.min(DEFAULT_POST_WRITE_PRUNE_MIN_INTERVAL_MS, pruneIntervalMs);
  const assetLeases = new Map();
  const leaseStatePath = path.join(coverDir, PENDING_ASSET_LEASE_FILE);
  let leaseWriteTail = Promise.resolve();
  let leaseWriteError = '';

  function loadLeaseState() {
    let payload = null;
    try { payload = JSON.parse(fs.readFileSync(leaseStatePath, 'utf8')); }
    catch (error) {
      if (error && error.code !== 'ENOENT') logger?.warn?.('metadata cover lease state load failed:', error?.message || error);
      return 0;
    }
    const now = Date.now();
    let loaded = 0;
    for (const [assetId, rawExpiresAt] of Object.entries(payload && payload.leases || {})) {
      const id = String(assetId || '').toLowerCase();
      const expiresAt = Number(rawExpiresAt) || 0;
      if (!/^[a-f0-9]{64}$/.test(id) || expiresAt <= now) continue;
      assetLeases.set(id, expiresAt);
      loaded += 1;
    }
    return loaded;
  }

  function leaseSnapshot() {
    const leases = {};
    for (const [assetId, expiresAt] of assetLeases) leases[assetId] = expiresAt;
    return { schemaVersion:1, updatedAt:new Date().toISOString(), leases };
  }

  async function writeLeaseSnapshot(snapshot) {
    if (!Object.keys(snapshot.leases).length) {
      await fs.promises.rm(leaseStatePath, { force:true });
      await syncCoverDirectory();
      return;
    }
    const temp = `${leaseStatePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
    let handle = null;
    try {
      handle = await fs.promises.open(temp, 'wx', 0o600);
      await handle.writeFile(`${JSON.stringify(snapshot)}
`, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.promises.rename(temp, leaseStatePath);
      try { await fs.promises.chmod(leaseStatePath, 0o600); } catch {}
      await syncCoverDirectory();
      leaseWriteError = '';
    } catch (error) {
      leaseWriteError = String(error?.message || error);
      if (handle) { try { await handle.close(); } catch {} }
      try { await fs.promises.rm(temp, { force:true }); } catch {}
      throw error;
    }
  }

  function persistLeaseState() {
    const snapshot = leaseSnapshot();
    leaseWriteTail = leaseWriteTail.catch(() => {}).then(() => writeLeaseSnapshot(snapshot));
    return leaseWriteTail;
  }

  function cleanupExpiredLeases(now = Date.now(), persist = true) {
    let changed = false;
    for (const [assetId, expiresAt] of assetLeases) {
      if (expiresAt > now) continue;
      assetLeases.delete(assetId);
      changed = true;
    }
    if (changed && persist) void persistLeaseState().catch(error => logger?.warn?.('metadata cover lease cleanup persist failed:', error?.message || error));
    return changed;
  }

  function setAssetLease(assetId, ttlMs = pendingAssetLeaseMs) {
    const id = String(assetId || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(id)) return '';
    const expiresAt = Date.now() + clampInteger(ttlMs, pendingAssetLeaseMs, 30 * 1000, 60 * 60 * 1000);
    assetLeases.set(id, Math.max(assetLeases.get(id) || 0, expiresAt));
    return id;
  }

  function leaseAsset(assetId, ttlMs = pendingAssetLeaseMs) {
    const id = setAssetLease(assetId, ttlMs);
    if (!id) return false;
    void persistLeaseState().catch(error => logger?.warn?.('metadata cover lease persist failed:', error?.message || error));
    return true;
  }

  async function leaseAssetDurably(assetId, ttlMs = pendingAssetLeaseMs) {
    const id = setAssetLease(assetId, ttlMs);
    if (!id) return false;
    await persistLeaseState();
    return true;
  }

  function releaseAssetLease(assetId) {
    const id = String(assetId || '').toLowerCase();
    const changed = assetLeases.delete(id);
    if (changed) void persistLeaseState().catch(error => logger?.warn?.('metadata cover lease release persist failed:', error?.message || error));
    return changed;
  }

  async function releaseAssetLeaseDurably(assetId) {
    const id = String(assetId || '').toLowerCase();
    const previousExpiresAt = assetLeases.get(id) || 0;
    const changed = assetLeases.delete(id);
    if (!changed) return false;
    try {
      await persistLeaseState();
      return true;
    } catch (error) {
      // A failed durable release must not remove the in-process prune guard.
      // Restore the previous expiry and best-effort rewrite the sidecar; the
      // caller still receives the original failure and may retry later.
      if (previousExpiresAt > Date.now()) assetLeases.set(id, previousExpiresAt);
      try { await persistLeaseState(); } catch {}
      throw error;
    }
  }

  function isAssetLeased(assetId, now = Date.now()) {
    cleanupExpiredLeases(now);
    return (assetLeases.get(String(assetId || '').toLowerCase()) || 0) > now;
  }

  loadLeaseState();

  async function syncCoverDirectory() {
    let handle = null;
    try {
      handle = await fs.promises.open(coverDir, 'r');
      await handle.sync();
    } catch (error) {
      if (!error || !['EINVAL','ENOTSUP','EISDIR','EPERM'].includes(error.code)) throw error;
    } finally {
      if (handle) { try { await handle.close(); } catch {} }
    }
  }

  async function listCacheEntries() {
    const names = await fs.promises.readdir(coverDir).catch(error => {
      if (error && error.code === 'ENOENT') return [];
      throw error;
    });
    const entries = [];
    for (const name of names) {
      const parsed = parseCoverFileName(name);
      if (!parsed) continue;
      const filePath = path.join(coverDir, name);
      try {
        const stat = await fs.promises.stat(filePath);
        if (!stat.isFile()) continue;
        entries.push({ ...parsed, name, filePath, bytes:Number(stat.size) || 0, mtimeMs:Number(stat.mtimeMs) || 0 });
      } catch (error) {
        if (!error || error.code !== 'ENOENT') logger?.warn?.('metadata cover cache stat failed:', name, error?.message || error);
      }
    }
    return entries;
  }

  async function pruneCache(reason = 'scheduled') {
    if (pruneInflight) return pruneInflight;
    lastPruneStartedAt = Date.now();
    pruneInflight = (async () => {
      const now = Date.now();
      const entries = await listCacheEntries();
      let totalBytes = entries.reduce((sum, entry) => sum + entry.bytes, 0);
      let deletedBytes = 0;
      const deleted = [];
      const failures = [];
      const expiredLeaseChanged = cleanupExpiredLeases(now, false);
      if (expiredLeaseChanged) await persistLeaseState().catch(error => logger?.warn?.('metadata cover expired lease persist failed:', error?.message || error));
      const candidates = entries
        .filter(entry => !isAssetReferenced(entry.assetId) && !isAssetLeased(entry.assetId, now))
        .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name));
      for (const entry of candidates) {
        if (deleted.length >= maxDeletePerRun) break;
        const oldEnough = now - entry.mtimeMs >= minOrphanAgeMs;
        const overQuota = totalBytes > maxCacheBytes;
        if (!oldEnough && !overQuota) continue;
        try {
          await fs.promises.rm(entry.filePath, { force:true });
          totalBytes = Math.max(0, totalBytes - entry.bytes);
          deletedBytes += entry.bytes;
          deleted.push(entry.name);
        } catch (error) {
          failures.push({ file:entry.name, error:String(error?.message || error) });
        }
      }
      lastPrune = {
        reason,
        scanned:entries.length,
        deleted:deleted.length,
        deletedBytes,
        totalBytes,
        maxCacheBytes,
        failures,
        completedAt:new Date().toISOString(),
        pass:METADATA_COVER_CACHE_PASS
      };
      if (failures.length) logger?.warn?.('metadata cover cache prune had failures:', failures.length);
      return lastPrune;
    })().finally(() => { pruneInflight = null; });
    return pruneInflight;
  }

  async function persistCoverBuffer(buffer, contentType = '', maximumBytes = 0, filename = '') {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw Object.assign(new Error('metadata cover image is empty'), { code:'METADATA_COVER_INVALID' });
    if (maximumBytes && buffer.length > maximumBytes) throw Object.assign(new Error(`metadata cover image exceeds ${maximumBytes} bytes`), { code:'METADATA_COVER_TOO_LARGE' });
    const image = detectImage(buffer, contentType);
    if (!image) {
      const heifFamily = detectHeifFamily(buffer);
      if (heifFamily) {
        throw Object.assign(new Error(`${heifFamily.toUpperCase()} 표지는 JPEG, PNG, WebP, GIF, AVIF 또는 BMP로 변환한 뒤 업로드하십시오.`), { code:'METADATA_COVER_UNSUPPORTED_FORMAT', format:heifFamily });
      }
      const safeName = String(filename || '').replace(/[\r\n]/g, '').slice(0, 240);
      const suffix = safeName ? ` (${safeName})` : '';
      throw Object.assign(new Error(`지원되지 않거나 손상된 표지 이미지입니다${suffix}. JPEG, PNG, WebP, GIF, AVIF 또는 BMP 파일을 사용하십시오.`), { code:'METADATA_COVER_INVALID' });
    }
    const assetId = crypto.createHash('sha256').update(buffer).digest('hex');
    const filePath = path.join(coverDir, `${assetId}.${image.ext}`);
    let exists = false;
    try { await fs.promises.access(filePath, fs.constants.F_OK); exists = true; } catch {}
    if (!exists) {
      const temp = `${filePath}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      let handle = null;
      try {
        handle = await fs.promises.open(temp, 'wx', 0o600);
        await handle.writeFile(buffer);
        await handle.sync();
        await handle.close();
        handle = null;
        try {
          await fs.promises.rename(temp, filePath);
          await syncCoverDirectory();
        } catch (error) {
          if (!error || !['EEXIST','EPERM'].includes(error.code)) throw error;
          await fs.promises.rm(temp, { force:true });
        }
        try { await fs.promises.chmod(filePath, 0o600); } catch {}
      } catch (error) {
        if (handle) { try { await handle.close(); } catch {} }
        try { await fs.promises.rm(temp, { force:true }); } catch {}
        throw error;
      }
    }
    await leaseAssetDurably(assetId);
    if (!stopped && Date.now() - lastPruneStartedAt >= postWritePruneMinIntervalMs) {
      void pruneCache('post-write').catch(error => logger?.warn?.('metadata cover post-write prune failed:', error?.message || error));
    }
    return { assetId, mime:image.mime, ext:image.ext, bytes:buffer.length, url:`/api/metadata/covers/${assetId}` };
  }

  async function cacheRemoteCover(provider, remoteUrl, requestOptions = {}) {
    if (!remoteUrl) return null;
    const response = await transport.fetchProvider(provider, remoteUrl, {
      kind:'cover',
      binary:true,
      profile:'browser-image',
      referer:requestOptions.referer || '',
      signal:requestOptions.signal || null
    });
    return persistCoverBuffer(response.body, response.contentType);
  }

  async function cacheUploadedCover(buffer, requestOptions = {}) {
    return persistCoverBuffer(buffer, requestOptions.contentType || '', manualUploadMaxBytes, requestOptions.filename || '');
  }

  function findAsset(assetId) {
    const id = String(assetId || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    for (const ext of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(coverDir, `${id}.${ext}`);
      try {
        const stat = fs.lstatSync(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
      } catch { continue; }
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      return { assetId:id, filePath, mime, ext };
    }
    return null;
  }

  async function findAssetAsync(assetId) {
    const id = String(assetId || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(id)) return null;
    for (const ext of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(coverDir, `${id}.${ext}`);
      try {
        const stat = await fs.promises.lstat(filePath);
        if (!stat.isFile() || stat.isSymbolicLink()) continue;
      } catch { continue; }
      const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`;
      return { assetId:id, filePath, mime, ext };
    }
    return null;
  }

  async function openAssetForRead(assetId) {
    const asset = await findAssetAsync(assetId);
    if (!asset) return null;
    const noFollow = Number(fs.constants.O_NOFOLLOW) || 0;
    let handle = null;
    try {
      const [rootReal, fileReal] = await Promise.all([
        fs.promises.realpath(coverDir),
        fs.promises.realpath(asset.filePath)
      ]);
      const relative = path.relative(rootReal, fileReal);
      if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null;
      handle = await fs.promises.open(asset.filePath, fs.constants.O_RDONLY | noFollow);
      const stat = await handle.stat();
      if (!stat.isFile()) { await handle.close().catch(() => {}); return null; }
      const buffer = Buffer.alloc(512);
      const result = await handle.read(buffer, 0, buffer.length, 0);
      const detected = detectImage(buffer.subarray(0, result.bytesRead), asset.mime);
      if (!detected || detected.ext !== asset.ext) { await handle.close().catch(() => {}); return null; }
      return {
        ...asset,
        mime:detected.mime,
        stat,
        handle,
        pass:METADATA_COVER_NOFOLLOW_READ_PASS,
        close:() => handle.close()
      };
    } catch (error) {
      if (handle) await handle.close().catch(() => {});
      if (error && ['ELOOP','ENOENT','ENOTDIR'].includes(error.code)) return null;
      throw error;
    }
  }

  function canonicalAssetUrl(assetId) {
    const id = String(assetId || '').toLowerCase();
    return /^[a-f0-9]{64}$/.test(id) ? `/api/metadata/covers/${id}` : '';
  }

  async function verifyAssetAsync(assetId) {
    const opened = await openAssetForRead(assetId);
    if (!opened) return null;
    try {
      const digest = await new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = opened.handle.createReadStream({ start:0, autoClose:false });
        stream.on('data', chunk => hash.update(chunk));
        stream.once('error', reject);
        stream.once('end', () => resolve(hash.digest('hex')));
      });
      if (digest !== opened.assetId) return null;
      return { assetId:opened.assetId, filePath:opened.filePath, mime:opened.mime, ext:opened.ext, url:canonicalAssetUrl(opened.assetId), pass:METADATA_COVER_NOFOLLOW_READ_PASS };
    } finally {
      await opened.close().catch(() => {});
    }
  }

  function getStatus() {
    return {
      coverDir,
      maxCacheBytes,
      minOrphanAgeMs,
      pruneIntervalMs,
      maxDeletePerRun,
      manualUploadMaxBytes,
      pendingAssetLeaseMs,
      leaseStatePath,
      leaseWriteError,
      leasedAssets:(cleanupExpiredLeases(), assetLeases.size),
      postWritePruneMinIntervalMs,
      lastPruneStartedAt: lastPruneStartedAt || null,
      pruning:Boolean(pruneInflight),
      lastPrune,
      pass:METADATA_COVER_CACHE_PASS
    };
  }

  const pruneTimer = setInterval(() => {
    if (!stopped) void pruneCache('scheduled').catch(error => logger?.warn?.('metadata cover scheduled prune failed:', error?.message || error));
  }, pruneIntervalMs);
  pruneTimer.unref?.();
  void pruneCache('startup').catch(error => logger?.warn?.('metadata cover startup prune failed:', error?.message || error));

  async function stop() {
    stopped = true;
    clearInterval(pruneTimer);
    if (pruneInflight) await pruneInflight;
    await leaseWriteTail.catch(() => {});
    return { ok:true, pass:METADATA_COVER_CACHE_PASS };
  }

  return { cacheRemoteCover, cacheUploadedCover, leaseAsset, leaseAssetDurably, releaseAssetLease, releaseAssetLeaseDurably, isAssetLeased, findAsset, findAssetAsync, openAssetForRead, verifyAssetAsync, canonicalAssetUrl, pruneCache, getStatus, stop, pass:METADATA_COVER_CACHE_PASS };
}

module.exports = { METADATA_COVER_CACHE_PASS, METADATA_COVER_NOFOLLOW_READ_PASS, createMetadataCoverService, detectImage, detectAvif, detectBmp, detectHeifFamily, parseCoverFileName };
