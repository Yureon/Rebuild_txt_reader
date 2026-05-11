import { formatRelativeTime } from '../sync/sync-formatters.mjs';
import { renderRecoveryBadge, renderRecoverySummaryPanel, updateRecoveryCards } from './summary-panel.mjs';
import { renderRecoveryPolicyPanel } from './policy-checklist-panel.mjs';
import { focusRecoveryTarget, setRecoveryCenterRouteContext } from './navigation.mjs';
import { renderRecoveryDiagnosticsPanel } from './diagnostics-panel.mjs';
import { renderRecoveryCacheManagementPanel } from './cache-management-panel.mjs';
import { renderRecoverySearchPanel } from './search-panel.mjs';
import { applyRecoveryPrunePreset, deleteRecoveryCurrentCache, deleteRecoveryNovelCache, deleteRecoveryRangeCache, openRecoveryCachedNovelsModal, runRecoveryCachePrune, runRecoveryCachePruneDryRun } from './cache-actions.mjs';
import { openRecoveryCoverageModal } from './search-actions.mjs';
import {
  buildRecoveryBaseContext,
  buildRecoveryCacheManagementContext,
  buildRecoveryDiagnosticsContext,
  buildRecoverySearchContext,
  createRecoveryAdvancedGroup,
  createRecoveryLazyPanel,
  mergeRecoveryContexts,
  renderRecoveryPanelSafely,
  shouldAutoloadRecoveryPanel
} from './runtime.mjs';

export const RECOVERY_CENTER_ORCHESTRATION_PASS = 'v421-recovery-center-general-dev-orchestration-pass';

export async function renderRecoveryCenter(app, options = {}) {
  app.openLayer('recoveryCenterOverlay', 'recoveryCenterModal');
  const body = app.els.recoveryCenterBody;
  const baseContext = await buildRecoveryBaseContext(app);
  updateRecoveryCards(app, baseContext);
  renderRecoveryBadge(app, baseContext);

  if (!body) return;
  const manualDiagnosticsPanel = body.querySelector?.('[data-recovery-section="reader-manual-diagnostics"]')
    || app.els?.recoveryCenterModal?.querySelector?.('[data-recovery-section="reader-manual-diagnostics"]')
    || null;
  manualDiagnosticsPanel?.remove?.();
  if (manualDiagnosticsPanel?.dataset) {
    manualDiagnosticsPanel.dataset.readerManualDiagnosticsBodyOwner = 'v273';
  }
  body.innerHTML = '';

  const lazyContextCache = new Map();
  const lazyContext = (key, factory) => {
    if (!lazyContextCache.has(key)) lazyContextCache.set(key, Promise.resolve().then(factory));
    return lazyContextCache.get(key);
  };
  const loadDiagnosticsContext = () => lazyContext('diagnostics', () => buildRecoveryDiagnosticsContext(app, baseContext));
  const loadCacheContext = () => lazyContext('cache-management', () => buildRecoveryCacheManagementContext(app, baseContext));
  const loadSearchContext = () => lazyContext('search-coverage', () => buildRecoverySearchContext(app, baseContext));

  const refreshRecovery = (targetApp = app) => renderRecoveryCenter(targetApp).catch(() => {});
  const renderContext = mergeRecoveryContexts(baseContext, {
    searchCoverage: null,
    readerCacheDiagnostics: null,
    virtualDiagnostics: null,
    searchDiagnostics: null,
    libraryDiagnostics: null,
    libraryWindowDiagnostics: null,
    libraryPrototypeDiagnostics: null,
    libraryVirtualRenderDiagnostics: null,
    libraryActionAuditDiagnostics: null,
    cachePrunePlan: null
  });
  const advancedFocuses = new Set(['reader-manual-diagnostics', 'diagnostics', 'policy']);
  const advancedPanels = [
    manualDiagnosticsPanel,
    createRecoveryLazyPanel(app, 'diagnostics', '원본 진단', 'Reader/cache/virtual/search 원본 진단은 개발자 진단 영역에서 필요할 때만 생성합니다.', async () => {
      const context = await loadDiagnosticsContext();
      return renderRecoveryPanelSafely(app, 'diagnostics', 'Diagnostics', () => renderRecoveryDiagnosticsPanel(app, context));
    }, { autoLoad: shouldAutoloadRecoveryPanel(options, 'diagnostics') }),
    renderRecoveryPanelSafely(app, 'policy', 'Recovery policy', () => renderRecoveryPolicyPanel(baseContext.serverStatus))
  ];
  const panels = [
    renderRecoveryPanelSafely(app, 'summary', 'Summary', () => renderRecoverySummaryPanel(app, renderContext)),
    createRecoveryLazyPanel(app, 'cache-management', '캐시 관리', 'IndexedDB reader cache dry-run과 작품별 cache 요약은 이 섹션이 보일 때 생성합니다.', async () => {
      const context = await loadCacheContext();
      return renderRecoveryPanelSafely(app, 'cache-management', 'Cache management', () => renderRecoveryCacheManagementPanel(app, context, {
        formatRelativeTime,
        applyPreset: applyRecoveryPrunePreset,
        runDryRun: runRecoveryCachePruneDryRun,
        runPrune: (targetApp, refs) => runRecoveryCachePrune(targetApp, refs, { refreshRecovery: (nextApp = targetApp) => renderRecoveryCenter(nextApp) }),
        openCachedNovelsModal: (targetApp) => openRecoveryCachedNovelsModal(targetApp, { refreshRecovery: (nextApp = targetApp) => renderRecoveryCenter(nextApp) }),
        deleteNovelCache: (targetApp, item) => deleteRecoveryNovelCache(targetApp, item, { refreshRecovery: (nextApp = targetApp) => renderRecoveryCenter(nextApp) })
      }));
    }, { autoLoad: shouldAutoloadRecoveryPanel(options, 'cache-management') }),
    createRecoveryLazyPanel(app, 'search-coverage', '검색 진단', '검색 coverage와 cache-only 후보 분석은 이 섹션이 보일 때 생성합니다.', async () => {
      const context = await loadSearchContext();
      return renderRecoveryPanelSafely(app, 'search-coverage', 'Search diagnostics', () => renderRecoverySearchPanel(app, context, {
        openCoverageModal: (targetApp, coverage) => openRecoveryCoverageModal(targetApp, coverage, { refreshRecovery }),
        deleteRangeCache: (targetApp) => deleteRecoveryRangeCache(targetApp, { refreshRecovery }),
        deleteCurrentCache: (targetApp) => deleteRecoveryCurrentCache(targetApp, { refreshRecovery }),
        refreshRecovery
      }));
    }, { autoLoad: shouldAutoloadRecoveryPanel(options, 'search-coverage') }),
    createRecoveryAdvancedGroup(app, advancedPanels, { open: advancedFocuses.has(String(options?.focus || '')) })
  ].filter(Boolean);
  body.append(...panels);
  setRecoveryCenterRouteContext(app, options?.focus || 'summary');
  focusRecoveryTarget(app, { ...options, instant: options?.instant !== false });
}
