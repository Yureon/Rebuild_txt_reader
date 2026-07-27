import { clamp, formatPercent } from '../../core/utils.mjs';

const DEFAULT_BLOCKS_PER_CHUNK = 72;
export const READER_FULL_FILE_CHAR_PROGRESS_PASS = 'v472-reader-full-file-char-progress-pass';
export const READER_MANIFEST_BLOCK_CHAR_RANGES_PASS = 'v482-reader-manifest-block-char-ranges-pass';
export const READER_COORDINATE_EVICTION_PASS = 'v551-reader-coordinate-eviction-pass';

export function ensureCoordinateState(app) {
  if (!app.state.readerCoordinates) {
    app.state.readerCoordinates = createCoordinateState();
  }
  const coords = app.state.readerCoordinates;
  if (!(coords.blockCounts instanceof Map)) coords.blockCounts = new Map();
  if (!(coords.blockMeta instanceof Map)) coords.blockMeta = new Map();
  if (!(coords.manifestByChunk instanceof Map)) coords.manifestByChunk = new Map();
  if (!(coords.folderManifestByEpisode instanceof Map)) coords.folderManifestByEpisode = new Map();
  if (!Number.isFinite(Number(coords.averageBlocksPerChunk)) || Number(coords.averageBlocksPerChunk) <= 0) {
    coords.averageBlocksPerChunk = DEFAULT_BLOCKS_PER_CHUNK;
  }
  if (!Number.isFinite(Number(coords.totalKnownBlocks))) coords.totalKnownBlocks = 0;
  if (!Number.isFinite(Number(coords.knownChunkCount))) coords.knownChunkCount = 0;
  if (!Number.isFinite(Number(coords.totalManifestBlocks))) coords.totalManifestBlocks = 0;
  if (!Number.isFinite(Number(coords.totalManifestChars))) coords.totalManifestChars = 0;
  if (!Number.isFinite(Number(coords.revision))) coords.revision = 0;
  return coords;
}

function createCoordinateState() {
  return {
    blockCounts: new Map(),
    blockMeta: new Map(),
    manifest: null,
    manifestByChunk: new Map(),
    folderManifest: null,
    folderManifestByEpisode: new Map(),
    averageBlocksPerChunk: DEFAULT_BLOCKS_PER_CHUNK,
    totalKnownBlocks: 0,
    knownChunkCount: 0,
    totalManifestBlocks: 0,
    totalManifestChars: 0,
    revision: 0
  };
}

export function resetCoordinateState(app, { clearKnown = true, preserveFolderManifest = false } = {}) {
  const coords = ensureCoordinateState(app);
  const savedFolderManifest = preserveFolderManifest ? coords.folderManifest : null;
  const savedFolderManifestByEpisode = preserveFolderManifest && coords.folderManifestByEpisode instanceof Map ? new Map(coords.folderManifestByEpisode) : null;
  if (clearKnown) {
    coords.blockCounts.clear();
    coords.blockMeta.clear();
    coords.manifestByChunk.clear();
    coords.manifest = null;
    coords.folderManifestByEpisode.clear();
    coords.folderManifest = null;
    if (savedFolderManifest && savedFolderManifestByEpisode?.size) {
      coords.folderManifest = savedFolderManifest;
      coords.folderManifestByEpisode = savedFolderManifestByEpisode;
    }
    coords.averageBlocksPerChunk = DEFAULT_BLOCKS_PER_CHUNK;
    coords.totalKnownBlocks = 0;
    coords.knownChunkCount = 0;
    coords.totalManifestBlocks = 0;
    coords.totalManifestChars = 0;
  }
  coords.revision += 1;
  return coords;
}

export function applyBlockManifest(app, manifest = {}) {
  const chunks = Array.isArray(manifest.chunks) ? manifest.chunks : [];
  const normalized = chunks
    .map(row => normalizeManifestChunk(row))
    .filter(Boolean)
    .sort((a, b) => a.chunk - b.chunk);
  if (!normalized.length) return null;

  const coords = ensureCoordinateState(app);
  coords.blockCounts.clear();
  coords.blockMeta.clear();
  coords.manifestByChunk.clear();

  let totalBlocks = Math.max(0, Number(manifest.totalBlocks) || 0);
  let computedBlocks = 0;
  let maxCharEnd = 0;
  normalized.forEach(meta => {
    coords.blockCounts.set(meta.chunk, meta.blockCount);
    coords.blockMeta.set(meta.chunk, meta);
    coords.manifestByChunk.set(meta.chunk, meta);
    computedBlocks = Math.max(computedBlocks, meta.blockStart + meta.blockCount);
    maxCharEnd = Math.max(maxCharEnd, Number(meta.charEnd) || 0);
  });
  if (!totalBlocks) totalBlocks = computedBlocks;

  coords.manifest = {
    version: Number(manifest.version) || 1,
    novelId: manifest.novelId || '',
    episodeId: manifest.episodeId || null,
    sourceType: manifest.sourceType || '',
    preprocessSignature: manifest.preprocessSignature || '',
    contentHash: manifest.contentHash || '',
    statSignature: manifest.statSignature || '',
    totalChunks: Math.max(1, Number(manifest.totalChunks) || normalized.length),
    totalBlocks: Math.max(1, totalBlocks),
    generatedAt: Number(manifest.generatedAt) || 0
  };
  coords.totalKnownBlocks = Math.max(1, totalBlocks);
  coords.knownChunkCount = normalized.length;
  coords.totalManifestBlocks = Math.max(1, totalBlocks);
  coords.totalManifestChars = Math.max(0, Number(manifest.totalChars) || maxCharEnd);
  coords.averageBlocksPerChunk = Math.max(1, Math.round(coords.totalKnownBlocks / Math.max(1, coords.knownChunkCount)));
  coords.revision += 1;
  return coords.manifest;
}

function normalizeManifestChunk(row) {
  if (!row || typeof row !== 'object') return null;
  const chunk = Math.max(1, Math.round(Number(row.chunk) || 0));
  if (!chunk) return null;
  const blockStart = Math.max(0, Math.round(Number(row.blockStart) || 0));
  const blockCount = Math.max(1, Math.round(Number(row.blockCount) || 1));
  const charStart = Math.max(0, Math.round(Number(row.charStart) || 0));
  const charEnd = Math.max(charStart, Math.round(Number(row.charEnd) || charStart));
  const blocks = Array.isArray(row.blocks)
    ? row.blocks.map(block => normalizeManifestBlockRange(block, { charStart, charEnd })).filter(Boolean).sort((a, b) => a.index - b.index)
    : [];
  return { chunk, blockStart, blockCount, charStart, charEnd, blocks, blockCharRangesPass: blocks.length ? READER_MANIFEST_BLOCK_CHAR_RANGES_PASS : '', exact: true, source: 'manifest' };
}

function normalizeManifestBlockRange(block, chunk = {}) {
  if (!block || typeof block !== 'object') return null;
  const index = Math.max(0, Math.round(Number(block.index ?? block.blockIndex) || 0));
  const chunkCharStart = Math.max(0, Math.round(Number(chunk.charStart) || 0));
  const chunkCharEnd = Math.max(chunkCharStart, Math.round(Number(chunk.charEnd) || chunkCharStart));
  const hasLocalStart = Number.isFinite(Number(block.localCharStart));
  const hasLocalEnd = Number.isFinite(Number(block.localCharEnd));
  const localCharStart = Math.max(0, Math.round(hasLocalStart ? Number(block.localCharStart) : (Number(block.charStart) - chunkCharStart)) || 0);
  const localCharEnd = Math.max(localCharStart, Math.round(hasLocalEnd ? Number(block.localCharEnd) : (Number(block.charEnd) - chunkCharStart)) || localCharStart);
  const charStart = Math.max(chunkCharStart, Math.round(Number(block.charStart) || (chunkCharStart + localCharStart)));
  const charEnd = Math.max(charStart, Math.min(Math.max(charStart, Math.round(Number(block.charEnd) || (chunkCharStart + localCharEnd))), Math.max(charStart, chunkCharEnd || charStart)));
  return { index, blockIndex: index, localCharStart, localCharEnd, charStart, charEnd };
}

export function hasBlockManifest(app) {
  const coords = ensureCoordinateState(app);
  return !!coords.manifest && coords.manifestByChunk.size > 0 && coords.totalManifestBlocks > 0;
}

export function applyFolderBlockManifest(app, manifest = {}) {
  const episodes = Array.isArray(manifest.episodes) ? manifest.episodes : [];
  const normalized = episodes.map(row => normalizeFolderEpisode(row)).filter(Boolean).sort((a, b) => a.index - b.index);
  if (!normalized.length) return null;
  const coords = ensureCoordinateState(app);
  coords.folderManifestByEpisode.clear();
  let totalBlocks = Math.max(0, Number(manifest.totalBlocks) || 0);
  let totalChars = Math.max(0, Number(manifest.totalChars) || 0);
  let computedBlocks = 0;
  let computedChars = 0;
  normalized.forEach(meta => {
    coords.folderManifestByEpisode.set(meta.episodeId, meta);
    computedBlocks = Math.max(computedBlocks, meta.blockStart + meta.totalBlocks);
    computedChars = Math.max(computedChars, meta.charStart + meta.totalChars);
  });
  if (!totalBlocks) totalBlocks = computedBlocks;
  if (!totalChars) totalChars = computedChars;
  const partial = manifest.partial === true || String(manifest.scope || '').toLowerCase() === 'window';
  coords.folderManifest = {
    version: Number(manifest.version) || 1,
    novelId: manifest.novelId || '',
    sourceType: manifest.sourceType || 'multi',
    scope: partial ? 'window' : (String(manifest.scope || 'full') || 'full'),
    partial,
    totalsRepresent: String(manifest.totalsRepresent || (partial ? 'window' : 'full')),
    preprocessSignature: String(manifest.preprocessSignature || ''),
    totalEpisodes: Math.max(normalized.length, Math.round(Number(manifest.totalEpisodes) || normalized.length)),
    manifestedEpisodes: Math.max(normalized.length, Math.round(Number(manifest.manifestedEpisodes) || normalized.length)),
    windowStartIndex: Number.isFinite(Number(manifest.windowStartIndex)) ? Math.round(Number(manifest.windowStartIndex)) : (normalized[0]?.index ?? 0),
    windowEndIndex: Number.isFinite(Number(manifest.windowEndIndex)) ? Math.round(Number(manifest.windowEndIndex)) : (normalized[normalized.length - 1]?.index ?? 0),
    centerEpisodeIndex: Number.isFinite(Number(manifest.centerEpisodeIndex)) ? Math.round(Number(manifest.centerEpisodeIndex)) : -1,
    centerEpisodeId: String(manifest.centerEpisodeId || ''),
    radius: Math.max(0, Math.round(Number(manifest.radius) || 0)),
    totalChunks: Math.max(1, Number(manifest.totalChunks) || normalized.reduce((sum, ep) => sum + ep.totalChunks, 0)),
    totalBlocks: Math.max(1, totalBlocks),
    totalChars: Math.max(0, totalChars),
    windowTotalChunks: Math.max(1, Number(manifest.windowTotalChunks) || Number(manifest.totalChunks) || normalized.reduce((sum, ep) => sum + ep.totalChunks, 0)),
    windowTotalBlocks: Math.max(1, Number(manifest.windowTotalBlocks) || totalBlocks),
    windowTotalChars: Math.max(0, Number(manifest.windowTotalChars) || totalChars),
    episodes: normalized,
    generatedAt: Number(manifest.generatedAt) || 0
  };
  coords.revision += 1;
  return coords.folderManifest;
}

export function hasFolderBlockManifest(app) {
  const coords = ensureCoordinateState(app);
  return !!coords.folderManifest && coords.folderManifestByEpisode.size > 0 && coords.folderManifest.totalBlocks > 0;
}

function normalizeFolderEpisode(row) {
  if (!row || typeof row !== 'object') return null;
  const episodeId = String(row.episodeId || '').trim();
  if (!episodeId) return null;
  const chunks = Array.isArray(row.chunks) ? row.chunks.map(normalizeManifestChunk).filter(Boolean) : [];
  const totalBlocks = Math.max(1, Math.round(Number(row.totalBlocks) || chunks.reduce((max, chunk) => Math.max(max, chunk.blockStart + chunk.blockCount), 0) || 1));
  const totalChunks = Math.max(1, Math.round(Number(row.totalChunks) || chunks.length || 1));
  const totalChars = Math.max(0, Math.round(Number(row.totalChars) || chunks.reduce((max, chunk) => Math.max(max, chunk.charEnd), 0) || 0));
  return {
    episodeId,
    title: String(row.title || ''),
    index: Math.max(0, Math.round(Number(row.index) || 0)),
    blockStart: Math.max(0, Math.round(Number(row.blockStart) || 0)),
    charStart: Math.max(0, Math.round(Number(row.charStart) || 0)),
    totalChunks, totalBlocks, totalChars, chunks
  };
}

export function episodeRatioToFolderDocumentRatio(app, episodeId, localRatio = 0) {
  const coords = ensureCoordinateState(app);
  if (coords.folderManifest?.partial === true) return null;
  const meta = coords.folderManifestByEpisode.get(String(episodeId || ''));
  const totalBlocks = Math.max(1, Number(coords.folderManifest?.totalBlocks) || 0);
  if (!meta || !totalBlocks) return null;
  const local = clamp(Number(localRatio) || 0, 0, 1);
  return clamp((meta.blockStart + meta.totalBlocks * local) / totalBlocks, 0, 1);
}

export function folderRatioToEpisodeTarget(app, ratio = 0) {
  const coords = ensureCoordinateState(app);
  const manifest = coords.folderManifest;
  if (!manifest || manifest.partial === true || !Array.isArray(manifest.episodes) || !manifest.episodes.length) return null;
  const safe = clamp(Number(ratio) || 0, 0, 1);
  const totalBlocks = Math.max(1, Number(manifest.totalBlocks) || 1);
  const targetFolderBlock = clamp(Math.round(safe * Math.max(0, totalBlocks - 1)), 0, Math.max(0, totalBlocks - 1));
  let episode = manifest.episodes[manifest.episodes.length - 1];
  for (const candidate of manifest.episodes) {
    const start = Math.max(0, Number(candidate.blockStart) || 0);
    const end = start + Math.max(1, Number(candidate.totalBlocks) || 1);
    if (targetFolderBlock >= start && targetFolderBlock < end) { episode = candidate; break; }
  }
  const localBlock = clamp(targetFolderBlock - Math.max(0, Number(episode.blockStart) || 0), 0, Math.max(0, Number(episode.totalBlocks) - 1));
  let chunk = null;
  for (const meta of episode.chunks || []) {
    const start = Math.max(0, Number(meta.blockStart) || 0);
    const end = start + Math.max(1, Number(meta.blockCount) || 1);
    if (localBlock >= start && localBlock < end) { chunk = meta; break; }
  }
  const localRatio = clamp(localBlock / Math.max(1, Number(episode.totalBlocks) || 1), 0, 1);
  const blockIndex = chunk ? clamp(localBlock - Math.max(0, Number(chunk.blockStart) || 0), 0, Math.max(0, Number(chunk.blockCount) - 1)) : localBlock;
  return { episodeId: episode.episodeId, episodeIndex: episode.index, ratio: localRatio, documentRatio: safe, folderBlockIndex: targetFolderBlock, globalBlockIndex: localBlock, chunk: chunk ? chunk.chunk : 1, blockIndex };
}

export function registerChunkBlocks(app, chunk, blockCount) {
  const coords = ensureCoordinateState(app);
  const idx = Math.max(1, Number(chunk) || 1);
  const count = Math.max(1, Number(blockCount) || 1);
  coords.blockCounts.set(idx, count);
  const manifestMeta = coords.manifestByChunk.get(idx);
  if (manifestMeta) return manifestMeta;
  recomputeBlockMeta(app);
  return coords.blockMeta.get(idx) || { chunk: idx, blockStart: estimateChunkStart(app, idx), blockCount: count, exact: false };
}

export function pruneEstimatedCoordinateChunks(app, chunks = []) {
  const coords = ensureCoordinateState(app);
  const removed = Array.from(new Set((Array.isArray(chunks) ? chunks : [])
    .map(chunk => Math.max(1, Math.round(Number(chunk) || 0)))
    .filter(chunk => chunk > 0)))
    .sort((a, b) => a - b);
  if (!removed.length) {
    return { pass: READER_COORDINATE_EVICTION_PASS, pruned: 0, skipped: 'empty' };
  }
  if (hasBlockManifest(app)) {
    coords.lastCoordinateEviction = {
      pass: READER_COORDINATE_EVICTION_PASS,
      pruned: 0,
      skipped: 'exact-manifest',
      requested: removed,
      blockCountsSize: coords.blockCounts.size,
      blockMetaSize: coords.blockMeta.size,
      manifestByChunkSize: coords.manifestByChunk.size,
      at: Date.now()
    };
    return coords.lastCoordinateEviction;
  }

  let pruned = 0;
  removed.forEach(chunk => {
    const hadBlockCount = coords.blockCounts.delete(chunk);
    const hadBlockMeta = coords.blockMeta.delete(chunk);
    const hadManifestMeta = coords.manifestByChunk.delete(chunk);
    if (hadBlockCount || hadBlockMeta || hadManifestMeta) pruned += 1;
  });

  if (pruned > 0) recomputeBlockMeta(app);
  coords.lastCoordinateEviction = {
    pass: READER_COORDINATE_EVICTION_PASS,
    pruned,
    removed,
    blockCountsSize: coords.blockCounts.size,
    blockMetaSize: coords.blockMeta.size,
    manifestByChunkSize: coords.manifestByChunk.size,
    exactManifest: false,
    at: Date.now()
  };
  return coords.lastCoordinateEviction;
}

export function recomputeBlockMeta(app) {
  const coords = ensureCoordinateState(app);
  if (hasBlockManifest(app)) {
    coords.revision += 1;
    return coords;
  }
  const entries = Array.from(coords.blockCounts.entries()).sort((a, b) => a[0] - b[0]);
  coords.blockMeta.clear();
  coords.totalKnownBlocks = entries.reduce((sum, [, count]) => sum + Math.max(1, Number(count) || 1), 0);
  coords.knownChunkCount = entries.length;
  coords.averageBlocksPerChunk = coords.knownChunkCount
    ? Math.max(1, Math.round(coords.totalKnownBlocks / coords.knownChunkCount))
    : DEFAULT_BLOCKS_PER_CHUNK;

  let prev = null;
  entries.forEach(([chunk, blockCount]) => {
    let blockStart;
    let exact = false;
    if (chunk === 1) {
      blockStart = 0;
      exact = true;
    } else if (prev) {
      const gap = Math.max(0, chunk - prev.chunk - 1);
      blockStart = prev.blockStart + prev.blockCount + gap * coords.averageBlocksPerChunk;
      exact = prev.exact && gap === 0;
    } else {
      blockStart = (chunk - 1) * coords.averageBlocksPerChunk;
    }
    const meta = { chunk, blockStart: Math.max(0, Math.round(blockStart)), blockCount: Math.max(1, blockCount), exact };
    coords.blockMeta.set(chunk, meta);
    prev = meta;
  });
  coords.revision += 1;
  return coords;
}

export function decorateRowsWithGlobalBlocks(app, rows) {
  const coords = ensureCoordinateState(app);
  return rows.map(row => {
    if (row.type !== 'body') return row;
    const meta = coords.blockMeta.get(Number(row.chunk));
    const blockStart = meta ? meta.blockStart : estimateChunkStart(app, Number(row.chunk));
    const local = Math.max(0, Number(row.blockIndex) || 0);
    const blockRange = findManifestBlockRange(meta, local);
    const fallbackFileCharStart = meta ? Math.max(0, Number(meta.charStart) || 0) + Math.max(0, Number(row.start) || 0) : null;
    const fallbackFileCharEnd = meta ? Math.max(fallbackFileCharStart || 0, Math.max(0, Number(meta.charStart) || 0) + Math.max(0, Number(row.end) || 0)) : null;
    const fileCharStart = Number.isFinite(Number(blockRange?.charStart)) ? Number(blockRange.charStart) : fallbackFileCharStart;
    const fileCharEnd = Number.isFinite(Number(blockRange?.charEnd)) ? Number(blockRange.charEnd) : fallbackFileCharEnd;
    return {
      ...row,
      globalBlockIndex: blockStart + local,
      globalBlockEstimated: !meta || !meta.exact,
      fileCharStart: Number.isFinite(Number(fileCharStart)) ? Math.max(0, Math.round(Number(fileCharStart))) : null,
      fileCharEnd: Number.isFinite(Number(fileCharEnd)) ? Math.max(0, Math.round(Number(fileCharEnd))) : null,
      manifestBlockCharRangesPass: blockRange ? READER_MANIFEST_BLOCK_CHAR_RANGES_PASS : ''
    };
  });
}

function findManifestBlockRange(meta, blockIndex) {
  const list = Array.isArray(meta?.blocks) ? meta.blocks : [];
  if (!list.length) return null;
  const idx = Math.max(0, Math.round(Number(blockIndex) || 0));
  return list.find(block => Math.max(0, Number(block.index) || 0) === idx) || null;
}

export function getAverageBlocksPerChunk(app) {
  return ensureCoordinateState(app).averageBlocksPerChunk || DEFAULT_BLOCKS_PER_CHUNK;
}

export function estimateTotalBlocks(app) {
  const coords = ensureCoordinateState(app);
  if (coords.totalManifestBlocks > 0) return Math.max(1, Math.round(coords.totalManifestBlocks));
  const c = app.state.current;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  if (coords.blockCounts.size >= totalChunks) {
    let sum = 0;
    for (let chunk = 1; chunk <= totalChunks; chunk += 1) sum += Math.max(1, Number(coords.blockCounts.get(chunk)) || 1);
    return Math.max(1, sum);
  }
  return Math.max(1, Math.round(totalChunks * getAverageBlocksPerChunk(app)));
}

export function estimateChunkStart(app, chunk) {
  const coords = ensureCoordinateState(app);
  const idx = Math.max(1, Number(chunk) || 1);
  const exactMeta = coords.blockMeta.get(idx);
  if (exactMeta) return exactMeta.blockStart;

  const lower = Array.from(coords.blockMeta.values())
    .filter(meta => meta.chunk < idx)
    .sort((a, b) => b.chunk - a.chunk)[0];
  if (lower) {
    const gap = Math.max(0, idx - lower.chunk - 1);
    return Math.max(0, Math.round(lower.blockStart + lower.blockCount + gap * getAverageBlocksPerChunk(app)));
  }
  return Math.max(0, Math.round((idx - 1) * getAverageBlocksPerChunk(app)));
}

export function resolveGlobalBlock(app, globalBlockIndex) {
  const c = app.state.current;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  const totalBlocks = estimateTotalBlocks(app);
  const target = clamp(Math.round(Number(globalBlockIndex) || 0), 0, Math.max(0, totalBlocks - 1));
  const coords = ensureCoordinateState(app);

  for (const meta of Array.from(coords.blockMeta.values()).sort((a, b) => a.blockStart - b.blockStart)) {
    const start = meta.blockStart;
    const end = start + meta.blockCount;
    if (target >= start && target < end) {
      return { chunk: meta.chunk, blockIndex: target - start, globalBlockIndex: target, exact: !!meta.exact };
    }
  }

  const avg = getAverageBlocksPerChunk(app);
  const chunk = clamp(Math.floor(target / avg) + 1, 1, totalChunks);
  const local = clamp(target - estimateChunkStart(app, chunk), 0, Math.max(0, avg - 1));
  return { chunk, blockIndex: local, globalBlockIndex: target, exact: false };
}

export function ratioToChunkTarget(app, ratio) {
  const c = app.state.current;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  const safe = clamp(Number(ratio) || 0, 0, 1);
  const coords = ensureCoordinateState(app);
  if (hasBlockManifest(app) && coords.totalManifestChars > 0) {
    const targetChar = clamp(Math.round(safe * Math.max(0, coords.totalManifestChars - 1)), 0, Math.max(0, coords.totalManifestChars - 1));
    let meta = Array.from(coords.manifestByChunk.values()).sort((a, b) => a.chunk - b.chunk).find(item => targetChar >= item.charStart && targetChar < Math.max(item.charStart + 1, item.charEnd));
    if (!meta) meta = safe >= 0.999 ? Array.from(coords.manifestByChunk.values()).sort((a, b) => b.chunk - a.chunk)[0] : coords.manifestByChunk.get(1);
    if (meta) {
      const chunkChars = Math.max(1, Number(meta.charEnd) - Number(meta.charStart) || 1);
      const localChar = clamp(targetChar - Number(meta.charStart), 0, chunkChars);
      const localRatio = clamp(localChar / chunkChars, 0, 1);
      const blockIndex = clamp(Math.floor(localRatio * Math.max(1, meta.blockCount)), 0, Math.max(0, meta.blockCount - 1));
      const globalBlockIndex = clamp(meta.blockStart + blockIndex, 0, Math.max(0, estimateTotalBlocks(app) - 1));
      coords.lastFullFileCharProgress = { pass: READER_FULL_FILE_CHAR_PROGRESS_PASS, source: 'ratio-target', ratio: safe, chunk: meta.chunk, targetChar, localChar, localRatio, blockIndex, globalBlockIndex, at: Date.now() };
      return { chunk: meta.chunk, blockIndex, globalBlockIndex, charIndex: localChar, ratio: localRatio, documentRatio: safe, charProgressPass: READER_FULL_FILE_CHAR_PROGRESS_PASS };
    }
  }
  if (hasBlockManifest(app)) {
    const totalBlocks = estimateTotalBlocks(app);
    const globalBlockIndex = clamp(Math.round(safe * Math.max(0, totalBlocks - 1)), 0, Math.max(0, totalBlocks - 1));
    const target = resolveGlobalBlock(app, globalBlockIndex);
    const meta = coords.blockMeta.get(target.chunk);
    const chunkRatio = meta ? clamp(target.blockIndex / Math.max(1, meta.blockCount), 0, 1) : 0;
    return { ...target, ratio: chunkRatio, documentRatio: safe };
  }
  const scaled = safe * totalChunks;
  const chunk = clamp(Math.floor(scaled) + 1, 1, totalChunks);
  const chunkRatio = chunk >= totalChunks && safe >= 1 ? 1 : clamp(scaled - (chunk - 1), 0, 1);
  return { chunk, ratio: chunkRatio, documentRatio: safe };
}

export function chunkStateToDocumentRatio(app, chunk, chunkRatio = 0) {
  const c = app.state.current;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  const idx = clamp(Number(chunk) || 1, 1, totalChunks);
  const coords = ensureCoordinateState(app);
  const meta = coords.blockMeta.get(idx);
  if (meta && hasBlockManifest(app) && coords.totalManifestChars > 0) {
    const safeRatio = clamp(chunkRatio, 0, 1);
    const chunkChars = Math.max(1, Number(meta.charEnd) - Number(meta.charStart) || 1);
    const charPosition = Number(meta.charStart) + chunkChars * safeRatio;
    coords.lastFullFileCharProgress = { pass: READER_FULL_FILE_CHAR_PROGRESS_PASS, source: 'chunk-state', chunk: idx, chunkRatio: safeRatio, charPosition: Math.round(charPosition), totalChars: coords.totalManifestChars, at: Date.now() };
    return clamp(charPosition / Math.max(1, coords.totalManifestChars), 0, 1);
  }
  if (meta && hasBlockManifest(app)) {
    const safeRatio = clamp(chunkRatio, 0, 1);
    const blockPosition = meta.blockStart + meta.blockCount * safeRatio;
    return clamp(blockPosition / Math.max(1, estimateTotalBlocks(app)), 0, 1);
  }
  return clamp(((idx - 1) + clamp(chunkRatio, 0, 1)) / totalChunks, 0, 1);
}

export function addressToDocumentRatio(app, address = {}) {
  if (Number.isFinite(Number(address.documentRatio))) {
    return clamp(Number(address.documentRatio), 0, 1);
  }
  if (Number.isFinite(Number(address.chunk)) && Number.isFinite(Number(address.charIndex))) {
    const byChar = chunkCharToDocumentRatio(app, address.chunk, address.charIndex, address.chunkTextLength || 0);
    if (Number.isFinite(Number(byChar))) return clamp(byChar, 0, 1);
  }
  if (Number.isFinite(Number(address.globalBlockIndex))) {
    return clamp(Number(address.globalBlockIndex) / Math.max(1, estimateTotalBlocks(app) - 1), 0, 1);
  }
  return chunkStateToDocumentRatio(app, address.chunk, address.ratio || 0);
}

export function chunkCharToDocumentRatio(app, chunk, charIndex = 0, chunkTextLength = 0) {
  const coords = ensureCoordinateState(app);
  const idx = Math.max(1, Number(chunk) || 1);
  const meta = coords.blockMeta.get(idx);
  if (meta && hasBlockManifest(app) && coords.totalManifestChars > 0) {
    const chunkChars = Math.max(1, Number(meta.charEnd) - Number(meta.charStart) || Number(chunkTextLength) || 1);
    const absoluteChar = Number(meta.charStart) + clamp(Number(charIndex) || 0, 0, chunkChars);
    return clamp(absoluteChar / Math.max(1, coords.totalManifestChars), 0, 1);
  }
  const c = app.state.current;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  const localRatio = clamp(Number(charIndex) / Math.max(1, Number(chunkTextLength) || 1), 0, 1);
  return clamp(((idx - 1) + localRatio) / totalChunks, 0, 1);
}


export function chunkCharToFileChar(app, chunk, charIndex = 0) {
  const coords = ensureCoordinateState(app);
  const idx = Math.max(1, Number(chunk) || 1);
  const meta = coords.manifestByChunk.get(idx);
  if (!meta) return null;
  const chunkChars = Math.max(1, Number(meta.charEnd) - Number(meta.charStart) || 1);
  return Math.max(0, Math.round(Number(meta.charStart) + clamp(Number(charIndex) || 0, 0, chunkChars)));
}

export function fileCharToDocumentRatio(app, fileCharIndex = 0) {
  const coords = ensureCoordinateState(app);
  const totalChars = Math.max(0, Number(coords.totalManifestChars) || 0);
  if (!totalChars) return null;
  const target = clamp(Number(fileCharIndex) || 0, 0, totalChars);
  coords.lastFullFileCharProgress = {
    pass: READER_FULL_FILE_CHAR_PROGRESS_PASS,
    source: 'file-char',
    fileCharIndex: Math.round(target),
    totalChars,
    at: Date.now()
  };
  return clamp(target / Math.max(1, totalChars), 0, 1);
}

export function fileCharToChunkAddress(app, fileCharIndex = 0) {
  const coords = ensureCoordinateState(app);
  const targetChar = Math.max(0, Math.round(Number(fileCharIndex) || 0));
  const metas = Array.from(coords.manifestByChunk.values()).sort((a, b) => a.chunk - b.chunk);
  if (!metas.length) return null;
  let meta = metas.find(item => targetChar >= Number(item.charStart) && targetChar < Math.max(Number(item.charStart) + 1, Number(item.charEnd)));
  if (!meta) meta = targetChar >= Number(metas[metas.length - 1].charEnd) ? metas[metas.length - 1] : metas[0];
  if (!meta) return null;
  const chunkChars = Math.max(1, Number(meta.charEnd) - Number(meta.charStart) || 1);
  const charIndex = clamp(targetChar - Number(meta.charStart), 0, chunkChars);
  const blockRange = Array.isArray(meta.blocks) ? meta.blocks.find(block => targetChar >= Number(block.charStart) && targetChar < Math.max(Number(block.charStart) + 1, Number(block.charEnd))) : null;
  const blockIndex = blockRange ? Math.max(0, Number(blockRange.index) || 0) : clamp(Math.floor((charIndex / chunkChars) * Math.max(1, Number(meta.blockCount) || 1)), 0, Math.max(0, Number(meta.blockCount) - 1));
  return {
    chunk: meta.chunk,
    charIndex,
    fileCharIndex: targetChar,
    blockIndex,
    globalBlockIndex: Math.max(0, Number(meta.blockStart) || 0) + blockIndex,
    ratio: clamp(charIndex / chunkChars, 0, 1),
    blockCharRangesPass: blockRange ? READER_MANIFEST_BLOCK_CHAR_RANGES_PASS : ''
  };
}

export function formatDocumentPosition(app, address = {}) {
  const ratio = addressToDocumentRatio(app, address);
  const global = Number.isFinite(Number(address.globalBlockIndex)) ? Number(address.globalBlockIndex) : null;
  const blockText = global != null && global >= 0 ? `블럭 ${global + 1}` : '블럭 -';
  return `${formatPercent(ratio, 1)} · ${blockText}`;
}
