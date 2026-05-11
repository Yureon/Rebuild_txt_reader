import { createEl, formatBytes } from '../../core/utils.mjs';
import { formatSearchCoverageSummary } from './search-diagnostics.mjs';
import { buildReaderManualDiagnosticsTrendBundle } from '../reader/manual-diagnostics-snapshot.mjs';

export const RECOVERY_SUMMARY_RENDERER_REFACTOR_PASS = 'v165-recovery-summary-renderer-pass';
export const RECOVERY_SUMMARY_MANUAL_BROWSER_TREND_PASS = 'v255-recovery-summary-manual-browser-trend-pass';
export const RECOVERY_SUMMARY_REAL_BROWSER_EXPORT_TREND_PASS = 'v258-recovery-summary-real-browser-export-trend-pass';
export const RECOVERY_SUMMARY_COMPACT_PASS = 'v419-recovery-summary-compact-pass';
export const RECOVERY_BADGE_ACTIONABLE_ONLY_PASS = 'v422-recovery-badge-actionable-only-pass';
export const RECOVERY_SERVER_STATUS_SCOPED_UNAVAILABLE_PASS = 'v422-recovery-server-status-scoped-unavailable-pass';
export const RECOVERY_READER_STALE_CACHE_SUMMARY_PASS = 'v424-recovery-reader-stale-cache-summary-pass';

function formatRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  const diff = Math.max(0, Date.now() - value);
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(value).toLocaleString();
}

export function updateRecoveryCards(app, info = {}) {
  const { cacheStats = {}, queueLength = 0, lastRead = null, lastServerSync = 0, lastFailure = null, serverStatus = null } = info;
  if (app.els.recoveryCardOffline) app.els.recoveryCardOffline.textContent = cacheStats.available ? `${cacheStats.entries}개 · ${formatBytes(cacheStats.bytes)}` : '사용 불가';
  if (app.els.recoveryCardQueue) app.els.recoveryCardQueue.textContent = queueLength ? `${queueLength}개 대기` : '없음';
  if (app.els.recoveryCardCheckpoint) app.els.recoveryCardCheckpoint.textContent = lastRead?.ts ? formatRelativeTime(lastRead.ts) : '없음';
  if (app.els.recoveryCardServerSync) app.els.recoveryCardServerSync.textContent = lastServerSync ? formatRelativeTime(lastServerSync) : (serverStatus?.syncData?.mtimeMs ? formatRelativeTime(serverStatus.syncData.mtimeMs) : '없음');
  if (app.els.recoveryCardSyncFail) app.els.recoveryCardSyncFail.textContent = lastFailure ? formatRelativeTime(lastFailure.at || lastFailure.ts) : '없음';
  if (app.els.recoveryCardOrphan) app.els.recoveryCardOrphan.textContent = serverStatus?.snapshot?.count ? `스냅샷 ${serverStatus.snapshot.count}개` : '없음';
}

export function renderRecoveryBadge(app, info = {}) {
  const badge = app.els.recoveryCenterBadge;
  if (!badge) return;
  const hasFailure = !!info.lastFailure;
  const hasQueue = Number(info.queueLength) > 0;
  const degraded = !!info.serverStatus?.degraded;
  badge.dataset.recoveryBadgeActionableOnlyPass = RECOVERY_BADGE_ACTIONABLE_ONLY_PASS;
  badge.classList.remove('ok', 'warn', 'bad');
  if (hasFailure || degraded) {
    badge.classList.add('bad');
    badge.textContent = '조치 필요';
  } else if (hasQueue) {
    badge.classList.add('warn');
    badge.textContent = '대기 있음';
  } else {
    badge.classList.add('ok');
    badge.textContent = '정상';
  }
}

export function renderRecoverySummaryPanel(app, info = {}) {
  const server = info.serverStatus || {};
  const cacheStats = info.cacheStats || {};
  const manualTrend = app?.state?.readerManualDiagnosticsRecoveryTrend || buildReaderManualDiagnosticsTrendBundle(app?.state?.readerManualDiagnosticsHistory || []);
  const staleCacheBypass = app?.state?.readerStaleMultiFileCacheBypass || null;
  const sliderGuardLabel = staleCacheBypass
    ? `${staleCacheBypass.reason || 'multi-file totalChunks cache bypass'} · chunk ${staleCacheBypass.chunk || '-'} · ${formatRelativeTime(staleCacheBypass.at)} · ${RECOVERY_READER_STALE_CACHE_SUMMARY_PASS}`
    : `최근 다중 파일 slider/cache guard 없음 · ${RECOVERY_READER_STALE_CACHE_SUMMARY_PASS}`;
  const primaryRows = [
    ['Reader cache', cacheStats.available ? `${cacheStats.entries} entries / ${formatBytes(cacheStats.bytes)}` : 'unavailable'],
    ['Prefetch queue', info.queueLength ? `${info.queueLength} pending` : 'empty'],
    ['Network policy', info.networkProfile ? `${info.networkProfile.label} · ${info.networkProfile.detail}` : 'unknown'],
    ['Offline coverage', info.coverage?.total ? `${info.coverage.cached}/${info.coverage.total} chunks · ${info.coverage.start}-${info.coverage.end}` : 'no current reader'],
    ['Server sync data', server?.scopedOut ? 'owner-only · unavailable is non-actionable' : (server.syncData?.exists ? `${formatBytes(server.syncData.size)} · ${formatRelativeTime(server.syncData.mtimeMs)}` : 'missing')],
    ['Slider/cache guard', sliderGuardLabel]
  ];
  const detailRows = [
    ['Prefetch result', info.prefetchSnapshot ? `fetched ${info.prefetchSnapshot.fetched} / cached-hit ${info.prefetchSnapshot.cached} / failed ${info.prefetchSnapshot.failed}` : 'unknown'],
    ['Loaded chunks', String(app.state.loadedChunks?.size || 0)],
    ['Search results', String(app.state.search?.results?.length || 0)],
    ['Search coverage', formatSearchCoverageSummary(info.searchCoverage)],
    ['Manual browser trend', manualTrend.count ? `${manualTrend.count} checks · issues ${manualTrend.issueCount} · live DOM ${manualTrend.liveDomEvidenceCount} · retry ${manualTrend.retryCount} · PC ${manualTrend.sourceCoverage?.pc || 0} · mobile ${manualTrend.sourceCoverage?.mobile || 0} · imported ${manualTrend.sourceCoverage?.imported || 0}` : 'none'],
    ['Server snapshots', server?.scopedOut ? 'owner-only' : (server.snapshot?.count ? `${server.snapshot.count} · ${server.snapshot.latest || '-'}` : 'none')],
    ['Library cache', server?.scopedOut ? 'owner-only' : (server.libraryCache ? `${server.libraryCache.count || 0} novels · build ${server.libraryCache.buildCount || 0}` : 'unknown')],
    ['Server diagnostics scope', server?.scopedOut ? `${server.status || '-'} · ${server.reason || 'owner-only'} · ${RECOVERY_SERVER_STATUS_SCOPED_UNAVAILABLE_PASS}` : (server ? 'available' : 'not loaded')]
  ];
  const row = ([k, v]) => createEl('div', { class:'recovery-status-row' }, [
    createEl('div', { class:'recovery-status-key', text:k }),
    createEl('div', { class:'recovery-status-val', text:v })
  ]);
  return createEl('section', { class:'recovery-section recovery-summary-compact', dataset:{ recoverySection:'summary', recoverySummaryRendererPass:RECOVERY_SUMMARY_RENDERER_REFACTOR_PASS, recoverySummaryManualBrowserTrendPass:RECOVERY_SUMMARY_MANUAL_BROWSER_TREND_PASS, recoverySummaryRealBrowserExportTrendPass:RECOVERY_SUMMARY_REAL_BROWSER_EXPORT_TREND_PASS, recoverySummaryCompactPass:RECOVERY_SUMMARY_COMPACT_PASS, recoveryReaderStaleCacheSummaryPass:RECOVERY_READER_STALE_CACHE_SUMMARY_PASS } }, [
    createEl('div', { class:'recovery-section-title', text:'현재 복구 상태' }),
    createEl('div', { class:'recovery-status-table' }, primaryRows.map(row)),
    createEl('details', { class:'recovery-summary-detail' }, [
      createEl('summary', { text:'상세 상태 더 보기' }),
      createEl('div', { class:'recovery-status-table' }, detailRows.map(row))
    ])
  ]);
}
