import { createEl } from '../../core/utils.mjs';
import { getReaderCacheCoverage, getReaderCacheDefaultPruneLimits, getReaderCacheDiagnostics, getReaderCacheStats, planReaderCachePrune } from '../reader/cache-store.mjs';
import { getReaderPrefetchSnapshot } from '../reader/prefetch-queue.mjs';
import { getNetworkProfile, getOfflineRange } from '../reader/offline-status.mjs';
import { getVirtualLayoutDiagnostics } from '../reader/virtual-layout.mjs';
import { buildRecoverySearchCoverage, getSearchTextCacheDiagnostics } from './search-diagnostics.mjs';

export const RECOVERY_RUNTIME_REFACTOR_PASS = 'v164-recovery-runtime-context-lazy-panel-pass';
export const RECOVERY_CENTER_RENDER_HARDENING_PASS = 'v140-recovery-center-render-hardening';
export const RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS = 'v142-recovery-lazy-diagnostics-pass';
export const RECOVERY_CENTER_COMPACT_ADVANCED_PASS = 'v421-recovery-center-dev-diagnostics-collapse-pass';
export const RECOVERY_CENTER_GENERAL_DEV_SPLIT_PASS = 'v421-recovery-center-general-dev-split-pass';
export const RECOVERY_STATUS_NON_ACTIONABLE_PASS = 'v422-recovery-status-non-actionable-pass';
export const RECOVERY_BADGE_ACTIONABLE_ONLY_PASS = 'v422-recovery-badge-actionable-only-pass';

export async function getRecoveryServerStatus(app) {
  if (!app.api?.get) return null;
  try {
    return await app.api.get('/api/recovery-status', { noRedirect: true });
  } catch (error) {
    const status = Number(error?.status || 0);
    const code = String(error?.data?.error || error?.message || '');
    if (status === 401 || status === 403 || code === 'owner_session_required') {
      return {
        available: false,
        scopedOut: true,
        degraded: false,
        status,
        reason: code || (status ? String(status) : 'owner_only'),
        note: 'owner 전용 recovery-status API를 사용할 수 없는 세션입니다. 일반 복구 UI에서는 조치 필요로 취급하지 않습니다.',
        pass: RECOVERY_STATUS_NON_ACTIONABLE_PASS
      };
    }
    return {
      available: false,
      degraded: false,
      status: status || 0,
      reason: error?.message || String(error || 'recovery status unavailable'),
      note: 'recovery-status 조회 실패는 개발자 진단 정보 누락으로만 표시하고, 데이터 복구 위험으로 승격하지 않습니다.',
      pass: RECOVERY_STATUS_NON_ACTIONABLE_PASS
    };
  }
}

export function isActionableRecoveryFailure(item = {}) {
  const area = String(item.area || '');
  const message = String(item.message || item.detail || '');
  const text = (area + ' ' + message).toLowerCase();
  if (!text) return false;
  if (/recovery-status|recovery-lazy-render|recovery-render/.test(text)) return false;
  if (/owner_session_required|401|403|forbidden|unauthorized/.test(text)) return false;
  return /(sync|persist|write|save|storage|indexeddb|quota|server-state|user-state)/.test(text);
}

export function mergeRecoveryContexts(...contexts) {
  return Object.assign({}, ...contexts.filter(Boolean));
}

export async function buildRecoveryBaseContext(app) {
  const cacheStats = await getReaderCacheStats();
  const serverStatus = await getRecoveryServerStatus(app);
  const prefetchSnapshot = getReaderPrefetchSnapshot(app);
  const queueLength = prefetchSnapshot.pending || 0;
  const range = getOfflineRange(app);
  const coverage = range ? await getReaderCacheCoverage(app, app.state.current, range) : null;
  const networkProfile = getNetworkProfile();
  const lastRead = app.state.progress?.lastRead || null;
  const lastServerSync = app.state.syncPolicySummary?.updatedAt || app.state.shared?.updatedAt || app.state.device?.updatedAt || 0;
  const lastFailure = [...(app.state.errors || [])].reverse().find(item => isActionableRecoveryFailure(item));
  return {
    cacheStats,
    serverStatus,
    prefetchSnapshot,
    queueLength,
    coverage,
    networkProfile,
    lastRead,
    lastServerSync,
    lastFailure
  };
}

export async function buildRecoveryDiagnosticsContext(app, baseContext = {}) {
  const searchCoverage = app.state.current ? await buildRecoverySearchCoverage(app) : null;
  const readerCacheDiagnostics = await getReaderCacheDiagnostics(app, app.state.current);
  const virtualDiagnostics = getVirtualLayoutDiagnostics(app);
  const searchDiagnostics = getSearchTextCacheDiagnostics(app, searchCoverage);
  return mergeRecoveryContexts(baseContext, {
    searchCoverage,
    readerCacheDiagnostics,
    virtualDiagnostics,
    searchDiagnostics
  });
}

export async function buildRecoveryCacheManagementContext(app, baseContext = {}) {
  const readerCacheDiagnostics = await getReaderCacheDiagnostics(app, app.state.current);
  const pruneLimits = getReaderCacheDefaultPruneLimits();
  const cachePrunePlan = await planReaderCachePrune(app, { maxEntries: pruneLimits.maxEntries, maxBytes: pruneLimits.maxBytes, protectCurrent: true, protectRadius: 8 });
  return mergeRecoveryContexts(baseContext, {
    readerCacheDiagnostics,
    cachePrunePlan
  });
}

export async function buildRecoverySearchContext(app, baseContext = {}) {
  const searchCoverage = app.state.current ? await buildRecoverySearchCoverage(app) : null;
  const searchDiagnostics = getSearchTextCacheDiagnostics(app, searchCoverage);
  return mergeRecoveryContexts(baseContext, {
    searchCoverage,
    searchDiagnostics
  });
}


export function createRecoveryAdvancedGroup(app, panels = [], options = {}) {
  const list = (Array.isArray(panels) ? panels : []).filter(Boolean);
  if (!list.length) return null;
  const details = createEl('details', {
    class:'recovery-advanced-group',
    dataset:{
      recoverySectionGroup:'advanced',
      recoveryAdvancedCollapsePass:RECOVERY_CENTER_COMPACT_ADVANCED_PASS
    }
  });
  if (options.open) details.open = true;
  const summary = createEl('summary', { class:'recovery-advanced-summary' }, [
    createEl('span', { text:'개발자 진단' }),
    createEl('small', { text:'일반 복구에서 제외한 원본/수동 진단만 필요 시 표시' })
  ]);
  const body = createEl('div', { class:'recovery-advanced-body' }, list);
  details.append(summary, body);
  return details;
}

export function createRecoveryLazyPanel(app, sectionId, label, description, factory, options = {}) {
  const section = createEl('section', {
    class:'recovery-section recovery-lazy-panel',
    dataset:{
      recoverySection:sectionId,
      recoveryLazyPass:RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS,
      recoveryRuntimePass:RECOVERY_RUNTIME_REFACTOR_PASS,
      recoveryLazyState:'idle'
    }
  });
  const status = createEl('div', { class:'recovery-cache-empty', text:description || '상세 진단은 필요할 때 생성합니다.' });
  const loadBtn = createEl('button', { class:'devdbg-btn tiny', type:'button', text:'진단 불러오기' });
  const titleRow = createEl('div', { class:'recovery-section-title-row' }, [
    createEl('div', {}, [
      createEl('div', { class:'recovery-section-title', text:label || sectionId }),
      createEl('div', { class:'recovery-section-desc', text:description || 'Recovery Center lazy diagnostics placeholder. 펼치거나 이동하면 상세 DOM과 JSON payload를 생성합니다.' })
    ]),
    loadBtn
  ]);
  section.append(titleRow, status);
  let started = false;
  let observer = null;
  const load = async () => {
    if (started) return;
    started = true;
    section.dataset.recoveryLazyState = 'loading';
    loadBtn.disabled = true;
    loadBtn.textContent = '불러오는 중';
    status.textContent = '상세 진단을 생성하는 중입니다.';
    try {
      const panel = await factory();
      if (panel) {
        panel.dataset.recoveryLazyPass = RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS;
        panel.dataset.recoveryRuntimePass = RECOVERY_RUNTIME_REFACTOR_PASS;
        panel.dataset.recoveryLazyState = 'rendered';
        section.replaceWith(panel);
      } else {
        section.dataset.recoveryLazyState = 'empty';
        status.textContent = '생성된 진단 패널이 없습니다.';
      }
    } catch (error) {
      const message = error?.message || String(error || 'unknown error');
      app?.state?.errors?.push?.({ area:'recovery-lazy-render', section:sectionId, message, stack:error?.stack || '', at:Date.now(), pass:RECOVERY_CENTER_LAZY_DIAGNOSTICS_PASS, refactorPass:RECOVERY_RUNTIME_REFACTOR_PASS });
      console.error?.('[txt-reader:rebuild] recovery lazy panel render failed', sectionId, error);
      section.dataset.recoveryLazyState = 'error';
      loadBtn.disabled = false;
      loadBtn.textContent = '다시 시도';
      started = false;
      status.replaceChildren(createEl('div', { class:'recovery-diag-item bad' }, [
        createEl('div', { class:'title', text:(label || sectionId) + ' 지연 렌더링 실패' }),
        createEl('div', { class:'desc', text:message })
      ]));
    } finally {
      if (observer) observer.disconnect?.();
    }
  };
  section.loadRecoveryLazyPanel = load;
  loadBtn.addEventListener('click', load);
  if (options.autoLoad) {
    window.setTimeout(load, 0);
  } else if (typeof IntersectionObserver === 'function') {
    window.setTimeout(() => {
      if (!section.isConnected) return;
      observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) load();
      }, { root: app?.els?.recoveryCenterBody || null, rootMargin:'180px 0px 220px 0px', threshold:0.01 });
      observer.observe(section);
    }, 0);
  }
  return section;
}

export function shouldAutoloadRecoveryPanel(options, sectionId) {
  return String(options?.focus || '') === String(sectionId || '');
}

export function renderRecoveryPanelSafely(app, sectionId, label, factory) {
  try {
    return factory();
  } catch (error) {
    const message = error?.message || String(error || 'unknown error');
    app?.state?.errors?.push?.({ area:'recovery-render', section:sectionId, message, stack:error?.stack || '', at:Date.now(), pass:RECOVERY_CENTER_RENDER_HARDENING_PASS, refactorPass:RECOVERY_RUNTIME_REFACTOR_PASS });
    console.error?.('[txt-reader:rebuild] recovery panel render failed', sectionId, error);
    return createEl('section', { class:'recovery-section recovery-panel-error', dataset:{ recoverySection:sectionId, recoveryRenderHardeningPass:RECOVERY_CENTER_RENDER_HARDENING_PASS, recoveryRuntimePass:RECOVERY_RUNTIME_REFACTOR_PASS } }, [
      createEl('div', { class:'recovery-diag-item bad' }, [
        createEl('div', { class:'title', text:(label || sectionId) + ' 패널 렌더링 실패' }),
        createEl('div', { class:'desc', text:message }),
        createEl('div', { class:'desc', text:'다른 복구센터 섹션은 계속 표시됩니다. 콘솔 stack 또는 복구 JSON을 기준으로 해당 패널만 수정하세요.' })
      ])
    ]);
  }
}
