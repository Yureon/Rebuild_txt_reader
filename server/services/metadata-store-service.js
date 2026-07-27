const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadJsonWithBackup, durableRemoveAsync } = require('../repositories/json-file-store');
const { loadCompressedJsonWithBackup, atomicWriteCompressedJsonAsync, COMPRESSED_JSON_STORE_PASS } = require('../repositories/compressed-json-file-store');
const { cleanMetadataSearchTitle } = require('./metadata-search-terms');
const { createMetadataCandidateShardStore, createBoundedCandidateSelector, METADATA_CANDIDATE_SHARD_PASS } = require('./metadata-candidate-shard-store');
const { createMetadataAppliedShardStore, METADATA_APPLIED_SHARD_V2_PASS } = require('./metadata-applied-shard-store');

const METADATA_STORE_PASS = 'v576-metadata-store-pass';
const METADATA_STORE_ASYNC_PERSISTENCE_PASS = 'v592-metadata-store-async-persistence-pass';
const METADATA_COLLECTED_CANDIDATE_RETENTION_PASS = 'v614-metadata-collected-candidate-retention-pass';
const METADATA_CANDIDATE_DEDUP_PASS = 'v615-metadata-candidate-dedup-pass';
const METADATA_MANUAL_EDIT_PASS = 'v630-metadata-manual-edit-pass';
const METADATA_CANDIDATE_DELETE_PASS = 'v630-metadata-candidate-delete-pass';
const METADATA_EQUIVALENT_GROUP_PASS = 'v638-metadata-equivalent-group-pass';
const METADATA_COMPRESSED_STORE_PASS = 'v642-metadata-compressed-store-pass';
const METADATA_CANDIDATE_MAINTENANCE_PASS = 'v642-metadata-candidate-maintenance-pass';
const METADATA_PROVIDER_SETTINGS_PASS = 'v643-metadata-provider-settings-pass';
const METADATA_PRESENTATION_REVISION_PASS = 'v646-metadata-presentation-revision-pass';
const METADATA_SINGLE_SERIALIZE_WRITE_PASS = 'v646-metadata-single-serialize-write-pass';
const METADATA_STARTUP_COMPACTION_PASS = 'v646-metadata-startup-compaction-once-pass';
const METADATA_APPLIED_SHARD_PASS = 'v648-metadata-applied-shard-pass';
const METADATA_CANDIDATE_COMPACTION_VERSION = 2;
const METADATA_UNION_FIND_COMPACTION_PASS = 'v671-metadata-union-find-compaction-pass';
const METADATA_CLEANUP_BACKGROUND_PLAN_PASS = 'v671-metadata-cleanup-background-plan-pass';
const METADATA_INCREMENTAL_INDEX_PASS = 'v672-metadata-incremental-index-pass';
const METADATA_APPLIED_INCREMENTAL_INDEX_PASS = 'v673-metadata-applied-incremental-index-pass';
const V675_METADATA_COMPACT_INDEX_PASS = 'v675-metadata-compact-index-pass';
const V675_METADATA_STARTUP_BOUND_PASS = 'v675-metadata-startup-bound-pass';
const V676_METADATA_BOUNDED_SHARD_LOAD_PASS = 'v676-metadata-bounded-shard-load-pass';
const V677_METADATA_HARD_RESIDENT_BOUND_PASS = 'v677-metadata-hard-resident-bound-pass';
const V677_METADATA_INCREMENTAL_EVICTION_PASS = 'v677-metadata-incremental-eviction-pass';
const V677_METADATA_APPLIED_PROVENANCE_PASS = 'v677-metadata-applied-provenance-pass';
const CLEANUP_PLAN_CACHE_TTL_MS = 5 * 60 * 1000;
const CLEANUP_PLAN_CACHE_MAX = 4;
const CLEANUP_REMOVAL_IDS = Symbol('metadataCleanupRemovalIds');
const METADATA_FIELDS = Object.freeze(['title','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','cover']);

function nowIso() { return new Date().toISOString(); }
function id(prefix = '') { return `${prefix}${crypto.randomBytes(12).toString('hex')}`; }
function normalizeText(value, max = 1000) { return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max); }
function normalizeList(value, maxItems = 40, maxLength = 100) {
  const seen = new Set();
  const out = [];
  for (const raw of Array.isArray(value) ? value : []) {
    const item = normalizeText(raw, maxLength).replace(/^#+/, '');
    const key = item.toLocaleLowerCase('ko-KR');
    if (!item || seen.has(key)) continue;
    seen.add(key); out.push(item);
    if (out.length >= maxItems) break;
  }
  return out;
}
function aliasList(novel) {
  return Array.from(new Set([novel && novel.id, ...(Array.isArray(novel && novel.progressAliases) ? novel.progressAliases : [])].map(String).filter(Boolean))).slice(0, 256);
}
function normalizeWorkKey(title, author = '') {
  const cleanTitle = cleanMetadataSearchTitle(String(title || '')) || normalizeText(title, 300);
  const raw = `${cleanTitle.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '')}|${normalizeText(author, 120).normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, '')}`;
  return crypto.createHash('sha256').update(raw).digest('hex');
}
function sanitizeExtracted(value = {}) {
  const year = Number(value.publicationYear);
  return {
    title:normalizeText(value.title, 300),
    originalTitle:normalizeText(value.originalTitle, 300) || null,
    author:normalizeText(value.author, 160) || null,
    synopsis:normalizeText(value.synopsis, 8000) || null,
    genres:normalizeList(value.genres, 24, 100),
    tags:normalizeList(value.tags, 40, 100),
    publicationStatus:normalizeText(value.publicationStatus, 80) || null,
    publicationYear:Number.isInteger(year) && year >= 1000 && year <= 3000 ? year : null,
    sourceLanguage:normalizeText(value.sourceLanguage, 24) || null,
    coverRemoteUrl:normalizeText(value.coverUrl || value.coverRemoteUrl, 2048) || null,
    coverAssetId:normalizeText(value.coverAssetId, 128) || null,
    coverUrl:normalizeText(value.coverUrlLocal, 2048) || null,
    sourceUrl:normalizeText(value.sourceUrl, 2048),
    remoteId:normalizeText(value.remoteId, 160),
    rawSha256:normalizeText(value.rawSha256, 128)
  };
}

function candidateRecency(candidate) {
  return String(candidate && (candidate.updatedAt || candidate.createdAt) || '');
}

function boundedInteger(value, fallback, min, max) {
  const parsed = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(parsed) ? Math.floor(parsed) : fallback));
}
function candidateTimestampMs(candidate) {
  const parsed = Date.parse(String(candidate && (candidate.updatedAt || candidate.createdAt) || ''));
  return Number.isFinite(parsed) ? parsed : 0;
}
function fileBytesSync(filePath) {
  try {
    const stat = fs.lstatSync(filePath);
    return stat.isFile() && !stat.isSymbolicLink() ? Math.max(0, Number(stat.size) || 0) : 0;
  } catch (_error) { return 0; }
}

function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

function cleanupCandidateComparator(left, right) {
  return candidateTimestampMs(right) - candidateTimestampMs(left)
    || Number(right && right.matchScore || 0) - Number(left && left.matchScore || 0)
    || String(right && right.id || '').localeCompare(String(left && left.id || ''));
}

function retainBoundedCandidate(map, key, candidate, limit) {
  if (limit <= 0) return;
  const list = map.get(key) || [];
  let insertAt = list.length;
  for (let index = 0; index < list.length; index += 1) {
    if (cleanupCandidateComparator(candidate, list[index]) < 0) {
      insertAt = index;
      break;
    }
  }
  list.splice(insertAt, 0, candidate);
  if (list.length > limit) list.length = limit;
  map.set(key, list);
}

function estimateCandidateLogicalBytes(candidate) {
  try { return Buffer.byteLength(JSON.stringify(candidate), 'utf8'); }
  catch { return 0; }
}

function availableMetadataFields(data = {}) {
  return METADATA_FIELDS.filter(field => {
    if (field === 'cover') return !!(data.coverAssetId && data.coverUrl);
    const value = data[field];
    return Array.isArray(value) ? value.length > 0 : value != null && String(value).trim() !== '';
  });
}
function selectMetadataFields(data = {}, fields) {
  const available = new Set(availableMetadataFields(data));
  const requested = Array.isArray(fields)
    ? Array.from(new Set(fields.map(String).filter(field => METADATA_FIELDS.includes(field))))
    : Array.from(available);
  if (!requested.length) throw Object.assign(new Error('at least one metadata field must be selected'), { code:'METADATA_FIELDS_REQUIRED' });
  const unavailable = requested.filter(field => !available.has(field));
  if (unavailable.length) throw Object.assign(new Error(`selected metadata fields are unavailable: ${unavailable.join(', ')}`), { code:'METADATA_FIELDS_INVALID', fields:unavailable });
  return requested;
}
function normalizeFingerprintList(value, maxItems = 40, maxLength = 100) {
  return normalizeList(value, maxItems, maxLength)
    .map(item => item.normalize('NFKC').toLocaleLowerCase('ko-KR'))
    .sort((a,b) => a.localeCompare(b, 'ko'));
}
function metadataContentFingerprint(value = {}) {
  const year = Number(value.publicationYear);
  const payload = {
    title:normalizeText(value.title, 300).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    originalTitle:normalizeText(value.originalTitle, 300).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    author:normalizeText(value.author, 160).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    synopsis:normalizeText(value.synopsis, 8000).normalize('NFKC'),
    genres:normalizeFingerprintList(value.genres, 24, 100),
    tags:normalizeFingerprintList(value.tags, 40, 100),
    publicationStatus:normalizeText(value.publicationStatus, 80).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    publicationYear:Number.isInteger(year) && year >= 1000 && year <= 3000 ? year : null,
    sourceLanguage:normalizeText(value.sourceLanguage, 24).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    coverRemoteUrl:normalizeText(value.coverRemoteUrl || value.coverUrl, 2048)
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function metadataEquivalenceFingerprint(value = {}) {
  const year = Number(value.publicationYear);
  const payload = {
    title:normalizeText(value.title, 300).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    originalTitle:normalizeText(value.originalTitle, 300).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    author:normalizeText(value.author, 160).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    synopsis:normalizeText(value.synopsis, 8000).normalize('NFKC'),
    genres:normalizeFingerprintList(value.genres, 24, 100),
    tags:normalizeFingerprintList(value.tags, 40, 100),
    publicationStatus:normalizeText(value.publicationStatus, 80).normalize('NFKC').toLocaleLowerCase('ko-KR'),
    publicationYear:Number.isInteger(year) && year >= 1000 && year <= 3000 ? year : null,
    sourceLanguage:normalizeText(value.sourceLanguage, 24).normalize('NFKC').toLocaleLowerCase('ko-KR')
  };
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

function candidateContentKey(providerId, fingerprint) {
  return `${String(providerId || '')}|${String(fingerprint || '')}`;
}
function candidateIdentityPairs(value = {}) {
  const pairs = [];
  const add = (remoteId, sourceUrl) => {
    const pair = { remoteId:normalizeText(remoteId, 160), sourceUrl:normalizeText(sourceUrl, 2048) };
    if (!pair.remoteId && !pair.sourceUrl) return;
    if (pairs.some(item => item.remoteId === pair.remoteId && item.sourceUrl === pair.sourceUrl)) return;
    pairs.push(pair);
  };
  for (const pair of Array.isArray(value.sourceIdentityPairs) ? value.sourceIdentityPairs : []) add(pair && pair.remoteId, pair && pair.sourceUrl);
  add(value.remoteId, value.sourceUrl);
  if (!pairs.length) {
    for (const token of Array.isArray(value.sourceIdentities) ? value.sourceIdentities : []) {
      const text = normalizeText(token, 2200);
      if (text.startsWith('remote:')) add(text.slice(7), '');
      else if (text.startsWith('url:')) add('', text.slice(4));
    }
  }
  return pairs.slice(0, 32);
}
function candidateIdentityTokens(value = {}) {
  return Array.from(new Set(candidateIdentityPairs(value).flatMap(pair => [
    pair.remoteId ? `remote:${pair.remoteId}` : '',
    pair.sourceUrl ? `url:${pair.sourceUrl}` : ''
  ]).filter(Boolean))).slice(0, 64);
}
function candidateRecordsOverlap(left, right) {
  if (!left || !right) return false;
  if (left.novelId && right.novelId && String(left.novelId) === String(right.novelId)) return true;
  if (left.workKey && right.workKey && String(left.workKey) === String(right.workKey)) return true;
  const aliases = new Set(Array.isArray(left.aliases) ? left.aliases.map(String) : []);
  return (Array.isArray(right.aliases) ? right.aliases : []).some(alias => aliases.has(String(alias)));
}

function createMetadataStoreService(options = {}) {
  const storePath = options.storePath;
  const compressedStorePath = String(options.compressedStorePath || `${storePath}.gz`);
  const appliedStorePath = String(options.appliedStorePath || path.join(path.dirname(compressedStorePath), 'work-metadata-applied.json.gz'));
  const logger = options.logger || console;
  const compressionLevel = boundedInteger(options.compressionLevel, 6, 1, 9);
  const writeCompressed = typeof options.writeCompressed === 'function' ? options.writeCompressed : atomicWriteCompressedJsonAsync;
  const removeLegacy = typeof options.removeLegacy === 'function' ? options.removeLegacy : durableRemoveAsync;
  const candidateShardStore = createMetadataCandidateShardStore({
    baseDir:String(options.candidateShardDir || path.join(path.dirname(compressedStorePath), 'metadata-candidate-shards')),
    shardCount:Number(options.candidateShardCount) || 32,
    compressionLevel,
    writeCompressed,
    logger
  });
  const appliedShardStore = createMetadataAppliedShardStore({
    baseDir:String(options.appliedShardDir || path.join(path.dirname(compressedStorePath), 'metadata-applied-shards')),
    shardCount:Number(options.appliedShardCount) || 32,
    compressionLevel,
    writeCompressed,
    logger
  });
  let state = { schemaVersion:1, revision:0, revisions:{ applied:0, candidates:0, settings:0 }, maintenance:{ candidateCompactionVersion:0 }, settings:{ providers:{}, providerDefinitions:{} }, candidates:{}, applied:{} };
  const maxCandidates = Math.max(1000, Math.min(500000, Number(options.maxCandidates) || 20000));
  const maxCandidatesPerWork = Math.max(5, Math.min(100, Number(options.maxCandidatesPerWork) || 30));
  const maxCandidateResidentBytes = Math.max(8 * 1024 * 1024, Math.min(256 * 1024 * 1024, Number(options.maxCandidateResidentBytes) || 48 * 1024 * 1024));
  let loadedFromLegacy = false;
  let loadedSource = 'fallback';
  let appliedLoadedSource = 'fallback';
  let appliedStorageMode = 'none';
  let candidateLoadSource = 'fallback';
  let candidateLoadSeen = 0;
  let candidateLoadRemoved = 0;
  let lastCompression = { jsonBytes:0, compressedBytes:fileBytesSync(compressedStorePath), ratio:0, level:compressionLevel };
  let lastAppliedCompression = { jsonBytes:0, compressedBytes:fileBytesSync(appliedStorePath), ratio:0, level:compressionLevel };
  let trustedPrimarySha256 = '';
  let trustedAppliedPrimarySha256 = '';
  let hasAppliedShard = false;
  let appliedShardRepairNeeded = false;
  let aliasIndex = new Map();
  let workKeyIndex = new Map();
  let appliedRecordIdsByCandidateId = new Map();
  let coverAccessIndex = new Map();
  let candidateIdsByAlias = new Map();
  let candidateIdsByWorkKey = new Map();
  let candidateIdsByContentKey = new Map();
  let candidateIdsByIdentity = new Map();
  let candidateEvictionHeap = [];
  let candidateLogicalBytes = new Map();
  let totalCandidateLogicalBytes = 0;
  let candidateResidentCount = 0;
  let coverAccessDirty = false;
  let mainDirty = false;
  let appliedDirty = false;
  let candidateDirty = false;
  let writing = null;
  let generation = 0;
  let persistedMainGeneration = 0;
  let persistedAppliedGeneration = 0;
  let persistedCandidateGeneration = 0;
  let closed = false;
  let durableMutationTail = Promise.resolve();
  const cleanupPlanCache = new Map();
  const persistenceMetrics = {
    mutations:0,
    writes:0,
    coalescedMutations:0,
    lastWriteAt:0,
    lastWriteError:'',
    lastWriteErrorAt:0
  };


  function candidateRetentionCompare(left, right) {
    return Number(!!left.protected) - Number(!!right.protected)
      || candidateTimestampMs(left.candidate) - candidateTimestampMs(right.candidate)
      || String(left.id || '').localeCompare(String(right.id || ''));
  }
  function heapSwap(values, left, right) { const value = values[left]; values[left] = values[right]; values[right] = value; }
  function heapPush(values, value, compare) {
    values.push(value);
    let index = values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(values[parent], values[index]) <= 0) break;
      heapSwap(values, parent, index); index = parent;
    }
  }
  function heapPop(values, compare) {
    if (!values.length) return null;
    const first = values[0];
    const last = values.pop();
    if (values.length) {
      values[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1; const right = left + 1; let smallest = index;
        if (left < values.length && compare(values[left], values[smallest]) < 0) smallest = left;
        if (right < values.length && compare(values[right], values[smallest]) < 0) smallest = right;
        if (smallest === index) break;
        heapSwap(values, index, smallest); index = smallest;
      }
    }
    return first;
  }
  function pushCandidateEvictionEntry(record) {
    if (!record || !record.id) return;
    heapPush(candidateEvictionHeap, {
      id:String(record.id),
      candidate:record,
      protected:isProtectedCandidateId(record.id)
    }, candidateRetentionCompare);
  }
  function popCurrentEvictionCandidate() {
    while (candidateEvictionHeap.length) {
      const entry = heapPop(candidateEvictionHeap, candidateRetentionCompare);
      if (entry && state.candidates[entry.id] === entry.candidate) return entry.candidate;
    }
    return null;
  }

  function getIndexIds(map, key) {
    const value = map.get(String(key || ''));
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }
  function addIndexId(map, key, idValue) {
    const normalizedKey = String(key || '');
    const normalizedId = String(idValue || '');
    if (!normalizedKey || !normalizedId) return;
    const current = map.get(normalizedKey);
    if (!current) { map.set(normalizedKey, normalizedId); return; }
    if (Array.isArray(current)) {
      if (!current.includes(normalizedId)) current.push(normalizedId);
      return;
    }
    if (current !== normalizedId) map.set(normalizedKey, [current, normalizedId]);
  }
  function removeIndexId(map, key, idValue) {
    const normalizedKey = String(key || '');
    const normalizedId = String(idValue || '');
    if (!normalizedKey || !normalizedId) return;
    const current = map.get(normalizedKey);
    if (!current) return;
    if (!Array.isArray(current)) {
      if (current === normalizedId) map.delete(normalizedKey);
      return;
    }
    const next = current.filter(id => id !== normalizedId);
    if (!next.length) map.delete(normalizedKey);
    else if (next.length === 1) map.set(normalizedKey, next[0]);
    else map.set(normalizedKey, next);
  }
  function candidateIdentityIndexKeys(record) {
    const providerId = String(record && record.providerId || '');
    if (!providerId) return [];
    const keys = [];
    for (const pair of candidateIdentityPairs(record)) {
      if (pair.remoteId) keys.push(`${providerId}|remote:${pair.remoteId}`);
      if (pair.sourceUrl) keys.push(`${providerId}|url:${pair.sourceUrl}`);
    }
    return Array.from(new Set(keys));
  }
  function candidateContentIndexKey(record) {
    if (!record) return '';
    const fingerprint = String(record.contentFingerprint || metadataContentFingerprint(record.data || {}));
    return candidateContentKey(record.providerId, fingerprint);
  }
  function indexCandidateRecord(record) {
    if (!record || !record.id) return;
    const candidateId = String(record.id);
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) {
      const key = String(alias || '');
      if (!key) continue;
      addIndexId(candidateIdsByAlias, key, candidateId);
    }
    const workKey = String(record.workKey || '');
    if (workKey) {
      addIndexId(candidateIdsByWorkKey, workKey, candidateId);
    }
    addIndexId(candidateIdsByContentKey, candidateContentIndexKey(record), candidateId);
    for (const identityKey of candidateIdentityIndexKeys(record)) addIndexId(candidateIdsByIdentity, identityKey, candidateId);
  }
  function unindexCandidateRecord(record) {
    if (!record || !record.id) return;
    const candidateId = String(record.id);
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) {
      const key = String(alias || '');
      removeIndexId(candidateIdsByAlias, key, candidateId);
    }
    const workKey = String(record.workKey || '');
    if (workKey) {
      removeIndexId(candidateIdsByWorkKey, workKey, candidateId);
    }
    removeIndexId(candidateIdsByContentKey, candidateContentIndexKey(record), candidateId);
    for (const identityKey of candidateIdentityIndexKeys(record)) removeIndexId(candidateIdsByIdentity, identityKey, candidateId);
  }
  function setCandidateRecord(record) {
    if (!record || !record.id) return null;
    const candidateId = String(record.id);
    const previous = state.candidates[candidateId];
    if (!previous) candidateResidentCount += 1;
    if (previous) {
      unindexCandidateRecord(previous);
      totalCandidateLogicalBytes = Math.max(0, totalCandidateLogicalBytes - Math.max(0, Number(candidateLogicalBytes.get(candidateId)) || 0));
    }
    state.candidates[candidateId] = record;
    indexCandidateRecord(record);
    const logicalBytes = estimateCandidateLogicalBytes(record);
    candidateLogicalBytes.set(candidateId, logicalBytes);
    totalCandidateLogicalBytes += logicalBytes;
    pushCandidateEvictionEntry(record);
    coverAccessDirty = true;
    return record;
  }
  function deleteCandidateRecord(candidateId) {
    const key = String(candidateId || '');
    const previous = state.candidates[key];
    if (!previous) return null;
    unindexCandidateRecord(previous);
    delete state.candidates[key];
    candidateResidentCount = Math.max(0, candidateResidentCount - 1);
    totalCandidateLogicalBytes = Math.max(0, totalCandidateLogicalBytes - Math.max(0, Number(candidateLogicalBytes.get(key)) || 0));
    candidateLogicalBytes.delete(key);
    coverAccessDirty = true;
    return previous;
  }
  function rebuildAppliedIndexes() {
    aliasIndex = new Map();
    workKeyIndex = new Map();
    appliedRecordIdsByCandidateId = new Map();
    for (const [recordId, record] of Object.entries(state.applied || {})) {
      indexAppliedRecord(recordId, record);
    }
  }
  function appliedCandidateReferenceIds(record) {
    return Array.from(new Set([
      String(record && record.candidateId || ''),
      String(record && record.coverCandidateId || '')
    ].filter(Boolean)));
  }
  function indexAppliedRecord(recordId, record) {
    const normalizedId = String(recordId || record && record.id || '');
    if (!normalizedId || !record) return;
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) addIndexId(aliasIndex, String(alias || ''), normalizedId);
    if (record.workKey) addIndexId(workKeyIndex, String(record.workKey), normalizedId);
    for (const candidateId of appliedCandidateReferenceIds(record)) addIndexId(appliedRecordIdsByCandidateId, candidateId, normalizedId);
  }
  function unindexAppliedRecord(recordId, record) {
    const normalizedId = String(recordId || record && record.id || '');
    if (!normalizedId || !record) return;
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) removeIndexId(aliasIndex, String(alias || ''), normalizedId);
    if (record.workKey) removeIndexId(workKeyIndex, String(record.workKey), normalizedId);
    for (const candidateId of appliedCandidateReferenceIds(record)) removeIndexId(appliedRecordIdsByCandidateId, candidateId, normalizedId);
  }
  function indexedAppliedRecordId(index, key) {
    const ids = getIndexIds(index, key);
    return ids.length ? ids[ids.length - 1] : '';
  }
  function appliedReferenceSnapshotPresent(record, candidateId) {
    const id = String(candidateId || '');
    if (!id || !record) return true;
    if (String(record.candidateId || '') === id && String(record.candidateSnapshot && record.candidateSnapshot.id || '') !== id) return false;
    if (String(record.coverCandidateId || '') === id && String(record.coverCandidateSnapshot && record.coverCandidateSnapshot.id || '') !== id) return false;
    return true;
  }
  function isProtectedCandidateId(candidateId) {
    const id = String(candidateId || '');
    if (!id) return false;
    for (const recordId of getIndexIds(appliedRecordIdsByCandidateId, id)) {
      if (!appliedReferenceSnapshotPresent(state.applied[recordId], id)) return true;
    }
    return false;
  }
  function protectedCandidateIds() {
    const protectedIds = new Set();
    for (const candidateId of appliedRecordIdsByCandidateId.keys()) if (isProtectedCandidateId(candidateId)) protectedIds.add(candidateId);
    return protectedIds;
  }
  function compactCandidateProvenance(candidate, fallback = {}) {
    const source = candidate || {};
    return {
      id:String(source.id || fallback.id || ''),
      providerId:String(source.providerId || fallback.providerId || ''),
      providerName:String(source.providerName || fallback.providerName || ''),
      sourceUrl:String(source.sourceUrl || fallback.sourceUrl || ''),
      remoteId:String(source.remoteId || fallback.remoteId || ''),
      matchScore:Math.max(0, Math.min(1, Number(source.matchScore != null ? source.matchScore : fallback.matchScore) || 0)),
      direct:!!(source.direct != null ? source.direct : fallback.direct),
      updatedAt:String(source.updatedAt || source.createdAt || fallback.updatedAt || ''),
      pass:V677_METADATA_APPLIED_PROVENANCE_PASS
    };
  }
  function ensureAppliedProvenanceSnapshots() {
    let changed = 0;
    for (const record of Object.values(state.applied || {})) {
      if (!record || !record.id) continue;
      const primaryId = String(record.candidateId || '');
      if (primaryId && String(record.candidateSnapshot && record.candidateSnapshot.id || '') !== primaryId) {
        record.candidateSnapshot = compactCandidateProvenance(state.candidates[primaryId], {
          id:primaryId, providerId:record.providerId, sourceUrl:record.sourceUrl, updatedAt:record.updatedAt
        });
        changed += 1;
      }
      const coverId = String(record.coverCandidateId || '');
      if (coverId && String(record.coverCandidateSnapshot && record.coverCandidateSnapshot.id || '') !== coverId) {
        record.coverCandidateSnapshot = compactCandidateProvenance(state.candidates[coverId], {
          id:coverId, providerId:record.coverProviderId, sourceUrl:record.coverSourceUrl, updatedAt:record.updatedAt
        });
        changed += 1;
      }
    }
    if (changed) {
      appliedDirty = true;
      appliedShardStore.markAll(state.applied);
    }
    return changed;
  }
  function snapshotAppliedRecordsForCandidateIds(candidateIds) {
    const recordIds = new Set();
    for (const candidateId of Array.isArray(candidateIds) ? candidateIds : [candidateIds]) {
      for (const recordId of getIndexIds(appliedRecordIdsByCandidateId, candidateId)) recordIds.add(recordId);
    }
    return Array.from(recordIds, recordId => {
      const record = state.applied[recordId];
      return record ? [recordId, cloneJson(record)] : null;
    }).filter(Boolean);
  }
  function setAppliedRecord(recordId, record) {
    const key = String(recordId || record && record.id || '');
    if (!key || !record) return null;
    const previous = state.applied[key];
    if (previous) unindexAppliedRecord(key, previous);
    state.applied[key] = record;
    indexAppliedRecord(key, record);
    coverAccessDirty = true;
    return record;
  }
  function deleteAppliedRecord(recordId) {
    const key = String(recordId || '');
    const previous = state.applied[key];
    if (!previous) return null;
    unindexAppliedRecord(key, previous);
    delete state.applied[key];
    coverAccessDirty = true;
    return previous;
  }
  function addCoverAccess(record) {
    const assetId = normalizeText(record && record.data && record.data.coverAssetId, 128);
    if (!/^[a-f0-9]{64}$/.test(assetId)) return;
    const current = coverAccessIndex.get(assetId) || { aliases:new Set(), workKeys:new Set() };
    for (const alias of Array.isArray(record.aliases) ? record.aliases : []) current.aliases.add(String(alias));
    if (record.workKey) current.workKeys.add(String(record.workKey));
    coverAccessIndex.set(assetId, current);
  }
  function rebuildCoverAccessIndex() {
    coverAccessIndex = new Map();
    for (const record of Object.values(state.applied || {})) addCoverAccess(record);
    for (const record of Object.values(state.candidates || {})) addCoverAccess(record);
    coverAccessDirty = false;
  }
  function ensureCoverAccessIndex() {
    if (coverAccessDirty) rebuildCoverAccessIndex();
  }
  function rebuildCandidateIndexes() {
    candidateIdsByAlias = new Map(); candidateIdsByWorkKey = new Map(); candidateIdsByContentKey = new Map(); candidateIdsByIdentity = new Map();
    candidateEvictionHeap = [];
    candidateLogicalBytes = new Map();
    totalCandidateLogicalBytes = 0;
    candidateResidentCount = 0;
    for (const record of Object.values(state.candidates || {})) {
      indexCandidateRecord(record);
      candidateResidentCount += 1;
      const candidateId = String(record && record.id || '');
      const logicalBytes = estimateCandidateLogicalBytes(record);
      if (candidateId) candidateLogicalBytes.set(candidateId, logicalBytes);
      totalCandidateLogicalBytes += logicalBytes;
      pushCandidateEvictionEntry(record);
    }
  }
  function rebuildIndexes() {
    rebuildAppliedIndexes();
    rebuildCandidateIndexes();
    rebuildCoverAccessIndex();
  }

  function selectStartupCandidateKeepSet() {
    const selector = createBoundedCandidateSelector({
      maxCandidates,
      maxCandidatesPerWork,
      maxCandidateResidentBytes,
      protectedIds:protectedCandidateIds()
    });
    for (const candidate of Object.values(state.candidates || {})) selector.consider(candidate);
    return new Set(Object.keys(selector.result().candidates));
  }

  function pruneLoadedCandidatesBeforeIndexes() {
    const kept = selectStartupCandidateKeepSet();
    const removed = [];
    for (const candidateId of Object.keys(state.candidates || {})) {
      if (kept.has(candidateId)) continue;
      delete state.candidates[candidateId];
      removed.push(candidateId);
    }
    if (removed.length) coverAccessDirty = true;
    return removed;
  }

  function compactDuplicateCandidates() {
    const candidates = Object.values(state.candidates || {}).filter(Boolean);
    const appliedRefsByCandidateId = new Map();
    for (const [recordId, record] of Object.entries(state.applied || {})) {
      for (const candidateId of appliedCandidateReferenceIds(record)) addIndexId(appliedRefsByCandidateId, candidateId, recordId);
    }
    const appliedCandidateIds = new Set(appliedRefsByCandidateId.keys());
    let changed = 0;
    const groups = new Map();
    for (const candidate of candidates) {
      const fingerprint = metadataContentFingerprint(candidate.data || {});
      const key = candidateContentKey(candidate.providerId, fingerprint);
      const list = groups.get(key) || [];
      list.push(candidate);
      groups.set(key, list);
    }
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const parent = group.map((_candidate, index) => index);
      const rank = group.map(() => 0);
      const find = (index) => {
        let root = index;
        while (parent[root] !== root) root = parent[root];
        while (parent[index] !== index) { const next = parent[index]; parent[index] = root; index = next; }
        return root;
      };
      const union = (left, right) => {
        let a = find(left); let b = find(right);
        if (a === b) return;
        if (rank[a] < rank[b]) [a, b] = [b, a];
        parent[b] = a;
        if (rank[a] === rank[b]) rank[a] += 1;
      };
      const tokenOwner = new Map();
      group.forEach((candidate, index) => {
        const tokens = [];
        if (candidate.novelId) tokens.push(`novel:${String(candidate.novelId)}`);
        if (candidate.workKey) tokens.push(`work:${String(candidate.workKey)}`);
        for (const alias of Array.isArray(candidate.aliases) ? candidate.aliases : []) tokens.push(`alias:${String(alias)}`);
        for (const token of new Set(tokens)) {
          if (tokenOwner.has(token)) union(index, tokenOwner.get(token));
          else tokenOwner.set(token, index);
        }
      });
      const clusters = new Map();
      group.forEach((candidate, index) => {
        const root = find(index);
        const list = clusters.get(root) || [];
        list.push(candidate);
        clusters.set(root, list);
      });
      for (const cluster of clusters.values()) {
        if (cluster.length < 2) continue;
        cluster.sort((a,b) => {
          const protectedDelta = Number(appliedCandidateIds.has(b.id)) - Number(appliedCandidateIds.has(a.id));
          return protectedDelta || candidateRecency(b).localeCompare(candidateRecency(a)) || String(b.id || '').localeCompare(String(a.id || ''));
        });
        const keeper = cluster[0];
        const newest = cluster.slice().sort((a,b) => candidateRecency(b).localeCompare(candidateRecency(a)))[0] || keeper;
        keeper.aliases = Array.from(new Set(cluster.flatMap(candidate => Array.isArray(candidate.aliases) ? candidate.aliases.map(String) : []))).slice(0, 512);
        keeper.matchScore = Math.max(...cluster.map(candidate => Number(candidate.matchScore) || 0));
        keeper.direct = cluster.some(candidate => !!candidate.direct);
        keeper.createdAt = cluster.map(candidate => String(candidate.createdAt || '')).filter(Boolean).sort()[0] || keeper.createdAt;
        keeper.updatedAt = cluster.map(candidate => candidateRecency(candidate)).filter(Boolean).sort().reverse()[0] || keeper.updatedAt;
        keeper.jobId = String(newest.jobId || keeper.jobId || '');
        keeper.query = String(newest.query || keeper.query || '');
        keeper.sourceUrl = String(newest.sourceUrl || keeper.sourceUrl || '');
        keeper.remoteId = String(newest.remoteId || keeper.remoteId || '');
        keeper.sourceIdentityPairs = Array.from(new Map(cluster.flatMap(candidate => candidateIdentityPairs(candidate)).map(pair => [`${pair.remoteId}|${pair.sourceUrl}`, pair])).values()).slice(0, 32);
        keeper.sourceIdentities = candidateIdentityTokens(keeper);
        keeper.data = {
          ...(newest.data || keeper.data || {}),
          coverAssetId:String((newest.data && newest.data.coverAssetId) || (keeper.data && keeper.data.coverAssetId) || cluster.map(candidate => candidate.data && candidate.data.coverAssetId).find(Boolean) || ''),
          coverUrl:String((newest.data && newest.data.coverUrl) || (keeper.data && keeper.data.coverUrl) || cluster.map(candidate => candidate.data && candidate.data.coverUrl).find(Boolean) || '')
        };
        state.candidates[keeper.id] = keeper;
        for (const duplicate of cluster.slice(1)) {
          for (const recordId of getIndexIds(appliedRefsByCandidateId, String(duplicate.id))) {
            const applied = state.applied[recordId];
            if (!applied) continue;
            if (String(applied && applied.candidateId || '') === String(duplicate.id)) applied.candidateId = keeper.id;
            if (String(applied && applied.coverCandidateId || '') === String(duplicate.id)) applied.coverCandidateId = keeper.id;
            addIndexId(appliedRefsByCandidateId, keeper.id, recordId);
          }
          appliedRefsByCandidateId.delete(String(duplicate.id));
          delete state.candidates[duplicate.id];
          changed += 1;
        }
      }
    }
    return changed;
  }

  function load() {
    const compressed = loadCompressedJsonWithBackup(compressedStorePath, null);
    const legacy = compressed && compressed.ok ? null : loadJsonWithBackup(storePath, null);
    const loaded = compressed && compressed.ok ? compressed : legacy;
    const parsed = loaded && loaded.ok ? loaded.data : null;
    if (parsed && parsed.schemaVersion === 1) {
      const legacyRevision = Math.max(0, Number(parsed.revision) || 0);
      state = {
        ...state,
        ...parsed,
        revisions:{
          applied:Math.max(0, Number(parsed.revisions && parsed.revisions.applied) || legacyRevision),
          candidates:Math.max(0, Number(parsed.revisions && parsed.revisions.candidates) || legacyRevision),
          settings:Math.max(0, Number(parsed.revisions && parsed.revisions.settings) || legacyRevision)
        },
        maintenance:parsed.maintenance && typeof parsed.maintenance === 'object' ? parsed.maintenance : { candidateCompactionVersion:0 },
        settings:{
          ...(parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {}),
          providers:parsed.settings && parsed.settings.providers && typeof parsed.settings.providers === 'object' ? parsed.settings.providers : {},
          providerDefinitions:parsed.settings && parsed.settings.providerDefinitions && typeof parsed.settings.providerDefinitions === 'object' ? parsed.settings.providerDefinitions : {}
        },
        candidates:parsed.candidates || {},
        applied:parsed.applied || {}
      };
    }
    if (compressed && compressed.ok) {
      lastCompression = { jsonBytes:Math.max(0, Number(compressed.jsonBytes) || 0), compressedBytes:Math.max(0, Number(compressed.compressedBytes) || fileBytesSync(compressedStorePath)), ratio:Number(compressed.jsonBytes) ? Number(compressed.compressedBytes || 0) / Number(compressed.jsonBytes) : 0, level:compressionLevel };
      trustedPrimarySha256 = compressed.source === 'primary' ? String(compressed.compressedSha256 || '') : '';
    }
    else if (legacy && legacy.ok) lastCompression = { jsonBytes:fileBytesSync(legacy.path || storePath), compressedBytes:0, ratio:0, level:compressionLevel };

    const legacyCandidates = state.candidates && typeof state.candidates === 'object' ? state.candidates : {};
    const hasCandidateManifest = candidateShardStore.isManifest(state.candidateShards);
    const hasLegacyCandidates = Object.keys(legacyCandidates).length > 0;
    // Applied metadata is loaded before candidate shards so applied candidate
    // references can be protected while the normal sharded path performs a
    // bounded, one-shard-at-a-time startup load.
    state.candidates = {};

    const mainStateRevision = Math.max(0, Number(state.revision) || 0);
    const mainAppliedRevision = Math.max(0, Number(state.revisions && state.revisions.applied) || 0);
    const mainAppliedManifest = appliedShardStore.isManifest(state.appliedShards) ? state.appliedShards : null;
    const externalApplied = loadCompressedJsonWithBackup(appliedStorePath, null);
    const externalPayload = externalApplied && externalApplied.ok ? externalApplied.data : null;
    if (externalApplied && externalApplied.ok) {
      lastAppliedCompression = {
        jsonBytes:Math.max(0, Number(externalApplied.jsonBytes) || 0),
        compressedBytes:Math.max(0, Number(externalApplied.compressedBytes) || fileBytesSync(appliedStorePath)),
        ratio:Number(externalApplied.jsonBytes) ? Number(externalApplied.compressedBytes || 0) / Number(externalApplied.jsonBytes) : 0,
        level:compressionLevel
      };
      trustedAppliedPrimarySha256 = externalApplied.source === 'primary' ? String(externalApplied.compressedSha256 || '') : '';
    }

    const externalAppliedManifest = appliedShardStore.isManifest(externalPayload) ? externalPayload : null;
    if (mainAppliedManifest || externalAppliedManifest) {
      const mainManifestRevision = Math.max(0, Number(mainAppliedManifest && mainAppliedManifest.appliedRevision) || mainAppliedRevision);
      const externalManifestRevision = Math.max(0, Number(externalAppliedManifest && externalAppliedManifest.appliedRevision) || 0);
      const useExternal = !!externalAppliedManifest && (!mainAppliedManifest || externalManifestRevision >= mainManifestRevision);
      const selectedManifest = useExternal ? externalAppliedManifest : mainAppliedManifest;
      const appliedLoad = appliedShardStore.load(selectedManifest, {});
      state.applied = appliedLoad.applied || {};
      state.appliedShards = selectedManifest;
      state.revisions.applied = Math.max(mainAppliedRevision, Number(selectedManifest.appliedRevision) || 0);
      state.revision = Math.max(mainStateRevision, Number(selectedManifest.stateRevision) || 0);
      hasAppliedShard = true;
      appliedStorageMode = 'sharded-v2';
      if (useExternal) {
        // Keep the established public status vocabulary while exposing the
        // physical storage generation separately through appliedStorageMode.
        appliedLoadedSource = externalApplied.source === 'backup' ? 'compressed-backup' : 'compressed-primary';
        if (externalApplied.source === 'backup') {
          appliedDirty = true;
          appliedShardRepairNeeded = true;
        }
      } else {
        appliedLoadedSource = externalAppliedManifest ? 'compressed-stale' : 'compressed-main';
        appliedShardRepairNeeded = !externalAppliedManifest || externalManifestRevision < mainManifestRevision;
        if (appliedShardRepairNeeded) appliedDirty = true;
      }
    } else {
      // v648-v672 stored all applied metadata in one gzip document. Load that
      // representation once, then migrate lazily to bounded v673 shards.
      if (externalPayload && externalPayload.schemaVersion === 1 && externalPayload.applied && typeof externalPayload.applied === 'object') {
        const shardAppliedRevision = Math.max(0, Number(externalPayload.appliedRevision) || 0);
        const shardStateRevision = Math.max(0, Number(externalPayload.stateRevision) || 0);
        hasAppliedShard = true;
        if (shardAppliedRevision >= mainAppliedRevision) {
          state.applied = externalPayload.applied;
          state.revisions.applied = shardAppliedRevision;
          state.revision = Math.max(mainStateRevision, shardStateRevision);
          appliedLoadedSource = externalApplied.source === 'backup' ? 'legacy-compressed-backup' : 'legacy-compressed-primary';
        } else {
          appliedLoadedSource = 'legacy-compressed-stale';
        }
      }
      const legacyApplied = state.applied && typeof state.applied === 'object' ? state.applied : {};
      const hasLegacyApplied = Object.keys(legacyApplied).length > 0
        || !!(externalPayload && externalPayload.schemaVersion === 1 && externalPayload.applied && Object.keys(externalPayload.applied).length > 0);
      if (hasLegacyApplied) {
        const appliedLoad = appliedShardStore.load(null, legacyApplied);
        state.applied = appliedLoad.applied || {};
        appliedDirty = true;
        mainDirty = true;
        appliedShardRepairNeeded = true;
        appliedStorageMode = 'legacy-migration';
      } else {
        const appliedLoad = appliedShardStore.initializeEmpty();
        state.applied = appliedLoad.applied;
        appliedLoadedSource = externalApplied && externalApplied.ok ? 'compressed-primary' : 'empty';
        appliedStorageMode = 'sharded-v2';
        appliedShardRepairNeeded = false;
      }
    }

    rebuildAppliedIndexes();
    const provenanceSnapshotsAdded = ensureAppliedProvenanceSnapshots();
    if (provenanceSnapshotsAdded) { mainDirty = true; appliedDirty = true; }
    const candidateLoad = hasCandidateManifest || hasLegacyCandidates
      ? candidateShardStore.loadBoundedIsolated(state.candidateShards, legacyCandidates, {
        maxCandidates,
        maxCandidatesPerWork,
        maxCandidateResidentBytes,
        protectedIds:protectedCandidateIds()
      })
      : candidateShardStore.initializeEmpty();
    state.candidates = candidateLoad.candidates || {};
    candidateLoadSource = String(candidateLoad.source || 'unknown');
    candidateLoadSeen = Math.max(0, Number(candidateLoad.seen) || Object.keys(state.candidates).length);
    candidateLoadRemoved = Math.max(0, Number(candidateLoad.removed) || 0);
    if (candidateLoad.migrationNeeded || candidateLoad.warnings?.length || (!!state.candidateShards && !hasCandidateManifest)) {
      candidateDirty = candidateLoad.migrationNeeded || !!candidateLoad.warnings?.length;
      mainDirty = true;
    }

    generation = Math.max(0, Number(state.revision) || 0);
    persistedMainGeneration = mainStateRevision;
    persistedAppliedGeneration = generation;
    persistedCandidateGeneration = generation;
    loadedFromLegacy = !!(legacy && legacy.ok);
    loadedSource = loadedFromLegacy ? `legacy-${legacy.source}` : (compressed && compressed.ok ? `compressed-${compressed.source}` : 'fallback');
    if (loadedFromLegacy || (loaded && loaded.source === 'backup')) mainDirty = true;
    const needsStartupCompaction = Math.max(0, Number(state.maintenance && state.maintenance.candidateCompactionVersion) || 0) < METADATA_CANDIDATE_COMPACTION_VERSION;
    if (needsStartupCompaction) {
      const compacted = compactDuplicateCandidates();
      state.maintenance = { ...(state.maintenance || {}), candidateCompactionVersion:METADATA_CANDIDATE_COMPACTION_VERSION };
      state.revision = Math.max(0, Number(state.revision) || 0) + 1;
      state.revisions.candidates = Math.max(0, Number(state.revisions.candidates) || 0) + 1;
      generation = state.revision;
      mainDirty = true;
      if (compacted > 0) {
        appliedDirty = true;
        appliedShardStore.markAll(state.applied);
        candidateShardStore.markAll(state.candidates);
        candidateDirty = true;
      }
    }
    // Applied references are small and are required to preserve candidates
    // already used by an applied metadata record. Prune the loaded candidate
    // object before constructing the four resident candidate indexes so a
    // corrupt or legacy oversized shard set cannot double peak RSS at startup.
    rebuildAppliedIndexes();
    const startupRemoved = pruneLoadedCandidatesBeforeIndexes();
    rebuildCandidateIndexes();
    rebuildCoverAccessIndex();
    if (startupRemoved.length) {
      state.revision = Math.max(0, Number(state.revision) || 0) + 1;
      state.revisions.candidates = Math.max(0, Number(state.revisions.candidates) || 0) + 1;
      generation = state.revision;
      mainDirty = true;
      candidateDirty = true;
      candidateShardStore.markAll(state.candidates);
    }
    return state;
  }
  function markDirty(kind = 'all', candidateIds = [], appliedRecordIds = []) {
    if (closed) throw Object.assign(new Error('metadata store is closed'), { code:'METADATA_STORE_CLOSED' });
    state.revision = Math.max(0, Number(state.revision) || 0) + 1;
    const revisions = state.revisions && typeof state.revisions === 'object' ? state.revisions : { applied:0, candidates:0, settings:0 };
    state.revisions = revisions;
    const targets = kind === 'all'
      ? ['applied','candidates','settings']
      : Array.isArray(kind) ? Array.from(new Set(kind.map(String))) : [String(kind || '')];
    for (const target of targets) {
      if (!Object.prototype.hasOwnProperty.call(revisions, target)) continue;
      revisions[target] = Math.max(0, Number(revisions[target]) || 0) + 1;
    }
    generation = state.revision;
    if (mainDirty || candidateDirty || appliedDirty || writing) persistenceMetrics.coalescedMutations += 1;
    if (targets.includes('settings') || targets.includes('candidates')) mainDirty = true;
    if (targets.includes('candidates')) {
      cleanupPlanCache.clear();
      candidateDirty = true;
      const ids = Array.isArray(candidateIds) ? candidateIds.filter(Boolean) : [candidateIds].filter(Boolean);
      if (ids.length) candidateShardStore.markCandidates(ids);
      else candidateShardStore.markAll(state.candidates);
    }
    if (targets.includes('applied')) {
      appliedDirty = true;
      const ids = Array.isArray(appliedRecordIds) ? appliedRecordIds.filter(Boolean) : [appliedRecordIds].filter(Boolean);
      if (ids.length) appliedShardStore.markRecords(ids);
      else appliedShardStore.markAll(state.applied);
    }
    persistenceMetrics.mutations += 1;
    // Hot metadata mutations maintain indexes incrementally. Full index rebuilds
    // are reserved for startup compaction and rollback recovery.
  }
  async function writeAppliedManifest(manifest, trustedSha256 = trustedAppliedPrimarySha256) {
    const serializedJson = Buffer.from(JSON.stringify(manifest), 'utf8');
    const snapshot = writeCompressed === atomicWriteCompressedJsonAsync ? manifest : JSON.parse(serializedJson.toString('utf8'));
    return writeCompressed(appliedStorePath, snapshot, { level:compressionLevel, serializedJson, trustedPrimarySha256:trustedSha256 });
  }
  async function flush() {
    if (writing) {
      await writing;
      if (!mainDirty && !candidateDirty && !appliedDirty) return true;
    }
    if (!mainDirty && !candidateDirty && !appliedDirty) return true;
    const writeGeneration = generation;
    const writeMain = mainDirty || candidateDirty;
    const writeCandidates = candidateDirty;
    const writeApplied = appliedDirty;
    const candidateRevision = getCandidateRevision();
    const appliedRevision = getAppliedRevision();
    const { candidates:_candidateRecords, applied:_appliedRecords, ...mainState } = state;
    const mainBaseSnapshot = writeMain ? cloneJson({ ...mainState, candidates:{}, applied:{} }) : null;
    mainDirty = false;
    candidateDirty = false;
    appliedDirty = false;
    writing = (async () => {
      let mainCommitted = false;
      let candidateManifest = state.candidateShards || null;
      let appliedManifest = state.appliedShards || null;
      try {
        // Shard payloads are written before either manifest is published. The
        // candidate manifest lives in the main store; the applied manifest is
        // also embedded in main for combined transactions and written to its
        // small standalone commit marker for applied-only mutations.
        if (writeCandidates) {
          candidateManifest = await candidateShardStore.flush(
            state.candidates || {},
            candidateRevision,
            writeGeneration
          );
          persistenceMetrics.writes += 1;
        }
        if (writeApplied) {
          appliedManifest = await appliedShardStore.flush(
            state.applied || {},
            appliedRevision,
            writeGeneration
          );
          persistenceMetrics.writes += 1;
        }
        if (writeMain) {
          const mainPayload = {
            ...mainBaseSnapshot,
            candidateShards:candidateManifest,
            appliedShards:appliedManifest,
            candidates:{},
            applied:{}
          };
          const mainSerializedJson = Buffer.from(JSON.stringify(mainPayload), 'utf8');
          const mainSnapshot = writeCompressed === atomicWriteCompressedJsonAsync
            ? mainPayload
            : JSON.parse(mainSerializedJson.toString('utf8'));
          const result = await writeCompressed(compressedStorePath, mainSnapshot, { level:compressionLevel, serializedJson:mainSerializedJson, trustedPrimarySha256 });
          lastCompression = result || lastCompression;
          trustedPrimarySha256 = String(result && result.primarySha256 || '');
          state.candidateShards = candidateManifest;
          state.appliedShards = appliedManifest;
          persistedMainGeneration = Math.max(persistedMainGeneration, writeGeneration);
          if (writeCandidates) persistedCandidateGeneration = Math.max(persistedCandidateGeneration, writeGeneration);
          if (writeApplied) persistedAppliedGeneration = Math.max(persistedAppliedGeneration, writeGeneration);
          mainCommitted = true;
          persistenceMetrics.writes += 1;
          if (loadedFromLegacy) {
            for (const legacyPath of [storePath, `${storePath}.bak`]) {
              try { await removeLegacy(legacyPath, { force:true }); }
              catch (error) { logger.warn?.('legacy metadata store cleanup failed:', legacyPath, error && error.message || error); }
            }
            loadedFromLegacy = false;
          }
        }
        if (writeApplied) {
          try {
            const result = await writeAppliedManifest(appliedManifest);
            lastAppliedCompression = result || lastAppliedCompression;
            trustedAppliedPrimarySha256 = String(result && result.primarySha256 || '');
            state.appliedShards = appliedManifest;
            persistedAppliedGeneration = Math.max(persistedAppliedGeneration, writeGeneration);
            hasAppliedShard = true;
            appliedShardRepairNeeded = false;
            appliedLoadedSource = 'compressed-primary';
            appliedStorageMode = 'sharded-v2';
            persistenceMetrics.writes += 1;
          } catch (error) {
            if (!mainCommitted) throw error;
            appliedShardRepairNeeded = true;
            persistedAppliedGeneration = Math.max(persistedAppliedGeneration, writeGeneration);
            appliedLoadedSource = 'compressed-stale';
            appliedStorageMode = 'sharded-v2';
            persistenceMetrics.lastWriteError = `applied manifest deferred: ${String(error && error.message || error)}`;
            persistenceMetrics.lastWriteErrorAt = Date.now();
            logger.warn?.('metadata applied manifest write deferred after main commit:', error && error.message || error);
          }
        }
        loadedSource = 'compressed-primary';
        persistenceMetrics.lastWriteAt = Date.now();
        if (!appliedShardRepairNeeded) {
          persistenceMetrics.lastWriteError = '';
          persistenceMetrics.lastWriteErrorAt = 0;
        }
      } catch (error) {
        if (writeCandidates && !mainCommitted) candidateDirty = true;
        if (writeMain && !mainCommitted) mainDirty = true;
        if (writeApplied && !mainCommitted) appliedDirty = true;
        persistenceMetrics.lastWriteError = String(error && error.message || error);
        persistenceMetrics.lastWriteErrorAt = Date.now();
        throw error;
      }
    })().finally(() => { writing = null; });
    await writing;
    if (mainDirty || candidateDirty || appliedDirty) return flush();
    return true;
  }


  async function close() {
    closed = true;
    return flush();
  }
  function getPersistenceStatus() {
    return {
      pass:METADATA_STORE_ASYNC_PERSISTENCE_PASS,
      incrementalIndexPass:METADATA_INCREMENTAL_INDEX_PASS,
      dirty:mainDirty || candidateDirty || appliedDirty,
      mainDirty,
      candidateDirty,
      appliedDirty,
      writing:!!writing,
      closed,
      generation,
      persistedGeneration:mainDirty || candidateDirty || appliedDirty ? Math.min(persistedMainGeneration, persistedCandidateGeneration, persistedAppliedGeneration) : generation,
      persistedMainGeneration,
      persistedCandidateGeneration,
      persistedAppliedGeneration,
      loadedSource,
      appliedLoadedSource,
      appliedStorageMode,
      compressedStorePath:path.basename(compressedStorePath),
      appliedStorePath:path.basename(appliedStorePath),
      appliedShardPass:METADATA_APPLIED_SHARD_PASS,
      appliedShardV2Pass:METADATA_APPLIED_SHARD_V2_PASS,
      candidateShardPass:METADATA_CANDIDATE_SHARD_PASS,
      candidateShards:candidateShardStore.getStats(),
      appliedShards:appliedShardStore.getStats(),
      appliedShardRepairNeeded,
      compressionPass:METADATA_COMPRESSED_STORE_PASS,
      compressedJsonPass:COMPRESSED_JSON_STORE_PASS,
      compression:{ ...lastCompression },
      appliedCompression:{ ...lastAppliedCompression },
      trustedPrimarySha256:trustedPrimarySha256 ? trustedPrimarySha256.slice(0, 16) : '',
      trustedAppliedPrimarySha256:trustedAppliedPrimarySha256 ? trustedAppliedPrimarySha256.slice(0, 16) : '',
      ...persistenceMetrics
    };
  }
  function getRevision() { return Math.max(0, Number(state.revision) || 0); }
  function getAppliedRevision() { return Math.max(0, Number(state.revisions && state.revisions.applied) || 0); }
  function getCandidateRevision() { return Math.max(0, Number(state.revisions && state.revisions.candidates) || 0); }
  function getSettingsRevision() { return Math.max(0, Number(state.revisions && state.revisions.settings) || 0); }
  function cloneJson(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function runSerializedDurableMutation(task) {
    const run = durableMutationTail.catch(() => {}).then(task);
    durableMutationTail = run.then(() => undefined, () => undefined);
    return run;
  }
  function restoreAfterFailedMutation(restore, kind = 'all', candidateIds = [], appliedRecordIds = []) {
    try {
      if (restore()) { rebuildIndexes(); markDirty(kind, candidateIds, appliedRecordIds); }
    } catch (_error) {}
  }

  function findRecordIdForNovel(novel) {
    for (const alias of aliasList(novel)) {
      const recordId = indexedAppliedRecordId(aliasIndex, alias);
      if (recordId) return recordId;
    }
    const exact = normalizeWorkKey(novel && novel.title, novel && novel.author);
    const exactRecordId = indexedAppliedRecordId(workKeyIndex, exact);
    if (exactRecordId) return exactRecordId;
    const titleOnly = normalizeWorkKey(novel && novel.title, '');
    const titleOnlyRecordId = indexedAppliedRecordId(workKeyIndex, titleOnly);
    if (titleOnlyRecordId) return titleOnlyRecordId;
    return '';
  }
  function getAppliedForNovel(novel) {
    const recordId = findRecordIdForNovel(novel);
    return recordId ? state.applied[recordId] || null : null;
  }

  function hasCandidateForNovel(novel) {
    for (const alias of aliasList(novel)) if (candidateIdsByAlias.has(alias)) return true;
    return candidateIdsByWorkKey.has(normalizeWorkKey(novel && novel.title, novel && novel.author))
      || candidateIdsByWorkKey.has(normalizeWorkKey(novel && novel.title, ''));
  }
  function hasCollectedMetadataForNovel(novel) {
    return !!getAppliedForNovel(novel) || hasCandidateForNovel(novel);
  }
  function enrichNovel(novel) {
    const applied = getAppliedForNovel(novel);
    if (!applied) return novel;
    const data = applied.data || {};
    return {
      ...novel,
      title:data.title || novel.title,
      author:data.author || novel.author || '',
      description:data.synopsis || novel.description || novel.synopsis || '',
      synopsis:data.synopsis || novel.synopsis || '',
      genres:Array.isArray(data.genres) ? data.genres : [],
      tags:Array.isArray(data.tags) ? data.tags : [],
      publicationStatus:data.publicationStatus || '',
      publicationYear:data.publicationYear || null,
      sourceLanguage:data.sourceLanguage || '',
      coverUrl:data.coverUrl || novel.coverUrl || novel.cover || '',
      metadata:{ recordId:applied.id, providerId:applied.providerId, sourceUrl:applied.sourceUrl, updatedAt:applied.updatedAt, fields:applied.fields || [] }
    };
  }


  function candidateMatchesNovel(candidate, novel) {
    if (!candidate || !novel) return false;
    const aliases = new Set(aliasList(novel));
    if ((candidate.aliases || []).some(alias => aliases.has(String(alias)))) return true;
    const keys = new Set([normalizeWorkKey(novel.title, novel.author), normalizeWorkKey(novel.title, '')]);
    return keys.has(String(candidate.workKey || ''));
  }
  function pruneCandidatesForWork(workKey, extraCandidateIds = []) {
    const removed = [];
    const key = String(workKey || '');
    if (!key) return removed;
    const extras = Array.isArray(extraCandidateIds) ? extraCandidateIds : [extraCandidateIds];
    const ids = Array.from(new Set([...getIndexIds(candidateIdsByWorkKey, key), ...extras.map(value => String(value || '')).filter(Boolean)]));
    if (ids.length <= maxCandidatesPerWork) return removed;
    const sorted = ids.map(candidateId => state.candidates[candidateId]).filter(Boolean)
      .sort((a,b) => Number(isProtectedCandidateId(b.id)) - Number(isProtectedCandidateId(a.id))
        || candidateRecency(b).localeCompare(candidateRecency(a))
        || String(b.id || '').localeCompare(String(a.id || '')));
    const keep = new Set(sorted.slice(0, maxCandidatesPerWork).map(candidate => String(candidate.id)));
    for (const candidate of sorted) {
      if (keep.has(String(candidate.id))) continue;
      deleteCandidateRecord(candidate.id);
      removed.push(candidate.id);
    }
    return removed;
  }

  function pruneCandidates(force = false) {
    const removed = [];
    const overLimit = () => candidateResidentCount > maxCandidates
      || totalCandidateLogicalBytes > maxCandidateResidentBytes;
    if (!force && !overLimit()) return removed;
    while (overLimit()) {
      const candidate = popCurrentEvictionCandidate();
      if (!candidate) break;
      deleteCandidateRecord(candidate.id);
      removed.push(candidate.id);
    }
    return removed;
  }

  function hasCoverAsset(assetId) {
    ensureCoverAccessIndex();
    return coverAccessIndex.has(String(assetId || '').toLowerCase());
  }
  function createCoverAccessScope(novels) {
    const aliases = new Set();
    const workKeys = new Set();
    for (const novel of Array.isArray(novels) ? novels : []) {
      for (const alias of aliasList(novel)) aliases.add(alias);
      workKeys.add(normalizeWorkKey(novel && novel.title, novel && novel.author));
      workKeys.add(normalizeWorkKey(novel && novel.title, ''));
    }
    return { aliases, workKeys, novelCount:Array.isArray(novels) ? novels.length : 0 };
  }
  function canAccessCoverWithScope(assetId, scope) {
    ensureCoverAccessIndex();
    const idValue = String(assetId || '').toLowerCase();
    const access = coverAccessIndex.get(idValue);
    if (!access || !scope) return false;
    const aliases = scope.aliases instanceof Set ? scope.aliases : new Set();
    const workKeys = scope.workKeys instanceof Set ? scope.workKeys : new Set();
    for (const alias of access.aliases) if (aliases.has(alias)) return true;
    for (const workKey of access.workKeys) if (workKeys.has(workKey)) return true;
    return false;
  }
  function canAccessCover(assetId, novels) {
    return canAccessCoverWithScope(assetId, createCoverAccessScope(novels));
  }

  function findReusableCandidate(novel, provider, clean) {
    const providerId = String(provider && provider.id || '');
    const remoteId = String(clean && clean.remoteId || '');
    const sourceUrl = String(clean && clean.sourceUrl || '');
    if (!providerId) return null;
    const fingerprint = metadataContentFingerprint(clean || {});
    if (remoteId || sourceUrl) {
      const identityIds = new Set();
      if (remoteId) for (const candidateId of getIndexIds(candidateIdsByIdentity, `${providerId}|remote:${remoteId}`)) identityIds.add(candidateId);
      if (sourceUrl) for (const candidateId of getIndexIds(candidateIdsByIdentity, `${providerId}|url:${sourceUrl}`)) identityIds.add(candidateId);
      const identityMatches = Array.from(identityIds)
        .map(candidateId => state.candidates[candidateId])
        .filter(candidate => candidate && candidateMatchesNovel(candidate, novel))
        .sort((a,b) => candidateRecency(b).localeCompare(candidateRecency(a)));
      for (const candidate of identityMatches) {
        const candidateFingerprint = String(candidate.contentFingerprint || metadataContentFingerprint(candidate.data || {}));
        if (candidateFingerprint === fingerprint) return { candidate, splitSharedIdentity:false };
        const pairs = candidateIdentityPairs(candidate);
        const remainingPairs = pairs.filter(pair => !((remoteId && pair.remoteId === remoteId) || (sourceUrl && pair.sourceUrl === sourceUrl)));
        if (remainingPairs.length) return { candidate, splitSharedIdentity:true, remainingPairs };
        return { candidate, splitSharedIdentity:false };
      }
    }
    const candidate = getIndexIds(candidateIdsByContentKey, candidateContentKey(providerId, fingerprint))
      .map(candidateId => state.candidates[candidateId])
      .filter(item => item && candidateMatchesNovel(item, novel))
      .sort((a,b) => Number(isProtectedCandidateId(b.id)) - Number(isProtectedCandidateId(a.id)) || candidateRecency(b).localeCompare(candidateRecency(a)))[0] || null;
    return candidate ? { candidate, splitSharedIdentity:false } : null;
  }

  function splitSharedCandidateIdentity(candidate, remainingPairs) {
    if (!candidate || !Array.isArray(remainingPairs) || !remainingPairs.length) return null;
    const primary = remainingPairs.find(pair => pair.remoteId && pair.sourceUrl) || remainingPairs[0];
    const cloneId = id('mc_');
    const clone = {
      ...candidate,
      id:cloneId,
      remoteId:String(primary && primary.remoteId || ''),
      sourceUrl:String(primary && primary.sourceUrl || ''),
      sourceIdentityPairs:remainingPairs.slice(0, 32),
      createdAt:candidate.createdAt || nowIso(),
      updatedAt:candidate.updatedAt || candidate.createdAt || nowIso(),
      data:{
        ...(candidate.data || {}),
        remoteId:String(primary && primary.remoteId || ''),
        sourceUrl:String(primary && primary.sourceUrl || '')
      }
    };
    clone.sourceIdentities = candidateIdentityTokens(clone);
    setCandidateRecord(clone);
    return clone;
  }


  function saveCandidate(novel, provider, extracted, options = {}) {
    const clean = sanitizeExtracted(extracted);
    const reusableMatch = findReusableCandidate(novel, provider, clean);
    const reusable = reusableMatch && reusableMatch.candidate || null;
    const splitClone = reusableMatch && reusableMatch.splitSharedIdentity ? splitSharedCandidateIdentity(reusable, reusableMatch.remainingPairs) : null;
    const candidateId = reusable && reusable.id || id('mc_');
    const record = {
      ...(reusable || {}),
      id:candidateId,
      novelId:String(novel.id || ''),
      aliases:Array.from(new Set([...(reusable && reusable.aliases || []), ...aliasList(novel)])).slice(0, 512),
      workKey:normalizeWorkKey(novel.title, novel.author || clean.author || ''),
      providerId:String(provider.id || ''),
      providerName:String(provider.name || provider.id || ''),
      adapterKey:String(provider.adapterKey || ''),
      adapterRevision:Number(provider.adapter && provider.adapter.revision || provider.revision || 1),
      matchScore:Math.max(0, Math.min(1, Number(options.matchScore) || 0)),
      direct:!!options.direct,
      query:normalizeText(options.query, 300),
      data:clean,
      contentFingerprint:metadataContentFingerprint(clean),
      sourceUrl:clean.sourceUrl,
      remoteId:clean.remoteId,
      sourceIdentityPairs:reusableMatch && reusableMatch.splitSharedIdentity
        ? candidateIdentityPairs(clean)
        : Array.from(new Map([...(reusable && candidateIdentityPairs(reusable) || []), ...candidateIdentityPairs(clean)].map(pair => [`${pair.remoteId}|${pair.sourceUrl}`, pair])).values()).slice(0, 32),
      createdAt:reusable && reusable.createdAt || nowIso(),
      updatedAt:nowIso(),
      jobId:String(options.jobId || '')
    };
    record.sourceIdentities = candidateIdentityTokens(record);
    setCandidateRecord(record);
    const prunedForWork = pruneCandidatesForWork(record.workKey, [candidateId, splitClone && splitClone.id]);
    const prunedGlobal = pruneCandidates(false);
    markDirty('candidates', [candidateId, splitClone && splitClone.id, ...prunedForWork, ...prunedGlobal]);
    return record;
  }

  function listCandidatesForNovel(novel, limit = 30) {
    const ids = new Set();
    for (const alias of aliasList(novel)) {
      for (const candidateId of getIndexIds(candidateIdsByAlias, alias)) if (candidateId) ids.add(candidateId);
    }
    for (const workKey of [normalizeWorkKey(novel && novel.title, novel && novel.author), normalizeWorkKey(novel && novel.title, '')]) {
      for (const candidateId of getIndexIds(candidateIdsByWorkKey, workKey)) if (candidateId) ids.add(candidateId);
    }
    const unique = new Map();
    for (const candidate of Array.from(ids)
      .map(candidateId => state.candidates[candidateId])
      .filter(item => item && candidateMatchesNovel(item, novel))
      .sort((a,b) => candidateRecency(b).localeCompare(candidateRecency(a)) || String(b.id || '').localeCompare(String(a.id || '')))) {
      const fingerprint = String(candidate.contentFingerprint || metadataContentFingerprint(candidate.data || {}));
      const key = candidateContentKey(candidate.providerId, fingerprint);
      const existing = unique.get(key);
      if (!existing || (isProtectedCandidateId(candidate.id) && !isProtectedCandidateId(existing.id))) unique.set(key, candidate);
    }
    return Array.from(unique.values())
      .sort((a,b) => candidateRecency(b).localeCompare(candidateRecency(a)) || String(b.id || '').localeCompare(String(a.id || '')))
      .slice(0, Math.max(1, Math.min(100, Number(limit) || 30)));
  }

  function applyCandidateGroup(novel, primaryCandidateId, coverCandidateId = '', fields) {
    const primary = state.candidates[String(primaryCandidateId || '')];
    if (!primary) throw Object.assign(new Error('metadata candidate not found'), { code:'METADATA_CANDIDATE_NOT_FOUND' });
    if (!candidateMatchesNovel(primary, novel)) throw Object.assign(new Error('metadata candidate does not belong to this novel'), { code:'METADATA_CANDIDATE_FORBIDDEN' });
    const coverCandidate = coverCandidateId ? state.candidates[String(coverCandidateId)] : primary;
    if (!coverCandidate) throw Object.assign(new Error('metadata cover candidate not found'), { code:'METADATA_CANDIDATE_NOT_FOUND' });
    if (!candidateMatchesNovel(coverCandidate, novel)) throw Object.assign(new Error('metadata cover candidate does not belong to this novel'), { code:'METADATA_CANDIDATE_FORBIDDEN' });

    const mergedAvailableData = { ...(primary.data || {}) };
    if (coverCandidate.data && coverCandidate.data.coverAssetId && coverCandidate.data.coverUrl) {
      mergedAvailableData.coverAssetId = coverCandidate.data.coverAssetId;
      mergedAvailableData.coverUrl = coverCandidate.data.coverUrl;
      mergedAvailableData.coverRemoteUrl = coverCandidate.data.coverRemoteUrl || null;
    }
    const selected = selectMetadataFields(mergedAvailableData, fields);
    const existingId = findRecordIdForNovel(novel);
    const existing = existingId ? state.applied[existingId] : null;
    const nextData = { ...(existing && existing.data || {}) };
    for (const field of selected) {
      if (field === 'cover') {
        nextData.coverAssetId = coverCandidate.data.coverAssetId;
        nextData.coverUrl = coverCandidate.data.coverUrl;
        nextData.coverRemoteUrl = coverCandidate.data.coverRemoteUrl || null;
      } else nextData[field] = primary.data[field];
    }
    const recordId = existingId || id('wm_');
    const coverWasSelected = selected.includes('cover');
    const nextAppliedRecord = {
      id:recordId,
      novelId:String(novel.id || ''),
      aliases:Array.from(new Set([...(existing && existing.aliases || []), ...aliasList(novel), ...(primary.aliases || []), ...(coverCandidate.aliases || [])])).slice(0, 512),
      workKey:primary.workKey || normalizeWorkKey(novel.title, novel.author),
      providerId:primary.providerId,
      candidateId:primary.id,
      candidateSnapshot:compactCandidateProvenance(primary),
      sourceUrl:primary.sourceUrl,
      coverProviderId:coverWasSelected ? String(coverCandidate.providerId || '') : String(existing && existing.coverProviderId || ''),
      coverCandidateId:coverWasSelected ? String(coverCandidate.id || '') : String(existing && existing.coverCandidateId || ''),
      coverCandidateSnapshot:coverWasSelected ? compactCandidateProvenance(coverCandidate) : (existing && existing.coverCandidateSnapshot || null),
      coverSourceUrl:coverWasSelected ? String(coverCandidate.sourceUrl || '') : String(existing && existing.coverSourceUrl || ''),
      fields:Array.from(new Set([...(existing && existing.fields || []), ...selected])),
      data:nextData,
      createdAt:existing && existing.createdAt || nowIso(),
      updatedAt:nowIso()
    };
    setAppliedRecord(recordId, nextAppliedRecord);
    markDirty('applied', [], [recordId]);
    return state.applied[recordId];
  }

  function applyCandidate(novel, candidateId, fields) {
    return applyCandidateGroup(novel, candidateId, candidateId, fields);
  }

  function removeApplied(novel) {
    const recordId = findRecordIdForNovel(novel);
    if (!recordId) return false;
    deleteAppliedRecord(recordId); markDirty('applied', [], [recordId]); return true;
  }

  function removeCandidate(novel, candidateId) {
    const key = String(candidateId || '');
    const candidate = state.candidates[key];
    if (!candidate) throw Object.assign(new Error('metadata candidate not found'), { code:'METADATA_CANDIDATE_NOT_FOUND' });
    if (!candidateMatchesNovel(candidate, novel)) throw Object.assign(new Error('metadata candidate does not belong to this novel'), { code:'METADATA_CANDIDATE_FORBIDDEN' });
    const linkedAppliedRecordIds = Array.from(getIndexIds(appliedRecordIdsByCandidateId, key));
    deleteCandidateRecord(key);
    for (const recordId of linkedAppliedRecordIds) {
      const previous = state.applied[recordId];
      if (!previous) continue;
      const next = { ...previous };
      if (String(previous.candidateId || '') === key) { next.candidateId = ''; next.candidateSnapshot = null; }
      if (String(previous.coverCandidateId || '') === key) {
        next.coverCandidateId = '';
        next.coverProviderId = '';
        next.coverSourceUrl = '';
        next.coverCandidateSnapshot = null;
      }
      setAppliedRecord(recordId, next);
    }
    markDirty(['candidates','applied'], [key], linkedAppliedRecordIds);
    return candidate;
  }


  function removeCandidateGroup(novel, candidateIds = []) {
    const ids = Array.from(new Set((Array.isArray(candidateIds) ? candidateIds : []).map(value => String(value || '')).filter(Boolean))).slice(0,100);
    if (!ids.length) throw Object.assign(new Error('metadata candidate group is empty'), { code:'METADATA_CANDIDATE_GROUP_NOT_FOUND' });
    const candidates = ids.map(candidateId => {
      const candidate = state.candidates[candidateId];
      if (!candidate) throw Object.assign(new Error('metadata candidate group member not found'), { code:'METADATA_CANDIDATE_NOT_FOUND' });
      if (!candidateMatchesNovel(candidate, novel)) throw Object.assign(new Error('metadata candidate group does not belong to this novel'), { code:'METADATA_CANDIDATE_FORBIDDEN' });
      return candidate;
    });
    const idSet = new Set(ids);
    const linkedAppliedRecordIds = new Set(ids.flatMap(candidateId => getIndexIds(appliedRecordIdsByCandidateId, candidateId)));
    for (const candidateId of ids) deleteCandidateRecord(candidateId);
    for (const recordId of linkedAppliedRecordIds) {
      const previous = state.applied[recordId];
      if (!previous) continue;
      const next = { ...previous };
      if (idSet.has(String(previous.candidateId || ''))) { next.candidateId = ''; next.candidateSnapshot = null; }
      if (idSet.has(String(previous.coverCandidateId || ''))) {
        next.coverCandidateId = '';
        next.coverProviderId = '';
        next.coverSourceUrl = '';
        next.coverCandidateSnapshot = null;
      }
      setAppliedRecord(recordId, next);
    }
    markDirty(['candidates','applied'], ids, Array.from(linkedAppliedRecordIds));
    return candidates;
  }

  function saveManualMetadata(novel, input = {}) {
    const sourceInput = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
    const rawCoverAssetId = normalizeText(sourceInput.coverAssetId, 128).toLowerCase();
    const rawCoverLocalUrl = normalizeText(sourceInput.coverUrlLocal, 2048);
    const rawExternalCoverUrl = normalizeText(sourceInput.coverUrl || sourceInput.coverRemoteUrl, 2048);
    if (rawExternalCoverUrl) throw Object.assign(new Error('manual metadata cannot store an external cover URL'), { code:'METADATA_COVER_INVALID' });
    if (rawCoverAssetId || rawCoverLocalUrl) {
      if (!/^[a-f0-9]{64}$/.test(rawCoverAssetId)) throw Object.assign(new Error('manual cover asset ID must be a SHA-256 hex value'), { code:'METADATA_COVER_INVALID' });
      const canonicalCoverUrl = `/api/metadata/covers/${rawCoverAssetId}`;
      if (rawCoverLocalUrl !== canonicalCoverUrl) throw Object.assign(new Error('manual cover URL must match the canonical asset URL'), { code:'METADATA_COVER_INVALID' });
      input = { ...sourceInput, coverAssetId:rawCoverAssetId, coverUrlLocal:canonicalCoverUrl, coverUrl:'', coverRemoteUrl:'' };
    } else input = { ...sourceInput };

    const clean = sanitizeExtracted(input);
    const available = new Set(availableMetadataFields(clean));
    const explicitFields = Array.isArray(input.fields) ? input.fields.map(String) : null;
    const clearFields = Array.from(new Set((Array.isArray(input.clearFields) ? input.clearFields : []).map(String)));
    const requested = explicitFields || METADATA_FIELDS.filter(field => available.has(field));
    const unknown = Array.from(new Set([...requested, ...clearFields].filter(field => !METADATA_FIELDS.includes(field))));
    if (unknown.length) {
      const error = Object.assign(new Error(`unsupported manual metadata fields: ${unknown.join(', ')}`), { code:'METADATA_FIELDS_INVALID' });
      error.fields = unknown;
      throw error;
    }
    const conflicting = clearFields.filter(field => requested.includes(field) && available.has(field));
    if (conflicting.length) {
      const error = Object.assign(new Error(`manual metadata fields cannot be set and cleared together: ${conflicting.join(', ')}`), { code:'METADATA_FIELDS_INVALID' });
      error.fields = conflicting;
      throw error;
    }
    const missing = requested.filter(field => !available.has(field));
    if (missing.length) {
      const error = Object.assign(new Error(`manual metadata fields are missing values: ${missing.join(', ')}`), { code:'METADATA_FIELDS_INVALID' });
      error.fields = missing;
      throw error;
    }
    const selected = Array.from(new Set([...requested, ...clearFields]));
    if (!selected.length) throw Object.assign(new Error('at least one manual metadata field is required'), { code:'METADATA_FIELDS_REQUIRED' });

    const existingId = findRecordIdForNovel(novel);
    const existing = existingId ? state.applied[existingId] : null;
    const nextData = { ...(existing && existing.data || {}) };
    for (const field of requested) {
      if (field === 'cover') {
        nextData.coverAssetId = clean.coverAssetId || null;
        nextData.coverUrl = clean.coverUrl || null;
        nextData.coverRemoteUrl = null;
      } else nextData[field] = clean[field] ?? null;
    }
    for (const field of clearFields) {
      if (field === 'cover') {
        nextData.coverAssetId = null;
        nextData.coverUrl = null;
        nextData.coverRemoteUrl = null;
      } else if (field === 'genres' || field === 'tags') nextData[field] = [];
      else nextData[field] = null;
    }
    const recordId = existingId || id('wm_');
    const activeFields = Array.from(new Set([...(existing && existing.fields || []), ...requested])).filter(field => !clearFields.includes(field));
    const workAuthor = clearFields.includes('author') ? novel.author : (clean.author || novel.author);
    const nextAppliedRecord = {
      id:recordId,
      novelId:String(novel.id || ''),
      aliases:Array.from(new Set([...(existing && existing.aliases || []), ...aliasList(novel)])).slice(0, 512),
      workKey:normalizeWorkKey(novel.title, workAuthor),
      providerId:'manual',
      candidateId:'',
      sourceUrl:'',
      fields:activeFields,
      data:nextData,
      createdAt:existing && existing.createdAt || nowIso(),
      updatedAt:nowIso()
    };
    setAppliedRecord(recordId, nextAppliedRecord);
    markDirty('applied', [], [recordId]);
    return state.applied[recordId];
  }

  function updateCandidateCover(candidateId, cover) {
    const candidate = state.candidates[String(candidateId || '')];
    if (!candidate) return null;
    unindexCandidateRecord(candidate);
    candidate.data.coverAssetId = normalizeText(cover && cover.assetId, 128) || null;
    candidate.data.coverUrl = normalizeText(cover && cover.url, 2048) || null;
    candidate.data.coverMime = normalizeText(cover && cover.mime, 120) || null;
    candidate.contentFingerprint = metadataContentFingerprint(candidate.data || {});
    indexCandidateRecord(candidate);
    const previousBytes = Math.max(0, Number(candidateLogicalBytes.get(String(candidate.id))) || 0);
    const nextBytes = estimateCandidateLogicalBytes(candidate);
    candidateLogicalBytes.set(String(candidate.id), nextBytes);
    totalCandidateLogicalBytes = Math.max(0, totalCandidateLogicalBytes - previousBytes + nextBytes);
    pushCandidateEvictionEntry(candidate);
    coverAccessDirty = true;
    markDirty('candidates', [candidate.id]); return candidate;
  }

  function applyCandidateGroupDurably(novel, primaryCandidateId, coverCandidateId = '', fields) {
    return runSerializedDurableMutation(async () => {
      const previousId = findRecordIdForNovel(novel);
      const previous = previousId ? cloneJson(state.applied[previousId]) : null;
      const applied = applyCandidateGroup(novel, primaryCandidateId, coverCandidateId, fields);
      const recordId = applied.id;
      const mutationStamp = applied.updatedAt;
      try {
        await flush();
        return applied;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          const current = state.applied[recordId];
          if (!current || current.updatedAt !== mutationStamp || current.candidateId !== applied.candidateId) return false;
          if (previous) state.applied[recordId] = previous;
          else delete state.applied[recordId];
          return true;
        }, 'applied', [], [recordId]);
        throw error;
      }
    });
  }

  function applyCandidateDurably(novel, candidateId, fields) {
    return applyCandidateGroupDurably(novel, candidateId, candidateId, fields);
  }

  function removeAppliedDurably(novel) {
    return runSerializedDurableMutation(async () => {
      const recordId = findRecordIdForNovel(novel);
      const previous = recordId ? cloneJson(state.applied[recordId]) : null;
      const removed = removeApplied(novel);
      try {
        await flush();
        return removed;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          if (!removed || !previous || state.applied[recordId]) return false;
          state.applied[recordId] = previous;
          return true;
        }, 'applied', [], [recordId]);
        throw error;
      }
    });
  }

  function removeCandidateDurably(novel, candidateId) {
    return runSerializedDurableMutation(async () => {
      const key = String(candidateId || '');
      const previous = state.candidates[key] ? cloneJson(state.candidates[key]) : null;
      const linkedApplied = snapshotAppliedRecordsForCandidateIds([key]);
      const removed = removeCandidate(novel, key);
      try {
        await flush();
        return removed;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          if (!previous || state.candidates[key]) return false;
          state.candidates[key] = previous;
          for (const [recordId, record] of linkedApplied) state.applied[recordId] = record;
          return true;
        }, ['candidates','applied'], [key], linkedApplied.map(([recordId]) => recordId));
        throw error;
      }
    });
  }


  function removeCandidateGroupDurably(novel, candidateIds = []) {
    return runSerializedDurableMutation(async () => {
      const ids = Array.from(new Set((Array.isArray(candidateIds) ? candidateIds : []).map(value => String(value || '')).filter(Boolean))).slice(0,100);
      const previousCandidates = ids.map(candidateId => [candidateId, state.candidates[candidateId] ? cloneJson(state.candidates[candidateId]) : null]);
      const linkedApplied = snapshotAppliedRecordsForCandidateIds(ids);
      const removed = removeCandidateGroup(novel, ids);
      try {
        await flush();
        return removed;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          let restored = false;
          for (const [candidateId, candidate] of previousCandidates) {
            if (candidate && !state.candidates[candidateId]) { state.candidates[candidateId] = candidate; restored = true; }
          }
          for (const [recordId, record] of linkedApplied) { state.applied[recordId] = record; restored = true; }
          return restored;
        }, ['candidates','applied'], ids, linkedApplied.map(([recordId]) => recordId));
        throw error;
      }
    });
  }

  function saveManualMetadataDurably(novel, input = {}) {
    return runSerializedDurableMutation(async () => {
      const previousId = findRecordIdForNovel(novel);
      const previous = previousId ? cloneJson(state.applied[previousId]) : null;
      const applied = saveManualMetadata(novel, input);
      const recordId = applied.id;
      const mutationStamp = applied.updatedAt;
      try {
        await flush();
        return applied;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          const current = state.applied[recordId];
          if (!current || current.updatedAt !== mutationStamp || current.providerId !== 'manual') return false;
          if (previous) state.applied[recordId] = previous;
          else delete state.applied[recordId];
          return true;
        }, 'applied', [], [recordId]);
        throw error;
      }
    });
  }


  function getStorageStats() {
    const candidates = Object.values(state.candidates || {}).filter(Boolean);
    const applied = Object.values(state.applied || {}).filter(Boolean);
    const candidateShardStats = candidateShardStore.getStats();
    const appliedShardStats = appliedShardStore.getStats();
    const mainLogicalBytes = Math.max(0, Number(lastCompression.jsonBytes) || fileBytesSync(storePath));
    const candidateLogicalBytes = Math.max(0, Number(candidateShardStats.logicalBytes) || 0);
    const appliedLogicalBytes = Math.max(0, Number(lastAppliedCompression.jsonBytes) || 0) + Math.max(0, Number(appliedShardStats.logicalBytes) || 0);
    const logicalBytes = mainLogicalBytes + candidateLogicalBytes + appliedLogicalBytes;
    const mainCompressedBytes = fileBytesSync(compressedStorePath);
    const candidateCompressedBytes = Math.max(0, Number(candidateShardStats.compressedBytes) || 0);
    const appliedCompressedBytes = fileBytesSync(appliedStorePath) + Math.max(0, Number(appliedShardStats.compressedBytes) || 0);
    const compressedBytes = mainCompressedBytes + candidateCompressedBytes + appliedCompressedBytes;
    const mainBackupBytes = fileBytesSync(`${compressedStorePath}.bak`);
    const candidateBackupBytes = Math.max(0, Number(candidateShardStats.backupBytes) || 0);
    const appliedBackupBytes = fileBytesSync(`${appliedStorePath}.bak`) + Math.max(0, Number(appliedShardStats.backupBytes) || 0);
    const backupBytes = mainBackupBytes + candidateBackupBytes + appliedBackupBytes;
    const legacyBytes = fileBytesSync(storePath) + fileBytesSync(`${storePath}.bak`);
    const protectedIds = protectedCandidateIds();
    return {
      pass:METADATA_CANDIDATE_MAINTENANCE_PASS,
      compressionPass:METADATA_COMPRESSED_STORE_PASS,
      schemaVersion:Number(state.schemaVersion) || 1,
      revision:getRevision(),
      revisions:{ applied:getAppliedRevision(), candidates:getCandidateRevision(), settings:getSettingsRevision() },
      candidateCount:candidates.length,
      appliedCount:applied.length,
      protectedCandidateCount:candidates.filter(candidate => protectedIds.has(String(candidate.id || ''))).length,
      candidateLimit:maxCandidates,
      candidatePerWorkLimit:maxCandidatesPerWork,
      compactIndexPass:V675_METADATA_COMPACT_INDEX_PASS,
      startupBoundPass:V675_METADATA_STARTUP_BOUND_PASS,
      boundedShardLoadPass:V676_METADATA_BOUNDED_SHARD_LOAD_PASS,
      hardResidentBoundPass:V677_METADATA_HARD_RESIDENT_BOUND_PASS,
      incrementalEvictionPass:V677_METADATA_INCREMENTAL_EVICTION_PASS,
      appliedProvenancePass:V677_METADATA_APPLIED_PROVENANCE_PASS,
      residentCandidateCount:candidateResidentCount,
      residentCandidateLogicalBytes:totalCandidateLogicalBytes,
      residentCandidateByteLimit:maxCandidateResidentBytes,
      candidateLoad:{ source:candidateLoadSource, seen:candidateLoadSeen, removed:candidateLoadRemoved },
      indexEntries:{
        aliases:candidateIdsByAlias.size,
        workKeys:candidateIdsByWorkKey.size,
        contentKeys:candidateIdsByContentKey.size,
        identities:candidateIdsByIdentity.size,
        appliedAliases:aliasIndex.size,
        appliedWorkKeys:workKeyIndex.size,
        appliedCandidateLinks:appliedRecordIdsByCandidateId.size
      },
      logicalBytes,
      logicalBytesApproximate:mainDirty || candidateDirty || appliedDirty,
      compressedBytes,
      mainCompressedBytes,
      candidateCompressedBytes,
      appliedCompressedBytes,
      backupBytes,
      mainBackupBytes,
      candidateBackupBytes,
      appliedBackupBytes,
      legacyBytes,
      totalDiskBytes:compressedBytes + backupBytes + legacyBytes,
      compressionRatio:logicalBytes ? Number((compressedBytes / logicalBytes).toFixed(4)) : 0,
      loadedSource,
      appliedLoadedSource,
      appliedStorePath:path.basename(appliedStorePath),
      appliedShardPass:METADATA_APPLIED_SHARD_PASS,
      appliedShardV2Pass:METADATA_APPLIED_SHARD_V2_PASS,
      appliedShards:appliedShardStats,
      candidateShardPass:METADATA_CANDIDATE_SHARD_PASS,
      candidateShards:candidateShardStats,
      compressionLevel,
      maxCandidates,
      maxCandidatesPerWork
    };
  }

  function normalizeCandidateCleanupPolicy(policy = {}) {
    return {
      olderThanDays:boundedInteger(policy.olderThanDays, 30, 1, 3650),
      orphanOlderThanDays:boundedInteger(policy.orphanOlderThanDays, 7, 1, 3650),
      keepPerWork:boundedInteger(policy.keepPerWork, 5, 0, 100),
      keepPerProvider:boundedInteger(policy.keepPerProvider, 1, 0, 20)
    };
  }

  function candidateCleanupInputs(policy = {}, context = {}) {
    const normalizedPolicy = normalizeCandidateCleanupPolicy(policy);
    const activeNovelIds = new Set((Array.isArray(context.activeNovelIds) ? context.activeNovelIds : []).map(String).filter(Boolean));
    const activeWorkKeys = new Set((Array.isArray(context.activeWorkKeys) ? context.activeWorkKeys : []).map(String).filter(Boolean));
    const protectedIds = protectedCandidateIds();
    return {
      policy:normalizedPolicy,
      candidates:Object.values(state.candidates || {}).filter(Boolean),
      activeNovelIds,
      activeWorkKeys,
      hasActiveScope:activeNovelIds.size > 0 || activeWorkKeys.size > 0,
      protectedIds,
      now:Date.now()
    };
  }

  function candidateCleanupCacheKey(candidateRevision, normalizedPolicy, activeNovelIds, activeWorkKeys) {
    const contextHash = crypto.createHash('sha256').update(JSON.stringify({
      activeNovelIds:Array.from(activeNovelIds).sort(),
      activeWorkKeys:Array.from(activeWorkKeys).sort()
    })).digest('hex').slice(0, 20);
    return `${candidateRevision}:${JSON.stringify(normalizedPolicy)}:${contextHash}`;
  }

  function pruneCandidateCleanupCache(now = Date.now()) {
    for (const [key, entry] of cleanupPlanCache) {
      if (!entry || now - entry.createdAt > CLEANUP_PLAN_CACHE_TTL_MS) cleanupPlanCache.delete(key);
    }
    while (cleanupPlanCache.size > CLEANUP_PLAN_CACHE_MAX) cleanupPlanCache.delete(cleanupPlanCache.keys().next().value);
  }

  function attachCleanupRemovalIds(plan, removalIds) {
    Object.defineProperty(plan, CLEANUP_REMOVAL_IDS, {
      configurable:false,
      enumerable:false,
      writable:false,
      value:removalIds
    });
    return plan;
  }

  function cloneCleanupPlan(entry) {
    const plan = {
      ...entry.plan,
      policy:{ ...entry.plan.policy },
      reasons:{ ...entry.plan.reasons },
      sample:Array.isArray(entry.plan.sample) ? entry.plan.sample.map(item => ({ ...item })) : []
    };
    if (Array.isArray(entry.plan.removals)) plan.removals = entry.plan.removals.map(item => ({ ...item }));
    return attachCleanupRemovalIds(plan, entry.removalIds.slice());
  }

  function candidateCleanupRetention(candidates, keepPerWork, keepPerProvider) {
    const topByWork = new Map();
    const topByProvider = new Map();
    for (const candidate of candidates) {
      const workKey = String(candidate.workKey || candidate.novelId || '');
      retainBoundedCandidate(topByWork, workKey, candidate, keepPerWork);
      retainBoundedCandidate(topByProvider, `${workKey}\0${String(candidate.providerId || '')}`, candidate, keepPerProvider);
    }
    return {
      retainedByWork:new Set(Array.from(topByWork.values()).flat().map(candidate => String(candidate.id || '')).filter(Boolean)),
      retainedByProvider:new Set(Array.from(topByProvider.values()).flat().map(candidate => String(candidate.id || '')).filter(Boolean))
    };
  }

  async function candidateCleanupRetentionAsync(candidates, keepPerWork, keepPerProvider) {
    const topByWork = new Map();
    const topByProvider = new Map();
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const workKey = String(candidate.workKey || candidate.novelId || '');
      retainBoundedCandidate(topByWork, workKey, candidate, keepPerWork);
      retainBoundedCandidate(topByProvider, `${workKey}\0${String(candidate.providerId || '')}`, candidate, keepPerProvider);
      if ((index & 255) === 255) await yieldToEventLoop();
    }
    return {
      retainedByWork:new Set(Array.from(topByWork.values()).flat().map(candidate => String(candidate.id || '')).filter(Boolean)),
      retainedByProvider:new Set(Array.from(topByProvider.values()).flat().map(candidate => String(candidate.id || '')).filter(Boolean))
    };
  }

  function candidateCleanupDecision(candidate, inputs, retention, cutoff, orphanCutoff) {
    const id = String(candidate.id || '');
    if (!id || inputs.protectedIds.has(id)) return null;
    const timestamp = candidateTimestampMs(candidate);
    if (!timestamp) return null;
    const aliases = Array.isArray(candidate.aliases) ? candidate.aliases.map(String) : [];
    const active = !inputs.hasActiveScope
      || aliases.some(alias => inputs.activeNovelIds.has(alias))
      || inputs.activeWorkKeys.has(String(candidate.workKey || ''));
    let reason = '';
    if (!active && timestamp <= orphanCutoff) reason = 'orphaned';
    else if (timestamp <= cutoff && !retention.retainedByWork.has(id) && !retention.retainedByProvider.has(id)) reason = 'stale';
    if (!reason) return null;
    return {
      id,
      reason,
      providerId:String(candidate.providerId || ''),
      workKey:String(candidate.workKey || ''),
      updatedAt:candidateRecency(candidate),
      logicalBytes:estimateCandidateLogicalBytes(candidate),
      coverAssetId:String(candidate.data && candidate.data.coverAssetId || '')
    };
  }

  function finalizeCandidateCleanupPlan(inputs, candidateRevision, removalIds, sample, compatibilityRemovals, reasons, estimatedLogicalBytes) {
    const plan = {
      pass:METADATA_CANDIDATE_MAINTENANCE_PASS,
      backgroundPlanPass:METADATA_CLEANUP_BACKGROUND_PLAN_PASS,
      candidateRevision,
      dryRun:true,
      policy:{ ...inputs.policy },
      totalCandidates:inputs.candidates.length,
      protectedCandidates:inputs.protectedIds.size,
      removeCount:removalIds.length,
      keepCount:Math.max(0, inputs.candidates.length - removalIds.length),
      estimatedLogicalBytes,
      reasons,
      sample:sample.slice(0, 50)
    };
    // Preserve the legacy internal inspection contract for small fixtures and
    // installations, while large plans expose only a bounded sample. Execution
    // consumes the non-enumerable ID list instead of allocating full removal
    // objects in the HTTP response path.
    if (inputs.candidates.length <= 1000) plan.removals = compatibilityRemovals;
    return attachCleanupRemovalIds(plan, removalIds);
  }

  function buildCandidateCleanupPlan(policy = {}, context = {}) {
    const candidateRevision = getCandidateRevision();
    const inputs = candidateCleanupInputs(policy, context);
    const cutoff = inputs.now - inputs.policy.olderThanDays * 86400000;
    const orphanCutoff = inputs.now - inputs.policy.orphanOlderThanDays * 86400000;
    const retention = candidateCleanupRetention(inputs.candidates, inputs.policy.keepPerWork, inputs.policy.keepPerProvider);
    const removalIds = [];
    const compatibilityRemovals = [];
    const sample = [];
    const reasons = { orphaned:0, stale:0 };
    let estimatedLogicalBytes = 0;
    for (const candidate of inputs.candidates) {
      const removal = candidateCleanupDecision(candidate, inputs, retention, cutoff, orphanCutoff);
      if (!removal) continue;
      removalIds.push(removal.id);
      if (compatibilityRemovals.length < 1001) compatibilityRemovals.push(removal);
      if (sample.length < 50) sample.push(removal);
      reasons[removal.reason] += 1;
      estimatedLogicalBytes += removal.logicalBytes;
    }
    return finalizeCandidateCleanupPlan(inputs, candidateRevision, removalIds, sample, compatibilityRemovals, reasons, estimatedLogicalBytes);
  }

  async function buildCandidateCleanupPlanAsync(policy = {}, context = {}) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const candidateRevision = getCandidateRevision();
      const inputs = candidateCleanupInputs(policy, context);
      const cacheKey = candidateCleanupCacheKey(candidateRevision, inputs.policy, inputs.activeNovelIds, inputs.activeWorkKeys);
      pruneCandidateCleanupCache();
      const cached = cleanupPlanCache.get(cacheKey);
      if (cached) return cloneCleanupPlan(cached);
      const cutoff = inputs.now - inputs.policy.olderThanDays * 86400000;
      const orphanCutoff = inputs.now - inputs.policy.orphanOlderThanDays * 86400000;
      const retention = await candidateCleanupRetentionAsync(inputs.candidates, inputs.policy.keepPerWork, inputs.policy.keepPerProvider);
      const removalIds = [];
      const compatibilityRemovals = [];
      const sample = [];
      const reasons = { orphaned:0, stale:0 };
      let estimatedLogicalBytes = 0;
      for (let index = 0; index < inputs.candidates.length; index += 1) {
        const removal = candidateCleanupDecision(inputs.candidates[index], inputs, retention, cutoff, orphanCutoff);
        if (removal) {
          removalIds.push(removal.id);
          if (compatibilityRemovals.length < 1001) compatibilityRemovals.push(removal);
          if (sample.length < 50) sample.push(removal);
          reasons[removal.reason] += 1;
          estimatedLogicalBytes += removal.logicalBytes;
        }
        if ((index & 255) === 255) await yieldToEventLoop();
      }
      if (candidateRevision !== getCandidateRevision()) continue;
      const plan = finalizeCandidateCleanupPlan(inputs, candidateRevision, removalIds, sample, compatibilityRemovals, reasons, estimatedLogicalBytes);
      const cacheEntry = {
        createdAt:Date.now(),
        plan:{ ...plan, sample:plan.sample.map(item => ({ ...item })), ...(Array.isArray(plan.removals) ? { removals:plan.removals.map(item => ({ ...item })) } : {}) },
        removalIds:removalIds.slice()
      };
      cleanupPlanCache.set(cacheKey, cacheEntry);
      pruneCandidateCleanupCache();
      return cloneCleanupPlan(cacheEntry);
    }
    throw Object.assign(new Error('metadata candidates changed while cleanup plan was being built'), {
      code:'METADATA_CLEANUP_PLAN_STALE',
      statusCode:409,
      retryAfter:1
    });
  }

  function cleanupCandidatesDurably(policy = {}, context = {}) {
    return runSerializedDurableMutation(async () => {
      let plan = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        plan = await buildCandidateCleanupPlanAsync({ ...policy, dryRun:false }, context);
        if (plan.candidateRevision === getCandidateRevision()) break;
        plan = null;
      }
      if (!plan) throw Object.assign(new Error('metadata cleanup plan became stale'), { code:'METADATA_CLEANUP_PLAN_STALE', statusCode:409, retryAfter:1 });
      if (policy.dryRun !== false || !plan.removeCount) return { ...plan, storage:getStorageStats() };
      const removalIds = Array.isArray(plan[CLEANUP_REMOVAL_IDS]) ? plan[CLEANUP_REMOVAL_IDS] : [];
      const removed = removalIds.map(candidateId => [candidateId, state.candidates[candidateId]]).filter(([,candidate]) => !!candidate);
      for (const [candidateId] of removed) deleteCandidateRecord(candidateId);
      if (removed.length) markDirty('candidates', removed.map(([candidateId]) => candidateId));
      else mainDirty = true;
      try {
        await flush();
        return { ...plan, dryRun:false, removedCount:removed.length, storage:getStorageStats() };
      } catch (error) {
        restoreAfterFailedMutation(() => {
          let restored = false;
          for (const [candidateId, candidate] of removed) {
            if (candidate && !state.candidates[candidateId]) { state.candidates[candidateId] = candidate; restored = true; }
          }
          return restored;
        }, 'candidates', removed.map(([candidateId]) => candidateId));
        throw error;
      }
    });
  }

  function rewriteCompressedDurably() {
    return runSerializedDurableMutation(async () => {
      mainDirty = true;
      candidateDirty = true;
      candidateShardStore.markAll(state.candidates || {});
      appliedDirty = true;
      appliedShardStore.markAll(state.applied || {});
      await flush();
      return getStorageStats();
    });
  }

  function normalizeProviderSettingNumber(patch, key, current, min, max, integer = false) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) return current == null ? null : current;
    if (patch[key] == null || patch[key] === '') return null;
    const value = Number(patch[key]);
    if (!Number.isFinite(value) || value < min || value > max) {
      throw Object.assign(new Error(`${key} must be between ${min} and ${max}`), { code:'METADATA_PROVIDER_SETTINGS_INVALID', field:key });
    }
    return integer ? Math.floor(value) : value;
  }
  function getProviderSettings(providerId) {
    const stored = state.settings.providers[String(providerId)] || {};
    return {
      enabled:stored.enabled !== false,
      priority:stored.priority == null ? null : Number(stored.priority),
      autoApply:stored.autoApply !== false,
      autoApplyThreshold:stored.autoApplyThreshold == null ? null : Number(stored.autoApplyThreshold),
      requestIntervalMs:stored.requestIntervalMs == null ? null : Number(stored.requestIntervalMs),
      searchLimit:stored.searchLimit == null ? null : Number(stored.searchLimit),
      pass:METADATA_PROVIDER_SETTINGS_PASS
    };
  }
  function setProviderSettings(providerId, patch = {}) {
    const current = getProviderSettings(providerId);
    state.settings.providers[String(providerId)] = {
      enabled:patch.enabled == null ? current.enabled !== false : !!patch.enabled,
      priority:normalizeProviderSettingNumber(patch, 'priority', current.priority, 1, 999, true),
      autoApply:patch.autoApply == null ? current.autoApply !== false : !!patch.autoApply,
      autoApplyThreshold:normalizeProviderSettingNumber(patch, 'autoApplyThreshold', current.autoApplyThreshold, 0.7, 1, false),
      requestIntervalMs:normalizeProviderSettingNumber(patch, 'requestIntervalMs', current.requestIntervalMs, 3000, 60000, true),
      searchLimit:normalizeProviderSettingNumber(patch, 'searchLimit', current.searchLimit, 1, 10, true)
    };
    markDirty('settings'); return getProviderSettings(providerId);
  }

  function setProviderSettingsDurably(providerId, patch = {}) {
    return runSerializedDurableMutation(async () => {
      const key = String(providerId);
      const hadPrevious = Object.prototype.hasOwnProperty.call(state.settings.providers, key);
      const previous = hadPrevious ? cloneJson(state.settings.providers[key]) : null;
      const settings = setProviderSettings(key, patch);
      const expected = JSON.stringify(state.settings.providers[key]);
      try {
        await flush();
        return settings;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          if (JSON.stringify(state.settings.providers[key]) !== expected) return false;
          if (hadPrevious) state.settings.providers[key] = previous;
          else delete state.settings.providers[key];
          return true;
        }, 'settings');
        throw error;
      }
    });
  }

  function getProviderDefinition(providerId) {
    const key = String(providerId || '');
    const value = state.settings.providerDefinitions && state.settings.providerDefinitions[key];
    return value && typeof value === 'object' ? cloneJson(value) : null;
  }
  function listProviderDefinitions() {
    const source = state.settings.providerDefinitions && typeof state.settings.providerDefinitions === 'object'
      ? state.settings.providerDefinitions
      : {};
    return Object.values(source).filter(value => value && typeof value === 'object').map(cloneJson);
  }
  function setProviderDefinition(providerId, definition) {
    const key = String(providerId || '');
    if (!key) throw Object.assign(new Error('metadata provider definition id is required'), { code:'METADATA_PROVIDER_DEFINITION_INVALID', field:'id' });
    if (!definition || typeof definition !== 'object' || Array.isArray(definition)) throw Object.assign(new Error('metadata provider definition is required'), { code:'METADATA_PROVIDER_DEFINITION_INVALID' });
    if (!state.settings.providerDefinitions || typeof state.settings.providerDefinitions !== 'object') state.settings.providerDefinitions = {};
    state.settings.providerDefinitions[key] = cloneJson(definition);
    markDirty('settings');
    return getProviderDefinition(key);
  }
  function setProviderDefinitionDurably(providerId, definition) {
    return runSerializedDurableMutation(async () => {
      const key = String(providerId || '');
      const source = state.settings.providerDefinitions || (state.settings.providerDefinitions = {});
      const hadPrevious = Object.prototype.hasOwnProperty.call(source, key);
      const previous = hadPrevious ? cloneJson(source[key]) : null;
      const saved = setProviderDefinition(key, definition);
      const expected = JSON.stringify(source[key]);
      try {
        await flush();
        return saved;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          if (JSON.stringify(source[key]) !== expected) return false;
          if (hadPrevious) source[key] = previous;
          else delete source[key];
          return true;
        }, 'settings');
        throw error;
      }
    });
  }
  function removeProviderDefinition(providerId) {
    const key = String(providerId || '');
    const source = state.settings.providerDefinitions || {};
    if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
    delete source[key];
    markDirty('settings');
    return true;
  }
  function removeProviderDefinitionDurably(providerId) {
    return runSerializedDurableMutation(async () => {
      const key = String(providerId || '');
      const source = state.settings.providerDefinitions || (state.settings.providerDefinitions = {});
      if (!Object.prototype.hasOwnProperty.call(source, key)) return false;
      const previous = cloneJson(source[key]);
      removeProviderDefinition(key);
      try {
        await flush();
        return true;
      } catch (error) {
        restoreAfterFailedMutation(() => {
          if (Object.prototype.hasOwnProperty.call(source, key)) return false;
          source[key] = previous;
          return true;
        }, 'settings');
        throw error;
      }
    });
  }

  load();
  if (mainDirty || candidateDirty || appliedDirty) { const migration = setImmediate(() => { void flush().catch(error => logger.warn?.('metadata compressed store migration failed:', error && error.message || error)); }); migration.unref?.(); }
  return { getRevision, getAppliedRevision, getCandidateRevision, getSettingsRevision, getAppliedForNovel, hasCandidateForNovel, hasCollectedMetadataForNovel, enrichNovel, saveCandidate, listCandidatesForNovel, applyCandidate, applyCandidateDurably, applyCandidateGroup, applyCandidateGroupDurably, removeCandidate, removeCandidateDurably, removeCandidateGroup, removeCandidateGroupDurably, saveManualMetadata, saveManualMetadataDurably, removeApplied, removeAppliedDurably, updateCandidateCover, getProviderSettings, setProviderSettings, setProviderSettingsDurably, getProviderDefinition, listProviderDefinitions, setProviderDefinition, setProviderDefinitionDurably, removeProviderDefinition, removeProviderDefinitionDurably, normalizeWorkKey, metadataContentFingerprint, metadataEquivalenceFingerprint, candidateMatchesNovel, availableMetadataFields, hasCoverAsset, canAccessCover, createCoverAccessScope, canAccessCoverWithScope, getStorageStats, buildCandidateCleanupPlan, buildCandidateCleanupPlanAsync, cleanupCandidatesDurably, rewriteCompressedDurably, flush, close, getPersistenceStatus, fields:METADATA_FIELDS, pass:METADATA_STORE_PASS, persistencePass:METADATA_STORE_ASYNC_PERSISTENCE_PASS, collectedCandidateRetentionPass:METADATA_COLLECTED_CANDIDATE_RETENTION_PASS, candidateDedupPass:METADATA_CANDIDATE_DEDUP_PASS, manualEditPass:METADATA_MANUAL_EDIT_PASS, candidateDeletePass:METADATA_CANDIDATE_DELETE_PASS, equivalentGroupPass:METADATA_EQUIVALENT_GROUP_PASS, compressedStorePass:METADATA_COMPRESSED_STORE_PASS, maintenancePass:METADATA_CANDIDATE_MAINTENANCE_PASS, presentationRevisionPass:METADATA_PRESENTATION_REVISION_PASS, singleSerializeWritePass:METADATA_SINGLE_SERIALIZE_WRITE_PASS, startupCompactionPass:METADATA_STARTUP_COMPACTION_PASS, unionFindCompactionPass:METADATA_UNION_FIND_COMPACTION_PASS, appliedShardPass:METADATA_APPLIED_SHARD_PASS, candidateShardPass:METADATA_CANDIDATE_SHARD_PASS, cleanupBackgroundPlanPass:METADATA_CLEANUP_BACKGROUND_PLAN_PASS, incrementalIndexPass:METADATA_INCREMENTAL_INDEX_PASS, appliedIncrementalIndexPass:METADATA_APPLIED_INCREMENTAL_INDEX_PASS, compactIndexPass:V675_METADATA_COMPACT_INDEX_PASS, startupBoundPass:V675_METADATA_STARTUP_BOUND_PASS, boundedShardLoadPass:V676_METADATA_BOUNDED_SHARD_LOAD_PASS, hardResidentBoundPass:V677_METADATA_HARD_RESIDENT_BOUND_PASS, incrementalEvictionPass:V677_METADATA_INCREMENTAL_EVICTION_PASS, appliedProvenancePass:V677_METADATA_APPLIED_PROVENANCE_PASS, appliedShardV2Pass:METADATA_APPLIED_SHARD_V2_PASS };
}

module.exports = { V677_METADATA_HARD_RESIDENT_BOUND_PASS, V677_METADATA_INCREMENTAL_EVICTION_PASS, V677_METADATA_APPLIED_PROVENANCE_PASS, V675_METADATA_COMPACT_INDEX_PASS, V675_METADATA_STARTUP_BOUND_PASS, METADATA_STORE_PASS, METADATA_APPLIED_SHARD_PASS, METADATA_APPLIED_SHARD_V2_PASS, METADATA_CANDIDATE_SHARD_PASS, METADATA_UNION_FIND_COMPACTION_PASS, METADATA_CLEANUP_BACKGROUND_PLAN_PASS, METADATA_INCREMENTAL_INDEX_PASS, METADATA_APPLIED_INCREMENTAL_INDEX_PASS, METADATA_PRESENTATION_REVISION_PASS, METADATA_SINGLE_SERIALIZE_WRITE_PASS, METADATA_STARTUP_COMPACTION_PASS, METADATA_STORE_ASYNC_PERSISTENCE_PASS, METADATA_COLLECTED_CANDIDATE_RETENTION_PASS, METADATA_CANDIDATE_DEDUP_PASS, METADATA_MANUAL_EDIT_PASS, METADATA_CANDIDATE_DELETE_PASS, METADATA_EQUIVALENT_GROUP_PASS, METADATA_COMPRESSED_STORE_PASS, METADATA_CANDIDATE_MAINTENANCE_PASS, METADATA_FIELDS, createMetadataStoreService, normalizeWorkKey, metadataContentFingerprint, metadataEquivalenceFingerprint, availableMetadataFields };
