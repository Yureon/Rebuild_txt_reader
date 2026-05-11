const { ensurePlainObject, firstDefined, sanitizeTextValue, clampNumber } = require('./state-normalizer-core');

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
    Object.keys(input.byNovel).slice(0, 5000).forEach((novelId) => {
      const snap = normalizeProgressSnapshotInput(input.byNovel[novelId], novelId, null);
      if (snap) out.byNovel[snap.novelId] = snap;
    });
  }

  if (ensurePlainObject(input.readMeta)) {
    Object.keys(input.readMeta).slice(0, 10000).forEach((key) => {
      const rawKey = String(key || '');
      const dashIdx = rawKey.indexOf('-');
      const fallbackNovelId = dashIdx >= 0 ? rawKey.slice(0, dashIdx) : '';
      const fallbackEpisodeId = dashIdx >= 0 ? rawKey.slice(dashIdx + 1) : null;
      const snap = normalizeProgressSnapshotInput(input.readMeta[key], fallbackNovelId, fallbackEpisodeId);
      if (!snap) return;
      const normalizedKey = `${snap.novelId}-${snap.episodeId || 'single'}`;
      out.readMeta[normalizedKey] = snap;
    });
  }

  if (ensurePlainObject(input.positions)) {
    Object.keys(input.positions).slice(0, 20000).forEach((key) => {
      if (!/^pos-[^-]+-.+/.test(String(key || ''))) return;
      const normalized = normalizePositionValueInput(input.positions[key]);
      if (normalized == null) return;
      out.positions[String(key)] = normalized;
    });
  }

  return out;
}

module.exports = {
  normalizeProgressSnapshotInput,
  normalizePositionValueInput,
  normalizeProgressStateInput
};
