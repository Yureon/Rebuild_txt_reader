import { clamp, formatPercent } from '../../core/utils.mjs';
import { persistBookData, persistProgress } from '../../state/app-state.mjs';
import { getChunkViewportState, getViewportAddress } from './virtual-layout.mjs';
import { chunkStateToDocumentRatio, episodeRatioToFolderDocumentRatio, formatDocumentPosition } from './coordinates.mjs';
import { scheduleSafeAreaCollisionFit } from '../ui/viewport-fit.mjs';

export const READER_LIVE_SCROLL_PROGRESS_PASS = 'v464-reader-live-scroll-progress-pass';
export const READER_COORDINATE_POLICY_V470_PASS = 'v470-reader-coordinate-policy-pass';
export const READER_SLIDER_FILE_CHAR_PROGRESS_PASS = 'v485-reader-slider-file-char-progress-pass';
export const READER_SLIDER_COAST_THUMB_SETTLE_PASS = 'v485-reader-slider-coast-thumb-settle-pass';
export const READER_PROGRESS_COORDINATE_SCOPE_FIX_PASS = 'v486-reader-progress-coordinate-scope-fix-pass';
export const READER_PROGRESS_DATASET_GUARD_PASS = 'v489-reader-progress-dataset-guard-pass';
export const READER_NAV_TERMINAL_PROGRESS_SYNC_PASS = 'v514-reader-nav-terminal-progress-sync-pass';

export function updateNav(app) {
  const c = app.state.current;
  if (!c) return;
  const chunkState = getChunkViewportState(app);
  const address = getViewportAddress(app);
  const rawLocalDocRatio = address.documentRatio ?? chunkStateToDocumentRatio(app, chunkState.chunk, chunkState.ratio);
  const displayAddress = resolveNavTerminalProgressAddress(app, address, rawLocalDocRatio, chunkState);
  const localDocRatio = displayAddress.documentRatio ?? rawLocalDocRatio;
  const sliderProgress = resolveNavSliderProgress(app, displayAddress, localDocRatio);
  const sliderRatio = sliderProgress.ratio;
  const prefix = c.episode ? `${c.episodeIdx + 1}/${c.novel.episodes.length}화 · ` : '';
  if (app.els.navInfo) {
    app.els.navInfo.textContent = `${prefix}${formatDocumentPosition(app, { ...displayAddress, documentRatio: localDocRatio })}`;
    if (app.els.navInfo.dataset) app.els.navInfo.dataset.readerLiveScrollProgressPass = READER_LIVE_SCROLL_PROGRESS_PASS;
  }
  if (app.els.navSlider) {
    app.els.navSlider.min = '0';
    app.els.navSlider.max = '1000';
    app.els.navSlider.step = '1';
    const holdSlider = shouldHoldNavSliderDuringTouchCoast(app, sliderRatio);
    if (app.state.navSliderSeeking !== true && !holdSlider) app.els.navSlider.value = String(Math.round(clamp(sliderRatio, 0, 1) * 1000));
    app.els.navSlider.title = c.episode ? `현재 화 위치 ${formatPercent(sliderRatio, 1)}` : `위치 ${formatPercent(sliderRatio, 1)}`;
    if (app.els.navSlider.dataset) {
      app.els.navSlider.dataset.readerLiveScrollProgressPass = READER_LIVE_SCROLL_PROGRESS_PASS;
      app.els.navSlider.dataset.readerCoordinatePolicyPass = READER_COORDINATE_POLICY_V470_PASS;
      app.els.navSlider.dataset.readerSliderScope = c.episode ? 'current-episode' : 'single-document';
      app.els.navSlider.dataset.readerSliderProgressSource = sliderProgress.source;
      app.els.navSlider.dataset.readerSliderFileCharProgressPass = sliderProgress.fileChar ? READER_SLIDER_FILE_CHAR_PROGRESS_PASS : '';
      app.els.navSlider.dataset.readerSliderCoastThumbSettlePass = holdSlider ? READER_SLIDER_COAST_THUMB_SETTLE_PASS : '';
      app.els.navSlider.dataset.readerProgressDatasetGuardPass = READER_PROGRESS_DATASET_GUARD_PASS;
      app.els.navSlider.dataset.readerNavTerminalProgressSyncPass = app.state.lastReaderNavTerminalProgressSync?.pass || '';
    }
  }
  const chunk = chunkState.chunk;
  if (app.els.prevBtn) app.els.prevBtn.disabled = chunk <= 1 && (!c.episode || c.episodeIdx <= 0);
  if (app.els.nextBtn) app.els.nextBtn.disabled = chunk >= c.totalChunks && (!c.episode || c.episodeIdx >= c.novel.episodes.length - 1);
}

export const READER_SAFE_AREA_MULTI_FILE_OVERALL_PROGRESS_PASS = 'v429-safe-area-multi-file-overall-progress-pass';
export const READER_SAFE_AREA_MULTI_FILE_STRICT_FOLDER_PROGRESS_PASS = 'v455-safe-area-multi-file-strict-folder-progress-pass';
export const READER_SAFE_REMAINING_STABLE_ESTIMATE_PASS = 'v465-safe-remaining-stable-estimate-pass';
export const READER_SAFE_AREA_MULTI_FILE_BODY_PROGRESS_PASS = 'v446-safe-area-multi-file-body-progress-pass';
export const READER_SAFE_AREA_MULTI_FILE_NULL_MANIFEST_FALLBACK_PASS = 'v446-safe-area-multi-file-null-manifest-fallback-pass';

export function updateProgressFromViewport(app) {
  const c = app.state.current;
  if (!c) return;
  const { chunk, ratio } = getChunkViewportState(app);
  c.chunk = clamp(chunk, 1, c.totalChunks);
  c.ratio = clamp(ratio, 0, 1);
  updateNav(app);
  if (app.els.safeProgress) {
    const address = getViewportAddress(app);
    const chunkLocalRatio = chunkStateToDocumentRatio(app, c.chunk, c.ratio);
    const displayAddress = resolveNavTerminalProgressAddress(app, address, chunkLocalRatio, { chunk, ratio });
    const localRatio = resolveSafeAreaLocalRatio(app, displayAddress, chunkLocalRatio);
    const sliderProgress = resolveNavSliderProgress(app, displayAddress, localRatio);
    const sliderRatio = sliderProgress.ratio;
    const overallRatio = getFolderDocumentRatio(app, localRatio);
    const displayRatio = getSafeAreaDisplayRatio(app, localRatio, overallRatio, displayAddress);
    app.els.safeProgress.textContent = formatSafeProgress(app, displayRatio);
    app.els.safeProgress.dataset.safeProgressScope = c.novel?.isMultiFile && c.episode ? 'folder-document' : 'document';
    app.els.safeProgress.dataset.readerLiveScrollProgressPass = READER_LIVE_SCROLL_PROGRESS_PASS;
    app.els.safeProgress.dataset.readerCoordinatePolicyPass = READER_COORDINATE_POLICY_V470_PASS;
    app.state.lastReaderCoordinatePolicy = {
      pass: READER_COORDINATE_POLICY_V470_PASS,
      safeAreaScope: app.els.safeProgress.dataset.safeProgressScope,
      sliderScope: c.episode ? 'current-episode' : 'single-document',
      resumeScope: c.episode ? 'episode-local' : 'document',
      localRatio,
      folderRatio: overallRatio,
      displayRatio,
      sliderRatio,
      sliderProgressSource: sliderProgress.source,
      sliderFileCharProgress: !!sliderProgress.fileChar,
      at: Date.now()
    };
    scheduleSafeAreaCollisionFit(app, 'safe-progress-update');
  }
}

export function snapshotProgress(app) {
  const c = app.state.current;
  if (!c) return null;
  updateProgressFromViewport(app);
  const address = getViewportAddress(app);
  const chunkState = getChunkViewportState(app);
  const rawLocalDocumentRatio = address.documentRatio ?? chunkStateToDocumentRatio(app, chunkState.chunk, chunkState.ratio);
  const displayAddress = resolveNavTerminalProgressAddress(app, address, rawLocalDocumentRatio, chunkState);
  const localDocumentRatio = clamp(displayAddress.documentRatio ?? rawLocalDocumentRatio, 0, 1);
  const overallDocumentRatio = getFolderDocumentRatio(app, localDocumentRatio);
  return {
    novelId: c.novel.id,
    episodeId: c.episode?.id || null,
    episodeIdx: c.episodeIdx || 0,
    chunk: c.chunk,
    totalChunks: c.totalChunks,
    ratio: c.ratio,
    globalBlockIndex: displayAddress.globalBlockIndex,
    blockIndex: displayAddress.blockIndex,
    charIndex: displayAddress.charIndex,
    fileCharIndex: Number.isFinite(Number(displayAddress.fileCharIndex)) ? Math.round(Number(displayAddress.fileCharIndex)) : null,
    episodeDocumentRatio: localDocumentRatio,
    documentRatio: c.episode ? overallDocumentRatio : localDocumentRatio,
    ts: Date.now(),
    sourceDeviceId: app.state.deviceId,
    sourceDeviceName: app.state.deviceName,
    sourceSavedAt: Date.now(),
    coordinatePolicyPass: READER_COORDINATE_POLICY_V470_PASS,
      progressCoordinateScopeFixPass: READER_PROGRESS_COORDINATE_SCOPE_FIX_PASS
  };
}

export async function saveProgress(app) {
  const snap = snapshotProgress(app);
  if (!snap) return;
  const key = `${snap.novelId}-${snap.episodeId || 'single'}`;
  app.state.progress.lastRead = snap;
  app.state.progress.byNovel[snap.novelId] = snap;
  app.state.progress.readMeta[key] = { ...snap, documentRatio: snap.episodeDocumentRatio ?? snap.documentRatio };
  app.state.progress.positions[`pos-${snap.novelId}-${snap.episodeId || 'single'}`] = {
    globalBlockIndex: snap.globalBlockIndex,
    documentRatio: snap.episodeDocumentRatio ?? snap.documentRatio,
    fallbackChunk: snap.chunk,
    fallbackRatio: snap.ratio,
    ts: snap.ts
  };
  app.state.progress.positions[`pos-${snap.novelId}-${snap.episodeId || 'single'}-${snap.chunk}`] = snap.ratio.toFixed(4);
  persistProgress(app.state);
  try {
    app.state.sharedVersion += 1;
    const res = await app.api.putProgress({ progress: app.state.progress, updatedAt: Date.now(), syncVersion: app.state.sharedVersion });
    if (res && res.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
  } catch {
    // 오프라인/일시 실패는 로컬 저장을 유지하고 조용히 넘긴다.
  }
}

export function rememberRecent(app) {
  const c = app.state.current;
  if (!c) return;
  const multi = !!(c.novel?.isMultiFile && c.episode);
  const item = {
    novelId: c.novel.id,
    episodeId: multi ? null : (c.episode?.id || null),
    resumeEpisodeId: c.episode?.id || null,
    title: multi ? (c.novel.title || c.novel.fileName || c.title) : c.title,
    ts: Date.now()
  };
  app.state.recents = [item, ...app.state.recents.filter(x => {
    if (x.novelId !== item.novelId) return true;
    if (multi) return false;
    return (x.episodeId || null) !== item.episodeId;
  })].slice(0, 80);
  persistBookData(app.state);
}





function resolveNavTerminalProgressAddress(app, address = {}, fallbackRatio = 0, chunkState = {}) {
  const c = app?.state?.current || null;
  const totalChunks = Math.max(1, Number(c?.totalChunks) || 1);
  const stateChunk = Math.max(1, Number(chunkState?.chunk) || Number(c?.chunk) || 1);
  const stateRatio = clamp(Number(chunkState?.ratio) || 0, 0, 1);
  const trustedTerminal = stateChunk >= totalChunks && stateRatio >= 1;
  const rawDocumentRatio = Number(address?.documentRatio);
  const rawFileCharRatio = Number(address?.fileCharDocumentRatio);
  const fallback = clamp(Number(fallbackRatio) || 0, 0, 1);
  const sourceRatio = Number.isFinite(rawFileCharRatio)
    ? clamp(rawFileCharRatio, 0, 1)
    : Number.isFinite(rawDocumentRatio)
      ? clamp(rawDocumentRatio, 0, 1)
      : fallback;
  if (trustedTerminal) {
    recordNavTerminalProgressSync(app, {
      mode: 'trusted-terminal-100',
      ratio: 1,
      sourceRatio,
      chunk: stateChunk,
      totalChunks,
      chunkRatio: stateRatio
    });
    return {
      ...(address || {}),
      documentRatio: 1,
      guardedDocumentRatio: 1,
      fileCharDocumentRatio: Number.isFinite(rawFileCharRatio) ? 1 : address?.fileCharDocumentRatio,
      manifestDocumentRatio: Number.isFinite(Number(address?.manifestDocumentRatio)) ? 1 : address?.manifestDocumentRatio,
      progressGuardMode: 'trusted-terminal-progress-sync'
    };
  }
  const maxPreTerminalRatio = 0.9984;
  if (sourceRatio >= maxPreTerminalRatio) {
    const next = { ...(address || {}) };
    if (Number.isFinite(rawDocumentRatio)) next.documentRatio = Math.min(clamp(rawDocumentRatio, 0, 1), maxPreTerminalRatio);
    if (Number.isFinite(Number(next.guardedDocumentRatio))) next.guardedDocumentRatio = Math.min(clamp(Number(next.guardedDocumentRatio), 0, 1), maxPreTerminalRatio);
    if (Number.isFinite(rawFileCharRatio)) next.fileCharDocumentRatio = Math.min(clamp(rawFileCharRatio, 0, 1), maxPreTerminalRatio);
    if (Number.isFinite(Number(next.manifestDocumentRatio))) next.manifestDocumentRatio = Math.min(clamp(Number(next.manifestDocumentRatio), 0, 1), maxPreTerminalRatio);
    next.progressGuardMode = next.progressGuardMode || 'pre-terminal-progress-cap';
    recordNavTerminalProgressSync(app, {
      mode: 'pre-terminal-cap',
      ratio: maxPreTerminalRatio,
      sourceRatio,
      chunk: stateChunk,
      totalChunks,
      chunkRatio: stateRatio
    });
    return next;
  }
  recordNavTerminalProgressSync(app, {
    mode: 'normal',
    ratio: sourceRatio,
    sourceRatio,
    chunk: stateChunk,
    totalChunks,
    chunkRatio: stateRatio
  });
  return address || {};
}

function recordNavTerminalProgressSync(app, payload = {}) {
  if (!app?.state) return null;
  app.state.readerNavTerminalProgressSyncPass = READER_NAV_TERMINAL_PROGRESS_SYNC_PASS;
  app.state.lastReaderNavTerminalProgressSync = {
    pass: READER_NAV_TERMINAL_PROGRESS_SYNC_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return app.state.lastReaderNavTerminalProgressSync;
}

function resolveNavSliderProgress(app, address = {}, fallbackRatio = 0) {
  const fileCharRatio = Number(address?.fileCharDocumentRatio);
  if (Number.isFinite(fileCharRatio)) {
    const ratio = clamp(fileCharRatio, 0, 1);
    recordNavSliderProgress(app, {
      pass: READER_SLIDER_FILE_CHAR_PROGRESS_PASS,
      ratio,
      source: 'file-char',
      fileChar: true,
      fileCharIndex: Number.isFinite(Number(address?.fileCharIndex)) ? Math.round(Number(address.fileCharIndex)) : null,
      guardedDocumentRatio: Number.isFinite(Number(address?.guardedDocumentRatio)) ? clamp(Number(address.guardedDocumentRatio), 0, 1) : null,
      fallbackDocumentRatio: Number.isFinite(Number(address?.fallbackDocumentRatio)) ? clamp(Number(address.fallbackDocumentRatio), 0, 1) : null,
      manifestDocumentRatio: Number.isFinite(Number(address?.manifestDocumentRatio)) ? clamp(Number(address.manifestDocumentRatio), 0, 1) : null
    });
    return { ratio, source: 'file-char', fileChar: true };
  }
  const guarded = Number(address?.documentRatio);
  const ratio = clamp(Number.isFinite(guarded) ? guarded : Number(fallbackRatio) || 0, 0, 1);
  recordNavSliderProgress(app, {
    pass: READER_SLIDER_FILE_CHAR_PROGRESS_PASS,
    ratio,
    source: Number.isFinite(guarded) ? 'guarded-document' : 'chunk-fallback',
    fileChar: false,
    fileCharIndex: null,
    guardedDocumentRatio: Number.isFinite(guarded) ? clamp(guarded, 0, 1) : null,
    fallbackDocumentRatio: Number.isFinite(Number(address?.fallbackDocumentRatio)) ? clamp(Number(address.fallbackDocumentRatio), 0, 1) : null,
    manifestDocumentRatio: Number.isFinite(Number(address?.manifestDocumentRatio)) ? clamp(Number(address.manifestDocumentRatio), 0, 1) : null
  });
  return { ratio, source: Number.isFinite(guarded) ? 'guarded-document' : 'chunk-fallback', fileChar: false };
}

function recordNavSliderProgress(app, payload = {}) {
  if (!app?.state) return null;
  app.state.readerSliderFileCharProgressPass = READER_SLIDER_FILE_CHAR_PROGRESS_PASS;
  app.state.lastReaderSliderProgressDiagnostic = {
    pass: READER_SLIDER_FILE_CHAR_PROGRESS_PASS,
    ...(payload || {}),
    at: Date.now()
  };
  return app.state.lastReaderSliderProgressDiagnostic;
}

function shouldHoldNavSliderDuringTouchCoast(app, targetRatio = 0) {
  const v = app?.state?.readerVirtual || null;
  if (!v) return false;
  const now = Date.now();
  const source = String(v.lastUserScrollSource || '');
  const activeUntil = Number(v.userScrollActiveUntil) || 0;
  const active = source === 'touch-coast' && activeUntil > now;
  if (!active) return false;
  const delay = Math.max(40, Math.min(900, Math.round(activeUntil - now + 48)));
  app.state.readerSliderCoastThumbSettlePass = READER_SLIDER_COAST_THUMB_SETTLE_PASS;
  app.state.lastReaderSliderCoastThumbSettle = {
    pass: READER_SLIDER_COAST_THUMB_SETTLE_PASS,
    held: true,
    targetRatio: clamp(Number(targetRatio) || 0, 0, 1),
    remainingMs: Math.max(0, Math.round(activeUntil - now)),
    reason: 'touch-coast keeps nav slider thumb stable until native inertia settles',
    at: now
  };
  if (!app.state.readerSliderCoastThumbSettleTimer) {
    app.state.readerSliderCoastThumbSettleTimer = globalThis.setTimeout?.(() => {
      app.state.readerSliderCoastThumbSettleTimer = 0;
      try { updateProgressFromViewport(app); } catch {}
    }, delay) || 0;
  }
  return true;
}

function resolveSafeAreaLocalRatio(app, address = {}, fallbackRatio = 0) {
  const c = app.state.current;
  const fallback = clamp(Number(fallbackRatio) || 0, 0, 1);
  if (!c?.episode) return fallback;
  const addressRatio = Number(address?.documentRatio);
  if (Number.isFinite(addressRatio) && addressRatio > 0) return clamp(addressRatio, 0, 1);
  return fallback;
}

function getSafeAreaDisplayRatio(app, localRatio = 0, overallRatio = 0, address = {}) {
  const c = app.state.current;
  const local = clamp(Number(localRatio) || 0, 0, 1);
  const overall = clamp(Number(overallRatio) || 0, 0, 1);
  if (c?.novel?.isMultiFile && c?.episode) {
    app.state.lastSafeAreaMultiFileProgress = {
      pass: READER_SAFE_AREA_MULTI_FILE_STRICT_FOLDER_PROGRESS_PASS,
      legacyPass: READER_SAFE_AREA_MULTI_FILE_OVERALL_PROGRESS_PASS,
      bodyProgressPass: READER_SAFE_AREA_MULTI_FILE_BODY_PROGRESS_PASS,
      nullManifestFallbackPass: READER_SAFE_AREA_MULTI_FILE_NULL_MANIFEST_FALLBACK_PASS,
      scope: 'folder-document',
      episodeId: c.episode.id || null,
      localRatio: local,
      folderRatio: overall,
      viewportDocumentRatio: Number.isFinite(Number(address?.documentRatio)) ? clamp(Number(address.documentRatio), 0, 1) : null,
      at: Date.now()
    };
    return overall;
  }
  return overall;
}

function getFolderDocumentRatio(app, localRatio = 0) {
  const c = app.state.current;
  const ratio = clamp(Number(localRatio) || 0, 0, 1);
  if (!c?.episode || !Array.isArray(c.novel?.episodes) || !c.novel.episodes.length) return ratio;
  const exact = episodeRatioToFolderDocumentRatio(app, c.episode.id, ratio);
  if (exact != null && Number.isFinite(Number(exact))) return clamp(Number(exact), 0, 1);
  const episodeCount = Math.max(1, c.novel.episodes.length);
  const episodeIdx = clamp(Number(c.episodeIdx) || 0, 0, episodeCount - 1);
  return clamp((episodeIdx + ratio) / episodeCount, 0, 1);
}

function formatSafeProgress(app, docRatio) {
  const ratio = clamp(docRatio, 0, 1);
  const percent = formatPercent(ratio);
  if (!app.state.prefs?.safeRemainingShow) return percent;
  const remaining = estimateRemainingTime(app, ratio);
  return remaining ? `${percent} · ${formatCompactRemaining(remaining)}` : `${percent} · 계산중`;
}

function estimateRemainingTime(app, ratio) {
  const c = app.state.current;
  const key = buildRemainingStatsKey(app, c);
  const stats = ensureRemainingStats(app, key);
  const now = Date.now();
  const safeRatio = clamp(Number(ratio) || 0, 0, 1);
  const v = app?.state?.virtual || null;
  const scrollSource = String(v?.lastUserScrollSource || '');
  const programmatic = scrollSource === 'programmatic-slider' || scrollSource === 'programmatic' || scrollSource === 'search' || scrollSource === 'jump';
  const prevRatio = Number(stats.lastRatio);
  const prevTs = Number(stats.lastTs) || 0;
  if (Number.isFinite(prevRatio) && prevTs > 0) {
    const deltaRatio = safeRatio - prevRatio;
    const deltaMs = now - prevTs;
    const forwardSample = deltaRatio > 0.00002 && deltaRatio < 0.035 && deltaMs >= 2200 && deltaMs <= 300000;
    if (deltaRatio < -0.004 || Math.abs(deltaRatio) >= 0.06 || programmatic) {
      stats.lastIgnoredSample = { pass: READER_SAFE_REMAINING_STABLE_ESTIMATE_PASS, reason: programmatic ? 'programmatic/jump sample ignored' : 'large or reverse progress sample ignored', deltaRatio, deltaMs, source: scrollSource, at: now };
    } else if (forwardSample) {
      const instant = deltaRatio / deltaMs;
      const maxReasonableRate = 1 / 900000;
      if (instant > 0 && instant <= maxReasonableRate) {
        stats.ratioPerMs = stats.ratioPerMs ? (stats.ratioPerMs * 0.82 + instant * 0.18) : instant;
        stats.sampleCount = Math.min(999, (Number(stats.sampleCount) || 0) + 1);
      }
    }
  }
  stats.lastRatio = safeRatio;
  stats.lastTs = now;
  const rate = Number(stats.ratioPerMs) || 0;
  const remainingMs = rate > 0 && safeRatio > 0 && safeRatio < 1 ? (1 - safeRatio) / rate : 0;
  if (Number.isFinite(remainingMs) && remainingMs > 0 && remainingMs <= 10 * 86400000) {
    stats.lastEstimateMs = remainingMs;
    stats.lastEstimateAt = now;
  }
  const estimateMs = Number(stats.lastEstimateMs) || 0;
  app.state.lastSafeRemainingEstimate = {
    pass: READER_SAFE_REMAINING_STABLE_ESTIMATE_PASS,
    key, ratio: safeRatio, rate, sampleCount: Number(stats.sampleCount) || 0,
    estimateMs: Math.round(estimateMs), source: scrollSource, at: now
  };
  if (!estimateMs || safeRatio >= 1) return '';
  return formatRemainingMs(estimateMs);
}

function buildRemainingStatsKey(app, c) {
  const novelId = String(c?.novel?.id || c?.novelId || 'reader');
  return c?.novel?.isMultiFile && c?.episode ? `${novelId}:folder` : `${novelId}:single`;
}

function ensureRemainingStats(app, key) {
  const root = app.state.readingStats || (app.state.readingStats = { key, lastRatio: null, lastTs: 0, ratioPerMs: 0 });
  if (!root.byKey || typeof root.byKey !== 'object') root.byKey = {};
  if (!root.byKey[key]) root.byKey[key] = { key, lastRatio: null, lastTs: 0, ratioPerMs: 0, sampleCount: 0, lastEstimateMs: 0, lastEstimateAt: 0 };
  root.key = key;
  return root.byKey[key];
}

function formatRemainingMs(remainingMs) {
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return '';
  if (remainingMs < 60000) return '남은 1분 미만';
  const minutes = Math.max(1, Math.round(remainingMs / 60000));
  if (minutes < 60) return `남은 ${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `남은 ${hours}시간 ${rest}분` : `남은 ${hours}시간`;
  const days = Math.floor(hours / 24);
  const dayHours = hours % 24;
  return dayHours ? `남은 ${days}일 ${dayHours}시간` : `남은 ${days}일`;
}

function formatCompactRemaining(text = '') {
  const value = String(text || '').replace(/^남은\s*/, '').trim();
  return value || '--';
}
