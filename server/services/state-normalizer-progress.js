const { ensurePlainObject, isSafeRecordKey, firstDefined, sanitizeTextValue, clampNumber } = require('./state-normalizer-core');

const PROGRESS_RETENTION_PASS = 'v671-progress-recency-retention-pass';
const V675_PROGRESS_INCREMENTAL_MERGE_PASS = 'v675-progress-incremental-merge-pass';
const PROGRESS_RUNTIME_META = Symbol('progressRuntimeMeta');
const PROGRESS_PRUNE_SLACK = 256;
const MAX_PROGRESS_NOVELS = 20000;
const MAX_PROGRESS_READ_META = 40000;
const MAX_PROGRESS_POSITIONS = 80000;

function boundedRecentEntries(record, limit, timestampOf, protectedKeys = null) {
  const entries = Object.entries(record || {});
  if (entries.length <= limit) return entries;
  const protectedSet = protectedKeys instanceof Set ? protectedKeys : new Set(Array.isArray(protectedKeys) ? protectedKeys.map(String) : []);
  return entries
    .map(([key, value], index) => ({ key, value, index, protected:protectedSet.has(String(key)), ts:Math.max(0, Number(timestampOf(value, key)) || 0) }))
    .sort((a, b) => Number(b.protected) - Number(a.protected) || b.ts - a.ts || b.index - a.index || String(b.key).localeCompare(String(a.key)))
    .slice(0, limit)
    .sort((a, b) => a.index - b.index)
    .map(item => [item.key, item.value]);
}

function snapshotTimestamp(value) {
  return Math.max(0, Number(value && (value.ts || value.sourceSavedAt)) || 0);
}

function positionTimestamp(value) {
  return ensurePlainObject(value) ? Math.max(0, Number(value.ts) || 0) : 0;
}

function normalizeProgressSnapshotInput(input, fallbackNovelId, fallbackEpisodeId) {
  if (!ensurePlainObject(input)) return null;
  const novelId = sanitizeTextValue(input.novelId || fallbackNovelId, 160, '');
  if (!novelId) return null;
  const episodeIdRaw = input.episodeId == null || input.episodeId === '' || input.episodeId === 'single'
    ? (fallbackEpisodeId == null || fallbackEpisodeId === '' || fallbackEpisodeId === 'single' ? null : fallbackEpisodeId)
    : input.episodeId;
  const episodeId = episodeIdRaw == null ? null : sanitizeTextValue(episodeIdRaw, 160, '');

  const snap = {
    novelId,
    episodeId: episodeId || null,
    episodeIdx: Math.max(0, Math.floor(clampNumber(input.episodeIdx, 0, 100000, 0))),
    chunk: Math.max(1, Math.floor(clampNumber(firstDefined(input.chunk, input.fallbackChunk), 1, 1000000, 1))),
    totalChunks: Math.max(1, Math.floor(clampNumber(input.totalChunks, 1, 1000000, 1))),
    ratio: clampNumber(firstDefined(input.ratio, input.fallbackRatio, input.documentRatio), 0, 1, 0),
    ts: Math.max(0, Math.floor(clampNumber(input.ts, 0, Date.now() + 86400000, 0))),
    sourceDeviceId: sanitizeTextValue(input.sourceDeviceId, 120, ''),
    sourceDeviceName: sanitizeTextValue(input.sourceDeviceName, 120, ''),
    sourceSavedAt: Math.max(0, Math.floor(clampNumber(input.sourceSavedAt, 0, Date.now() + 86400000, 0)))
  };

  if (Number.isFinite(Number(input.globalBlockIndex))) {
    snap.globalBlockIndex = Math.max(0, Math.floor(clampNumber(input.globalBlockIndex, 0, 100000000, 0)));
  }
  if (Number.isFinite(Number(input.blockIndex))) {
    snap.blockIndex = Math.max(0, Math.floor(clampNumber(input.blockIndex, 0, 1000000, 0)));
  }
  if (Number.isFinite(Number(input.charIndex))) {
    snap.charIndex = Math.max(0, Math.floor(clampNumber(input.charIndex, 0, 100000000, 0)));
  }
  if (Number.isFinite(Number(input.documentRatio))) {
    snap.documentRatio = clampNumber(input.documentRatio, 0, 1, snap.ratio);
  }
  if (Number.isFinite(Number(input.episodeDocumentRatio))) {
    snap.episodeDocumentRatio = clampNumber(input.episodeDocumentRatio, 0, 1, snap.documentRatio ?? snap.ratio);
  }
  if (Number.isFinite(Number(input.fileCharIndex))) {
    snap.fileCharIndex = Math.max(0, Math.floor(clampNumber(input.fileCharIndex, 0, 1000000000, 0)));
  }
  const coordinatePolicyPass = sanitizeTextValue(input.coordinatePolicyPass, 120, '');
  if (coordinatePolicyPass) snap.coordinatePolicyPass = coordinatePolicyPass;
  const progressCoordinateScopeFixPass = sanitizeTextValue(input.progressCoordinateScopeFixPass, 120, '');
  if (progressCoordinateScopeFixPass) snap.progressCoordinateScopeFixPass = progressCoordinateScopeFixPass;

  return snap;
}

function normalizePositionValueInput(value) {
  if (ensurePlainObject(value)) {
    const out = {};
    if (Number.isFinite(Number(value.globalBlockIndex))) out.globalBlockIndex = Math.max(0, Math.floor(clampNumber(value.globalBlockIndex, 0, 100000000, 0)));
    if (Number.isFinite(Number(value.documentRatio))) out.documentRatio = clampNumber(value.documentRatio, 0, 1, 0);
    if (Number.isFinite(Number(value.fallbackChunk))) out.fallbackChunk = Math.max(1, Math.floor(clampNumber(value.fallbackChunk, 1, 1000000, 1)));
    if (Number.isFinite(Number(value.fallbackRatio))) out.fallbackRatio = clampNumber(value.fallbackRatio, 0, 1, 0);
    if (Number.isFinite(Number(value.chunk))) out.chunk = Math.max(1, Math.floor(clampNumber(value.chunk, 1, 1000000, 1)));
    if (Number.isFinite(Number(value.ratio))) out.ratio = clampNumber(value.ratio, 0, 1, 0);
    if (Number.isFinite(Number(value.ts))) out.ts = Math.max(0, Math.floor(clampNumber(value.ts, 0, Date.now() + 86400000, 0)));
    return Object.keys(out).length ? out : null;
  }
  const ratio = clampNumber(value, 0, 1, NaN);
  if (!Number.isFinite(ratio)) return null;
  return ratio.toFixed(4);
}

function normalizeProgressStateInput(input) {
  const out = {
    lastRead: null,
    byNovel: {},
    positions: {},
    readMeta: {}
  };
  if (!ensurePlainObject(input)) return out;

  const lastRead = normalizeProgressSnapshotInput(input.lastRead, null, null);
  if (lastRead) out.lastRead = lastRead;

  if (ensurePlainObject(input.byNovel)) {
    boundedRecentEntries(input.byNovel, MAX_PROGRESS_NOVELS, snapshotTimestamp).forEach(([novelId]) => {
      const snap = normalizeProgressSnapshotInput(input.byNovel[novelId], novelId, null);
      if (snap && isSafeRecordKey(snap.novelId)) out.byNovel[snap.novelId] = snap;
    });
  }

  if (ensurePlainObject(input.readMeta)) {
    boundedRecentEntries(input.readMeta, MAX_PROGRESS_READ_META, snapshotTimestamp).forEach(([key]) => {
      const rawKey = String(key || '');
      const dashIdx = rawKey.indexOf('-');
      const fallbackNovelId = dashIdx >= 0 ? rawKey.slice(0, dashIdx) : '';
      const fallbackEpisodeId = dashIdx >= 0 ? rawKey.slice(dashIdx + 1) : null;
      const snap = normalizeProgressSnapshotInput(input.readMeta[key], fallbackNovelId, fallbackEpisodeId);
      if (!snap) return;
      const normalizedKey = `${snap.novelId}-${snap.episodeId || 'single'}`;
      if (isSafeRecordKey(normalizedKey)) out.readMeta[normalizedKey] = snap;
    });
  }

  if (ensurePlainObject(input.positions)) {
    boundedRecentEntries(input.positions, MAX_PROGRESS_POSITIONS, positionTimestamp).forEach(([key]) => {
      if (!/^pos-[^-]+-.+/.test(String(key || ''))) return;
      const normalized = normalizePositionValueInput(input.positions[key]);
      if (normalized == null) return;
      if (isSafeRecordKey(String(key))) out.positions[String(key)] = normalized;
    });
  }

  return out;
}


function ensureProgressRuntimeMeta(progress) {
  if (!ensurePlainObject(progress)) return { byNovel:0, readMeta:0, positions:0 };
  let meta = progress[PROGRESS_RUNTIME_META];
  if (!meta) {
    meta = {
      byNovel:Object.keys(progress.byNovel || {}).length,
      readMeta:Object.keys(progress.readMeta || {}).length,
      positions:Object.keys(progress.positions || {}).length
    };
    try { Object.defineProperty(progress, PROGRESS_RUNTIME_META, { value:meta, enumerable:false, configurable:true }); }
    catch { progress[PROGRESS_RUNTIME_META] = meta; }
  }
  return meta;
}

function touchRecord(record, key, value, meta, metaKey) {
  const normalizedKey = String(key || '');
  if (!normalizedKey) return;
  const existed = Object.prototype.hasOwnProperty.call(record, normalizedKey);
  if (existed) delete record[normalizedKey];
  record[normalizedKey] = value;
  if (!existed) meta[metaKey] += 1;
}

function pruneRecordByInsertion(record, limit, meta, metaKey, protectedKeys = []) {
  if (meta[metaKey] <= limit + PROGRESS_PRUNE_SLACK) return 0;
  const protectedSet = new Set(protectedKeys.map(String));
  let toRemove = Math.max(0, meta[metaKey] - limit);
  let removed = 0;
  for (const key of Object.keys(record)) {
    if (toRemove <= 0) break;
    if (protectedSet.has(String(key))) continue;
    delete record[key];
    toRemove -= 1;
    removed += 1;
  }
  meta[metaKey] = Math.max(0, meta[metaKey] - removed);
  return removed;
}

function mergeProgressSnapshotDeltaIncremental(progressInput, snapshotInput, routeNovelId = '') {
  const progress = ensurePlainObject(progressInput) ? progressInput : normalizeProgressStateInput(progressInput);
  if (!ensurePlainObject(progress.byNovel)) progress.byNovel = {};
  if (!ensurePlainObject(progress.readMeta)) progress.readMeta = {};
  if (!ensurePlainObject(progress.positions)) progress.positions = {};
  const routeId = sanitizeTextValue(routeNovelId, 160, '');
  const snapshot = normalizeProgressSnapshotInput(snapshotInput, routeId, snapshotInput && snapshotInput.episodeId);
  if (!snapshot || !routeId || snapshot.novelId !== routeId || !isSafeRecordKey(routeId)) return null;
  const episodeKey = snapshot.episodeId || 'single';
  const readMetaKey = `${snapshot.novelId}-${episodeKey}`;
  const basePositionKey = `pos-${snapshot.novelId}-${episodeKey}`;
  const chunkPositionKey = `${basePositionKey}-${snapshot.chunk}`;
  const localDocumentRatio = clampNumber(
    firstDefined(snapshot.episodeDocumentRatio, snapshot.documentRatio, snapshot.ratio),
    0,
    1,
    snapshot.ratio
  );
  const meta = ensureProgressRuntimeMeta(progress);
  progress.lastRead = snapshot;
  touchRecord(progress.byNovel, snapshot.novelId, snapshot, meta, 'byNovel');
  if (isSafeRecordKey(readMetaKey)) touchRecord(progress.readMeta, readMetaKey, { ...snapshot, documentRatio:localDocumentRatio }, meta, 'readMeta');
  if (isSafeRecordKey(basePositionKey)) {
    touchRecord(progress.positions, basePositionKey, {
      ...(Number.isFinite(Number(snapshot.globalBlockIndex)) ? { globalBlockIndex:snapshot.globalBlockIndex } : {}),
      documentRatio:localDocumentRatio,
      fallbackChunk:snapshot.chunk,
      fallbackRatio:snapshot.ratio,
      ts:snapshot.ts
    }, meta, 'positions');
  }
  if (isSafeRecordKey(chunkPositionKey)) touchRecord(progress.positions, chunkPositionKey, snapshot.ratio.toFixed(4), meta, 'positions');
  pruneRecordByInsertion(progress.byNovel, MAX_PROGRESS_NOVELS, meta, 'byNovel', [snapshot.novelId]);
  pruneRecordByInsertion(progress.readMeta, MAX_PROGRESS_READ_META, meta, 'readMeta', [readMetaKey]);
  pruneRecordByInsertion(progress.positions, MAX_PROGRESS_POSITIONS, meta, 'positions', [basePositionKey, chunkPositionKey]);
  return { progress, snapshot, readMetaKey, positionKeys:[basePositionKey, chunkPositionKey], pass:V675_PROGRESS_INCREMENTAL_MERGE_PASS };
}

function mergeProgressSnapshotDelta(progressInput, snapshotInput, routeNovelId = '') {
  const progress = normalizeProgressStateInput(progressInput);
  const routeId = sanitizeTextValue(routeNovelId, 160, '');
  const snapshot = normalizeProgressSnapshotInput(snapshotInput, routeId, snapshotInput && snapshotInput.episodeId);
  if (!snapshot || !routeId || snapshot.novelId !== routeId || !isSafeRecordKey(routeId)) return null;
  const episodeKey = snapshot.episodeId || 'single';
  const readMetaKey = `${snapshot.novelId}-${episodeKey}`;
  const basePositionKey = `pos-${snapshot.novelId}-${episodeKey}`;
  const chunkPositionKey = `${basePositionKey}-${snapshot.chunk}`;
  const localDocumentRatio = clampNumber(
    firstDefined(snapshot.episodeDocumentRatio, snapshot.documentRatio, snapshot.ratio),
    0,
    1,
    snapshot.ratio
  );
  progress.lastRead = snapshot;
  progress.byNovel[snapshot.novelId] = snapshot;
  if (isSafeRecordKey(readMetaKey)) progress.readMeta[readMetaKey] = { ...snapshot, documentRatio:localDocumentRatio };
  if (isSafeRecordKey(basePositionKey)) {
    progress.positions[basePositionKey] = {
      ...(Number.isFinite(Number(snapshot.globalBlockIndex)) ? { globalBlockIndex:snapshot.globalBlockIndex } : {}),
      documentRatio:localDocumentRatio,
      fallbackChunk:snapshot.chunk,
      fallbackRatio:snapshot.ratio,
      ts:snapshot.ts
    };
  }
  if (isSafeRecordKey(chunkPositionKey)) progress.positions[chunkPositionKey] = snapshot.ratio.toFixed(4);
  progress.byNovel = Object.fromEntries(boundedRecentEntries(progress.byNovel, MAX_PROGRESS_NOVELS, snapshotTimestamp, new Set([snapshot.novelId])));
  progress.readMeta = Object.fromEntries(boundedRecentEntries(progress.readMeta, MAX_PROGRESS_READ_META, snapshotTimestamp, new Set([readMetaKey])));
  progress.positions = Object.fromEntries(boundedRecentEntries(progress.positions, MAX_PROGRESS_POSITIONS, positionTimestamp, new Set([basePositionKey, chunkPositionKey])));
  return { progress, snapshot, readMetaKey, positionKeys:[basePositionKey, chunkPositionKey] };
}

module.exports = {
  normalizeProgressSnapshotInput,
  normalizePositionValueInput,
  normalizeProgressStateInput,
  mergeProgressSnapshotDelta,
  mergeProgressSnapshotDeltaIncremental,
  V675_PROGRESS_INCREMENTAL_MERGE_PASS,
  PROGRESS_RETENTION_PASS,
  MAX_PROGRESS_NOVELS,
  MAX_PROGRESS_READ_META,
  MAX_PROGRESS_POSITIONS
};
