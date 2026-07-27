'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const {
  atomicWriteCompressedJsonAsync,
  parseCompressedJsonSync
} = require('../repositories/compressed-json-file-store');

const METADATA_CANDIDATE_SHARD_PASS = 'v671-metadata-candidate-shard-pass';
const CANDIDATE_SHARD_SCHEMA_VERSION = 1;

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

function shardIndexForId(candidateId, shardCount) {
  const digest = crypto.createHash('sha256').update(String(candidateId || '')).digest();
  return digest.readUInt32BE(0) % shardCount;
}

function readShardVersion(filePath, expectedRevision, shardIndex) {
  const targets = [filePath, `${filePath}.bak`];
  for (const target of targets) {
    try {
      if (!fs.existsSync(target)) continue;
      const payload = parseCompressedJsonSync(target);
      if (!payload || payload.schemaVersion !== CANDIDATE_SHARD_SCHEMA_VERSION || Number(payload.shardIndex) !== shardIndex || !payload.candidates || typeof payload.candidates !== 'object') continue;
      const revision = Math.max(0, Number(payload.candidateRevision) || 0);
      const candidate = { payload, revision, source:target === filePath ? 'primary' : 'backup' };
      if (revision === expectedRevision) return candidate;
    } catch {}
  }
  // The main manifest is the transaction commit marker. A newer shard can be
  // present when the process stops after replacing one or more shards but
  // before the manifest is committed. Loading that newer shard would publish
  // an uncommitted partial transaction. Only an exact revision is safe; the
  // previous exact revision normally remains in the atomic writer's backup.
  return null;
}


function candidateWeight(candidate = {}) {
  const value = Date.parse(String(candidate.updatedAt || candidate.createdAt || ''));
  return Number.isFinite(value) ? value : 0;
}

function candidateWorkKey(candidate = {}) {
  return String(candidate.workKey || candidate.novelId || '__unscoped__');
}

function compareCandidatePriority(left, right) {
  return candidateWeight(left) - candidateWeight(right)
    || String(left && left.id || '').localeCompare(String(right && right.id || ''));
}

function createIndexedMinHeap(compare, indexProperty) {
  const values = [];
  const setIndex = (node, index) => { if (node) node[indexProperty] = index; };
  const swap = (left, right) => {
    const value = values[left];
    values[left] = values[right];
    values[right] = value;
    setIndex(values[left], left);
    setIndex(values[right], right);
  };
  const up = (startIndex) => {
    let index = startIndex;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(values[parent], values[index]) <= 0) break;
      swap(parent, index);
      index = parent;
    }
    return index;
  };
  const down = (startIndex) => {
    let index = startIndex;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      let smallest = index;
      if (left < values.length && compare(values[left], values[smallest]) < 0) smallest = left;
      if (right < values.length && compare(values[right], values[smallest]) < 0) smallest = right;
      if (smallest === index) break;
      swap(index, smallest);
      index = smallest;
    }
    return index;
  };
  const removeAt = (index) => {
    if (index < 0 || index >= values.length) return null;
    const removed = values[index];
    const last = values.pop();
    setIndex(removed, -1);
    if (index < values.length) {
      values[index] = last;
      setIndex(last, index);
      const moved = up(index);
      down(moved);
    }
    return removed;
  };
  return {
    push(value) {
      setIndex(value, values.length);
      values.push(value);
      up(values.length - 1);
    },
    pop() { return removeAt(0); },
    remove(value) {
      const index = Number(value && value[indexProperty]);
      if (!Number.isInteger(index) || index < 0 || values[index] !== value) return false;
      removeAt(index);
      return true;
    },
    peek() { return values[0] || null; },
    get size() { return values.length; }
  };
}

function createBoundedCandidateSelector(options = {}) {
  const maxCandidates = Math.max(1, Number(options.maxCandidates) || 20000);
  const maxCandidatesPerWork = Math.max(1, Number(options.maxCandidatesPerWork) || 30);
  const maxCandidateResidentBytes = Math.max(1024 * 1024, Number(options.maxCandidateResidentBytes) || 48 * 1024 * 1024);
  const protectedIds = options.protectedIds instanceof Set ? options.protectedIds : new Set(options.protectedIds || []);
  const selected = new Map();
  const workSelected = new Map();
  const compareNodePriority = (left, right) => {
    // Applied references receive retention priority, but they still participate
    // in the hard count/byte/work bounds. When every retained candidate is
    // protected, the oldest protected item is evicted instead of bypassing the
    // resident limit indefinitely.
    return Number(!!left.protected) - Number(!!right.protected)
      || compareCandidatePriority(left.candidate, right.candidate);
  };
  const globalHeap = createIndexedMinHeap(compareNodePriority, 'globalHeapIndex');
  const workHeaps = new Map();
  let seen = 0;
  let logicalBytes = 0;

  const remove = node => {
    if (!node || selected.get(node.id) !== node) return false;
    selected.delete(node.id);
    globalHeap.remove(node);
    const workHeap = workHeaps.get(node.workKey);
    if (workHeap) {
      workHeap.remove(node);
      if (!workHeap.size) workHeaps.delete(node.workKey);
    }
    logicalBytes = Math.max(0, logicalBytes - Math.max(0, Number(node.logicalBytes) || 0));
    const nextWorkCount = Math.max(0, (workSelected.get(node.workKey) || 1) - 1);
    if (nextWorkCount) workSelected.set(node.workKey, nextWorkCount);
    else workSelected.delete(node.workKey);
    return true;
  };

  const toNode = candidate => {
    const id = String(candidate && candidate.id || '');
    if (!id) return null;
    const workKey = candidateWorkKey(candidate);
    let candidateBytes = 0;
    try { candidateBytes = Buffer.byteLength(JSON.stringify(candidate), 'utf8'); } catch {}
    return {
      id,
      workKey,
      candidate,
      protected:protectedIds.has(id),
      logicalBytes:candidateBytes,
      globalHeapIndex:-1,
      workHeapIndex:-1
    };
  };

  const addNode = node => {
    if (!node || selected.has(node.id)) return false;
    selected.set(node.id, node);
    logicalBytes += node.logicalBytes;
    workSelected.set(node.workKey, (workSelected.get(node.workKey) || 0) + 1);
    globalHeap.push(node);
    let heap = workHeaps.get(node.workKey);
    if (!heap) {
      heap = createIndexedMinHeap(compareNodePriority, 'workHeapIndex');
      workHeaps.set(node.workKey, heap);
    }
    heap.push(node);
    return true;
  };

  function enforceBounds(workKey = '') {
    const workHeap = workKey ? workHeaps.get(workKey) : null;
    while (workHeap && (workSelected.get(workKey) || 0) > maxCandidatesPerWork && workHeap.size) {
      remove(workHeap.peek());
    }
    while ((selected.size > maxCandidates || logicalBytes > maxCandidateResidentBytes) && globalHeap.size) {
      remove(globalHeap.peek());
    }
  }

  function consider(candidate) {
    seen += 1;
    const node = toNode(candidate);
    if (!node || selected.has(node.id)) return;
    const workCount = workSelected.get(node.workKey) || 0;
    if (workCount >= maxCandidatesPerWork) {
      const oldest = workHeaps.get(node.workKey)?.peek() || null;
      if (!oldest || compareNodePriority(node, oldest) <= 0) return;
      remove(oldest);
    }
    if (selected.size >= maxCandidates || logicalBytes + node.logicalBytes > maxCandidateResidentBytes) {
      const oldest = globalHeap.peek();
      if (!oldest || compareNodePriority(node, oldest) <= 0) return;
      remove(oldest);
    }
    addNode(node);
    enforceBounds(node.workKey);
  }

  function result() {
    const candidates = {};
    for (const [id,node] of selected) candidates[id] = node.candidate;
    return {
      candidates,
      seen,
      retained:selected.size,
      removed:Math.max(0, seen - selected.size),
      logicalBytes,
      protectedRetained:Array.from(selected.values()).filter(node => node.protected).length,
      hardBounded:true
    };
  }
  return { consider, result };
}

function createMetadataCandidateShardStore(options = {}) {
  const baseDir = String(options.baseDir || '');
  if (!baseDir) throw new Error('candidate shard baseDir is required');
  const shardCount = boundedShardCount(options.shardCount);
  const compressionLevel = Math.max(1, Math.min(9, Number(options.compressionLevel) || 6));
  const writeCompressed = typeof options.writeCompressed === 'function' ? options.writeCompressed : atomicWriteCompressedJsonAsync;
  const logger = options.logger || console;
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

  function indexCandidates(candidates) {
    for (const set of idsByShard) set.clear();
    for (const candidateId of Object.keys(candidates || {})) idsByShard[shardIndexForId(candidateId, shardCount)].add(candidateId);
  }

  function markCandidate(candidateId) {
    const id = String(candidateId || '');
    if (!id) return;
    const index = shardIndexForId(id, shardCount);
    idsByShard[index].add(id);
    dirtyVersions[index] += 1;
    dirtyShards.add(index);
  }

  function markCandidates(candidateIds) {
    for (const candidateId of Array.isArray(candidateIds) ? candidateIds : [candidateIds]) markCandidate(candidateId);
  }

  function markAll(candidates) {
    indexCandidates(candidates);
    for (let index = 0; index < shardCount; index += 1) {
      dirtyVersions[index] += 1;
      dirtyShards.add(index);
    }
    migrationNeeded = true;
  }

  function initializeEmpty() {
    indexCandidates({});
    dirtyShards.clear();
    for (let index = 0; index < shardCount; index += 1) {
      dirtyVersions[index] = 0;
      shardRevisions[index] = 0;
      trustedSha256[index] = '';
      compression[index] = { jsonBytes:0, compressedBytes:0, ratio:0, level:compressionLevel };
    }
    migrationNeeded = false;
    loadWarnings = [];
    return { candidates:{}, source:'empty', migrationNeeded:false, warnings:[] };
  }

  function isManifest(value) {
    return !!(value && value.version === 1 && Number(value.shardCount) === shardCount && Array.isArray(value.revisions));
  }

  function load(manifest, fallbackCandidates = {}) {
    const expected = isManifest(manifest) ? manifest : null;
    if (!expected) {
      const candidates = fallbackCandidates && typeof fallbackCandidates === 'object' ? fallbackCandidates : {};
      markAll(candidates);
      return { candidates, source:'legacy-monolith', migrationNeeded:true, warnings:[] };
    }
    const candidates = {};
    const revisions = Array.isArray(expected.revisions) ? expected.revisions : [];
    loadWarnings = [];
    for (let index = 0; index < shardCount; index += 1) {
      const expectedRevision = Math.max(0, Number(revisions[index]) || 0);
      shardRevisions[index] = expectedRevision;
      const loaded = readShardVersion(shardPath(index), expectedRevision, index);
      if (!loaded && expectedRevision === 0) continue;
      if (!loaded) {
        const error = Object.assign(new Error(`metadata candidate shard ${index} revision ${expectedRevision} is unavailable`), {
          code:'METADATA_CANDIDATE_SHARD_REVISION_MISSING',
          shardIndex:index,
          expectedRevision
        });
        loadWarnings.push(error.message);
        dirtyShards.add(index);
        throw error;
      }
      const payload = loaded.payload;
      for (const [candidateId, candidate] of Object.entries(payload.candidates || {})) {
        candidates[candidateId] = candidate;
        idsByShard[index].add(candidateId);
      }
      const filePath = loaded.source === 'primary' ? shardPath(index) : `${shardPath(index)}.bak`;
      compression[index] = {
        jsonBytes:Math.max(0, Number(payload.jsonBytes) || 0),
        compressedBytes:fileBytes(filePath),
        ratio:0,
        level:compressionLevel
      };
    }
    migrationNeeded = false;
    return { candidates, source:'candidate-shards', migrationNeeded:false, warnings:loadWarnings.slice() };
  }


  function loadBounded(manifest, fallbackCandidates = {}, options = {}) {
    const selector = createBoundedCandidateSelector(options);
    const expected = isManifest(manifest) ? manifest : null;
    if (!expected) {
      const source = fallbackCandidates && typeof fallbackCandidates === 'object' ? fallbackCandidates : {};
      for (const candidate of Object.values(source)) selector.consider(candidate);
      const bounded = selector.result();
      markAll(bounded.candidates);
      return { ...bounded, source:'legacy-monolith-bounded', migrationNeeded:true, warnings:[] };
    }
    const revisions = Array.isArray(expected.revisions) ? expected.revisions : [];
    loadWarnings = [];
    for (const set of idsByShard) set.clear();
    for (let index = 0; index < shardCount; index += 1) {
      const expectedRevision = Math.max(0, Number(revisions[index]) || 0);
      shardRevisions[index] = expectedRevision;
      const loaded = readShardVersion(shardPath(index), expectedRevision, index);
      if (!loaded && expectedRevision === 0) continue;
      if (!loaded) {
        const error = Object.assign(new Error(`metadata candidate shard ${index} revision ${expectedRevision} is unavailable`), {
          code:'METADATA_CANDIDATE_SHARD_REVISION_MISSING', shardIndex:index, expectedRevision
        });
        loadWarnings.push(error.message);
        dirtyShards.add(index);
        throw error;
      }
      const payload = loaded.payload;
      for (const candidate of Object.values(payload.candidates || {})) selector.consider(candidate);
      const filePath = loaded.source === 'primary' ? shardPath(index) : `${shardPath(index)}.bak`;
      compression[index] = {
        jsonBytes:Math.max(0, Number(payload.jsonBytes) || 0),
        compressedBytes:fileBytes(filePath), ratio:0, level:compressionLevel
      };
    }
    const bounded = selector.result();
    indexCandidates(bounded.candidates);
    migrationNeeded = bounded.removed > 0;
    if (migrationNeeded) markAll(bounded.candidates);
    return { ...bounded, source:'candidate-shards-bounded', migrationNeeded, warnings:loadWarnings.slice() };
  }


  function loadBoundedIsolated(manifestValue, fallbackCandidates = {}, options = {}) {
    const expected = isManifest(manifestValue) ? manifestValue : null;
    if (!expected || options.isolated === false) return loadBounded(manifestValue, fallbackCandidates, options);
    const loaderPath = path.resolve(__dirname, '../workers/metadata-candidate-bounded-loader.js');
    const protectedIds = options.protectedIds instanceof Set
      ? Array.from(options.protectedIds, String)
      : Array.isArray(options.protectedIds) ? options.protectedIds.map(String) : [];
    const request = JSON.stringify({
      baseDir,
      shardCount,
      compressionLevel,
      manifest:expected,
      maxCandidates:Math.max(1, Number(options.maxCandidates) || 20000),
      maxCandidatesPerWork:Math.max(1, Number(options.maxCandidatesPerWork) || 30),
      maxCandidateResidentBytes:Math.max(1024 * 1024, Number(options.maxCandidateResidentBytes) || 48 * 1024 * 1024),
      protectedIds
    });
    const maxBuffer = Math.max(16 * 1024 * 1024, Math.min(192 * 1024 * 1024, Number(options.isolatedMaxBufferBytes) || 96 * 1024 * 1024));
    const run = spawnSync(process.execPath, [loaderPath], {
      input:request,
      encoding:'utf8',
      timeout:Math.max(10_000, Math.min(300_000, Number(options.isolatedTimeoutMs) || 120_000)),
      maxBuffer,
      windowsHide:true
    });
    if (run.status !== 0 || run.error) {
      logger.warn?.('metadata bounded shard isolated loader failed; using in-process fallback:', String(run.stderr || run.error?.message || `exit ${run.status}`).trim());
      return loadBounded(manifestValue, fallbackCandidates, options);
    }
    let bounded;
    try { bounded = JSON.parse(String(run.stdout || '')); }
    catch (error) {
      logger.warn?.('metadata bounded shard isolated loader returned invalid JSON; using in-process fallback:', error.message);
      return loadBounded(manifestValue, fallbackCandidates, options);
    }
    const revisions = Array.isArray(expected.revisions) ? expected.revisions : [];
    loadWarnings = Array.isArray(bounded.warnings) ? bounded.warnings.slice() : [];
    for (let index = 0; index < shardCount; index += 1) {
      shardRevisions[index] = Math.max(0, Number(revisions[index]) || 0);
      compression[index] = {
        jsonBytes:0,
        compressedBytes:fileBytes(shardPath(index)),
        ratio:0,
        level:compressionLevel
      };
    }
    const candidates = bounded && bounded.candidates && typeof bounded.candidates === 'object' ? bounded.candidates : {};
    indexCandidates(candidates);
    migrationNeeded = Math.max(0, Number(bounded.removed) || 0) > 0;
    if (migrationNeeded) markAll(candidates);
    return {
      candidates,
      seen:Math.max(0, Number(bounded.seen) || Object.keys(candidates).length),
      retained:Object.keys(candidates).length,
      removed:Math.max(0, Number(bounded.removed) || 0),
      logicalBytes:Math.max(0, Number(bounded.logicalBytes) || 0),
      source:'candidate-shards-bounded-isolated',
      migrationNeeded,
      warnings:loadWarnings.slice(),
      isolated:true
    };
  }

  function manifest(candidateRevision, stateRevision) {
    return {
      version:1,
      pass:METADATA_CANDIDATE_SHARD_PASS,
      shardCount,
      candidateRevision:Math.max(0, Number(candidateRevision) || 0),
      stateRevision:Math.max(0, Number(stateRevision) || 0),
      revisions:shardRevisions.slice()
    };
  }

  async function flush(candidates, candidateRevision, stateRevision, options = {}) {
    const forceAll = options.forceAll === true || migrationNeeded;
    if (forceAll) {
      indexCandidates(candidates);
      for (let index = 0; index < shardCount; index += 1) dirtyShards.add(index);
    }
    const targets = Array.from(dirtyShards).sort((a, b) => a - b).map(index => {
      const dirtyVersion = dirtyVersions[index];
      const ids = idsByShard[index];
      const shardCandidates = {};
      for (const candidateId of Array.from(ids)) {
        const candidate = candidates && candidates[candidateId];
        if (candidate) shardCandidates[candidateId] = candidate;
        else ids.delete(candidateId);
      }
      const payload = {
        schemaVersion:CANDIDATE_SHARD_SCHEMA_VERSION,
        pass:METADATA_CANDIDATE_SHARD_PASS,
        shardIndex:index,
        candidateRevision:Math.max(0, Number(candidateRevision) || 0),
        stateRevision:Math.max(0, Number(stateRevision) || 0),
        candidates:shardCandidates
      };
      const serializedJson = Buffer.from(JSON.stringify(payload), 'utf8');
      return { index, dirtyVersion, payload, serializedJson };
    });
    for (const target of targets) {
      const { index, dirtyVersion, payload, serializedJson } = target;
      const result = await writeCompressed(shardPath(index), payload, {
        level:compressionLevel,
        serializedJson,
        trustedPrimarySha256:trustedSha256[index]
      });
      trustedSha256[index] = String(result && result.primarySha256 || '');
      compression[index] = result || compression[index];
      shardRevisions[index] = Math.max(0, Number(candidateRevision) || 0);
      if (dirtyVersions[index] === dirtyVersion) dirtyShards.delete(index);
    }
    migrationNeeded = false;
    return manifest(candidateRevision, stateRevision);
  }

  function getStats() {
    let compressedBytes = 0;
    let backupBytes = 0;
    let jsonBytes = 0;
    for (let index = 0; index < shardCount; index += 1) {
      compressedBytes += fileBytes(shardPath(index));
      backupBytes += fileBytes(`${shardPath(index)}.bak`);
      jsonBytes += Math.max(0, Number(compression[index] && compression[index].jsonBytes) || 0);
    }
    return {
      pass:METADATA_CANDIDATE_SHARD_PASS,
      baseDir:path.basename(baseDir),
      shardCount,
      dirtyShards:dirtyShards.size,
      migrationNeeded,
      compressedBytes,
      backupBytes,
      logicalBytes:jsonBytes,
      warnings:loadWarnings.slice(0, 20),
      revisions:shardRevisions.slice()
    };
  }

  return {
    load,
    loadBounded,
    loadBoundedIsolated,
    flush,
    manifest,
    markCandidate,
    markCandidates,
    markAll,
    initializeEmpty,
    isManifest,
    indexCandidates,
    getStats,
    shardIndexForId:candidateId => shardIndexForId(candidateId, shardCount),
    pass:METADATA_CANDIDATE_SHARD_PASS
  };
}

module.exports = {
  METADATA_CANDIDATE_SHARD_PASS,
  createMetadataCandidateShardStore,
  shardIndexForId,
  createBoundedCandidateSelector
};
