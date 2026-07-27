import { CURRENT_BUILD_ID } from '../../version.mjs';
import { MAX_SEARCH_TEXT_CACHE, buildSearchCoveragePreview } from '../search/matcher.mjs';

export const RECOVERY_SEARCH_DIAGNOSTICS_VERSION = CURRENT_BUILD_ID;
export const RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_PASS = 'v157-recovery-search-diagnostics-extraction-pass';

function formatRecoverySearchTs(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  try { return new Date(value).toLocaleString(); } catch { return String(ts || '-'); }
}

export function getSearchTextCacheDiagnostics(app, coverage = null) {
  const cache = app?.state?.chunkTextCache instanceof Map ? app.state.chunkTextCache : new Map();
  const loaded = app?.state?.loadedChunks instanceof Map ? app.state.loadedChunks : new Map();
  const chunks = Array.from(cache.keys()).map(value => Math.max(1, Math.round(Number(value) || 0))).filter(Boolean).sort((a, b) => a - b);
  const loadedChunks = new Set(Array.from(loaded.keys()).map(value => Math.max(1, Math.round(Number(value) || 0))).filter(Boolean));
  let bytes = 0;
  let chars = 0;
  cache.forEach(value => {
    const text = String(value ?? '');
    chars += text.length;
    bytes += text.length * 2;
  });
  const stats = app?.state?.search?.stats || null;
  return {
    pass: RECOVERY_SEARCH_DIAGNOSTICS_EXTRACTION_PASS,
    entries: cache.size,
    maxEntries: MAX_SEARCH_TEXT_CACHE,
    chunks,
    bytes,
    chars,
    loadedOverlap: chunks.filter(chunk => loadedChunks.has(chunk)).length,
    loadedChunks: loaded.size,
    resultCount: app?.state?.search?.results?.length || 0,
    statsMode: stats?.mode || '',
    statsDone: !!stats?.done,
    scannedChunks: Number(stats?.scannedChunks) || 0,
    memoryChunks: Number(stats?.memoryChunks) || 0,
    loadedStatsChunks: Number(stats?.loadedChunks) || 0,
    cacheChunks: Number(stats?.cacheChunks) || 0,
    networkChunks: Number(stats?.networkChunks) || 0,
    failedChunks: Number(stats?.failedChunks) || 0,
    skippedOfflineChunks: Number(stats?.skippedOfflineChunks) || 0,
    cacheOnlySkipped: Number(stats?.skippedCacheOnlyChunks) || 0,
    coverage: coverage ? {
      totalChunks: coverage.totalChunks,
      sampledChunks: coverage.sampledChunks,
      loadedChunks: coverage.loadedChunks,
      memoryChunks: coverage.memoryChunks,
      cacheChunks: coverage.cacheChunks,
      searchableChunks: coverage.searchableChunks,
      offlineMissingChunks: coverage.offlineMissingChunks,
      truncated: !!coverage.truncated
    } : null,
    generatedAt: Date.now()
  };
}

export async function buildRecoverySearchCoverage(app) {
  try {
    await app.reader?.ensureBlockManifest?.({ signal: app.state.search?.abortController?.signal });
    return await buildSearchCoveragePreview(app, app.state.current, { signal: app.state.search?.abortController?.signal, maxChunks: 5000 });
  } catch (error) {
    if (error && error.name === 'AbortError') return null;
    return { error: error?.message || String(error) };
  }
}

export function formatSearchCoverageSummary(coverage) {
  if (!coverage) return 'no current reader';
  if (coverage.error) return `error: ${coverage.error}`;
  const total = Number(coverage.totalChunks) || 0;
  if (!total) return 'unknown';
  const mode = coverage.online ? 'online' : 'offline';
  const missing = Math.max(0, Number(coverage.offlineMissingChunks) || 0);
  const truncated = coverage.truncated ? ` · sampled ${coverage.sampledChunks}` : '';
  return `${mode} ${coverage.searchableChunks}/${total} searchable · loaded ${coverage.loadedChunks} · memory ${coverage.memoryChunks} · cache ${coverage.cacheChunks} · missing ${missing}${truncated}`;
}

export function formatSearchJumpRecoverySummary(statusInfo = null, failure = null, validation = null) {
  if (failure) {
    const chunk = Math.max(1, Number(failure.chunk) || 1);
    const total = Math.max(1, Number(failure.totalChunks) || 1);
    return '실패 · chunk ' + chunk + '/' + total + ' · ' + (failure.error || '원인 미상') + ' · v153 live-field 확인 대상';
  }
  if (!statusInfo) return '기록 없음';
  const stage = statusInfo.stage === 'done' ? '완료' : statusInfo.stage === 'loading' ? '진행 중' : statusInfo.stage === 'failed' ? '실패' : '기록됨';
  const chunk = Math.max(1, Number(statusInfo.chunk) || 1);
  const total = Math.max(1, Number(statusInfo.totalChunks) || 1);
  const validity = validation && validation.ok === false ? ' · 현재 상태와 불일치' : ' · 현재 상태와 일치';
  return stage + ' · chunk ' + chunk + '/' + total + validity;
}

export function formatSearchJumpRetryValidation(validation = null) {
  if (!validation) return '기록 없음';
  return validation.ok ? '통과 · index ' + (validation.index ?? '-') : '차단 · ' + (validation.reason || 'unknown');
}

export function formatSearchJumpSessionCleanup(info = null) {
  if (!info) return '기록 없음';
  const reason = String(info.reason || 'reset');
  const pass = String(info.pass || '');
  const at = formatRecoverySearchTs(info.at);
  return [reason, pass, at].filter(Boolean).join(' · ');
}

export function formatSearchContextReset(info = null) {
  if (!info) return '기록 없음';
  const reason = String(info.reason || 'reset');
  const trigger = String(info.triggerPass || info.pass || '');
  const previous = info.previous || {};
  const resultCount = Number(previous.resultCount) || 0;
  const at = formatRecoverySearchTs(info.at);
  const reader = info.previousReader && info.nextReader
    ? ' · reader ' + (info.previousReader.novelId || '-') + ' → ' + (info.nextReader.novelId || '-')
    : '';
  return [reason, trigger, resultCount ? '이전 결과 ' + resultCount + '개' : '이전 결과 없음', at].filter(Boolean).join(' · ') + reader;
}

export function getCoverageMissingChunks(coverage) {
  if (!coverage || coverage.error) return [];
  const total = Math.max(0, Number(coverage.sampledChunks || coverage.totalChunks) || 0);
  if (!total) return [];
  const available = new Set((Array.isArray(coverage.chunks) ? coverage.chunks : [])
    .map(item => Math.max(1, Math.round(Number(item?.chunk) || 0)))
    .filter(Boolean));
  const out = [];
  for (let chunk = 1; chunk <= total; chunk += 1) {
    if (!available.has(chunk)) out.push(chunk);
  }
  return out;
}

export function buildCoverageRows(coverage) {
  if (!coverage || coverage.error) return [];
  const total = Math.max(0, Number(coverage.sampledChunks || coverage.totalChunks) || 0);
  const sourceByChunk = new Map();
  (Array.isArray(coverage.chunks) ? coverage.chunks : []).forEach(item => {
    const chunk = Math.max(1, Math.round(Number(item?.chunk) || 0));
    if (!chunk) return;
    sourceByChunk.set(chunk, String(item?.source || 'reader-cache'));
  });
  const rows = [];
  for (let chunk = 1; chunk <= total; chunk += 1) {
    const source = sourceByChunk.get(chunk) || 'missing';
    const type = source === 'missing' ? 'missing' : 'cached';
    rows.push({ chunk, source, type, label: sourceLabel(source), hint: sourceHint(source) });
  }
  return rows;
}

export function formatCoverageModalSummary(rows, coverage) {
  const missing = rows.filter(row => row.type === 'missing').length;
  const cached = rows.length - missing;
  const sampled = coverage?.truncated ? ' · 앞 ' + (coverage.sampledChunks || rows.length) + '개 샘플' : '';
  return '캐시/표시중 ' + cached + '개 · 저장 후보 ' + missing + '개' + sampled;
}

function sourceLabel(source) {
  if (source === 'loaded') return '현재 표시중';
  if (source === 'memory') return '검색 메모리';
  if (source === 'reader-cache') return 'IndexedDB 캐시';
  return '저장 후보';
}

function sourceHint(source) {
  if (source === 'loaded') return '화면에 올라온 chunk입니다. IDB 캐시가 있으면 삭제 대상에 포함됩니다.';
  if (source === 'memory') return '검색 text cache에 있는 chunk입니다. IDB 캐시가 있으면 삭제 대상에 포함됩니다.';
  if (source === 'reader-cache') return '오프라인 검색/읽기에 사용할 수 있습니다.';
  return '네트워크 연결 상태에서 오프라인 저장 가능';
}
