const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadCompressedJsonWithBackup, atomicWriteCompressedJsonAsync } = require('../repositories/compressed-json-file-store');
const { loadJsonWithBackup, atomicWriteJsonAsync } = require('../repositories/json-file-store');

const LIBRARY_CACHE_STRATEGY_PASS = 'v439-library-cache-strategy-pass';
const LIBRARY_CATALOG_PERFORMANCE_PASS = 'v453-library-catalog-performance-pass';
const NOVELS_API_PAYLOAD_BUDGET_PASS = 'v453-novels-api-payload-budget-pass';
const NOVELS_API_RESPONSE_CACHE_BUDGET_PASS = 'v453-novels-api-response-cache-budget-pass';
const LIBRARY_STALE_WHILE_REVALIDATE_PASS = 'v567-library-stale-while-revalidate-pass';
const LIBRARY_SHELF_INDEX_PASS = 'v567-library-shelf-index-pass';
const LIBRARY_ASYNC_SIGNATURE_CHECK_PASS = 'v569-library-async-signature-check-pass';
const LIBRARY_SIGNATURE_BACKOFF_PASS = 'v569-library-signature-backoff-pass';
const LIBRARY_COMPLETE_SCAN_PASS = 'v573-library-complete-scan-pass';
const LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS = 'v628-library-episode-sequence-grouping-pass';
const LIBRARY_ASYNC_BUILD_PASS = 'v591-library-async-build-pass';
const LIBRARY_REQUEST_STABILITY_PASS = 'v646-library-request-stability-pass';
const LIBRARY_DURABLE_CATALOG_PASS = 'v646-library-durable-catalog-pass';
const LIBRARY_COLD_FAILURE_BACKOFF_PASS = 'v646-library-cold-failure-backoff-pass';
const LIBRARY_DURABLE_CATALOG_SCHEMA = 2;
const LIBRARY_DURABLE_MUTATION_STATE_SCHEMA = 2;
const LIBRARY_DURABLE_MUTATION_STATE_PASS = 'v649-library-catalog-mutation-journal-pass';
const LIBRARY_INVALIDATION_STABILITY_PASS = 'v649-library-invalidation-stability-pass';
const LIBRARY_MUTATION_PREFLIGHT_PASS = 'v649-library-mutation-preflight-pass';
const LIBRARY_ASYNC_MUTATION_JOURNAL_PASS = 'v671-library-async-mutation-journal-pass';
const LIBRARY_SYNC_COLD_GUARD_PASS = 'v648-library-sync-cold-guard-pass';

const EPISODE_SEQUENCE_KOREAN_NUMBERED = String.raw`(?:제\s*)?\d{1,7}\s*(?:화|회|편|장|권|부)`;
const EPISODE_SEQUENCE_LATIN_NUMBERED = String.raw`(?:vol(?:ume)?|book|ep|episode|chapter|chap|ch)\s*[.\-_:：]?\s*[\divxlcdm]{1,12}`;
const EPISODE_SEQUENCE_SPECIAL = String.raw`(?:prologue|epilogue|interlude|extra|side\s*story|프롤로그|에필로그|막간|외전|번외|서장|종장)(?:\s*\d{1,4})?`;
const EPISODE_SEQUENCE_MARKER = String.raw`(?:${EPISODE_SEQUENCE_KOREAN_NUMBERED}|${EPISODE_SEQUENCE_LATIN_NUMBERED}|${EPISODE_SEQUENCE_SPECIAL})`;
const EPISODE_SEQUENCE_PREFIXED_PATTERN = new RegExp(String.raw`^(.{1,200}?)[\s._-]+${EPISODE_SEQUENCE_MARKER}(?:\s*[-_.:：]?\s*.*)?$`, 'iu');
const EPISODE_SEQUENCE_NUMERIC_SUFFIX_PATTERN = /^(.{2,200}?)[\s._-]+0*(\d{1,4})$/u;
const EPISODE_SEQUENCE_RANGE_LIKE = /\d\s*[-~～–—]\s*\d/u;
const EPISODE_VOLUME_SERIES_PATTERN = /^(.{2,200}?)(?:\s*[\[(（]\s*|\s*)0*(\d{1,4})\s*(?:권|book|vol(?:ume)?)\s*[\])）]?$/iu;
const EPISODE_RANGE_SEGMENT_PATTERN = /^(.{2,200}?)\s+0*(\d{1,4})\s+0*(\d{1,7})\s*[-~～–—]\s*0*(\d{1,7})(?:\s*(?:화|회|편|장))?$/iu;

function normalizeShelfSearchKey(novel) {
  return [novel && novel.title, novel && novel.categoryPath, ...(Array.isArray(novel && novel.category) ? novel.category : [])]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
    .toLocaleLowerCase('ko-KR');
}

function createLibraryService(options = {}) {
  const LIBRARY_PATH = options.libraryPath;
  const encodeStableId = options.encodeStableId;
  const collator = options.collator || new Intl.Collator('ko', { numeric: true, sensitivity: 'base' });
  const contentService = options.contentService || null;

  if (!LIBRARY_PATH) {
    throw new Error('libraryPath is required');
  }
  if (typeof encodeStableId !== 'function') {
    throw new Error('encodeStableId is required');
  }

  const DIR_SCAN_CACHE = new Map();
  const DIR_SCAN_CACHE_MAX = options.dirScanCacheMax ?? 512;
  // libraryCacheTtlMs is retained as a compatibility alias, but it now controls
  // change-check cadence rather than forcing a full catalog rebuild.
  const LIBRARY_CHANGE_CHECK_TTL = Number.isFinite(Number(options.libraryChangeCheckTtlMs ?? options.libraryCacheTtlMs))
    ? Math.max(0, Number(options.libraryChangeCheckTtlMs ?? options.libraryCacheTtlMs))
    : 30000;
  const LIBRARY_CACHE_TTL = LIBRARY_CHANGE_CHECK_TTL; // compatibility marker; no longer forces rebuilds
  const LIBRARY_DEEP_SIGNATURE_CHECK_TTL = Number.isFinite(Number(options.libraryDeepSignatureCheckTtlMs))
    ? Math.max(0, Number(options.libraryDeepSignatureCheckTtlMs))
    : LIBRARY_CHANGE_CHECK_TTL;
  const LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL = Number.isFinite(Number(options.libraryDeepSignatureCheckMaxTtlMs))
    ? Math.max(LIBRARY_DEEP_SIGNATURE_CHECK_TTL, Number(options.libraryDeepSignatureCheckMaxTtlMs))
    : Math.max(LIBRARY_DEEP_SIGNATURE_CHECK_TTL, 300000);
  const LIBRARY_SIGNATURE_CHECK_CONCURRENCY = Number.isFinite(Number(options.librarySignatureCheckConcurrency))
    ? Math.max(1, Math.min(32, Number(options.librarySignatureCheckConcurrency)))
    : 8;
  const LIBRARY_REQUEST_COLD_WAIT_MS = Number.isFinite(Number(options.libraryRequestColdWaitMs))
    ? Math.max(500, Math.min(30000, Number(options.libraryRequestColdWaitMs)))
    : 4000;
  const LIBRARY_CATALOG_CACHE_PATH = String(options.catalogCachePath || '').trim();
  const LIBRARY_CATALOG_STATE_PATH = String(options.catalogStatePath || (LIBRARY_CATALOG_CACHE_PATH ? `${LIBRARY_CATALOG_CACHE_PATH}.state.json` : '')).trim();
  const ALLOW_SYNCHRONOUS_COLD_BUILD = options.allowSynchronousColdBuild !== false;
  const LIBRARY_CATALOG_CACHE_COMPRESSION_LEVEL = Number.isFinite(Number(options.catalogCacheCompressionLevel))
    ? Math.max(1, Math.min(9, Number(options.catalogCacheCompressionLevel)))
    : 6;
  const LIBRARY_CATALOG_CACHE_WRITE_DELAY_MS = Number.isFinite(Number(options.catalogCacheWriteDelayMs))
    ? Math.max(0, Math.min(60000, Number(options.catalogCacheWriteDelayMs)))
    : 5000;
  const writeMutationStateAsync = typeof options.writeMutationStateAsync === 'function'
    ? options.writeMutationStateAsync
    : atomicWriteJsonAsync;
  const LIBRARY_COLD_FAILURE_BACKOFF_BASE_MS = Number.isFinite(Number(options.coldFailureBackoffBaseMs))
    ? Math.max(1000, Math.min(60000, Number(options.coldFailureBackoffBaseMs)))
    : 5000;
  const LIBRARY_COLD_FAILURE_BACKOFF_MAX_MS = Number.isFinite(Number(options.coldFailureBackoffMaxMs))
    ? Math.max(LIBRARY_COLD_FAILURE_BACKOFF_BASE_MS, Math.min(600000, Number(options.coldFailureBackoffMaxMs)))
    : 120000;
  const LIBRARY_ROOT_HASH = crypto.createHash('sha256').update(path.resolve(LIBRARY_PATH)).digest('hex');
  const libraryCacheMetrics = {
    rootSignatureCalls: 0,
    directorySignatureCalls: 0,
    deepSignatureChecks: 0,
    libraryCacheHits: 0,
    libraryCacheMisses: 0,
    dirScanCacheHits: 0,
    dirScanCacheMisses: 0,
    dirScanCacheEvictions: 0,
    staleSnapshotServes: 0,
    backgroundRefreshScheduled: 0,
    backgroundRefreshCompleted: 0,
    backgroundRefreshFailed: 0,
    asyncSignatureChecksScheduled: 0,
    asyncSignatureChecksCompleted: 0,
    asyncSignatureChecksFailed: 0,
    asyncSignatureChangesDetected: 0,
    asyncBuildsStarted: 0,
    asyncBuildsCompleted: 0,
    asyncBuildsFailed: 0,
    asyncBuildInflightJoins: 0,
    synchronousColdBuilds: 0,
    requestColdWaits: 0,
    requestColdTimeouts: 0,
    requestColdBackoffRejects: 0,
    durableCatalogLoads: 0,
    durableCatalogLoadFailures: 0,
    durableCatalogWrites: 0,
    durableCatalogWriteFailures: 0,
    durableCatalogWriteCoalesces: 0,
    mutationStateLoads: 0,
    mutationStateWrites: 0,
    mutationStateWriteFailures: 0,
    invalidations: 0,
    tombstonesApplied: 0,
    synchronousColdBuildRejects: 0
  };
  const novelsApiMetrics = {
    marker: LIBRARY_CATALOG_PERFORMANCE_PASS,
    payloadBudgetPass: NOVELS_API_PAYLOAD_BUDGET_PASS,
    responseCacheBudgetPass: NOVELS_API_RESPONSE_CACHE_BUDGET_PASS,
    requests: 0,
    serialized: 0,
    responseCacheHits: 0,
    responseCacheMisses: 0,
    responseCacheSkips: 0,
    responseCacheBytes: 0,
    lastCacheSkipReason: '',
    lastSerializeMs: 0,
    lastPayloadBytes: 0,
    lastNovelCount: 0,
    maxPayloadBytes: 0,
    maxSerializeMs: 0,
    lastAt: 0
  };
  let mutationJournalTail = Promise.resolve();
  const libraryCache = {
    data: null,
    time: 0,
    signature: '',
    buildCount: 0,
    lastBuildMs: 0,
    lastBuildAt: 0,
    directorySignatures: new Map(),
    titleData: [],
    novelById: new Map(),
    lastDeepSignatureCheckAt: 0,
    refreshScheduled: false,
    refreshInProgress: false,
    refreshHandle: null,
    lastRefreshReason: '',
    lastRefreshError: '',
    signatureCheckScheduled: false,
    signatureCheckInProgress: false,
    signatureCheckPromise: null,
    signatureCheckHandle: null,
    signatureGeneration: 0,
    effectiveDeepSignatureCheckTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_TTL,
    lastSignatureCheckStartedAt: 0,
    lastSignatureCheckCompletedAt: 0,
    lastSignatureCheckDurationMs: 0,
    lastSignatureCheckTargetCount: 0,
    lastSignatureChangedPath: '',
    lastSignatureCheckError: '',
    buildPromise: null,
    durableCatalogLoaded: false,
    durableCatalogSource: 'none',
    durableCatalogLoadedAt: 0,
    durableCatalogWrittenAt: 0,
    durableCatalogJsonBytes: 0,
    durableCatalogCompressedBytes: 0,
    durableCatalogLastError: '',
    coldFailureCount: 0,
    coldFailureBackoffUntil: 0,
    lastColdFailureAt: 0,
    lastColdFailureCode: '',
    catalogGeneration: 0,
    mutationGeneration: 0,
    committedGeneration: 0,
    catalogDirty: false,
    mutationStateLoaded: false,
    mutationTombstones: [],
    mutationStateLastError: '',
    refreshAfterBuild: false
  };
  let durableCatalogPrimarySha256 = '';
  let durableCatalogPersistTimer = null;
  let durableCatalogPersistWriting = null;
  let durableCatalogPersistQueued = false;

  function resolveCachedDirectoryPath(relativePath) {
    const root = path.resolve(LIBRARY_PATH);
    const normalized = String(relativePath == null ? '' : relativePath).replace(/\\/g, '/');
    if (normalized === '') return root;
    if (normalized.startsWith('/') || normalized.split('/').includes('..')) return '';
    const resolved = path.resolve(root, normalized);
    return resolved.startsWith(root + path.sep) ? resolved : '';
  }

  function normalizeCategoryPath(value) {
    return String(value || '').split('>').map(part => part.trim()).filter(Boolean).join(' > ');
  }

  function normalizeRelativeLibraryPath(value) {
    const normalized = String(value || '').replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(part => part && part !== '.').join('/');
    return normalized.split('/').includes('..') ? '' : normalized;
  }

  function normalizeMutationValues(values, normalizer = value => String(value || '').trim()) {
    return Array.from(new Set((Array.isArray(values) ? values : [values]).map(normalizer).filter(Boolean)));
  }

  function normalizeMutationTombstone(input = {}, generation = 0) {
    return {
      id:String(input.id || `mutation-${Math.max(0, Number(generation) || 0)}-${crypto.randomBytes(6).toString('hex')}`).slice(0, 160),
      generation:Math.max(0, Number(generation) || 0),
      at:Math.max(0, Number(input.at) || Date.now()),
      reason:String(input.reason || 'library-mutation').slice(0, 160),
      pending:input.pending === true,
      novelIds:normalizeMutationValues(Array.isArray(input.novelIds) ? input.novelIds : input.novelId),
      categoryPaths:normalizeMutationValues(Array.isArray(input.categoryPaths) ? input.categoryPaths : input.categoryPath, normalizeCategoryPath),
      paths:normalizeMutationValues(Array.isArray(input.paths) ? input.paths : input.path, normalizeRelativeLibraryPath)
    };
  }

  function compactMutationTombstones(items = libraryCache.mutationTombstones, committedGeneration = libraryCache.committedGeneration) {
    const active = (Array.isArray(items) ? items : [])
      .map(item => normalizeMutationTombstone(item, item && item.generation))
      .filter(item => item.generation > Math.max(0, Number(committedGeneration) || 0));
    const pending = [];
    const novelIds = new Set();
    const categoryPaths = new Set();
    const paths = new Set();
    let maxGeneration = 0;
    let earliestAt = Date.now();
    for (const item of active) {
      maxGeneration = Math.max(maxGeneration, item.generation);
      earliestAt = Math.min(earliestAt, item.at || earliestAt);
      if (item.pending) { pending.push(item); continue; }
      for (const value of item.novelIds) novelIds.add(value);
      for (const value of item.categoryPaths) categoryPaths.add(value);
      for (const value of item.paths) paths.add(value);
    }
    const compacted = [];
    if (novelIds.size || categoryPaths.size || paths.size) {
      compacted.push(normalizeMutationTombstone({
        id:`committed-${maxGeneration}`,
        generation:maxGeneration,
        at:earliestAt,
        reason:'compacted-library-mutations',
        pending:false,
        novelIds:[...novelIds],
        categoryPaths:[...categoryPaths],
        paths:[...paths]
      }, maxGeneration));
    }
    return compacted.concat(pending).sort((left, right) => left.generation - right.generation || left.id.localeCompare(right.id));
  }

  function loadCatalogMutationState() {
    if (!LIBRARY_CATALOG_STATE_PATH) return false;
    try {
      const loaded = loadJsonWithBackup(LIBRARY_CATALOG_STATE_PATH, null);
      const state = loaded && loaded.ok ? loaded.data : null;
      if (!state || ![1, LIBRARY_DURABLE_MUTATION_STATE_SCHEMA].includes(Number(state.schemaVersion)) || !['v648-library-catalog-mutation-state-pass', LIBRARY_DURABLE_MUTATION_STATE_PASS].includes(state.pass)) return false;
      if (String(state.libraryRootHash || '') !== LIBRARY_ROOT_HASH) return false;
      libraryCache.mutationGeneration = Math.max(0, Number(state.mutationGeneration) || 0);
      libraryCache.committedGeneration = Math.max(0, Number(state.committedGeneration) || 0);
      libraryCache.catalogDirty = libraryCache.mutationGeneration > libraryCache.committedGeneration;
      libraryCache.mutationTombstones = compactMutationTombstones(Array.isArray(state.tombstones) ? state.tombstones : [], libraryCache.committedGeneration);
      libraryCache.mutationStateLoaded = true;
      libraryCacheMetrics.mutationStateLoads += 1;
      return true;
    } catch (error) {
      libraryCache.mutationStateLastError = error && error.message || String(error || 'catalog mutation state load failed');
      return false;
    }
  }

  function buildCatalogMutationStatePayload(overrides = {}) {
    const mutationGeneration = Math.max(0, Number(
      Object.prototype.hasOwnProperty.call(overrides, 'mutationGeneration')
        ? overrides.mutationGeneration
        : libraryCache.mutationGeneration
    ) || 0);
    const committedGeneration = Math.max(0, Number(
      Object.prototype.hasOwnProperty.call(overrides, 'committedGeneration')
        ? overrides.committedGeneration
        : libraryCache.committedGeneration
    ) || 0);
    const sourceTombstones = Object.prototype.hasOwnProperty.call(overrides, 'tombstones')
      ? overrides.tombstones
      : libraryCache.mutationTombstones;
    const tombstones = compactMutationTombstones(Array.isArray(sourceTombstones) ? sourceTombstones : [], committedGeneration);
    return {
      schemaVersion:LIBRARY_DURABLE_MUTATION_STATE_SCHEMA,
      pass:LIBRARY_DURABLE_MUTATION_STATE_PASS,
      preflightPass:LIBRARY_MUTATION_PREFLIGHT_PASS,
      asyncJournalPass:LIBRARY_ASYNC_MUTATION_JOURNAL_PASS,
      libraryRootHash:LIBRARY_ROOT_HASH,
      mutationGeneration,
      committedGeneration,
      dirty:mutationGeneration > committedGeneration,
      tombstones,
      writtenAt:Date.now()
    };
  }

  async function persistCatalogMutationStateAsync(payload = buildCatalogMutationStatePayload()) {
    if (!LIBRARY_CATALOG_STATE_PATH) return true;
    try {
      await writeMutationStateAsync(LIBRARY_CATALOG_STATE_PATH, payload);
      libraryCache.mutationStateLastError = '';
      libraryCacheMetrics.mutationStateWrites += 1;
      return true;
    } catch (error) {
      libraryCache.mutationStateLastError = error && error.message || String(error || 'catalog mutation state write failed');
      libraryCacheMetrics.mutationStateWriteFailures += 1;
      throw error;
    }
  }

  function runMutationJournalOperation(task) {
    const run = mutationJournalTail.catch(() => {}).then(task);
    mutationJournalTail = run.then(() => undefined, () => undefined);
    return run;
  }

  function mutationStateUnavailableError(cause = null) {
    const error = new Error('library mutation journal could not be persisted');
    error.code = 'LIBRARY_MUTATION_STATE_UNAVAILABLE';
    error.status = 503;
    error.statusCode = 503;
    error.retryAfterSeconds = 5;
    error.pass = LIBRARY_MUTATION_PREFLIGHT_PASS;
    error.asyncJournalPass = LIBRARY_ASYNC_MUTATION_JOURNAL_PASS;
    if (cause) error.cause = cause;
    return error;
  }

  function beginLibraryMutation(options = {}) {
    return runMutationJournalOperation(async () => {
      const nextGeneration = Math.max(libraryCache.mutationGeneration || 0, libraryCache.catalogGeneration || 0) + 1;
      const tombstone = normalizeMutationTombstone({ ...options, pending:true }, nextGeneration);
      const nextTombstones = libraryCache.mutationTombstones.slice().concat(tombstone);
      const payload = buildCatalogMutationStatePayload({
        mutationGeneration:nextGeneration,
        tombstones:nextTombstones
      });
      try {
        await persistCatalogMutationStateAsync(payload);
      } catch (error) {
        throw mutationStateUnavailableError(error);
      }
      libraryCache.mutationGeneration = nextGeneration;
      libraryCache.catalogDirty = true;
      libraryCache.mutationTombstones = payload.tombstones;
      return { pass:LIBRARY_MUTATION_PREFLIGHT_PASS, asyncJournalPass:LIBRARY_ASYNC_MUTATION_JOURNAL_PASS, id:tombstone.id, generation:tombstone.generation, tombstone };
    });
  }

  function abortLibraryMutation(token) {
    return runMutationJournalOperation(async () => {
      const id = String(token && token.id || '');
      if (!id) return false;
      const before = libraryCache.mutationTombstones.slice();
      const nextTombstones = before.filter(item => String(item && item.id || '') !== id);
      if (nextTombstones.length === before.length) return false;
      const nextDirty = libraryCache.mutationGeneration > libraryCache.committedGeneration && nextTombstones.length > 0;
      const payload = buildCatalogMutationStatePayload({ tombstones:nextTombstones });
      try {
        await persistCatalogMutationStateAsync(payload);
      } catch (_error) {
        libraryCache.catalogDirty = true;
        return false;
      }
      libraryCache.mutationTombstones = payload.tombstones;
      libraryCache.catalogDirty = nextDirty;
      return true;
    });
  }

  function applyCommittedMutationInvalidation(token) {
    libraryCacheMetrics.invalidations += 1;
    libraryCache.signatureGeneration += 1;
    libraryCache.catalogDirty = true;
    if (libraryCache.signatureCheckHandle) {
      try { clearImmediate(libraryCache.signatureCheckHandle); } catch {}
    }
    libraryCache.signatureCheckHandle = null;
    libraryCache.signatureCheckScheduled = false;
    libraryCache.signatureCheckInProgress = false;
    libraryCache.signatureCheckPromise = null;
    libraryCache.lastDeepSignatureCheckAt = 0;
    libraryCache.effectiveDeepSignatureCheckTtlMs = LIBRARY_DEEP_SIGNATURE_CHECK_TTL;
    libraryCache.lastSignatureCheckStartedAt = 0;
    libraryCache.lastSignatureCheckCompletedAt = 0;
    libraryCache.lastSignatureCheckDurationMs = 0;
    libraryCache.lastSignatureCheckTargetCount = 0;
    libraryCache.lastSignatureChangedPath = '';
    libraryCache.lastSignatureCheckError = '';
    DIR_SCAN_CACHE.clear();
    if (Array.isArray(libraryCache.data)) {
      libraryCache.data = applyMutationTombstones(libraryCache.data, libraryCache.catalogGeneration);
      libraryCache.titleData = libraryCache.data.slice().sort((a, b) => {
        const titleCmp = collator.compare(a.title || '', b.title || '');
        return titleCmp || collator.compare(a.categoryPath || '', b.categoryPath || '');
      });
      libraryCache.novelById = new Map(libraryCache.data.map(novel => [String(novel && novel.id || ''), novel]).filter(([novelId]) => novelId));
      libraryCache.time = Date.now();
    }
    if (libraryCache.buildPromise || libraryCache.refreshInProgress) libraryCache.refreshAfterBuild = true;
    else scheduleLibraryRefresh(`explicit-invalidation:${token && token.tombstone && token.tombstone.reason || 'library-mutation'}`);
  }

  function commitLibraryMutation(token) {
    return runMutationJournalOperation(async () => {
      const id = String(token && token.id || '');
      const index = libraryCache.mutationTombstones.findIndex(item => String(item && item.id || '') === id);
      if (index < 0) throw Object.assign(new Error('library mutation token is no longer active'), { code:'LIBRARY_MUTATION_TOKEN_INVALID', statusCode:409 });
      const nextTombstones = libraryCache.mutationTombstones.slice();
      nextTombstones[index] = { ...nextTombstones[index], pending:false };
      const payload = buildCatalogMutationStatePayload({ tombstones:nextTombstones });
      try {
        await persistCatalogMutationStateAsync(payload);
      } catch (error) {
        // Keep the in-memory token pending to match the last durable state. The
        // filesystem operation has already happened, so the caller receives a
        // recovery-required 503 and the pending tombstone remains protective.
        libraryCache.catalogDirty = true;
        throw error;
      }
      libraryCache.mutationTombstones = payload.tombstones;
      applyCommittedMutationInvalidation(token);
      return {
        pass:LIBRARY_INVALIDATION_STABILITY_PASS,
        preflightPass:LIBRARY_MUTATION_PREFLIGHT_PASS,
        asyncJournalPass:LIBRARY_ASYNC_MUTATION_JOURNAL_PASS,
        mutationGeneration:libraryCache.mutationGeneration,
        retainedCount:Array.isArray(libraryCache.data) ? libraryCache.data.length : 0,
        tombstone:token && token.tombstone || null,
        statePersisted:true
      };
    });
  }

  function novelMatchesMutationTombstone(novel, tombstone) {
    if (!novel || !tombstone) return false;
    const novelId = String(novel.id || '');
    if ((tombstone.novelIds || []).includes(novelId)) return true;
    const categoryPath = normalizeCategoryPath(novel.categoryPath || '');
    if ((tombstone.categoryPaths || []).some(prefix => categoryPath === prefix || categoryPath.startsWith(`${prefix} > `))) return true;
    const candidatePaths = [novel.singlePath, novel.path, novel.fileName, ...(Array.isArray(novel.episodes) ? novel.episodes.map(episode => episode && episode.path) : [])]
      .map(normalizeRelativeLibraryPath).filter(Boolean);
    return (tombstone.paths || []).some(prefix => candidatePaths.some(candidate => candidate === prefix || candidate.startsWith(`${prefix}/`)));
  }

  function applyMutationTombstones(data, catalogGeneration = 0) {
    const active = (libraryCache.mutationTombstones || []).filter(item => Number(item && item.generation) > Number(catalogGeneration || 0));
    if (!active.length || !Array.isArray(data)) return data;
    const filtered = data.filter(novel => !active.some(tombstone => novelMatchesMutationTombstone(novel, tombstone)));
    libraryCacheMetrics.tombstonesApplied += Math.max(0, data.length - filtered.length);
    return filtered;
  }

  function markCatalogGenerationCommitted(generation) {
    return runMutationJournalOperation(async () => {
      const committed = Math.max(libraryCache.committedGeneration || 0, Math.max(0, Number(generation) || 0));
      const nextTombstones = libraryCache.mutationGeneration <= committed
        ? []
        : (libraryCache.mutationTombstones || []).filter(item => Number(item && item.generation) > committed);
      const payload = buildCatalogMutationStatePayload({
        committedGeneration:committed,
        tombstones:nextTombstones
      });
      try {
        await persistCatalogMutationStateAsync(payload);
      } catch (error) {
        throw mutationStateUnavailableError(error);
      }
      libraryCache.committedGeneration = committed;
      libraryCache.mutationTombstones = payload.tombstones;
      libraryCache.catalogDirty = libraryCache.mutationGeneration > committed;
      return true;
    });
  }

  function restoreDurableCatalogSnapshot() {
    if (!LIBRARY_CATALOG_CACHE_PATH) return false;
    try {
      const loaded = loadCompressedJsonWithBackup(LIBRARY_CATALOG_CACHE_PATH, null);
      const payload = loaded && loaded.ok ? loaded.data : null;
      if (!payload || ![1, LIBRARY_DURABLE_CATALOG_SCHEMA].includes(Number(payload.schemaVersion)) || payload.pass !== LIBRARY_DURABLE_CATALOG_PASS) return false;
      if (String(payload.libraryRootHash || '') !== LIBRARY_ROOT_HASH || !Array.isArray(payload.data)) return false;
      const signatures = new Map();
      for (const pair of Array.isArray(payload.directorySignatures) ? payload.directorySignatures : []) {
        if (!Array.isArray(pair) || pair.length !== 2) continue;
        const resolved = resolveCachedDirectoryPath(pair[0]);
        const signature = String(pair[1] || '').slice(0, 160);
        if (resolved && signature) signatures.set(resolved, signature);
      }
      const payloadGeneration = Math.max(0, Number(payload.catalogGeneration) || 0);
      libraryCache.catalogGeneration = payloadGeneration;
      libraryCache.committedGeneration = Math.max(libraryCache.committedGeneration || 0, payloadGeneration);
      libraryCache.catalogDirty = libraryCache.mutationGeneration > payloadGeneration;
      const data = applyMutationTombstones(payload.data.filter(novel => novel && typeof novel === 'object' && String(novel.id || '')), payloadGeneration);
      libraryCache.signatureGeneration += 1;
      libraryCache.data = data;
      libraryCache.directorySignatures = signatures;
      libraryCache.titleData = data.slice().sort((a, b) => {
        const titleCmp = collator.compare(a.title || '', b.title || '');
        return titleCmp || collator.compare(a.categoryPath || '', b.categoryPath || '');
      });
      libraryCache.novelById = new Map(data.map(novel => [String(novel.id || ''), novel]));
      libraryCache.signature = String(payload.signature || '');
      if (libraryCache.signature && !libraryCache.directorySignatures.has(path.resolve(LIBRARY_PATH))) {
        libraryCache.directorySignatures.set(path.resolve(LIBRARY_PATH), libraryCache.signature);
      }
      libraryCache.time = Date.now();
      libraryCache.lastBuildAt = Math.max(0, Number(payload.writtenAt) || 0);
      libraryCache.lastDeepSignatureCheckAt = 0;
      libraryCache.durableCatalogLoaded = true;
      libraryCache.durableCatalogSource = String(loaded.source || 'primary');
      libraryCache.durableCatalogLoadedAt = Date.now();
      libraryCache.durableCatalogWrittenAt = Math.max(0, Number(payload.writtenAt) || 0);
      libraryCache.durableCatalogJsonBytes = Math.max(0, Number(loaded.jsonBytes) || 0);
      libraryCache.durableCatalogCompressedBytes = Math.max(0, Number(loaded.compressedBytes) || 0);
      durableCatalogPrimarySha256 = loaded.source === 'primary' ? String(loaded.compressedSha256 || '') : '';
      libraryCacheMetrics.durableCatalogLoads += 1;
      return true;
    } catch (error) {
      libraryCache.durableCatalogLastError = error && error.message || String(error || 'durable catalog load failed');
      libraryCacheMetrics.durableCatalogLoadFailures += 1;
      return false;
    }
  }

  function buildDurableCatalogPayload() {
    const root = path.resolve(LIBRARY_PATH);
    const directorySignatures = [];
    for (const [directoryPath, signature] of libraryCache.directorySignatures || []) {
      const resolved = path.resolve(String(directoryPath || ''));
      if (resolved !== root && !resolved.startsWith(root + path.sep)) continue;
      const relative = resolved === root ? '' : path.relative(root, resolved).replace(/\\/g, '/');
      directorySignatures.push([relative, String(signature || '').slice(0, 160)]);
    }
    return {
      schemaVersion:LIBRARY_DURABLE_CATALOG_SCHEMA,
      pass:LIBRARY_DURABLE_CATALOG_PASS,
      libraryRootHash:LIBRARY_ROOT_HASH,
      writtenAt:Date.now(),
      catalogGeneration:Math.max(0, Number(libraryCache.catalogGeneration) || 0),
      signature:String(libraryCache.signature || ''),
      directorySignatures,
      data:Array.isArray(libraryCache.data) ? libraryCache.data : []
    };
  }

  async function persistDurableCatalogNow() {
    if (!LIBRARY_CATALOG_CACHE_PATH || !libraryCache.data) return false;
    if (durableCatalogPersistTimer) {
      clearTimeout(durableCatalogPersistTimer);
      durableCatalogPersistTimer = null;
    }
    if (durableCatalogPersistWriting) {
      durableCatalogPersistQueued = true;
      libraryCacheMetrics.durableCatalogWriteCoalesces += 1;
      return durableCatalogPersistWriting;
    }
    durableCatalogPersistQueued = false;
    const payload = buildDurableCatalogPayload();
    const serializedJson = Buffer.from(JSON.stringify(payload), 'utf8');
    durableCatalogPersistWriting = atomicWriteCompressedJsonAsync(LIBRARY_CATALOG_CACHE_PATH, payload, {
      level:LIBRARY_CATALOG_CACHE_COMPRESSION_LEVEL,
      serializedJson,
      trustedPrimarySha256:durableCatalogPrimarySha256
    }).then(async result => {
      durableCatalogPrimarySha256 = String(result && result.primarySha256 || '');
      libraryCache.durableCatalogWrittenAt = Math.max(0, Number(payload.writtenAt) || Date.now());
      libraryCache.durableCatalogJsonBytes = Math.max(0, Number(result && result.jsonBytes) || serializedJson.length);
      libraryCache.durableCatalogCompressedBytes = Math.max(0, Number(result && result.compressedBytes) || 0);
      libraryCache.durableCatalogLastError = '';
      libraryCacheMetrics.durableCatalogWrites += 1;
      await markCatalogGenerationCommitted(payload.catalogGeneration);
      return true;
    }).catch(error => {
      libraryCache.durableCatalogLastError = error && error.message || String(error || 'durable catalog write failed');
      libraryCacheMetrics.durableCatalogWriteFailures += 1;
      return false;
    }).finally(() => {
      durableCatalogPersistWriting = null;
      if (durableCatalogPersistQueued) scheduleDurableCatalogPersist();
    });
    return durableCatalogPersistWriting;
  }

  function scheduleDurableCatalogPersist() {
    if (!LIBRARY_CATALOG_CACHE_PATH || !libraryCache.data) return false;
    durableCatalogPersistQueued = true;
    if (durableCatalogPersistWriting || durableCatalogPersistTimer) {
      libraryCacheMetrics.durableCatalogWriteCoalesces += 1;
      return true;
    }
    durableCatalogPersistTimer = setTimeout(() => {
      durableCatalogPersistTimer = null;
      void persistDurableCatalogNow();
    }, LIBRARY_CATALOG_CACHE_WRITE_DELAY_MS);
    durableCatalogPersistTimer.unref?.();
    return true;
  }

  async function closeDurableCatalogCache() {
    if (durableCatalogPersistTimer) {
      clearTimeout(durableCatalogPersistTimer);
      durableCatalogPersistTimer = null;
    }
    if (durableCatalogPersistWriting) await durableCatalogPersistWriting;
    await mutationJournalTail.catch(() => {});
    if (!LIBRARY_CATALOG_CACHE_PATH || !libraryCache.data) return { ok:true, skipped:true, pass:LIBRARY_DURABLE_CATALOG_PASS };
    const needsWrite = durableCatalogPersistQueued || libraryCache.durableCatalogWrittenAt < libraryCache.lastBuildAt;
    if (!needsWrite) return { ok:true, skipped:true, pass:LIBRARY_DURABLE_CATALOG_PASS };
    const ok = await persistDurableCatalogNow();
    return { ok:ok !== false, skipped:false, pass:LIBRARY_DURABLE_CATALOG_PASS };
  }

  function recordColdBuildFailure(error) {
    if (libraryCache.data) return;
    libraryCache.coldFailureCount = Math.min(32, Math.max(0, Number(libraryCache.coldFailureCount) || 0) + 1);
    const exponent = Math.max(0, libraryCache.coldFailureCount - 1);
    const delayMs = Math.min(LIBRARY_COLD_FAILURE_BACKOFF_MAX_MS, LIBRARY_COLD_FAILURE_BACKOFF_BASE_MS * (2 ** Math.min(10, exponent)));
    libraryCache.coldFailureBackoffUntil = Date.now() + delayMs;
    libraryCache.lastColdFailureAt = Date.now();
    libraryCache.lastColdFailureCode = String(error && error.code || 'LIBRARY_COLD_BUILD_FAILED').slice(0, 120);
  }

  function resetColdBuildFailure() {
    libraryCache.coldFailureCount = 0;
    libraryCache.coldFailureBackoffUntil = 0;
    libraryCache.lastColdFailureAt = 0;
    libraryCache.lastColdFailureCode = '';
  }

  function createColdBuildBackoffError(now = Date.now()) {
    const remainingMs = Math.max(0, (Number(libraryCache.coldFailureBackoffUntil) || 0) - now);
    const error = new Error('library catalog cold build is in failure backoff');
    error.code = 'LIBRARY_COLD_BUILD_BACKOFF';
    error.status = 503;
    error.retryAfterSeconds = Math.max(1, Math.min(10, Math.ceil(remainingMs / 1000)));
    error.pass = LIBRARY_COLD_FAILURE_BACKOFF_PASS;
    return error;
  }

  function createColdBuildFailedError(cause) {
    const now = Date.now();
    const remainingMs = Math.max(0, (Number(libraryCache.coldFailureBackoffUntil) || now + LIBRARY_COLD_FAILURE_BACKOFF_BASE_MS) - now);
    const error = new Error('library catalog cold build failed; retry is temporarily delayed');
    error.code = 'LIBRARY_COLD_BUILD_FAILED';
    error.status = 503;
    error.retryAfterSeconds = Math.max(1, Math.min(10, Math.ceil(remainingMs / 1000)));
    error.pass = LIBRARY_COLD_FAILURE_BACKOFF_PASS;
    error.cause = cause;
    error.storageCode = String(cause && cause.code || '').slice(0, 120);
    return error;
  }

  function getDirScanCache(dirPath, stat) {
    const key = String(dirPath || '');
    if (!key) return null;
    const hit = DIR_SCAN_CACHE.get(key);
    if (!hit) {
      libraryCacheMetrics.dirScanCacheMisses += 1;
      return null;
    }
    if (!stat || hit.mtimeMs !== Math.floor(stat.mtimeMs || 0)) {
      libraryCacheMetrics.dirScanCacheMisses += 1;
      return null;
    }
    libraryCacheMetrics.dirScanCacheHits += 1;
    DIR_SCAN_CACHE.delete(key);
    DIR_SCAN_CACHE.set(key, hit);
    return Array.isArray(hit.files) ? hit.files.slice() : null;
  }

  function setDirScanCache(dirPath, stat, files) {
    const key = String(dirPath || '');
    if (!key || !stat) return;
    DIR_SCAN_CACHE.set(key, { mtimeMs: Math.floor(stat.mtimeMs || 0), files: Array.isArray(files) ? files.slice() : [] });
    while (DIR_SCAN_CACHE.size > DIR_SCAN_CACHE_MAX) {
      const oldestKey = DIR_SCAN_CACHE.keys().next().value;
      if (!oldestKey) break;
      DIR_SCAN_CACHE.delete(oldestKey);
      libraryCacheMetrics.dirScanCacheEvictions += 1;
    }
  }

  function getDirectorySignature(dirPath) {
    libraryCacheMetrics.directorySignatureCalls += 1;
    try {
      const stat = fs.statSync(dirPath);
      if (!stat || !stat.isDirectory || !stat.isDirectory()) return '0:0';
      return `${Math.floor(stat.mtimeMs || 0)}:${stat.size || 0}`;
    } catch (e) {
      return '0:0';
    }
  }

  function recordLibraryDirectorySignature(signatureMap, dirPath) {
    if (!signatureMap || !dirPath) return;
    signatureMap.set(path.resolve(dirPath), getDirectorySignature(dirPath));
  }

  function scanLibrary(dirPath) {
    if (!fs.existsSync(dirPath)) return [];

    function walk(currentDir) {
      let stat = null;
      try {
        stat = fs.statSync(currentDir);
      } catch (err) {
        return [];
      }

      const cached = getDirScanCache(currentDir, stat);
      if (cached) return cached;

      let entries = [];
      try {
        entries = fs.readdirSync(currentDir, { withFileTypes: true });
      } catch (err) {
        return [];
      }

      const files = [];
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) files.push(...walk(fullPath));
        else if (entry.isFile() && entry.name.toLowerCase().endsWith('.txt')) files.push(fullPath);
      }

      setDirScanCache(currentDir, stat, files);
      return files;
    }

    return walk(dirPath);
  }

  function readDirEntriesSafe(dirPath) {
    try {
      return fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
      return [];
    }
  }

  function readDirEntriesForLibraryBuild(dirPath, signatureMap) {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      const stat = fs.statSync(dirPath);
      if (!stat || !stat.isDirectory || !stat.isDirectory()) {
        const error = new Error('library scan target is not a directory');
        error.code = 'LIBRARY_SCAN_NOT_DIRECTORY';
        throw error;
      }
      if (signatureMap) {
        signatureMap.set(path.resolve(dirPath), `${Math.floor(stat.mtimeMs || 0)}:${stat.size || 0}`);
      }
      return entries;
    } catch (error) {
      const wrapped = new Error(`library scan failed (${String(error && error.code || 'UNKNOWN')})`);
      wrapped.name = 'LibraryScanError';
      wrapped.code = 'LIBRARY_SCAN_INCOMPLETE';
      wrapped.causeCode = String(error && error.code || 'UNKNOWN');
      wrapped.cause = error;
      throw wrapped;
    }
  }

  async function readDirEntriesForLibraryBuildAsync(dirPath, signatureMap) {
    try {
      const [entries, stat] = await Promise.all([
        fs.promises.readdir(dirPath, { withFileTypes: true }),
        fs.promises.stat(dirPath)
      ]);
      if (!stat || !stat.isDirectory || !stat.isDirectory()) {
        const error = new Error('library scan target is not a directory');
        error.code = 'LIBRARY_SCAN_NOT_DIRECTORY';
        throw error;
      }
      if (signatureMap) {
        signatureMap.set(path.resolve(dirPath), `${Math.floor(stat.mtimeMs || 0)}:${stat.size || 0}`);
      }
      return entries;
    } catch (error) {
      const wrapped = new Error(`library scan failed (${String(error && error.code || 'UNKNOWN')})`);
      wrapped.name = 'LibraryScanError';
      wrapped.code = 'LIBRARY_SCAN_INCOMPLETE';
      wrapped.causeCode = String(error && error.code || 'UNKNOWN');
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function isTxtDirEntry(entry) {
    return !!(entry && entry.isFile && entry.isFile() && entry.name && entry.name.toLowerCase().endsWith('.txt'));
  }

  function sanitizeNodeName(name) {
    const s = String(name || '').trim();
    if (!s) return '';
    if (s.includes('/') || s.includes('\\')) return '';
    if (s === '.' || s === '..') return '';
    if (/[<>:"|?*\x00-\x1F]/.test(s)) return '';
    return s;
  }

  function normalizeTxtBaseName(name) {
    const clean = sanitizeNodeName(name);
    if (!clean) return '';
    return clean.replace(/\.txt$/i, '');
  }

  function getDirectoryNovelModeOverride(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const fileNames = new Set(
      safeEntries
        .filter(entry => entry && entry.isFile && entry.isFile() && entry.name)
        .map(entry => String(entry.name || '').trim().toLowerCase())
    );

    if (fileNames.has('.txt-reader-folder') || fileNames.has('.txt-reader-category')) {
      return 'folder';
    }
    if (fileNames.has('.txt-reader-episodes') || fileNames.has('.txt-reader-novel')) {
      return 'episodes';
    }
    return '';
  }

  function isLikelyEpisodeFileName(name) {
    const base = normalizeTxtBaseName(name);
    if (!base) return false;

    return (
      /^(?:\d{1,4})$/.test(base) ||
      /^(?:\d{1,4})\s*(?:화|회|편|장|권|부)$/.test(base) ||
      /^(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)$/.test(base) ||
      /^(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)(?:\s*[-_.:：)）\]]?\s*.+)$/i.test(base) ||
      /^(?:[[(（]?\s*(?:제\s*)?\d{1,4}\s*(?:화|회|편|장|권|부)\s*[\])）]?)(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:vol(?:ume)?|book)\s*[.:-]?\s*\d{1,4}(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:ep|episode|chapter|ch)\s*[.:-]?\s*[\divxlcdm]+(?:\s*[-_.:：]?\s*.+)?$/i.test(base) ||
      /^(?:prologue|epilogue|interlude|extra|side\s*story|프롤로그|에필로그|막간|외전|번외|서장|종장)$/.test(base)
    );
  }

  function cleanDerivedEpisodeTitle(value) {
    return String(value || '').normalize('NFKC').trim().replace(/[._-]+/g, ' ').replace(/\s+/g, ' ').slice(0, 300);
  }

  function normalizeDerivedEpisodeTitle(value) {
    return cleanDerivedEpisodeTitle(value).toLocaleLowerCase('ko-KR');
  }

  function analyzePrefixedEpisodeFileName(name) {
    const base = normalizeTxtBaseName(name).normalize('NFKC').trim();
    if (!base) return null;
    const volumeSeries = base.match(EPISODE_VOLUME_SERIES_PATTERN);
    if (volumeSeries) {
      const title = cleanDerivedEpisodeTitle(volumeSeries[1] || '');
      const number = Number.parseInt(volumeSeries[2] || '', 10);
      if (title && Number.isSafeInteger(number) && number > 0) {
        return { title, key:normalizeDerivedEpisodeTitle(title), number, kind:'volume-series' };
      }
    }
    const rangeSegment = base.match(EPISODE_RANGE_SEGMENT_PATTERN);
    if (rangeSegment) {
      const title = cleanDerivedEpisodeTitle(rangeSegment[1] || '');
      const part = Number.parseInt(rangeSegment[2] || '', 10);
      const start = Number.parseInt(rangeSegment[3] || '', 10);
      const end = Number.parseInt(rangeSegment[4] || '', 10);
      if (title && Number.isSafeInteger(part) && Number.isSafeInteger(start) && Number.isSafeInteger(end) && end >= start) {
        return { title, key:normalizeDerivedEpisodeTitle(title), number:part, start, end, kind:'range-segment' };
      }
    }
    const match = base.match(EPISODE_SEQUENCE_PREFIXED_PATTERN);
    if (!match) return null;
    const title = cleanDerivedEpisodeTitle(match[1] || '');
    return title ? { title, key:normalizeDerivedEpisodeTitle(title), kind:'filename-prefix' } : null;
  }

  function analyzeNumericSuffixEpisodeFileName(name) {
    const base = normalizeTxtBaseName(name).normalize('NFKC').trim();
    if (!base || EPISODE_SEQUENCE_RANGE_LIKE.test(base) || new RegExp(EPISODE_SEQUENCE_MARKER, 'iu').test(base)) return null;
    const match = base.match(EPISODE_SEQUENCE_NUMERIC_SUFFIX_PATTERN);
    if (!match) return null;
    const title = cleanDerivedEpisodeTitle(match[1] || '');
    const number = Number.parseInt(match[2] || '', 10);
    if (!title || /\d$/u.test(title) || !Number.isSafeInteger(number) || number < 0 || number > 9999) return null;
    return { title, key:normalizeDerivedEpisodeTitle(title), number, kind:'numeric-suffix' };
  }

  function qualifiesNumericSuffixSequence(numbers, rowCount) {
    if (rowCount < 3 || rowCount > 500 || numbers.length !== rowCount) return false;
    const ordered = numbers.slice().sort((a, b) => a - b);
    const first = ordered[0];
    const last = ordered[ordered.length - 1];
    if (first !== 0 && first !== 1) return false;
    const span = last - first + 1;
    return span > 0 && ordered.length / span >= 0.8;
  }

  function classifyDerivedEpisodeGroups(entries) {
    const txtEntries = (Array.isArray(entries) ? entries : []).filter(isTxtDirEntry);
    const prefixGroups = new Map();
    const numericGroups = new Map();
    for (const entry of txtEntries) {
      const prefix = analyzePrefixedEpisodeFileName(entry.name);
      if (prefix) {
        const group = prefixGroups.get(prefix.key) || { title:prefix.title, kind:prefix.kind, entries:[] };
        group.entries.push(entry);
        prefixGroups.set(prefix.key, group);
        continue;
      }
      const numeric = analyzeNumericSuffixEpisodeFileName(entry.name);
      if (numeric) {
        const group = numericGroups.get(numeric.key) || { title:numeric.title, kind:numeric.kind, entries:[], numbers:[] };
        group.entries.push(entry);
        group.numbers.push(numeric.number);
        numericGroups.set(numeric.key, group);
      }
    }
    const accepted = [];
    for (const group of prefixGroups.values()) if (group.entries.length >= 2) accepted.push(group);
    for (const group of numericGroups.values()) {
      const unique = [...new Set(group.numbers)];
      if (qualifiesNumericSuffixSequence(unique, group.entries.length)) accepted.push(group);
    }
    const claimed = new Set();
    const groups = [];
    for (const group of accepted.sort((a, b) => collator.compare(a.title, b.title))) {
      const available = group.entries.filter(entry => !claimed.has(entry.name));
      if (available.length < (group.kind === 'numeric-suffix' ? 3 : 2)) continue;
      available.forEach(entry => claimed.add(entry.name));
      groups.push({ ...group, entries:available });
    }
    return { groups, claimed };
  }

  function shouldTreatDirectoryAsEpisodeNovel(entries) {
    const safeEntries = Array.isArray(entries) ? entries : [];
    const overrideMode = getDirectoryNovelModeOverride(safeEntries);
    if (overrideMode === 'episodes') return true;
    if (overrideMode === 'folder') return false;
    const dirEntries = safeEntries.filter(entry => entry && entry.isDirectory && entry.isDirectory());
    if (dirEntries.length) return false;

    const txtEntries = safeEntries.filter(isTxtDirEntry);
    if (txtEntries.length < 2) return false;

    const episodeLikeCount = txtEntries.reduce((count, entry) => {
      return count + (isLikelyEpisodeFileName(entry.name) ? 1 : 0);
    }, 0);

    return episodeLikeCount === txtEntries.length;
  }

  function buildLibraryDetailed() {
    const novelMap = new Map();
    const buildDirectorySignatures = new Map();

    function upsertSingleFileNovel(filePath, categoryParts) {
      const rel = path.relative(LIBRARY_PATH, filePath);
      const novelKey = rel;

      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: path.basename(rel, '.txt'),
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: false,
          singlePath: rel,
        });
      }
    }

    function upsertEpisodeNovel(dirPath, entries, categoryParts) {
      const novelTitle = path.basename(dirPath);
      const novelKey = categoryParts.length ? (categoryParts.join('/') + '/' + novelTitle) : novelTitle;

      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: novelTitle,
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: true,
          singlePath: null,
        });
      }

      const novel = novelMap.get(novelKey);
      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) =>
        collator.compare(a.name, b.name)
      );

      txtEntries.forEach((entry) => {
        const absPath = path.join(dirPath, entry.name);
        const episodePath = path.relative(LIBRARY_PATH, absPath);
        novel.episodes.push({
          id: encodeStableId(episodePath),
          title: path.basename(entry.name, '.txt'),
          path: episodePath,
        });
      });
    }

    function upsertDerivedEpisodeNovel(dirPath, group, categoryParts) {
      const relDir = path.relative(LIBRARY_PATH, dirPath).replace(/\\/g, '/');
      const sourceKey = `derived-episode:${group.kind}:${relDir}:${normalizeDerivedEpisodeTitle(group.title)}`;
      const novel = {
        id: encodeStableId(sourceKey),
        title: group.title,
        category: categoryParts.slice(),
        categoryPath: categoryParts.join(' > '),
        episodes: [],
        isMultiFile: true,
        isVirtualEpisodeGroup: true,
        episodeGroupingKind: group.kind,
        episodeGroupingPass: LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS,
        singlePath: null,
      };
      group.entries.slice().sort((a, b) => collator.compare(a.name, b.name)).forEach(entry => {
        const episodePath = path.relative(LIBRARY_PATH, path.join(dirPath, entry.name));
        novel.episodes.push({
          id: encodeStableId(episodePath),
          title: path.basename(entry.name, '.txt'),
          path: episodePath,
        });
      });
      novelMap.set(sourceKey, novel);
    }

    function walkCategoryDir(currentDir, categoryParts, preloadedEntries) {
      const entries = Array.isArray(preloadedEntries) ? preloadedEntries : readDirEntriesForLibraryBuild(currentDir, buildDirectorySignatures);
      if (!entries.length) return;

      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) =>
        collator.compare(a.name, b.name)
      );
      const dirEntries = entries
        .filter(entry => entry && entry.isDirectory && entry.isDirectory())
        .sort((a, b) => collator.compare(a.name, b.name));

      const derivedGroups = classifyDerivedEpisodeGroups(txtEntries);
      derivedGroups.groups.forEach(group => upsertDerivedEpisodeNovel(currentDir, group, categoryParts));
      txtEntries.forEach((entry) => {
        if (!derivedGroups.claimed.has(entry.name)) upsertSingleFileNovel(path.join(currentDir, entry.name), categoryParts);
      });

      dirEntries.forEach((entry) => {
        const childDir = path.join(currentDir, entry.name);
        const childEntries = readDirEntriesForLibraryBuild(childDir, buildDirectorySignatures);
        if (!childEntries.length) return;

        if (shouldTreatDirectoryAsEpisodeNovel(childEntries)) {
          upsertEpisodeNovel(childDir, childEntries, categoryParts);
          return;
        }

        walkCategoryDir(childDir, categoryParts.concat(entry.name), childEntries);
      });
    }

    walkCategoryDir(LIBRARY_PATH, []);

    for (const novel of novelMap.values()) {
      novel.episodes.sort((a, b) =>
        collator.compare(a.title, b.title)
      );
      novel.shelfSearchKey = normalizeShelfSearchKey(novel);
    }

    const library = Array.from(novelMap.values()).sort((a, b) => {
      const catCmp = collator.compare(a.categoryPath, b.categoryPath);
      if (catCmp !== 0) return catCmp;
      return collator.compare(a.title, b.title);
    });

    const titleData = library.slice().sort((a, b) => {
      const titleCmp = collator.compare(a.title, b.title);
      if (titleCmp !== 0) return titleCmp;
      return collator.compare(a.categoryPath, b.categoryPath);
    });
    return { data: library, directorySignatures: buildDirectorySignatures, titleData };
  }

  async function buildLibraryDetailedAsync() {
    const novelMap = new Map();
    const buildDirectorySignatures = new Map();

    function upsertSingleFileNovel(filePath, categoryParts) {
      const rel = path.relative(LIBRARY_PATH, filePath);
      const novelKey = rel;
      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: path.basename(rel, '.txt'),
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: false,
          singlePath: rel,
        });
      }
    }

    function upsertEpisodeNovel(dirPath, entries, categoryParts) {
      const novelTitle = path.basename(dirPath);
      const novelKey = categoryParts.length ? (categoryParts.join('/') + '/' + novelTitle) : novelTitle;
      if (!novelMap.has(novelKey)) {
        novelMap.set(novelKey, {
          id: encodeStableId(novelKey),
          title: novelTitle,
          category: categoryParts.slice(),
          categoryPath: categoryParts.join(' > '),
          episodes: [],
          isMultiFile: true,
          singlePath: null,
        });
      }
      const novel = novelMap.get(novelKey);
      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) => collator.compare(a.name, b.name));
      txtEntries.forEach((entry) => {
        const absPath = path.join(dirPath, entry.name);
        const episodePath = path.relative(LIBRARY_PATH, absPath);
        novel.episodes.push({
          id: encodeStableId(episodePath),
          title: path.basename(entry.name, '.txt'),
          path: episodePath,
        });
      });
    }

    function upsertDerivedEpisodeNovel(dirPath, group, categoryParts) {
      const relDir = path.relative(LIBRARY_PATH, dirPath).replace(/\\/g, '/');
      const sourceKey = `derived-episode:${group.kind}:${relDir}:${normalizeDerivedEpisodeTitle(group.title)}`;
      const novel = {
        id: encodeStableId(sourceKey),
        title: group.title,
        category: categoryParts.slice(),
        categoryPath: categoryParts.join(' > '),
        episodes: [],
        isMultiFile: true,
        isVirtualEpisodeGroup: true,
        episodeGroupingKind: group.kind,
        episodeGroupingPass: LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS,
        singlePath: null,
      };
      group.entries.slice().sort((a, b) => collator.compare(a.name, b.name)).forEach(entry => {
        const episodePath = path.relative(LIBRARY_PATH, path.join(dirPath, entry.name));
        novel.episodes.push({
          id: encodeStableId(episodePath),
          title: path.basename(entry.name, '.txt'),
          path: episodePath,
        });
      });
      novelMap.set(sourceKey, novel);
    }

    async function walkCategoryDir(currentDir, categoryParts, preloadedEntries) {
      const entries = Array.isArray(preloadedEntries)
        ? preloadedEntries
        : await readDirEntriesForLibraryBuildAsync(currentDir, buildDirectorySignatures);
      if (!entries.length) return;

      const txtEntries = entries.filter(isTxtDirEntry).sort((a, b) => collator.compare(a.name, b.name));
      const dirEntries = entries
        .filter(entry => entry && entry.isDirectory && entry.isDirectory())
        .sort((a, b) => collator.compare(a.name, b.name));

      const derivedGroups = classifyDerivedEpisodeGroups(txtEntries);
      derivedGroups.groups.forEach(group => upsertDerivedEpisodeNovel(currentDir, group, categoryParts));
      txtEntries.forEach((entry) => {
        if (!derivedGroups.claimed.has(entry.name)) upsertSingleFileNovel(path.join(currentDir, entry.name), categoryParts);
      });

      for (const entry of dirEntries) {
        const childDir = path.join(currentDir, entry.name);
        const childEntries = await readDirEntriesForLibraryBuildAsync(childDir, buildDirectorySignatures);
        if (!childEntries.length) continue;
        if (shouldTreatDirectoryAsEpisodeNovel(childEntries)) {
          upsertEpisodeNovel(childDir, childEntries, categoryParts);
          continue;
        }
        await walkCategoryDir(childDir, categoryParts.concat(entry.name), childEntries);
      }
    }

    await walkCategoryDir(LIBRARY_PATH, []);

    for (const novel of novelMap.values()) {
      novel.episodes.sort((a, b) => collator.compare(a.title, b.title));
      novel.shelfSearchKey = normalizeShelfSearchKey(novel);
    }

    const library = Array.from(novelMap.values()).sort((a, b) => {
      const catCmp = collator.compare(a.categoryPath, b.categoryPath);
      if (catCmp !== 0) return catCmp;
      return collator.compare(a.title, b.title);
    });
    const titleData = library.slice().sort((a, b) => {
      const titleCmp = collator.compare(a.title, b.title);
      if (titleCmp !== 0) return titleCmp;
      return collator.compare(a.categoryPath, b.categoryPath);
    });
    return { data: library, directorySignatures: buildDirectorySignatures, titleData };
  }

  function buildLibrary() {
    return buildLibraryDetailed().data;
  }

  function getLibraryRootSignature() {
    libraryCacheMetrics.rootSignatureCalls += 1;
    try {
      const st = fs.statSync(LIBRARY_PATH);
      return `${Math.floor(st.mtimeMs || 0)}:${st.size || 0}`;
    } catch (e) {
      return '0:0';
    }
  }


  async function getDirectorySignatureAsync(dirPath) {
    try {
      const stat = await fs.promises.stat(dirPath);
      if (!stat || !stat.isDirectory || !stat.isDirectory()) return '0:0';
      return `${Math.floor(stat.mtimeMs || 0)}:${stat.size || 0}`;
    } catch (error) {
      if (error && error.code === 'ENOENT') return '0:0';
      throw error;
    }
  }

  async function inspectLibrarySignaturesAsync(expectedGeneration = libraryCache.signatureGeneration) {
    const startedAt = Date.now();
    const entries = Array.from(libraryCache.directorySignatures?.entries?.() || []);
    const rootPath = path.resolve(LIBRARY_PATH);
    if (!entries.some(([dirPath]) => path.resolve(dirPath) === rootPath)) {
      entries.unshift([rootPath, libraryCache.signature || '0:0']);
    }
    libraryCache.lastSignatureCheckStartedAt = startedAt;
    libraryCache.lastSignatureCheckTargetCount = entries.length;
    libraryCacheMetrics.deepSignatureChecks += 1;
    let nextIndex = 0;
    let changedPath = '';
    const workers = Array.from({ length: Math.min(LIBRARY_SIGNATURE_CHECK_CONCURRENCY, Math.max(1, entries.length)) }, async () => {
      while (!changedPath) {
        const index = nextIndex++;
        if (index >= entries.length) return;
        const [dirPath, expected] = entries[index];
        const actual = await getDirectorySignatureAsync(dirPath);
        libraryCacheMetrics.directorySignatureCalls += 1;
        if (actual !== expected) {
          changedPath = dirPath;
          return;
        }
      }
    });
    await Promise.all(workers);
    const completedAt = Date.now();
    const durationMs = Math.max(0, completedAt - startedAt);
    if (expectedGeneration !== libraryCache.signatureGeneration || !libraryCache.data) {
      return { changed:false, stale:true, durationMs, targetCount:entries.length };
    }
    libraryCache.lastDeepSignatureCheckAt = completedAt;
    libraryCache.lastSignatureCheckCompletedAt = completedAt;
    libraryCache.lastSignatureCheckDurationMs = durationMs;
    libraryCache.lastSignatureChangedPath = changedPath;
    libraryCache.lastSignatureCheckError = '';

    if (changedPath) {
      libraryCache.effectiveDeepSignatureCheckTtlMs = LIBRARY_DEEP_SIGNATURE_CHECK_TTL;
      libraryCacheMetrics.asyncSignatureChangesDetected += 1;
    } else {
      const slowCheckBackoff = Math.ceil(durationMs * 6);
      libraryCache.effectiveDeepSignatureCheckTtlMs = Math.min(
        LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL,
        Math.max(LIBRARY_DEEP_SIGNATURE_CHECK_TTL, slowCheckBackoff)
      );
    }
    return { changed: !!changedPath, changedPath, durationMs, targetCount: entries.length };
  }

  function scheduleLibrarySignatureCheck(reason = 'signature-check-due') {
    if (!libraryCache.data || libraryCache.signatureCheckScheduled || libraryCache.signatureCheckInProgress) return false;
    libraryCache.signatureCheckScheduled = true;
    libraryCacheMetrics.asyncSignatureChecksScheduled += 1;
    const expectedGeneration = libraryCache.signatureGeneration;
    const handle = setImmediate(() => {
      libraryCache.signatureCheckHandle = null;
      libraryCache.signatureCheckScheduled = false;
      if (!libraryCache.data || expectedGeneration !== libraryCache.signatureGeneration) return;
      libraryCache.signatureCheckInProgress = true;
      const promise = inspectLibrarySignaturesAsync(expectedGeneration)
        .then(result => {
          libraryCacheMetrics.asyncSignatureChecksCompleted += 1;
          if (!result.stale && result.changed) scheduleLibraryRefresh(`async-signature-changed:${result.changedPath || reason}`);
          return result;
        })
        .catch(error => {
          libraryCacheMetrics.asyncSignatureChecksFailed += 1;
          libraryCache.lastSignatureCheckError = error && error.message || String(error || 'signature check failed');
          return { changed:false, error:libraryCache.lastSignatureCheckError };
        })
        .finally(() => {
          libraryCache.signatureCheckInProgress = false;
          if (libraryCache.signatureCheckPromise === promise) libraryCache.signatureCheckPromise = null;
        });
      libraryCache.signatureCheckPromise = promise;
    });
    libraryCache.signatureCheckHandle = handle;
    if (handle && typeof handle.unref === 'function') handle.unref();
    return true;
  }

  function commitLibrarySnapshot(data, signature, startedAt, now = Date.now(), snapshotMeta = {}) {
    if (libraryCache.signatureCheckHandle) {
      try { clearImmediate(libraryCache.signatureCheckHandle); } catch {}
    }
    libraryCache.signatureCheckHandle = null;
    libraryCache.signatureCheckScheduled = false;
    libraryCache.signatureGeneration += 1;
    libraryCache.catalogGeneration = Math.max(0, Number(libraryCache.mutationGeneration) || 0);
    libraryCache.data = data;
    libraryCache.directorySignatures = snapshotMeta.directorySignatures instanceof Map
      ? snapshotMeta.directorySignatures
      : libraryCache.directorySignatures;
    libraryCache.titleData = Array.isArray(snapshotMeta.titleData)
      ? snapshotMeta.titleData
      : libraryCache.titleData;
    libraryCache.novelById = new Map((Array.isArray(data) ? data : []).map(novel => [String(novel?.id || ''), novel]).filter(([id]) => id));
    libraryCache.lastDeepSignatureCheckAt = now;
    libraryCache.time = now;
    libraryCache.signature = String(signature || getLibraryRootSignature());
    libraryCache.buildCount += 1;
    libraryCache.lastBuildMs = Math.max(0, Date.now() - startedAt);
    libraryCache.lastBuildAt = now;
    libraryCache.lastRefreshError = '';
    libraryCache.effectiveDeepSignatureCheckTtlMs = LIBRARY_DEEP_SIGNATURE_CHECK_TTL;
    libraryCache.lastSignatureChangedPath = '';
    resetColdBuildFailure();
    scheduleDurableCatalogPersist();
    return data;
  }

  function buildAndCommitLibrarySnapshot() {
    const startedAt = Date.now();
    const rootStat = fs.statSync(LIBRARY_PATH);
    if (!rootStat.isDirectory()) throw new Error('library root is not a directory');
    const signature = `${Math.floor(rootStat.mtimeMs || 0)}:${rootStat.size || 0}`;
    const snapshot = buildLibraryDetailed();
    // Re-check access so a transient SMB disconnect cannot commit a partial/empty snapshot.
    const afterStat = fs.statSync(LIBRARY_PATH);
    if (!afterStat.isDirectory()) throw new Error('library root became unavailable');
    const afterSignature = `${Math.floor(afterStat.mtimeMs || 0)}:${afterStat.size || 0}`;
    if (afterSignature !== signature) {
      const error = new Error('library root changed during scan');
      error.code = 'LIBRARY_SCAN_CHANGED';
      throw error;
    }
    return commitLibrarySnapshot(snapshot.data, afterSignature, startedAt, Date.now(), snapshot);
  }

  async function buildAndCommitLibrarySnapshotAsync(expectedGeneration = libraryCache.signatureGeneration) {
    const startedAt = Date.now();
    const rootStat = await fs.promises.stat(LIBRARY_PATH);
    if (!rootStat.isDirectory()) throw new Error('library root is not a directory');
    const signature = `${Math.floor(rootStat.mtimeMs || 0)}:${rootStat.size || 0}`;
    const snapshot = await buildLibraryDetailedAsync();
    const afterStat = await fs.promises.stat(LIBRARY_PATH);
    if (!afterStat.isDirectory()) throw new Error('library root became unavailable');
    const afterSignature = `${Math.floor(afterStat.mtimeMs || 0)}:${afterStat.size || 0}`;
    if (afterSignature !== signature) {
      const error = new Error('library root changed during scan');
      error.code = 'LIBRARY_SCAN_CHANGED';
      throw error;
    }
    if (expectedGeneration !== libraryCache.signatureGeneration) {
      const error = new Error('library scan invalidated before commit');
      error.code = 'LIBRARY_SCAN_STALE';
      throw error;
    }
    return commitLibrarySnapshot(snapshot.data, afterSignature, startedAt, Date.now(), snapshot);
  }

  async function refreshLibraryCacheAsync(reason = 'manual-refresh') {
    if (libraryCache.buildPromise) {
      libraryCacheMetrics.asyncBuildInflightJoins += 1;
      return libraryCache.buildPromise;
    }
    if (libraryCache.refreshHandle) {
      try { clearImmediate(libraryCache.refreshHandle); } catch {}
    }
    libraryCache.refreshHandle = null;
    libraryCache.refreshScheduled = false;
    libraryCache.refreshInProgress = true;
    libraryCache.lastRefreshReason = String(reason || 'manual-refresh');
    libraryCacheMetrics.asyncBuildsStarted += 1;
    const expectedGeneration = libraryCache.signatureGeneration;
    const task = buildAndCommitLibrarySnapshotAsync(expectedGeneration)
      .then(data => {
        libraryCacheMetrics.asyncBuildsCompleted += 1;
        libraryCacheMetrics.backgroundRefreshCompleted += 1;
        return data;
      })
      .catch(error => {
        libraryCache.lastRefreshError = error && error.message || String(error || 'library refresh failed');
        libraryCacheMetrics.asyncBuildsFailed += 1;
        libraryCacheMetrics.backgroundRefreshFailed += 1;
        recordColdBuildFailure(error);
        throw error;
      })
      .finally(() => {
        libraryCache.refreshInProgress = false;
        if (libraryCache.buildPromise === task) libraryCache.buildPromise = null;
        if (libraryCache.refreshAfterBuild) {
          libraryCache.refreshAfterBuild = false;
          scheduleLibraryRefresh('post-invalidation-refresh');
        }
      });
    libraryCache.buildPromise = task;
    return task;
  }

  function refreshLibraryCacheNow(reason = 'manual-refresh') {
    if (libraryCache.refreshHandle) {
      try { clearImmediate(libraryCache.refreshHandle); } catch {}
    }
    libraryCache.refreshHandle = null;
    libraryCache.refreshScheduled = false;
    if (libraryCache.refreshInProgress) return libraryCache.data;
    libraryCache.refreshInProgress = true;
    libraryCache.lastRefreshReason = String(reason || 'manual-refresh');
    try {
      const data = buildAndCommitLibrarySnapshot();
      libraryCacheMetrics.backgroundRefreshCompleted += 1;
      return data;
    } catch (error) {
      libraryCache.lastRefreshError = error && error.message || String(error || 'library refresh failed');
      libraryCacheMetrics.backgroundRefreshFailed += 1;
      throw error;
    } finally {
      libraryCache.refreshInProgress = false;
    }
  }

  function scheduleLibraryRefresh(reason = 'filesystem-change') {
    if (libraryCache.refreshScheduled || libraryCache.refreshInProgress) return false;
    libraryCache.refreshScheduled = true;
    libraryCache.lastRefreshReason = String(reason || 'filesystem-change');
    libraryCacheMetrics.backgroundRefreshScheduled += 1;
    libraryCache.refreshHandle = setImmediate(() => {
      libraryCache.refreshHandle = null;
      libraryCache.refreshScheduled = false;
      void refreshLibraryCacheAsync(reason).catch(() => {});
    });
    if (libraryCache.refreshHandle && typeof libraryCache.refreshHandle.unref === 'function') libraryCache.refreshHandle.unref();
    return true;
  }

  async function getLibraryCachedAsync() {
    if (!libraryCache.data) {
      const now = Date.now();
      if (!libraryCache.buildPromise && now < Math.max(0, Number(libraryCache.coldFailureBackoffUntil) || 0)) {
        libraryCacheMetrics.requestColdBackoffRejects += 1;
        throw createColdBuildBackoffError(now);
      }
      libraryCacheMetrics.libraryCacheMisses += 1;
      try {
        return await refreshLibraryCacheAsync('async-cold-build');
      } catch (error) {
        if (error && error.code === 'LIBRARY_SCAN_STALE') {
          const retryNow = Date.now();
          if (retryNow < Math.max(0, Number(libraryCache.coldFailureBackoffUntil) || 0)) throw createColdBuildBackoffError(retryNow);
          return refreshLibraryCacheAsync('async-cold-build-retry');
        }
        if (!libraryCache.data && error && !['LIBRARY_COLD_BUILD_BACKOFF','LIBRARY_COLD_BUILD_FAILED'].includes(error.code)) {
          throw createColdBuildFailedError(error);
        }
        throw error;
      }
    }
    return getLibraryCached();
  }

  function getLibraryCached() {
    const now = Date.now();
    if (!libraryCache.data) {
      libraryCacheMetrics.libraryCacheMisses += 1;
      if (!ALLOW_SYNCHRONOUS_COLD_BUILD) {
        libraryCacheMetrics.synchronousColdBuildRejects += 1;
        scheduleLibraryRefresh('sync-cold-guard');
        const error = new Error('synchronous cold library build is disabled');
        error.code = 'LIBRARY_SYNC_COLD_BUILD_DISABLED';
        error.status = 503;
        error.retryAfterSeconds = Math.max(1, Math.ceil(LIBRARY_REQUEST_COLD_WAIT_MS / 1000));
        error.pass = LIBRARY_SYNC_COLD_GUARD_PASS;
        throw error;
      }
      libraryCacheMetrics.synchronousColdBuilds += 1;
      return buildAndCommitLibrarySnapshot();
    }

    const effectiveTtl = Math.max(0, Number(libraryCache.effectiveDeepSignatureCheckTtlMs) || LIBRARY_DEEP_SIGNATURE_CHECK_TTL);
    const signatureCheckDue = effectiveTtl === 0 || now - (libraryCache.lastDeepSignatureCheckAt || 0) >= effectiveTtl;
    if (signatureCheckDue) scheduleLibrarySignatureCheck('request-cache-hit');

    // Signature I/O never runs on the request path. The last known-good
    // snapshot remains available while the bounded asynchronous check and any
    // subsequent rebuild complete in the background.
    libraryCache.time = now;
    libraryCacheMetrics.libraryCacheHits += 1;
    if (libraryCache.signatureCheckScheduled || libraryCache.signatureCheckInProgress || libraryCache.refreshScheduled || libraryCache.refreshInProgress) {
      libraryCacheMetrics.staleSnapshotServes += 1;
    }
    return libraryCache.data;
  }



  async function getLibraryCachedForRequestAsync(options = {}) {
    if (libraryCache.data) return getLibraryCached();
    const now = Date.now();
    if (!libraryCache.buildPromise && now < Math.max(0, Number(libraryCache.coldFailureBackoffUntil) || 0)) {
      libraryCacheMetrics.requestColdBackoffRejects += 1;
      throw createColdBuildBackoffError(now);
    }
    libraryCacheMetrics.requestColdWaits += 1;
    const waitMs = Number.isFinite(Number(options.waitMs))
      ? Math.max(250, Math.min(30000, Number(options.waitMs)))
      : LIBRARY_REQUEST_COLD_WAIT_MS;
    const build = refreshLibraryCacheAsync('request-cold-build');
    let timer = null;
    try {
      return await Promise.race([
        build,
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            libraryCacheMetrics.requestColdTimeouts += 1;
            const error = new Error('library catalog is still warming');
            error.code = 'LIBRARY_COLD_BUILD_PENDING';
            error.status = 503;
            error.retryAfterSeconds = Math.max(1, Math.ceil(waitMs / 1000));
            error.pass = LIBRARY_REQUEST_STABILITY_PASS;
            reject(error);
          }, waitMs);
          timer.unref?.();
        })
      ]);
    } catch (error) {
      if (!libraryCache.data && error && !['LIBRARY_COLD_BUILD_PENDING','LIBRARY_COLD_BUILD_BACKOFF','LIBRARY_COLD_BUILD_FAILED'].includes(error.code)) {
        throw createColdBuildFailedError(error);
      }
      throw error;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function getNovelByIdCachedAsync(novelId) {
    const id = String(novelId || '').trim();
    if (!id) return null;
    if (!libraryCache.data) await getLibraryCachedForRequestAsync();
    return libraryCache.novelById.get(id) || null;
  }

  function getShelfTitleCatalog() {
    return Array.isArray(libraryCache.titleData) && libraryCache.titleData.length
      ? libraryCache.titleData
      : (Array.isArray(libraryCache.data) ? libraryCache.data : []);
  }



  function recordNovelsApiPayloadMetrics(metrics = {}) {
    novelsApiMetrics.requests += 1;
    if (metrics.cacheHit) novelsApiMetrics.responseCacheHits += 1;
    else novelsApiMetrics.responseCacheMisses += 1;
    if (metrics.serialized) novelsApiMetrics.serialized += 1;
    if (metrics.cacheSkipped) novelsApiMetrics.responseCacheSkips += 1;
    novelsApiMetrics.responseCacheBytes = Math.max(0, Number(metrics.responseCacheBytes) || 0);
    novelsApiMetrics.lastCacheSkipReason = metrics.cacheSkipReason ? String(metrics.cacheSkipReason) : '';
    novelsApiMetrics.lastSerializeMs = Math.max(0, Number(metrics.serializeMs) || 0);
    novelsApiMetrics.lastPayloadBytes = Math.max(0, Number(metrics.payloadBytes) || 0);
    novelsApiMetrics.lastNovelCount = Math.max(0, Number(metrics.novelCount) || 0);
    novelsApiMetrics.maxPayloadBytes = Math.max(novelsApiMetrics.maxPayloadBytes || 0, novelsApiMetrics.lastPayloadBytes);
    novelsApiMetrics.maxSerializeMs = Math.max(novelsApiMetrics.maxSerializeMs || 0, novelsApiMetrics.lastSerializeMs);
    novelsApiMetrics.lastAt = Date.now();
  }

  async function invalidateLibraryCache(options = {}) {
    const token = await beginLibraryMutation(options);
    return commitLibraryMutation(token);
  }

  function setLibraryMetaHeaders(res) {
    try {
      res.setHeader('X-Library-Signature', String(libraryCache.signature || ''));
      res.setHeader('X-Library-Build-Count', String(libraryCache.buildCount || 0));
      res.setHeader('X-Library-Build-Ms', String(libraryCache.lastBuildMs || 0));
      res.setHeader('X-Library-Build-At', String(libraryCache.lastBuildAt || 0));
      res.setHeader('X-Library-Refresh-Pending', libraryCache.refreshScheduled || libraryCache.refreshInProgress ? '1' : '0');
    } catch (e) {}
  }

  function safeJoinUnderLibrary(relPath) {
    const resolved = path.resolve(LIBRARY_PATH, relPath || '');
    const root = path.resolve(LIBRARY_PATH);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error('Invalid path');
    }
    return resolved;
  }

  function ensureExists(targetPath) {
    if (!fs.existsSync(targetPath)) {
      throw new Error('Path not found');
    }
  }

  function ensureNotExists(targetPath) {
    if (fs.existsSync(targetPath)) {
      throw new Error('Target already exists');
    }
  }

  function ensureDirExists(targetPath) {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }
  }

  function cleanupEmptyParents(startDir) {
    const root = path.resolve(LIBRARY_PATH);
    let cur = path.resolve(startDir);

    while (cur.startsWith(root) && cur !== root) {
      try {
        const entries = fs.readdirSync(cur);
        if (entries.length > 0) break;
        fs.rmdirSync(cur);
        cur = path.dirname(cur);
      } catch (e) {
        break;
      }
    }
  }

  function categoryPathToRelDir(categoryPath) {
    const parts = String(categoryPath || '')
      .split('>')
      .map(s => s.trim())
      .filter(Boolean);

    for (const p of parts) {
      if (!sanitizeNodeName(p)) throw new Error('Invalid category path');
    }

    return parts.join(path.sep);
  }

  function sendFsError(res, err) {
    const msg = String((err && err.message) || 'Unknown error');

    if (
      msg === 'Invalid path' ||
      msg === 'Invalid request' ||
      msg === 'Invalid title' ||
      msg === 'Invalid category path'
    ) {
      return res.status(400).json({ error: msg });
    }

    if (msg === 'Path not found' || msg === 'Novel not found') {
      return res.status(404).json({ error: msg });
    }

    if (msg === 'Target already exists') {
      return res.status(409).json({ error: msg });
    }

    if (err && (err.code === 'EROFS' || /read-only file system|EROFS/i.test(msg))) {
      return res.status(423).json({
        error: 'READ_ONLY_LIBRARY',
        message: 'Library path is read-only. Mount the library volume as writable to rename, move, or delete files.'
      });
    }

    if (err && (err.code === 'EACCES' || err.code === 'EPERM')) {
      return res.status(403).json({ error: 'LIBRARY_PERMISSION_DENIED', message: 'Library path is not writable.' });
    }

    const requestedStatus = Number(err && (err.statusCode || err.status));
    const statusCode = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus <= 599
      ? requestedStatus
      : 500;
    const retryAfterSeconds = Math.max(0, Math.min(3600, Number(err && err.retryAfterSeconds) || 0));
    if (retryAfterSeconds > 0) {
      if (typeof res.setHeader === 'function') res.setHeader('Retry-After', String(Math.ceil(retryAfterSeconds)));
      else if (typeof res.set === 'function') res.set('Retry-After', String(Math.ceil(retryAfterSeconds)));
    }
    const rawCode = String(err && err.code || '').trim();
    const publicCode = /^[A-Z][A-Z0-9_]{2,80}$/.test(rawCode) ? rawCode : (statusCode >= 500 ? 'internal_server_error' : 'library_file_operation_failed');
    const exposeMessage = statusCode < 500 || [
      'FILEOPS_MUTATION_QUEUE_FULL',
      'FILEOPS_MUTATION_WAIT_TIMEOUT',
      'FILEOPS_REQUEST_ABORTED',
      'LIBRARY_MUTATION_STATE_UNAVAILABLE',
      'LIBRARY_MUTATION_COMMIT_PERSIST_FAILED',
      'LIBRARY_MUTATION_ABORT_PERSIST_FAILED',
      'LIBRARY_MUTATION_DIRECTORY_FSYNC_FAILED'
    ].includes(publicCode);
    return res.status(statusCode).json({
      error: publicCode,
      message: exposeMessage ? msg : 'library file operation failed',
      retryable: retryAfterSeconds > 0,
      recoveryRequired:err && err.recoveryRequired === true,
      operationApplied:err && err.operationApplied === true,
      fileOperationApplied:err && err.fileOperationApplied === true,
      pass:String(err && err.pass || '')
    });
  }

  function invalidatePathCaches(filePath) {
    if (contentService && typeof contentService.invalidatePathCaches === 'function') {
      contentService.invalidatePathCaches(filePath);
    }
  }

  function clearAllFileCache() {
    if (contentService && typeof contentService.clearAllFileCache === 'function') {
      contentService.clearAllFileCache();
    }
  }

  function clearFileCachePath(filePath) {
    if (contentService && typeof contentService.clearFileCachePath === 'function') {
      contentService.clearFileCachePath(filePath);
    }
  }

  function isSubPath(parentAbs, childAbs) {
    const parent = path.resolve(parentAbs);
    const child = path.resolve(childAbs);
    return child === parent || child.startsWith(parent + path.sep);
  }

  function getNovelStorageInfo(novel) {
    if (!novel) throw new Error('Novel not found');

    if (novel.isMultiFile) {
      if (novel.isVirtualEpisodeGroup) {
        const error = new Error('Derived episode groups must be managed by individual episode files.');
        error.code = 'VIRTUAL_EPISODE_GROUP_MUTATION_UNSUPPORTED';
        throw error;
      }
      const eps = Array.isArray(novel.episodes) ? novel.episodes : [];
      if (!eps.length) throw new Error('Path not found');

      const firstEpisodeAbs = safeJoinUnderLibrary(eps[0].path);
      const folderAbs = path.dirname(firstEpisodeAbs);

      return {
        type: 'folder',
        absPath: folderAbs,
        name: path.basename(folderAbs)
      };
    }

    if (!novel.singlePath) throw new Error('Path not found');

    const singleAbs = safeJoinUnderLibrary(novel.singlePath);
    return {
      type: 'file',
      absPath: singleAbs,
      name: path.basename(singleAbs)
    };
  }

  function getEpisodeStorageInfo(novel, episodeId) {
    if (!novel || !novel.isMultiFile) throw new Error('Path not found');
    const eps = Array.isArray(novel.episodes) ? novel.episodes : [];
    const ep = eps.find(e => e && e.id === episodeId);
    if (!ep || !ep.path) throw new Error('Path not found');

    const absPath = safeJoinUnderLibrary(ep.path);
    return {
      type: 'file',
      absPath,
      name: path.basename(absPath)
    };
  }

  function clearNovelCachesByInfo(info) {
    if (!info) return;

    if (info.type === 'file') {
      invalidatePathCaches(info.absPath);
      return;
    }

    // Folder-backed novels can contain thousands of files on SMB or external
    // storage. Walking the entire folder synchronously only to clear entries is
    // redundant because a folder mutation invalidates the global content cache
    // immediately afterwards. Clear the cache now so in-flight builders are
    // aborted before the filesystem mutation without a recursive pre-scan.
    clearAllFileCache();
  }

  function getCacheStatus() {
    return {
      marker: LIBRARY_CACHE_STRATEGY_PASS,
      libraryCache: {
        count: Array.isArray(libraryCache.data) ? libraryCache.data.length : 0,
        buildCount: libraryCache.buildCount || 0,
        lastBuildMs: libraryCache.lastBuildMs || 0,
        lastBuildAt: libraryCache.lastBuildAt || 0,
        signature: libraryCache.signature || '',
        directorySignatureCount: libraryCache.directorySignatures ? libraryCache.directorySignatures.size : 0,
        lastDeepSignatureCheckAt: libraryCache.lastDeepSignatureCheckAt || 0,
        deepSignatureCheckTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_TTL,
        effectiveDeepSignatureCheckTtlMs: libraryCache.effectiveDeepSignatureCheckTtlMs || LIBRARY_DEEP_SIGNATURE_CHECK_TTL,
        deepSignatureCheckMaxTtlMs: LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL,
        signatureCheckConcurrency: LIBRARY_SIGNATURE_CHECK_CONCURRENCY,
        asyncSignatureCheckPass: LIBRARY_ASYNC_SIGNATURE_CHECK_PASS,
        signatureBackoffPass: LIBRARY_SIGNATURE_BACKOFF_PASS,
        completeScanPass: LIBRARY_COMPLETE_SCAN_PASS,
        asyncBuildPass: LIBRARY_ASYNC_BUILD_PASS,
        requestStabilityPass: LIBRARY_REQUEST_STABILITY_PASS,
        durableCatalogPass: LIBRARY_DURABLE_CATALOG_PASS,
        coldFailureBackoffPass: LIBRARY_COLD_FAILURE_BACKOFF_PASS,
        requestColdWaitMs: LIBRARY_REQUEST_COLD_WAIT_MS,
        catalogCachePath:LIBRARY_CATALOG_CACHE_PATH ? path.basename(LIBRARY_CATALOG_CACHE_PATH) : '',
        catalogCacheCompressionLevel:LIBRARY_CATALOG_CACHE_COMPRESSION_LEVEL,
        catalogCacheWriteDelayMs:LIBRARY_CATALOG_CACHE_WRITE_DELAY_MS,
        durableCatalogLoaded:!!libraryCache.durableCatalogLoaded,
        durableCatalogSource:libraryCache.durableCatalogSource,
        durableCatalogLoadedAt:libraryCache.durableCatalogLoadedAt,
        durableCatalogWrittenAt:libraryCache.durableCatalogWrittenAt,
        durableCatalogJsonBytes:libraryCache.durableCatalogJsonBytes,
        durableCatalogCompressedBytes:libraryCache.durableCatalogCompressedBytes,
        durableCatalogLastError:libraryCache.durableCatalogLastError,
        coldFailureCount:libraryCache.coldFailureCount,
        coldFailureBackoffUntil:libraryCache.coldFailureBackoffUntil,
        lastColdFailureAt:libraryCache.lastColdFailureAt,
        lastColdFailureCode:libraryCache.lastColdFailureCode,
        catalogGeneration:libraryCache.catalogGeneration,
        mutationGeneration:libraryCache.mutationGeneration,
        committedGeneration:libraryCache.committedGeneration,
        catalogDirty:!!libraryCache.catalogDirty,
        mutationTombstoneCount:Array.isArray(libraryCache.mutationTombstones) ? libraryCache.mutationTombstones.length : 0,
        mutationStateLoaded:!!libraryCache.mutationStateLoaded,
        mutationStateLastError:libraryCache.mutationStateLastError || '',
        allowSynchronousColdBuild:ALLOW_SYNCHRONOUS_COLD_BUILD,
        signatureCheckScheduled: !!libraryCache.signatureCheckScheduled,
        signatureCheckInProgress: !!libraryCache.signatureCheckInProgress,
        signatureGeneration: libraryCache.signatureGeneration || 0,
        lastSignatureCheckStartedAt: libraryCache.lastSignatureCheckStartedAt || 0,
        lastSignatureCheckCompletedAt: libraryCache.lastSignatureCheckCompletedAt || 0,
        lastSignatureCheckDurationMs: libraryCache.lastSignatureCheckDurationMs || 0,
        lastSignatureCheckTargetCount: libraryCache.lastSignatureCheckTargetCount || 0,
        lastSignatureChangedPath: libraryCache.lastSignatureChangedPath || '',
        lastSignatureCheckError: libraryCache.lastSignatureCheckError || '',
        changeCheckTtlMs: LIBRARY_CHANGE_CHECK_TTL,
        staleWhileRevalidatePass: LIBRARY_STALE_WHILE_REVALIDATE_PASS,
        shelfIndexPass: LIBRARY_SHELF_INDEX_PASS,
        titleIndexCount: Array.isArray(libraryCache.titleData) ? libraryCache.titleData.length : 0,
        refreshScheduled: !!libraryCache.refreshScheduled,
        refreshInProgress: !!libraryCache.refreshInProgress,
        asyncBuildInProgress: !!libraryCache.buildPromise,
        lastRefreshReason: libraryCache.lastRefreshReason || '',
        lastRefreshError: libraryCache.lastRefreshError || ''
      },
      dirScanCacheEntries: DIR_SCAN_CACHE.size || 0,
      metrics: Object.assign({}, libraryCacheMetrics),
      novelsApi: Object.assign({}, novelsApiMetrics)
    };
  }

  loadCatalogMutationState();
  const durableCatalogRestored = restoreDurableCatalogSnapshot();
  if (durableCatalogRestored && libraryCache.durableCatalogSource === 'backup') scheduleDurableCatalogPersist();
  if (durableCatalogRestored && libraryCache.catalogDirty) scheduleLibraryRefresh('durable-catalog-dirty');

  return {
    scanLibrary,
    readDirEntriesSafe,
    buildLibrary,
    getLibraryCached,
    getLibraryCachedAsync,
    getLibraryCachedForRequestAsync,
    flushDurableCatalogCache:persistDurableCatalogNow,
    closeDurableCatalogCache,
    warmLibraryCache: getLibraryCachedAsync,
    getShelfTitleCatalog,
    getNovelByIdCachedAsync,
    scheduleLibraryRefresh,
    scheduleLibrarySignatureCheck,
    refreshLibraryCacheNow,
    refreshLibraryCacheAsync,
    invalidateLibraryCache,
    beginLibraryMutation,
    commitLibraryMutation,
    abortLibraryMutation,
    setLibraryMetaHeaders,
    sanitizeNodeName,
    normalizeTxtBaseName,
    safeJoinUnderLibrary,
    ensureExists,
    ensureNotExists,
    ensureDirExists,
    cleanupEmptyParents,
    categoryPathToRelDir,
    sendFsError,
    invalidatePathCaches,
    clearFileCachePath,
    clearAllFileCache,
    isSubPath,
    getNovelStorageInfo,
    getEpisodeStorageInfo,
    clearNovelCachesByInfo,
    getCacheStatus,
    recordNovelsApiPayloadMetrics
  };
}

module.exports = { LIBRARY_ASYNC_MUTATION_JOURNAL_PASS, createLibraryService, LIBRARY_CACHE_STRATEGY_PASS, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS, LIBRARY_CATALOG_PERFORMANCE_PASS, NOVELS_API_PAYLOAD_BUDGET_PASS, NOVELS_API_RESPONSE_CACHE_BUDGET_PASS, LIBRARY_STALE_WHILE_REVALIDATE_PASS, LIBRARY_SHELF_INDEX_PASS, LIBRARY_ASYNC_SIGNATURE_CHECK_PASS, LIBRARY_SIGNATURE_BACKOFF_PASS, LIBRARY_COMPLETE_SCAN_PASS, LIBRARY_ASYNC_BUILD_PASS, LIBRARY_REQUEST_STABILITY_PASS, LIBRARY_DURABLE_CATALOG_PASS, LIBRARY_COLD_FAILURE_BACKOFF_PASS };
