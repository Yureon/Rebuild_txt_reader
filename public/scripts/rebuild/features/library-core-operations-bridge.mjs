// compatibility contract: from './library-virtual-diagnostics-summary.mjs'
import { showLoading, status, toast } from './ui.mjs';
import { applyLibraryCatalogState } from './library-load-state.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { normalizeLibraryRenderOptions } from './library-render-options.mjs';
import { renderLibraryQuickList } from './library-quick-list.mjs';
import { finishLibraryDrag, supportsNativeLibraryDnd, validateLibraryMoveTarget } from './library-drag-drop-contract.mjs';
import { getLibraryScrollAnchor, restoreLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { summarizeLibraryRowHeightMeasurement } from './library-row-diagnostics.mjs';
import { buildLibraryVirtualPrototypeWindowRows as buildLibraryVirtualPrototypeWindowRowsHelper, createPrototypeLibraryRow as createPrototypeLibraryRowHelper, createRootDropZone as createRootDropZoneHelper, decorateVirtualLibraryRow as decorateVirtualLibraryRowHelper, getLibraryPrototypeDiagnostics as getLibraryPrototypeDiagnosticsHelper } from './library-prototype-rows.mjs';
import { LIBRARY_VIRTUAL_ROWS_CACHE_PASS, getLibraryCurrentWindowRows, getLibraryVirtualRows } from './library-virtual-rows-runtime.mjs';
import { getLibraryVirtualGateRuntime, renderLibraryVirtualIfEnabledRuntime } from './library-virtual-render-runtime.mjs';
import { cancelLibraryVirtualRenderRuntime, scheduleLibraryVirtualRenderRuntime } from './library-virtual-render-scheduler.mjs';
import { renderLibraryEmptyStateRuntime } from './library-empty-renderer.mjs';
import { loadLibraryCatalogRuntime } from './library-catalog-loader.mjs';
import { renderLibraryOrchestratorRuntime } from './library-render-orchestrator.mjs';
import { renderLibraryFull as renderLibraryFullRuntime } from './library-full-renderer.mjs';
import { renderLibraryExplorerRuntime } from './library-explorer-renderer.mjs';
import { loadFullLibraryCatalogRuntime, loadMoreLibraryTreeRuntime, loadLibraryShelfPageRuntime, renderLibraryShelfRuntime, syncLibraryShelfChromeRuntime } from './library-shelf-runtime.mjs';
import { createLibraryDragDropDeps, createLibraryMoveDeps } from './library-runtime-dependency-bags.mjs';
import { LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS } from './library-runtime-config.mjs';

export const LIBRARY_CORE_OPERATIONS_BRIDGE_PASS = 'v304-library-core-operations-bridge-pass';

export const LIBRARY_DIAGNOSTICS_LAZY_PASS = 'v599-library-diagnostics-lazy-pass';
let detailedDiagnostics = null;
let detailedDiagnosticsPromise = null;
export function preloadLibraryCoreDiagnostics() {
  if (detailedDiagnostics) return Promise.resolve(detailedDiagnostics);
  if (!detailedDiagnosticsPromise) {
    detailedDiagnosticsPromise = Promise.all([
      import('./library-virtual-diagnostics-summary.mjs'),
      import('./library-action-audit-runtime.mjs')
    ]).then(([summary, actionAudit]) => {
      detailedDiagnostics = { summary, actionAudit };
      return detailedDiagnostics;
    }).finally(() => { detailedDiagnosticsPromise = null; });
  }
  return detailedDiagnosticsPromise;
}

function buildBasicFallbackDiagnostics(app, currentWindowRows = null) {
  const state = app?.state || {};
  return {
    pass: LIBRARY_DIAGNOSTICS_LAZY_PASS,
    lazy: true,
    active: !!state.libraryVirtualAutoFallback,
    reason: state.libraryVirtualAutoFallback?.reason || '',
    at: Number(state.libraryVirtualAutoFallback?.at) || 0,
    currentWindowRows: Array.isArray(currentWindowRows) ? currentWindowRows.length : 0,
    history: Array.isArray(state.libraryVirtualFallbackHistory) ? state.libraryVirtualFallbackHistory.slice(-5) : []
  };
}

function buildBasicRenderDiagnostics(app, refs) {
  const state = app?.state || {};
  const requested = !!refs.isLibraryVirtualRendererRequested?.(app);
  const enabled = !!refs.isLibraryVirtualRendererEnabled?.(app);
  return {
    pass: LIBRARY_DIAGNOSTICS_LAZY_PASS,
    lazy: true,
    requested,
    enabled,
    active: app?.els?.novelList?.dataset?.libraryVirtualActive === '1',
    lastRender: state.libraryVirtualLastRender || null,
    renderHistory: Array.isArray(state.libraryVirtualRenderHistory) ? state.libraryVirtualRenderHistory.slice(-5) : [],
    fallback: buildBasicFallbackDiagnostics(app, refs.getLibraryCurrentWindowRows?.(app)),
    safeTrial: refs.getLibraryVirtualTrialDiagnostics?.(app) || null,
    note: 'detailed diagnostics load when Recovery Center opens'
  };
}

function buildBasicActionAudit(app) {
  const box = app?.els?.novelList;
  return {
    pass: LIBRARY_DIAGNOSTICS_LAZY_PASS,
    lazy: true,
    currentRenderer: box?.dataset?.libraryVirtualActive === '1' ? 'windowed' : 'full',
    actualRows: box?.querySelectorAll?.('.cat-header,.novel-item,.ep-item')?.length || 0,
    note: 'detailed action audit is deferred'
  };
}

export function createLibraryCoreOperationsBridge(refs = {}) {
  function safeGetLibraryCurrentWindowRows(app) {
    try {
      const resolver = typeof refs.getLibraryCurrentWindowRows === 'function'
        ? refs.getLibraryCurrentWindowRows
        : getLibraryCurrentWindowRows;
      return resolver(app);
    } catch (error) {
      if (app?.state) {
        app.state.libraryVirtualDiagnosticsError = {
          pass: 'v647-library-settings-diagnostics-guard-pass',
          message: String(error?.message || error || 'library diagnostics unavailable'),
          at: Date.now()
        };
      }
      return null;
    }
  }
  function getLibraryDragDropDeps() { return createLibraryDragDropDeps({ getLibraryActionTarget: refs.getLibraryActionTarget, clearLongPress: refs.clearLongPress, formatFolderPath: refs.formatFolderPath, parentFolderPath: refs.parentFolderPath, normalizePromptCategory: refs.normalizePromptCategory, getCurrentLibraryPath: refs.getCurrentLibraryPath, moveDraggedLibraryItem: refs.moveDraggedLibraryItem }); }
  function getLibraryMoveDeps() { return createLibraryMoveDeps({ formatFolderPath: refs.formatFolderPath, getCurrentLibraryPath: refs.getCurrentLibraryPath, normalizePromptCategory: refs.normalizePromptCategory, validateLibraryMoveTarget: (target, targetPath, app) => validateLibraryMoveTarget(target, targetPath, { ...getLibraryDragDropDeps(), app }) }); }
  function scheduleLibraryVirtualRender(app) { return scheduleLibraryVirtualRenderRuntime(app, { isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, renderLibrary }); }
  function cancelLibraryVirtualRender(app) { return cancelLibraryVirtualRenderRuntime(app); }
  function getLibraryVirtualRenderDiagnostics(app) {
    if (detailedDiagnostics?.summary?.buildLibraryVirtualRenderDiagnosticsForApp) return detailedDiagnostics.summary.buildLibraryVirtualRenderDiagnosticsForApp(app, refs.getLibraryVirtualDiagnosticsDeps(app));
    return buildBasicRenderDiagnostics(app, { ...refs, getLibraryCurrentWindowRows: safeGetLibraryCurrentWindowRows });
  }
  function getLibraryVirtualFallbackDiagnostics(app, currentWindowRows = null) {
    if (detailedDiagnostics?.summary?.buildLibraryVirtualFallbackDiagnosticsForApp) return detailedDiagnostics.summary.buildLibraryVirtualFallbackDiagnosticsForApp(app, currentWindowRows, refs.getLibraryVirtualDiagnosticsDeps(app));
    return buildBasicFallbackDiagnostics(app, currentWindowRows);
  }
  function buildLibraryVirtualPrototypeWindowRows(app, options = {}) { return buildLibraryVirtualPrototypeWindowRowsHelper(app, options, refs.getLibraryPrototypeRowsDeps(app)); }
  function getLibraryVirtualGate(app, visibleRows, windowPlan, options = {}) { return getLibraryVirtualGateRuntime(app, visibleRows, windowPlan, { ...options, deps: { buildLibraryVirtualPrototypeWindowRows, getLibraryActionAuditDiagnostics, rowsCachePass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS } }); }
  function getLibraryPrototypeDiagnostics(app) { return getLibraryPrototypeDiagnosticsHelper(app, refs.getLibraryPrototypeRowsDeps(app)); }
  function createPrototypeLibraryRow(app, row) { return createPrototypeLibraryRowHelper(app, row, refs.getLibraryPrototypeRowsDeps(app)); }
  function decorateVirtualLibraryRow(row, el) { return decorateVirtualLibraryRowHelper(row, el); }
  function getLibraryActionAuditDiagnostics(app) {
    if (detailedDiagnostics?.actionAudit?.getLibraryActionAuditDiagnostics) return detailedDiagnostics.actionAudit.getLibraryActionAuditDiagnostics(app, { buildLibraryVirtualPrototypeWindowRows, formatFolderPath: refs.formatFolderPath, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, supportsNativeLibraryDnd });
    return buildBasicActionAudit(app);
  }
  async function loadLibrary(app, options = {}) { return loadLibraryCatalogRuntime(app, options, { applyLibraryCatalogState, loadFullCatalog, loadShelfPage, renderLibrary, showLoading, status, syncLibraryChrome:syncLibraryShelfChromeRuntime, toast }); }
  async function loadShelfPage(app, options = {}) { return loadLibraryShelfPageRuntime(app, options, { renderLibrary, syncLibraryChrome:syncLibraryShelfChromeRuntime, toast }); }
  async function loadFullCatalog(app, options = {}) { return loadFullLibraryCatalogRuntime(app, options, { applyLibraryCatalogState, renderLibrary, showLoading, status, syncLibraryChrome:syncLibraryShelfChromeRuntime, toast }); }
  async function loadMoreFullCatalog(app, options = {}) { return loadMoreLibraryTreeRuntime(app, options, { applyLibraryCatalogState, renderLibrary, status, syncLibraryChrome:syncLibraryShelfChromeRuntime, toast }); }
  function renderLibrary(app, options = {}) { return renderLibraryOrchestratorRuntime(app, options, { cancelLibraryVirtualRender, getLibraryFilteredNovels, normalizeLibraryRenderOptions, renderLibraryEmptyState, renderLibraryExplorer, renderLibraryFull, renderLibraryQuickList, renderLibraryShelf:renderLibraryShelfRuntime, renderLibraryVirtualIfEnabled, syncLibraryChrome:syncLibraryShelfChromeRuntime }); }
  function renderLibraryEmptyState(app, box, options = {}) { return renderLibraryEmptyStateRuntime(app, box, options, { recordLibraryVirtualRender: refs.recordLibraryVirtualRender }); }
  function renderLibraryFull(app, box, novels, reason = 'full-render', options = {}) { return renderLibraryFullRuntime(app, box, novels, reason, options, refs.getLibraryFullRendererDeps(app)); }
  function renderLibraryExplorer(app, box, novels, options = {}) { return renderLibraryExplorerRuntime(app, box, novels, options, { ...refs.getLibraryFullRendererDeps(app), createRootDropZone }); }
  function renderLibraryVirtualIfEnabled(app, box, novels, options = {}) { return renderLibraryVirtualIfEnabledRuntime(app, box, novels, options, { buildLibraryVirtualPrototypeWindowRows, getLibraryActionAuditDiagnostics, getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics, getLibraryVirtualRows, getLibraryVirtualWindowRendererDeps: refs.getLibraryVirtualWindowRendererDeps, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, recordLibraryVirtualFallback: refs.recordLibraryVirtualFallback, recordLibraryVirtualRender: refs.recordLibraryVirtualRender, getLibraryScrollAnchor, restoreLibraryScrollAnchor, rowsCachePass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS, renderWindowSkipPass: LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS, summarizeLibraryRowHeightMeasurement }); }
  function createRootDropZone() { return createRootDropZoneHelper(); }
  return { preloadDiagnostics:preloadLibraryCoreDiagnostics, buildLibraryVirtualPrototypeWindowRows, cancelLibraryVirtualRender, createPrototypeLibraryRow, createRootDropZone, decorateVirtualLibraryRow, finishLibraryDrag, getLibraryActionAuditDiagnostics, getLibraryDragDropDeps, getLibraryMoveDeps, getLibraryPrototypeDiagnostics, getLibraryVirtualFallbackDiagnostics, getLibraryVirtualGate, getLibraryVirtualRenderDiagnostics, loadFullCatalog, loadMoreFullCatalog, loadLibrary, loadShelfPage, renderLibrary, renderLibraryEmptyState, renderLibraryExplorer, renderLibraryFull, renderLibraryVirtualIfEnabled, scheduleLibraryVirtualRender };
}
