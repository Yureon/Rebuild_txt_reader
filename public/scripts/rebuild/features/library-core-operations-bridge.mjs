import { showLoading, status, toast } from './ui.mjs';
import { applyLibraryCatalogState } from './library-load-state.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { normalizeLibraryRenderOptions } from './library-render-options.mjs';
import { renderLibraryQuickList } from './library-quick-list.mjs';
import { finishLibraryDrag, supportsNativeLibraryDnd, validateLibraryMoveTarget } from './library-drag-drop.mjs';
import { getLibraryScrollAnchor, restoreLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { summarizeLibraryRowHeightMeasurement } from './library-row-diagnostics.mjs';
import { getLibraryActionAuditDiagnostics as buildLibraryActionAuditRuntimeDiagnostics } from './library-action-audit-runtime.mjs';
import { buildLibraryVirtualFallbackDiagnosticsForApp, buildLibraryVirtualRenderDiagnosticsForApp } from './library-virtual-diagnostics-summary.mjs';
import { buildLibraryVirtualPrototypeWindowRows as buildLibraryVirtualPrototypeWindowRowsHelper, createPrototypeLibraryRow as createPrototypeLibraryRowHelper, createRootDropZone as createRootDropZoneHelper, decorateVirtualLibraryRow as decorateVirtualLibraryRowHelper, getLibraryPrototypeDiagnostics as getLibraryPrototypeDiagnosticsHelper } from './library-prototype-rows.mjs';
import { LIBRARY_VIRTUAL_ROWS_CACHE_PASS, getLibraryVirtualRows } from './library-virtual-rows-runtime.mjs';
import { getLibraryVirtualGateRuntime, renderLibraryVirtualIfEnabledRuntime } from './library-virtual-render-runtime.mjs';
import { cancelLibraryVirtualRenderRuntime, scheduleLibraryVirtualRenderRuntime } from './library-virtual-render-scheduler.mjs';
import { renderLibraryEmptyStateRuntime } from './library-empty-renderer.mjs';
import { loadLibraryCatalogRuntime } from './library-catalog-loader.mjs';
import { renderLibraryOrchestratorRuntime } from './library-render-orchestrator.mjs';
import { renderLibraryFull as renderLibraryFullRuntime } from './library-full-renderer.mjs';
import { createLibraryDragDropDeps, createLibraryMoveDeps } from './library-runtime-dependency-bags.mjs';
import { LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS } from './library-runtime-config.mjs';

export const LIBRARY_CORE_OPERATIONS_BRIDGE_PASS = 'v304-library-core-operations-bridge-pass';

export function createLibraryCoreOperationsBridge(refs = {}) {
  function getLibraryDragDropDeps() { return createLibraryDragDropDeps({ getLibraryActionTarget: refs.getLibraryActionTarget, clearLongPress: refs.clearLongPress, formatFolderPath: refs.formatFolderPath, parentFolderPath: refs.parentFolderPath, normalizePromptCategory: refs.normalizePromptCategory, getCurrentLibraryPath: refs.getCurrentLibraryPath, moveDraggedLibraryItem: refs.moveDraggedLibraryItem }); }
  function getLibraryMoveDeps() { return createLibraryMoveDeps({ formatFolderPath: refs.formatFolderPath, getCurrentLibraryPath: refs.getCurrentLibraryPath, normalizePromptCategory: refs.normalizePromptCategory, validateLibraryMoveTarget: (target, targetPath, app) => validateLibraryMoveTarget(target, targetPath, { ...getLibraryDragDropDeps(), app }) }); }
  function scheduleLibraryVirtualRender(app) { return scheduleLibraryVirtualRenderRuntime(app, { isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, renderLibrary }); }
  function cancelLibraryVirtualRender(app) { return cancelLibraryVirtualRenderRuntime(app); }
  function getLibraryVirtualRenderDiagnostics(app) { return buildLibraryVirtualRenderDiagnosticsForApp(app, refs.getLibraryVirtualDiagnosticsDeps(app)); }
  function getLibraryVirtualFallbackDiagnostics(app, currentWindowRows = null) { return buildLibraryVirtualFallbackDiagnosticsForApp(app, currentWindowRows, refs.getLibraryVirtualDiagnosticsDeps(app)); }
  function buildLibraryVirtualPrototypeWindowRows(app, options = {}) { return buildLibraryVirtualPrototypeWindowRowsHelper(app, options, refs.getLibraryPrototypeRowsDeps(app)); }
  function getLibraryVirtualGate(app, visibleRows, windowPlan, options = {}) { return getLibraryVirtualGateRuntime(app, visibleRows, windowPlan, { ...options, deps: { buildLibraryVirtualPrototypeWindowRows, getLibraryActionAuditDiagnostics, rowsCachePass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS } }); }
  function getLibraryPrototypeDiagnostics(app) { return getLibraryPrototypeDiagnosticsHelper(app, refs.getLibraryPrototypeRowsDeps(app)); }
  function createPrototypeLibraryRow(app, row) { return createPrototypeLibraryRowHelper(app, row, refs.getLibraryPrototypeRowsDeps(app)); }
  function decorateVirtualLibraryRow(row, el) { return decorateVirtualLibraryRowHelper(row, el); }
  function getLibraryActionAuditDiagnostics(app) { return buildLibraryActionAuditRuntimeDiagnostics(app, { buildLibraryVirtualPrototypeWindowRows, formatFolderPath: refs.formatFolderPath, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, supportsNativeLibraryDnd }); }
  async function loadLibrary(app, options = {}) { return loadLibraryCatalogRuntime(app, options, { applyLibraryCatalogState, renderLibrary, showLoading, status, toast }); }
  function renderLibrary(app, options = {}) { return renderLibraryOrchestratorRuntime(app, options, { cancelLibraryVirtualRender, getLibraryFilteredNovels, normalizeLibraryRenderOptions, renderLibraryEmptyState, renderLibraryFull, renderLibraryQuickList, renderLibraryVirtualIfEnabled }); }
  function renderLibraryEmptyState(app, box, options = {}) { return renderLibraryEmptyStateRuntime(app, box, options, { recordLibraryVirtualRender: refs.recordLibraryVirtualRender }); }
  function renderLibraryFull(app, box, novels, reason = 'full-render', options = {}) { return renderLibraryFullRuntime(app, box, novels, reason, options, refs.getLibraryFullRendererDeps(app)); }
  function renderLibraryVirtualIfEnabled(app, box, novels, options = {}) { return renderLibraryVirtualIfEnabledRuntime(app, box, novels, options, { buildLibraryVirtualPrototypeWindowRows, getLibraryActionAuditDiagnostics, getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics, getLibraryVirtualRows, getLibraryVirtualWindowRendererDeps: refs.getLibraryVirtualWindowRendererDeps, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, recordLibraryVirtualFallback: refs.recordLibraryVirtualFallback, recordLibraryVirtualRender: refs.recordLibraryVirtualRender, getLibraryScrollAnchor, restoreLibraryScrollAnchor, rowsCachePass: LIBRARY_VIRTUAL_ROWS_CACHE_PASS, renderWindowSkipPass: LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS, summarizeLibraryRowHeightMeasurement }); }
  function createRootDropZone() { return createRootDropZoneHelper(); }
  return { buildLibraryVirtualPrototypeWindowRows, cancelLibraryVirtualRender, createPrototypeLibraryRow, createRootDropZone, decorateVirtualLibraryRow, finishLibraryDrag, getLibraryActionAuditDiagnostics, getLibraryDragDropDeps, getLibraryMoveDeps, getLibraryPrototypeDiagnostics, getLibraryVirtualFallbackDiagnostics, getLibraryVirtualGate, getLibraryVirtualRenderDiagnostics, loadLibrary, renderLibrary, renderLibraryEmptyState, renderLibraryFull, renderLibraryVirtualIfEnabled, scheduleLibraryVirtualRender };
}
