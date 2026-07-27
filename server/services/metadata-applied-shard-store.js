'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  atomicWriteCompressedJsonAsync,
  parseCompressedJsonSync
} = require('../repositories/compressed-json-file-store');

const METADATA_APPLIED_SHARD_V2_PASS = 'v673-metadata-applied-shard-v2-pass';
const APPLIED_SHARD_SCHEMA_VERSION = 1;
const APPLIED_MANIFEST_SCHEMA_VERSION = 2;

function fileBytes(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isFile() && !stat.isSymbolicLink() ? Math.max(0, Number(stat.size) || 0) : 0;
  } catch { return 0; }
}

function boundedShardCount(value) {
  const parsed = Number(value);
  const target = Number.isFinite(parsed) ? Math.floor(parsed) : 32;
  return Math.max(8, Math.min(128, target));
}

function shardIndexForId(recordId, shardCount) {
  const digest = crypto.createHash('sha256').update(String(recordId || '')).digest();
  return digest.readUInt32BE(0) % shardCount;
}

function readShardVersion(filePath, expectedRevision, shardIndex) {
  for (const target of [filePath, `${filePath}.bak`]) {
    try {
      if (!fs.existsSync(target)) continue;
      const payload = parseCompressedJsonSync(target);
      if (!payload || payload.schemaVersion !== APPLIED_SHARD_SCHEMA_VERSION || Number(payload.shardIndex) !== shardIndex || !payload.applied || typeof payload.applied !== 'object') continue;
      const revision = Math.max(0, Number(payload.shardRevision) || 0);
      if (revision !== expectedRevision) continue;
      return { payload, revision, source:target === filePath ? 'primary' : 'backup', filePath:target };
    } catch {}
  }
  return null;
}

function createMetadataAppliedShardStore(options = {}) {
  const baseDir = String(options.baseDir || '');
  if (!baseDir) throw new Error('applied shard baseDir is required');
  const shardCount = boundedShardCount(options.shardCount);
  const compressionLevel = Math.max(1, Math.min(9, Number(options.compressionLevel) || 6));
  const writeCompressed = typeof options.writeCompressed === 'function' ? options.writeCompressed : atomicWriteCompressedJsonAsync;
  const idsByShard = Array.from({ length:shardCount }, () => new Set());
  const dirtyShards = new Set();
  const dirtyVersions = Array.from({ length:shardCount }, () => 0);
  const shardRevisions = Array.from({ length:shardCount }, () => 0);
  const trustedSha256 = Array.from({ length:shardCount }, () => '');
  const compression = Array.from({ length:shardCount }, () => ({ jsonBytes:0, compressedBytes:0, ratio:0, level:compressionLevel }));
  let migrationNeeded = false;
  let loadWarnings = [];

  function shardPath(index) {
    return path.join(baseDir, `shard-${String(index).padStart(2, '0')}.json.gz`);
  }

  function indexApplied(applied) {
    for (const ids of idsByShard) ids.clear();
    for (const recordId of Object.keys(applied || {})) idsByShard[shardIndexForId(recordId, shardCount)].add(recordId);
  }

  function markRecord(recordId) {
    const id = String(recordId || '');
    if (!id) return;
    const index = shardIndexForId(id, shardCount);
    idsByShard[index].add(id);
    dirtyVersions[index] += 1;
    dirtyShards.add(index);
  }

  function markRecords(recordIds) {
    for (const recordId of Array.isArray(recordIds) ? recordIds : [recordIds]) markRecord(recordId);
  }

  function markAll(applied) {
    indexApplied(applied);
    for (let index = 0; index < shardCount; index += 1) {
      dirtyVersions[index] += 1;
      dirtyShards.add(index);
    }
    migrationNeeded = true;
  }

  function initializeEmpty() {
    indexApplied({});
    dirtyShards.clear();
    for (let index = 0; index < shardCount; index += 1) {
      dirtyVersions[index] = 0;
      shardRevisions[index] = 0;
      trustedSha256[index] = '';
      compression[index] = { jsonBytes:0, compressedBytes:0, ratio:0, level:compressionLevel };
    }
    migrationNeeded = false;
    loadWarnings = [];
    return { applied:{}, source:'empty', migrationNeeded:false, warnings:[] };
  }

  function isManifest(value) {
    return !!(value && value.schemaVersion === APPLIED_MANIFEST_SCHEMA_VERSION && value.pass === METADATA_APPLIED_SHARD_V2_PASS && Number(value.shardCount) === shardCount && Array.isArray(value.revisions));
  }

  function load(manifest, fallbackApplied = {}) {
    if (!isManifest(manifest)) {
      const applied = fallbackApplied && typeof fallbackApplied === 'object' ? fallbackApplied : {};
      markAll(applied);
      return { applied, source:'legacy-applied-store', migrationNeeded:true, warnings:[] };
    }
    const applied = {};
    loadWarnings = [];
    for (let index = 0; index < shardCount; index += 1) {
      const expectedRevision = Math.max(0, Number(manifest.revisions[index]) || 0);
      shardRevisions[index] = expectedRevision;
      const loaded = readShardVersion(shardPath(index), expectedRevision, index);
      if (!loaded && expectedRevision === 0) continue;
      if (!loaded) {
        const error = Object.assign(new Error(`metadata applied shard ${index} revision ${expectedRevision} is unavailable`), {
          code:'METADATA_APPLIED_SHARD_REVISION_MISSING',
          shardIndex:index,
          expectedRevision
        });
        loadWarnings.push(error.message);
        dirtyShards.add(index);
        throw error;
      }
      for (const [recordId, record] of Object.entries(loaded.payload.applied || {})) {
        applied[recordId] = record;
        idsByShard[index].add(recordId);
      }
      compression[index] = {
        jsonBytes:Math.max(0, Number(loaded.payload.jsonBytes) || 0),
        compressedBytes:fileBytes(loaded.filePath),
        ratio:0,
        level:compressionLevel
      };
    }
    migrationNeeded = false;
    return { applied, source:'applied-shards-v2', migrationNeeded:false, warnings:loadWarnings.slice() };
  }

  function manifest(appliedRevision, stateRevision) {
    return {
      schemaVersion:APPLIED_MANIFEST_SCHEMA_VERSION,
      pass:METADATA_APPLIED_SHARD_V2_PASS,
      shardCount,
      appliedRevision:Math.max(0, Number(appliedRevision) || 0),
      stateRevision:Math.max(0, Number(stateRevision) || 0),
      revisions:shardRevisions.slice()
    };
  }

  async function flush(applied, appliedRevision, stateRevision, options = {}) {
    const forceAll = options.forceAll === true || migrationNeeded;
    if (forceAll) markAll(applied);
    const revision = Math.max(0, Number(appliedRevision) || 0);
    const stateRev = Math.max(0, Number(stateRevision) || 0);
    const targets = Array.from(dirtyShards).sort((a, b) => a - b).map(index => {
      const dirtyVersion = dirtyVersions[index];
      const shardApplied = {};
      for (const recordId of Array.from(idsByShard[index])) {
        const record = applied && applied[recordId];
        if (record) shardApplied[recordId] = record;
        else idsByShard[index].delete(recordId);
      }
      const payload = {
        schemaVersion:APPLIED_SHARD_SCHEMA_VERSION,
        pass:METADATA_APPLIED_SHARD_V2_PASS,
        shardIndex:index,
        shardRevision:revision,
        appliedRevision:revision,
        stateRevision:stateRev,
        applied:shardApplied
      };
      return { index, dirtyVersion, payload, serializedJson:Buffer.from(JSON.stringify(payload), 'utf8') };
    });
    for (const target of targets) {
      const result = await writeCompressed(shardPath(target.index), target.payload, {
        level:compressionLevel,
        serializedJson:target.serializedJson,
        trustedPrimarySha256:trustedSha256[target.index]
      });
      trustedSha256[target.index] = String(result && result.primarySha256 || '');
      compression[target.index] = result || compression[target.index];
      shardRevisions[target.index] = revision;
      if (dirtyVersions[target.index] === target.dirtyVersion) dirtyShards.delete(target.index);
    }
    migrationNeeded = false;
    return manifest(revision, stateRev);
  }

  function getStats() {
    let compressedBytes = 0;
    let backupBytes = 0;
    let logicalBytes = 0;
    for (let index = 0; index < shardCount; index += 1) {
      compressedBytes += fileBytes(shardPath(index));
      backupBytes += fileBytes(`${shardPath(index)}.bak`);
      logicalBytes += Math.max(0, Number(compression[index] && compression[index].jsonBytes) || 0);
    }
    return {
      pass:METADATA_APPLIED_SHARD_V2_PASS,
      baseDir:path.basename(baseDir),
      shardCount,
      dirtyShards:dirtyShards.size,
      migrationNeeded,
      compressedBytes,
      backupBytes,
      logicalBytes,
      warnings:loadWarnings.slice(0, 20),
      revisions:shardRevisions.slice()
    };
  }

  return {
    load,
    flush,
    manifest,
    isManifest,
    markRecord,
    markRecords,
    markAll,
    initializeEmpty,
    indexApplied,
    getStats,
    shardIndexForId:recordId => shardIndexForId(recordId, shardCount),
    pass:METADATA_APPLIED_SHARD_V2_PASS
  };
}

module.exports = {
  METADATA_APPLIED_SHARD_V2_PASS,
  APPLIED_MANIFEST_SCHEMA_VERSION,
  createMetadataAppliedShardStore,
  shardIndexForId
};
