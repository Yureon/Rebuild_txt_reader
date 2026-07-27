import { createEl, formatBytes } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { deleteReaderCacheByRule, deleteReaderCacheChunks, deleteReaderCacheForCurrent, deleteReaderCacheForNovel, getReaderCacheDefaultPruneLimits, getReaderCacheNovelStats, planReaderCachePrune, runManualReaderCachePrune } from '../reader/cache-store.mjs';
import { getOfflineRange } from '../reader/offline-status.mjs';
import { formatReaderCacheDeleteBatchResult, formatReaderCacheDeleteResult, formatReaderCacheRuleDeleteResult, getReaderCacheDeleteToastTone } from '../reader/cache-delete-formatters.mjs';
import { buildCachedNovelRuleFromFilter, formatCachedNovelMeta, formatPruneCompact, formatPrunePlan, isCacheNovelOlderThan, parseRecoveryPruneOptions, shortCacheSignature } from './cache-diagnostics.mjs';
import { exportRecoveryJsonPayload } from './export-utils.mjs';
import { markRecoverySubModalLayer } from './modal-layer.mjs';

export const RECOVERY_CACHE_ACTIONS_REFACTOR_PASS = 'v175-recovery-cache-actions-pass';

export async function applyRecoveryPrunePreset(app, refs, preset) {
  const limits = getReaderCacheDefaultPruneLimits();
  const map = {
    default: { entries: limits.maxEntries, mb: Math.max(1, Math.round(limits.maxBytes / 1024 / 1024)), radius: 8, protect: true },
    conservative: { entries: Math.max(limits.maxEntries, 720), mb: Math.max(160, Math.round(limits.maxBytes / 1024 / 1024)), radius: 16, protect: true },
    compact: { entries: 180, mb: 48, radius: 6, protect: true }
  };
  const next = map[preset] || map.default;
  if (refs.maxEntriesInput) refs.maxEntriesInput.value = String(next.entries);
  if (refs.maxMbInput) refs.maxMbInput.value = String(next.mb);
  if (refs.radiusInput) refs.radiusInput.value = String(next.radius);
  if (refs.protectInput) refs.protectInput.checked = !!next.protect;
  await runRecoveryCachePruneDryRun(app, refs);
}

export async function runRecoveryCachePruneDryRun(app, refs) {
  const options = parseRecoveryPruneOptions(refs);
  const plan = await planReaderCachePrune(app, options);
  if (refs.planBox) refs.planBox.textContent = formatPrunePlan(plan, { formatRelativeTime });
  toast(app, plan.available ? 'success' : 'error', plan.available ? 'Prune 예상 완료' : 'Prune 예상 실패', plan.available ? formatPruneCompact(plan) : (plan.error || 'IndexedDB 사용 불가'));
}

export async function runRecoveryCachePrune(app, refs, options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  const optionsValue = parseRecoveryPruneOptions(refs);
  const plan = await planReaderCachePrune(app, optionsValue);
  if (refs.planBox) refs.planBox.textContent = formatPrunePlan(plan, { formatRelativeTime });
  if (!plan.available) return toast(app, 'error', 'Prune 실행 불가', plan.error || 'IndexedDB 사용 불가');
  if (!plan.remove) return toast(app, 'info', 'Prune 실행 불필요', '삭제 대상이 없습니다.');
  const warning = plan.limitedByProtected ? '\n\n현재 작품 보호 항목 때문에 목표치까지 줄어들지 않을 수 있습니다.' : '';
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(`IndexedDB reader cache ${plan.remove}개(${formatBytes(plan.removeBytes)})를 삭제할까요?${warning}`);
  if (!ok) return;
  const result = await runManualReaderCachePrune(app, optionsValue);
  app.state.chunkTextCache?.clear?.();
  app.offlineStatus?.refreshCoverage?.();
  await refreshRecovery(app);
  const detail = formatReaderCacheDeleteResult(result, formatBytes);
  toast(app, getReaderCacheDeleteToastTone(result), result.available ? 'Prune 실행 완료' : 'Prune 실행 실패', detail);
}

export async function deleteRecoveryNovelCache(app, item, options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  if (!item?.novelId) return;
  const title = item.title || item.novelId;
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(`${title}의 IndexedDB reader cache ${item.entries || 0}개를 삭제할까요? 읽기 위치와 서버 데이터는 유지합니다.`);
  if (!ok) return;
  const result = await deleteReaderCacheForNovel(app, item.novelId);
  app.state.chunkTextCache?.clear?.();
  app.offlineStatus?.refreshCoverage?.();
  await refreshRecovery(app);
  const detail = formatReaderCacheDeleteResult(result, formatBytes);
  toast(app, getReaderCacheDeleteToastTone(result), result.available ? '작품별 cache 삭제 완료' : '작품별 cache 삭제 실패', detail);
}

export async function openRecoveryCachedNovelsModal(app, options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  const overlay = createEl('div', { class:'recovery-chunk-overlay recovery-novels-overlay' });
  const modal = createEl('div', { class:'recovery-chunk-modal recovery-novels-modal' });
  markRecoverySubModalLayer(overlay, modal, 'cached-novels');
  const title = createEl('div', { class:'recovery-chunk-title', text:'전체 cached novels' });
  const sub = createEl('div', { class:'recovery-chunk-sub', text:'IndexedDB reader cache에 저장된 작품을 검색/정렬하고 작품 단위로 삭제합니다.' });
  const closeBtn = createEl('button', { class:'recovery-chunk-close', type:'button', text:'✕', 'aria-label':'닫기' });
  const queryInput = createEl('input', { class:'recovery-novels-search', type:'search', placeholder:'작품명 / novelId 검색' });
  const filterSelect = createEl('select', { class:'recovery-novels-filter' }, [
    createEl('option', { value:'all', text:'전체' }),
    createEl('option', { value:'staleSignature', text:'현재 전처리와 다른 signature 포함' }),
    createEl('option', { value:'multiSignature', text:'signature 2개 이상' }),
    createEl('option', { value:'old7', text:'최근 7일 미사용' }),
    createEl('option', { value:'old30', text:'최근 30일 미사용' }),
    createEl('option', { value:'old90', text:'최근 90일 미사용' })
  ]);
  const sortSelect = createEl('select', { class:'recovery-novels-sort' }, [
    createEl('option', { value:'bytes', text:'용량순' }),
    createEl('option', { value:'staleBytes', text:'stale 용량순' }),
    createEl('option', { value:'entries', text:'entries순' }),
    createEl('option', { value:'lastAccessedAt', text:'최근 사용순' }),
    createEl('option', { value:'oldestAccessedAt', text:'오래된 사용순' }),
    createEl('option', { value:'title', text:'제목순' })
  ]);
  const count = createEl('div', { class:'recovery-chunk-count', text:'불러오는 중...' });
  const list = createEl('div', { class:'recovery-novels-list' });
  const moreBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'더 보기' });
  const selectVisibleBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'표시 항목 선택' });
  const clearSelectionBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'선택 해제' });
  const deleteSelectedBtn = createEl('button', { class:'devdbg-btn danger', type:'button', text:'선택 작품 전체 삭제' });
  const deleteRuleBtn = createEl('button', { class:'devdbg-btn danger', type:'button', text:'필터 규칙 삭제' });
  const copySelectedBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'선택 JSON 복사' });
  const copyBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'목록 JSON 복사' });
  const selected = new Set();
  let stats = { available:false, novels:[], entries:0, bytes:0 };
  let visibleLimit = 200;
  let renderTimer = 0;

  const close = () => overlay.remove();
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
  queryInput.addEventListener('input', () => scheduleRender(true));
  filterSelect.addEventListener('change', () => scheduleRender(true));
  sortSelect.addEventListener('change', () => scheduleRender(true));
  moreBtn.addEventListener('click', () => { visibleLimit += 200; render(); });
  selectVisibleBtn.addEventListener('click', () => {
    getFilteredNovels().slice(0, visibleLimit).forEach(item => selected.add(item.novelId));
    render();
  });
  clearSelectionBtn.addEventListener('click', () => { selected.clear(); render(); });
  copyBtn.addEventListener('click', async () => {
    const payload = {
      entries: stats.entries || 0,
      bytes: stats.bytes || 0,
      novelGroups: stats.novelGroups || 0,
      query: queryInput.value || '',
      filter: filterSelect.value || 'all',
      sort: sortSelect.value || 'bytes',
      currentSignature: stats.currentSignature || '',
      selectedNovelIds: Array.from(selected),
      novels: getFilteredNovels(),
      copiedAt: Date.now()
    };
    try {
      await exportRecoveryJsonPayload(app, payload);
      toast(app, 'success', 'Cached novels 복사 완료', '현재 필터 결과 JSON을 클립보드에 복사했습니다.');
    } catch (error) {
      toast(app, 'error', 'Cached novels 복사 실패', error.message || String(error));
    }
  });
  copySelectedBtn.addEventListener('click', async () => {
    const ids = new Set(Array.from(selected));
    const payload = {
      entries: stats.entries || 0,
      bytes: stats.bytes || 0,
      query: queryInput.value || '',
      filter: filterSelect.value || 'all',
      sort: sortSelect.value || 'bytes',
      currentSignature: stats.currentSignature || '',
      selectedNovelIds: Array.from(selected),
      novels: getFilteredNovels().filter(item => ids.has(item.novelId)),
      copiedAt: Date.now()
    };
    try {
      await exportRecoveryJsonPayload(app, payload);
      toast(app, 'success', '선택 cache JSON 복사 완료', '선택한 cached novel 목록을 클립보드에 복사했습니다.');
    } catch (error) {
      toast(app, 'error', '선택 cache JSON 복사 실패', error.message || String(error));
    }
  });
  deleteRuleBtn.addEventListener('click', async () => {
    const rule = buildCachedNovelRuleFromFilter(filterSelect.value, stats);
    if (!rule.hasRule) return toast(app, 'info', '필터 규칙 삭제 불가', '전체 필터에서는 규칙 삭제를 사용할 수 없습니다. signature 또는 오래된 cache 필터를 선택하세요.');
    const novels = getFilteredNovels();
    if (!novels.length) return toast(app, 'info', '필터 규칙 삭제', '조건에 맞는 작품이 없습니다.');
    const novelIds = novels.map(item => item.novelId).filter(Boolean);
    const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(`${novelIds.length}개 작품에서 ${rule.label}에 해당하는 IndexedDB reader cache 항목만 삭제할까요? 현재 작품 주변 보호는 적용됩니다.`);
    if (!ok) return;
    const result = await deleteReaderCacheByRule(app, { ...rule.options, novelIds, protectCurrent: true, protectRadius: 8 });
    app.state.chunkTextCache?.clear?.();
    app.offlineStatus?.refreshCoverage?.();
    await reload();
    await refreshRecovery(app);
    const detail = formatReaderCacheRuleDeleteResult(result, formatBytes);
    toast(app, result.available ? 'success' : 'error', result.available ? '필터 규칙 삭제 완료' : '필터 규칙 삭제 실패', detail);
  });
  deleteSelectedBtn.addEventListener('click', async () => {
    const ids = Array.from(selected).filter(Boolean);
    if (!ids.length) return toast(app, 'info', '선택 삭제', '선택된 작품 cache가 없습니다.');
    const summary = ids.length + '개 작품의 IndexedDB reader cache를 삭제할까요? 읽기 위치, 북마크, 서버 데이터는 유지합니다.';
    const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(summary);
    if (!ok) return;
    await deleteRecoveryNovelCaches(app, ids);
    selected.clear();
    await reload();
    await refreshRecovery(app);
  });

  modal.append(
    createEl('div', { class:'recovery-chunk-head' }, [createEl('div', {}, [title, sub]), closeBtn]),
    createEl('div', { class:'recovery-novels-toolbar' }, [queryInput, filterSelect, sortSelect]),
    createEl('div', { class:'recovery-chunk-actions' }, [selectVisibleBtn, clearSelectionBtn, deleteSelectedBtn, deleteRuleBtn, copySelectedBtn, copyBtn]),
    count,
    list,
    createEl('div', { class:'recovery-chunk-footer' }, [moreBtn])
  );
  overlay.append(modal);
  document.body.append(overlay);
  await reload();

  async function reload() {
    list.replaceChildren(createEl('div', { class:'recovery-cache-empty', text:'IndexedDB cache 목록을 불러오는 중입니다.' }));
    stats = await getReaderCacheNovelStats(app);
    visibleLimit = 200;
    render();
  }

  function scheduleRender(resetLimit = false) {
    if (resetLimit) visibleLimit = 200;
    if (renderTimer) window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(() => {
      renderTimer = 0;
      render();
    }, 80);
  }

  function getFilteredNovels() {
    const query = String(queryInput.value || '').trim().toLowerCase();
    const filter = filterSelect.value || 'all';
    const source = Array.isArray(stats.novels) ? stats.novels : [];
    const now = Date.now();
    const filtered = source.filter(item => {
      const matchesQuery = !query || [item.title, item.novelId].some(value => String(value || '').toLowerCase().includes(query));
      if (!matchesQuery) return false;
      if (filter === 'staleSignature') return Number(item.staleSignatureEntries) > 0;
      if (filter === 'multiSignature') return Number(item.signatures) > 1;
      if (filter === 'old7') return isCacheNovelOlderThan(item, now, 7);
      if (filter === 'old30') return isCacheNovelOlderThan(item, now, 30);
      if (filter === 'old90') return isCacheNovelOlderThan(item, now, 90);
      return true;
    });
    const sort = sortSelect.value || 'bytes';
    filtered.sort((a, b) => {
      if (sort === 'title') return String(a.title || a.novelId).localeCompare(String(b.title || b.novelId), 'ko');
      if (sort === 'lastAccessedAt') return (Number(b.lastAccessedAt) || 0) - (Number(a.lastAccessedAt) || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'ko');
      if (sort === 'oldestAccessedAt') return (Number(a.oldestAccessedAt) || 0) - (Number(b.oldestAccessedAt) || 0) || String(a.title || '').localeCompare(String(b.title || ''), 'ko');
      if (sort === 'staleBytes') return (Number(b.staleSignatureBytes) || 0) - (Number(a.staleSignatureBytes) || 0) || (Number(b.bytes) || 0) - (Number(a.bytes) || 0);
      if (sort === 'entries') return (Number(b.entries) || 0) - (Number(a.entries) || 0) || (Number(b.bytes) || 0) - (Number(a.bytes) || 0);
      return (Number(b.bytes) || 0) - (Number(a.bytes) || 0) || (Number(b.entries) || 0) - (Number(a.entries) || 0);
    });
    return filtered;
  }

  function render() {
    if (!stats.available) {
      count.textContent = 'IndexedDB reader cache를 사용할 수 없습니다.';
      list.replaceChildren(createEl('div', { class:'recovery-cache-empty', text:stats.error || 'IndexedDB unavailable' }));
      moreBtn.hidden = true;
      deleteSelectedBtn.disabled = true;
      return;
    }
    const filtered = getFilteredNovels();
    const visible = filtered.slice(0, visibleLimit);
    const selectedBytes = filtered.filter(item => selected.has(item.novelId)).reduce((sum, item) => sum + (Number(item.bytes) || 0), 0);
    const staleEntries = filtered.reduce((sum, item) => sum + (Number(item.staleSignatureEntries) || 0), 0);
    const staleBytes = filtered.reduce((sum, item) => sum + (Number(item.staleSignatureBytes) || 0), 0);
    count.textContent = `표시 ${visible.length}/${filtered.length} · 전체 ${stats.novelGroups || 0}작품 · ${stats.entries || 0} entries · ${formatBytes(stats.bytes || 0)} · stale ${staleEntries} entries/${formatBytes(staleBytes)} · 선택 ${selected.size}작품/${formatBytes(selectedBytes)} · signature ${shortCacheSignature(stats.currentSignature || '')}`;
    moreBtn.hidden = visible.length >= filtered.length;
    deleteSelectedBtn.disabled = selected.size === 0;
    copySelectedBtn.disabled = selected.size === 0;
    deleteRuleBtn.disabled = !buildCachedNovelRuleFromFilter(filterSelect.value, stats).hasRule || !filtered.length;
    if (!visible.length) {
      list.replaceChildren(createEl('div', { class:'recovery-cache-empty', text:'조건에 맞는 cached novel이 없습니다.' }));
      return;
    }
    list.replaceChildren(...visible.map(item => renderNovelRow(item)));
  }

  function renderNovelRow(item) {
    const checkbox = createEl('input', { type:'checkbox' });
    checkbox.checked = selected.has(item.novelId);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) selected.add(item.novelId);
      else selected.delete(item.novelId);
      render();
    });
    const deleteBtn = createEl('button', { class:'devdbg-btn danger tiny', type:'button', text:'삭제' });
    deleteBtn.addEventListener('click', async ev => {
      ev.preventDefault();
      ev.stopPropagation();
      const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(`${item.title || item.novelId}의 IndexedDB reader cache ${item.entries || 0}개를 삭제할까요?`);
      if (!ok) return;
      await deleteRecoveryNovelCaches(app, [item.novelId]);
      selected.delete(item.novelId);
      await reload();
      await refreshRecovery(app);
    });
    return createEl('label', { class:'recovery-novel-cache-row' }, [
      checkbox,
      createEl('div', { class:'recovery-cache-novel-main' }, [
        createEl('div', { class:'recovery-cache-novel-title', text:item.title || item.novelId }),
        createEl('div', { class:'recovery-cache-novel-meta', text:formatCachedNovelMeta(item, { formatRelativeTime }) })
      ]),
      createEl('div', { class:'recovery-cache-novel-time', text:item.lastAccessedAt ? formatRelativeTime(item.lastAccessedAt) : '-' }),
      deleteBtn
    ]);
  }
}

export async function deleteRecoveryNovelCaches(app, novelIds = []) {
  const ids = Array.from(new Set(novelIds.map(value => String(value || '').trim()).filter(Boolean)));
  let removed = 0;
  let bytes = 0;
  let failed = 0;
  for (const novelId of ids) {
    const result = await deleteReaderCacheForNovel(app, novelId);
    if (result?.available) {
      removed += Number(result.removed) || 0;
      bytes += Number(result.bytes) || 0;
    } else {
      failed += 1;
    }
  }
  app.state.chunkTextCache?.clear?.();
  app.offlineStatus?.refreshCoverage?.();
  const detail = formatReaderCacheDeleteBatchResult({ removed, bytes, failed }, formatBytes);
  toast(app, failed ? 'warn' : 'success', failed ? '일부 cache 삭제 실패' : '작품별 cache 삭제 완료', detail);
  return { removed, bytes, failed };
}

export async function deleteRecoveryRangeCache(app, options = {}) {
  const range = getOfflineRange(app);
  if (!range) return toast(app, 'info', '캐시 삭제', '삭제할 현재 주변 범위가 없습니다.');
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm('현재 주변 ' + range.start + '-' + range.end + ' 구간의 IndexedDB reader cache를 삭제할까요?');
  if (!ok) return;
  const chunks = [];
  for (let chunk = range.start; chunk <= range.end; chunk += 1) chunks.push(chunk);
  await deleteRecoveryCacheChunks(app, chunks, { label:'현재 주변 캐시', refreshRecovery: options.refreshRecovery });
}

export async function deleteRecoveryCurrentCache(app, options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  if (!app.state.current) return toast(app, 'info', '캐시 삭제', '먼저 작품을 열어주세요.');
  const label = app.state.current.title || app.state.current.novel?.title || '현재 작품';
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(label + '의 IndexedDB reader cache 전체를 삭제할까요? 읽기 위치와 서버 데이터는 유지합니다.');
  if (!ok) return;
  const result = await deleteReaderCacheForCurrent(app, app.state.current);
  app.state.chunkTextCache?.clear?.();
  app.offlineStatus?.refreshCoverage?.();
  await refreshRecovery(app);
  const detail = formatReaderCacheDeleteResult(result, formatBytes);
  toast(app, getReaderCacheDeleteToastTone(result), result.available ? '현재 작품 캐시 삭제 완료' : '현재 작품 캐시 삭제 실패', detail);
}

export async function deleteRecoveryCacheChunks(app, chunks = [], options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  const list = normalizeChunkList(chunks);
  if (!list.length) return;
  const label = options.label || '선택 캐시';
  const ok = typeof window === 'undefined' || typeof window.confirm !== 'function' || window.confirm(label + ' ' + list.length + '개 chunk의 IndexedDB reader cache를 삭제할까요?');
  if (!ok) return;
  const result = await deleteReaderCacheChunks(app, app.state.current, list);
  list.forEach(chunk => app.state.chunkTextCache?.delete?.(chunk));
  app.offlineStatus?.refreshCoverage?.();
  await refreshRecovery(app);
  const detail = formatReaderCacheDeleteResult(result, formatBytes);
  toast(app, getReaderCacheDeleteToastTone(result), result.available ? '캐시 삭제 완료' : '캐시 삭제 실패', detail);
}

export function normalizeChunkList(chunks) {
  const out = [];
  const seen = new Set();
  (Array.isArray(chunks) ? chunks : []).forEach(value => {
    const chunk = Math.max(1, Math.round(Number(value) || 0));
    if (!chunk || seen.has(chunk)) return;
    seen.add(chunk);
    out.push(chunk);
  });
  return out.sort((a, b) => a - b);
}

function formatRelativeTime(ts) {
  const value = Number(ts) || 0;
  if (!value) return '-';
  const diff = Math.max(0, Date.now() - value);
  if (diff < 60_000) return '방금';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`;
  return new Date(value).toLocaleString();
}

async function noopAsync() {}
