import { formatBytes, formatPercent } from '../../core/utils.mjs';
import { getReaderCacheDefaultPruneLimits } from '../reader/cache-store.mjs';
import { MAX_SEARCH_TEXT_CACHE } from '../search/matcher.mjs';

export const RECOVERY_CACHE_DIAGNOSTICS_VERSION = 'rebuild-v161';
export const RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS = 'v158-recovery-cache-diagnostics-extraction-pass';

export function buildRecoveryDiagnosticsPayload({ app, virtual = {}, search = {}, readerCache = {}, libraryDiagnostics = null, searchCoverage = null, prefetchSnapshot = null, networkProfile = null } = {}) {
  return {
    version: RECOVERY_CACHE_DIAGNOSTICS_VERSION,
    pass: RECOVERY_CACHE_DIAGNOSTICS_EXTRACTION_PASS,
    current: app?.state?.current ? {
      novelId: app.state.current.novel?.id || '',
      episodeId: app.state.current.episode?.id || null,
      chunk: app.state.current.chunk,
      totalChunks: app.state.current.totalChunks,
      title: app.state.current.title
    } : null,
    virtual,
    searchTextCache: search,
    readerCache,
    library: libraryDiagnostics || null,
    searchCoverage: searchCoverage || null,
    prefetch: prefetchSnapshot || null,
    network: networkProfile || null,
    copiedAt: Date.now()
  };
}

export function buildRecoveryDiagnosticsRows({ virtual = {}, search = {}, readerCache = {} } = {}) {
  const currentCache = readerCache.current || null;
  return [
    ['Virtual rows', virtual.available ? `${virtual.rows} rows · mounted ${virtual.mountedRows} · rendered ${virtual.renderedRows}` : (virtual.reason || 'not initialized')],
    ['Measure cache', virtual.available ? `${virtual.measureCacheSize} entries · stale ${virtual.staleMeasureCacheSize} · estimated ${virtual.estimatedRows}` : 'unavailable'],
    ['Virtual height', virtual.available ? `${formatRecoveryNumber(virtual.totalHeight)}px · scroll ${formatRecoveryNumber(virtual.readerScrollTop)}px / viewport ${formatRecoveryNumber(virtual.readerClientHeight)}px` : 'unavailable'],
    ['Search text memory', `${search.entries || 0}/${search.maxEntries || MAX_SEARCH_TEXT_CACHE} chunks · ${formatBytes(search.bytes || 0)} · loaded overlap ${search.loadedOverlap || 0}`],
    ['Search state', `results ${search.resultCount || 0} · stats ${search.statsMode || '-'} · cache-only skipped ${search.cacheOnlySkipped || 0}`],
    ['IDB reader cache', readerCache.available ? `${readerCache.entries || 0} entries · ${formatBytes(readerCache.bytes || 0)} · novels ${readerCache.novelGroups || (readerCache.byNovel || []).length}` : (readerCache.error || 'unavailable')],
    ['Current IDB cache', currentCache ? `${currentCache.entries}/${currentCache.totalChunks} chunks (${formatPercent(currentCache.cachedRatio || 0, 1)}) · active signature ${currentCache.activeSignatureEntries}/${currentCache.totalChunks}` : 'no current reader'],
    ['Prune state', readerCache.prune ? `default ${readerCache.prune.defaultMaxEntries} / ${formatBytes(readerCache.prune.defaultMaxBytes)} · scheduled ${readerCache.prune.scheduled ? 'yes' : 'no'} · running ${readerCache.prune.running ? 'yes' : 'no'}` : 'unknown']
  ];
}

export function getRecoveryReaderCacheTopNovelRows(readerCache = {}, limit = 8) {
  return Array.isArray(readerCache.byNovel) ? readerCache.byNovel.slice(0, Math.max(0, Number(limit) || 0)) : [];
}

export function buildRecoveryCacheManagementRows(app, readerCache = {}, plan = {}) {
  const limits = getReaderCacheDefaultPruneLimits();
  const current = readerCache.current || null;
  return [
    ['전체 cache', readerCache.available ? `${readerCache.entries || 0} entries · ${formatBytes(readerCache.bytes || 0)} · 작품 ${readerCache.novelGroups || 0}개` : (readerCache.error || 'unavailable')],
    ['현재 작품 cache', current ? `${current.entries}/${current.totalChunks} chunks · ${formatBytes(current.bytes || 0)} · active ${current.activeSignatureEntries} · stale ${current.entries - current.activeSignatureEntries}` : '현재 열린 작품 없음'],
    ['현재 보호 범위', formatCurrentCacheProtection(app, plan)],
    ['기본 prune limit', `${limits.maxEntries} entries · ${formatBytes(limits.maxBytes)}`],
    ['현재 계획', formatPruneCompact(plan)]
  ];
}

export function parseRecoveryPruneOptions({ maxEntriesInput, maxMbInput, radiusInput, protectInput } = {}) {
  const limits = getReaderCacheDefaultPruneLimits();
  const maxEntries = Math.max(20, Math.round(Number(maxEntriesInput?.value) || limits.maxEntries));
  const maxMb = Math.max(1, Math.round(Number(maxMbInput?.value) || Math.round(limits.maxBytes / 1024 / 1024)));
  const protectRadius = Math.max(0, Math.round(Number(radiusInput?.value) || 0));
  return {
    maxEntries,
    maxBytes: maxMb * 1024 * 1024,
    protectCurrent: !!protectInput?.checked,
    protectRadius
  };
}

export function formatCurrentCacheProtection(app, plan = {}) {
  const current = app?.state?.current;
  if (!current?.novel?.id) return '현재 열린 작품 없음';
  const chunk = Math.max(1, Math.round(Number(current.chunk) || 1));
  const radius = Math.max(0, Math.round(Number(plan.protectRadius ?? 8) || 0));
  const total = Math.max(1, Number(current.totalChunks) || 1);
  const start = Math.max(1, chunk - radius);
  const end = Math.min(total, chunk + radius);
  const loaded = app?.state?.loadedChunks?.size || 0;
  const enabled = plan.protectCurrent !== false;
  return `${enabled ? 'ON' : 'OFF'} · chunk ${start}-${end} · loaded ${loaded} chunks`;
}

export function formatPruneCompact(plan = {}) {
  if (!plan.available) return plan.error || 'unavailable';
  if (!plan.remove) return `삭제 없음 · ${plan.entries || 0}/${plan.maxEntries || '-'} entries · ${formatBytes(plan.bytes || 0)}/${formatBytes(plan.maxBytes || 0)}`;
  return `삭제 예정 ${plan.remove}개 · ${formatBytes(plan.removeBytes || 0)} · 보호 ${plan.protectedEntries || 0}개 · 이후 ${plan.afterEntries || 0}개`;
}

export function formatPrunePlan(plan = {}, options = {}) {
  const formatRelativeTime = typeof options.formatRelativeTime === 'function' ? options.formatRelativeTime : fallbackRelativeTime;
  if (!plan.available) return 'Prune plan unavailable: ' + (plan.error || 'IndexedDB unavailable');
  const lines = [
    `entries: ${plan.entries || 0} / limit ${plan.maxEntries || 0}`,
    `bytes: ${formatBytes(plan.bytes || 0)} / limit ${formatBytes(plan.maxBytes || 0)}`,
    `remove: ${plan.remove || 0} entries / ${formatBytes(plan.removeBytes || 0)}`,
    `after: ${plan.afterEntries || 0} entries / ${formatBytes(plan.afterBytes || 0)}`,
    `protected: ${plan.protectedEntries || 0} entries (current reader radius ${plan.protectCurrent ? plan.protectRadius : 'off'})`,
    `limitedByProtected: ${plan.limitedByProtected ? 'yes' : 'no'}`
  ];
  if (Array.isArray(plan.victims) && plan.victims.length) {
    lines.push('', 'victim preview:');
    plan.victims.slice(0, 12).forEach(item => {
      lines.push(`- ${item.title || item.novelId} · chunk ${item.chunk} · ${formatBytes(item.bytes || 0)} · ${item.lastAccessedAt ? formatRelativeTime(item.lastAccessedAt) : '-'}`);
    });
  }
  return lines.join('\n');
}

export function formatCachedNovelMeta(item = {}, options = {}) {
  const formatRelativeTime = typeof options.formatRelativeTime === 'function' ? options.formatRelativeTime : fallbackRelativeTime;
  const chunkRange = item.minChunk && item.maxChunk ? `chunk ${item.minChunk}-${item.maxChunk}` : 'chunk -';
  const active = Number(item.activeSignatureEntries) || 0;
  const stale = Number(item.staleSignatureEntries) || 0;
  const age = item.ageDays == null ? '-' : `${item.ageDays}d`;
  return `${item.entries || 0} entries · ${item.chunks || 0} chunks · ${item.episodes || 0} episodes · ${formatBytes(item.bytes || 0)} · ${chunkRange} · active ${active} / stale ${stale} (${formatBytes(item.staleSignatureBytes || 0)}) · signatures ${item.signatures || 0} · age ${age} · updated ${item.updatedAt ? formatRelativeTime(item.updatedAt) : '-'}`;
}

export function isCacheNovelOlderThan(item = {}, now = Date.now(), days = 30) {
  const cutoff = now - Math.max(1, Number(days) || 1) * 86400000;
  const last = Number(item.lastAccessedAt || item.updatedAt || 0);
  return !!last && last < cutoff;
}

export function buildCachedNovelRuleFromFilter(filter, stats = {}) {
  const currentSignature = String(stats.currentSignature || '');
  const now = Date.now();
  if (filter === 'staleSignature' || filter === 'multiSignature') {
    return { hasRule: true, label: '현재 전처리 signature와 다른 cache', options: { staleSignature: true, currentSignature } };
  }
  if (filter === 'old7') return { hasRule: true, label: '최근 7일 미사용 cache', options: { beforeAccessedAt: now - 7 * 86400000 } };
  if (filter === 'old30') return { hasRule: true, label: '최근 30일 미사용 cache', options: { beforeAccessedAt: now - 30 * 86400000 } };
  if (filter === 'old90') return { hasRule: true, label: '최근 90일 미사용 cache', options: { beforeAccessedAt: now - 90 * 86400000 } };
  return { hasRule: false, label: '전체', options: {} };
}

export function shortCacheSignature(signature) {
  const value = String(signature || '');
  if (!value) return '-';
  return value.length > 48 ? value.slice(0, 45) + '…' : value;
}

function formatRecoveryNumber(value) {
  const n = Number(value) || 0;
  try { return n.toLocaleString('ko-KR'); } catch { return String(n); }
}

function fallbackRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  try { return new Date(value).toLocaleString(); } catch { return String(ts || '-'); }
}
