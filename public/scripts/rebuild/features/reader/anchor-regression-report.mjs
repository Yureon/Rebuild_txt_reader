import { CURRENT_BUILD_ID } from '../../version.mjs';
import { getChunkViewportState, getViewportAddress, getVirtualLayoutDiagnostics } from './virtual-layout.mjs';

export const READER_ANCHOR_REGRESSION_REPORT_PASS = 'v445-reader-anchor-regression-report-pass';
export const READER_ANCHOR_REPORT_LIVE_STATE_PASS = 'v451-reader-anchor-report-live-state-pass';

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function trimText(value, max = 1000) {
  return String(value || '').slice(0, max);
}

function resolveMode(app, diagnostics = null) {
  const c = app?.state?.current || null;
  if (c?.novel?.isMultiFile && c?.episode) return 'multi-file';
  const currentMode = diagnostics?.anchorTraceSummary?.currentMode || '';
  if (currentMode === 'multi-file' || currentMode === 'single-file') return currentMode;
  const trace = Array.isArray(diagnostics?.anchorTrace) ? diagnostics.anchorTrace : [];
  if (trace.some(event => event?.mode === 'multi-file')) return 'multi-file';
  const episodeCount = app?.state?.readerContext?.episodeCount ?? app?.state?.currentNovel?.episodes?.length ?? 0;
  return Number(episodeCount) > 1 ? 'multi-file' : 'single-file';
}

function readCurrent(app) {
  const reader = app?.els?.reader || null;
  const c = app?.state?.current || null;
  const context = app?.state?.readerContext || {};
  const currentNovel = app?.state?.currentNovel || c?.novel || {};
  const episode = c?.episode || null;
  return {
    pass: READER_ANCHOR_REPORT_LIVE_STATE_PASS,
    novelId: String(c?.novel?.id || context.novelId || currentNovel.id || ''),
    episodeId: String(episode?.id || context.episodeId || app?.state?.currentEpisodeId || ''),
    episodeIndex: safeNumber(c?.episodeIdx ?? context.episodeIndex ?? context.episodeIdx, 0),
    episodeCount: safeNumber(c?.novel?.episodes?.length ?? context.episodeCount ?? currentNovel.episodes?.length, 0),
    chunk: safeNumber(c?.chunk ?? context.chunk ?? app?.state?.currentChunk, 0),
    totalChunks: safeNumber(c?.totalChunks ?? context.totalChunks ?? app?.state?.totalChunks, 0),
    title: trimText(episode?.title || c?.title || context.title || currentNovel.title || '', 240),
    viewport: {
      scrollTop: Math.round(safeNumber(reader?.scrollTop, 0)),
      clientHeight: Math.round(safeNumber(reader?.clientHeight, 0)),
      scrollHeight: Math.round(safeNumber(reader?.scrollHeight, 0))
    }
  };
}

function readProgress(app) {
  const progress = app?.state?.progress || {};
  const readerProgress = app?.state?.readerProgress || {};
  let chunkState = null;
  let address = null;
  try { chunkState = getChunkViewportState(app); } catch { chunkState = null; }
  try { address = getViewportAddress(app); } catch { address = null; }
  const liveRatio = Number.isFinite(Number(chunkState?.ratio)) ? Number(chunkState.ratio) : null;
  const liveChunk = Number.isFinite(Number(chunkState?.chunk)) ? Number(chunkState.chunk) : null;
  const liveDocumentRatio = Number.isFinite(Number(address?.documentRatio)) ? Number(address.documentRatio) : null;
  return {
    pass: READER_ANCHOR_REPORT_LIVE_STATE_PASS,
    currentKey: String(progress.currentKey || readerProgress.currentKey || ''),
    chunk: safeNumber(liveChunk ?? progress.chunk ?? readerProgress.chunk, 0),
    ratio: safeNumber(liveRatio ?? progress.ratio ?? readerProgress.ratio, 0),
    documentRatio: safeNumber(liveDocumentRatio ?? progress.documentRatio ?? readerProgress.documentRatio, 0),
    viewportAddress: address ? {
      chunk: safeNumber(address.chunk, 0),
      blockIndex: safeNumber(address.blockIndex, -1),
      globalBlockIndex: safeNumber(address.globalBlockIndex, -1),
      charIndex: safeNumber(address.charIndex, 0),
      ratio: safeNumber(address.ratio, 0),
      documentRatio: safeNumber(address.documentRatio, 0)
    } : null,
    updatedAt: String(progress.updatedAt || readerProgress.updatedAt || ''),
    source: liveDocumentRatio != null || liveRatio != null ? 'live-viewport' : 'stored-progress'
  };
}

export function buildReaderAnchorRegressionReport(app, options = {}) {
  const virtualDiagnostics = getVirtualLayoutDiagnostics(app);
  const trace = Array.isArray(virtualDiagnostics.anchorTrace) ? virtualDiagnostics.anchorTrace.slice(-32) : [];
  return {
    pass: READER_ANCHOR_REGRESSION_REPORT_PASS,
    liveStatePass: READER_ANCHOR_REPORT_LIVE_STATE_PASS,
    version: CURRENT_BUILD_ID,
    exportedAt: new Date().toISOString(),
    mode: resolveMode(app, virtualDiagnostics),
    current: readCurrent(app),
    progress: readProgress(app),
    notes: trimText(options.notes || '', 1000),
    anchorTracePass: virtualDiagnostics.anchorTracePass || '',
    anchorTraceLowOverheadPass: virtualDiagnostics.anchorTraceLowOverheadPass || '',
    anchorTraceStats: virtualDiagnostics.anchorTraceStats || null,
    anchorTraceSummary: virtualDiagnostics.anchorTraceSummary || null,
    lastProgressPhaseReport: virtualDiagnostics.lastProgressPhaseReport || null,
    lastManifestAdoptionGuard: virtualDiagnostics.lastManifestAdoptionGuard || null,
    lastIpadScrollCoastRetain: virtualDiagnostics.lastIpadScrollCoastRetain || null,
    anchorTrace: trace,
    virtualDiagnostics
  };
}
