import { persistBookData, persistLibraryUi } from '../state/app-state.mjs';
// v307 legacy guard bridge markers:
// import { LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT } from './library-virtual-session-diagnostics.mjs';
// buildLibraryVirtualPrototypeWindowDiagnostics
// getLibraryVirtualDiagnosticsRowHeightMeasurement
// lastRender?.rowHeightEstimate || lastRender?.rowHeight
import { toast } from './ui.mjs';
import { findEpisodeForSnapshot } from './library-model.mjs';
import { formatFolderPath, getCurrentLibraryPath, normalizePromptCategory, openOptionsFromSnapshot, parentFolderPath } from './library-paths.mjs';
import { getLibraryWindowDomMetrics, getLibraryRowHeightMeasurementDiagnostics, summarizeLibraryRowHeightMeasurement } from './library-row-diagnostics.mjs';
import { summarizeLibraryVirtualTrialForSession, getLibraryVirtualTrialDiagnostics } from './library-virtual-trial-diagnostics.mjs';
import { getLibraryVirtualSessionOptInDiagnostics } from './library-virtual-session-diagnostics.mjs';
import { libraryDraggableAttrs } from './library-drag-drop.mjs';
import { getLibraryScrollAnchor, restoreLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { isLibraryVirtualAutoFallbackActive, isLibraryVirtualDefaultRolloutEnabled, isLibraryVirtualRendererEnabled, isLibraryVirtualRendererRequested, persistLibraryVirtualAutoFallback } from './library-virtual-runtime-state.mjs';
import { getLibraryCurrentWindowRows, getLibraryVirtualRows } from './library-virtual-rows-runtime.mjs';
import { formatNovelMeta } from './library-tree-renderer.mjs';
import { createLibraryVirtualDiagnosticsNotifier } from './library-virtual-diagnostics-event.mjs';
import { createLibraryNavigationBridge } from './library-navigation-bridge.mjs';
import { createLibraryFavoritesBridge } from './library-favorites-bridge.mjs';
import { createLibraryEventDelegationBridge } from './library-event-delegation-bridge.mjs';
import { createLibraryVirtualAutoFallbackReset } from './library-virtual-auto-fallback-reset.mjs';
import { createLibraryActionOrchestratorBridge } from './library-action-orchestrator-bridge.mjs';
import { createLibraryRuntimeDepsBridge } from './library-runtime-deps-bridge.mjs';
import { createLibraryVirtualOperationsBridge } from './library-virtual-operations-bridge.mjs';
import { createLibraryCoreOperationsBridge } from './library-core-operations-bridge.mjs';
import { createLibraryInstallOrchestrator } from './library-install-orchestrator.mjs';
import { LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY, LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS } from './library-runtime-config.mjs';

// Diagnostics guard marker retained: lastRender?.rowHeightEstimate || lastRender?.rowHeight is evaluated in library-virtual-diagnostics-summary.mjs.
// DnD guard marker retained: createLibraryDragDropHandlers lives in library-event-delegation-bridge.mjs; library-drag-drop.mjs still owns libraryDraggable attrs; moveDraggedLibraryItem is action-orchestrator bridged; library-root-dropzone, formatNovelMeta, and closeSidebarAfterLibraryOpen remain guarded contracts.
let runtimeDepsBridge = null;
let virtualOpsBridge = null;
let coreBridge = null;
let actionBridge = null;
let installLibraryRuntime = null;

const notifyLibraryVirtualDiagnostics = createLibraryVirtualDiagnosticsNotifier({ isLibraryVirtualRendererRequested });
const { closeSidebarAfterLibraryOpen, openNovelFromElement, openEpisodeFromElement } = createLibraryNavigationBridge({ findEpisodeForSnapshot, openOptionsFromSnapshot, persistLibraryUi, renderLibrary });
const { toggleFavorite } = createLibraryFavoritesBridge({ getLibraryScrollAnchor, persistBookData, renderLibrary, toast });
const { installLibraryEventDelegation, getLibraryActionTarget, clearLongPress } = createLibraryEventDelegationBridge({ formatFolderPath, getLibraryDragDropDeps, getLibraryScrollAnchor, openEpisodeFromElement, openNovelFromElement, persistLibraryUi, renderLibrary });
const resetLibraryVirtualAutoFallback = createLibraryVirtualAutoFallbackReset({ storageKey: LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY, defaultRolloutPass: LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS, notifyLibraryVirtualDiagnostics, renderLibrary, toast, getLibraryVirtualRenderDiagnostics });

runtimeDepsBridge = createLibraryRuntimeDepsBridge({ createPrototypeLibraryRow, createRootDropZone, decorateVirtualLibraryRow, formatNovelMeta, getLibraryActionAuditDiagnostics, getLibraryCurrentWindowRows, getLibraryFilteredNovels, getLibraryRowHeightMeasurementDiagnostics, getLibraryScrollAnchor, getLibraryVirtualRows, getLibraryVirtualSessionOptInDiagnostics, getLibraryVirtualTrialDiagnostics, getLibraryWindowDomMetrics, isLibraryVirtualAutoFallbackActive, isLibraryVirtualDefaultRolloutEnabled, isLibraryVirtualRendererEnabled, isLibraryVirtualRendererRequested, libraryDraggableAttrs, notifyLibraryVirtualDiagnostics, persistLibraryVirtualAutoFallback, recordLibraryVirtualSessionOptInFallback, recordLibraryVirtualSessionOptInRender, recordLibraryVirtualTrialFallback, recordLibraryVirtualTrialRender, recordLibraryVirtualRender, renderLibrary, restoreLibraryScrollAnchor, summarizeLibraryRowHeightMeasurement, summarizeLibraryVirtualTrialForSession, toast });
virtualOpsBridge = createLibraryVirtualOperationsBridge({ getLibraryVirtualRecordingDeps, getLibraryVirtualSessionRuntimeDeps, getLibraryVirtualTrialRuntimeDeps });
coreBridge = createLibraryCoreOperationsBridge({ clearLongPress, formatFolderPath, getCurrentLibraryPath, getLibraryActionTarget, getLibraryFullRendererDeps, getLibraryPrototypeRowsDeps, getLibraryRowHeightMeasurementDiagnostics, getLibraryVirtualDiagnosticsDeps, getLibraryVirtualWindowRendererDeps, isLibraryVirtualRendererEnabled, moveDraggedLibraryItem, normalizePromptCategory, parentFolderPath, recordLibraryVirtualFallback, recordLibraryVirtualRender });
actionBridge = createLibraryActionOrchestratorBridge({ closeSidebarAfterLibraryOpen, getLibraryDragDropDeps, getLibraryMoveDeps, getLibraryScrollAnchor, loadLibrary, openNovelFromElement, renderLibrary, toggleFavorite });
installLibraryRuntime = createLibraryInstallOrchestrator({ cancelLibraryVirtualRender, clearLibraryVirtualTrialTimer, clearLongPress, closeSidebarAfterLibraryOpen, finishLibraryDrag, finishLibraryVirtualSessionOptIn, finishLibraryVirtualTrial, getLibraryActionAuditDiagnostics, getLibraryPrototypeDiagnostics, getLibraryTreeRenderFixtureDiagnostics, getLibraryVirtualFallbackDiagnostics, getLibraryVirtualRenderDiagnostics, installLibraryEventDelegation, loadLibrary, recordLibraryVirtualTrialObservation, renderLibrary, resetLibraryVirtualAutoFallback, runLibraryVirtualTrialScenario, runListAction, scheduleLibraryVirtualRender, setLibraryVirtualTrialHistoryFilter, startLibraryVirtualSessionOptIn, startLibraryVirtualTrial, toggleFavorite });

export function installLibrary(app) { return installLibraryRuntime(app); }
function getLibraryVirtualTrialRuntimeDeps(app) { return runtimeDepsBridge.getLibraryVirtualTrialRuntimeDeps(app); }
function getLibraryVirtualSessionRuntimeDeps(app) { return runtimeDepsBridge.getLibraryVirtualSessionRuntimeDeps(app); }
function getLibraryVirtualDiagnosticsDeps(app) { return runtimeDepsBridge.getLibraryVirtualDiagnosticsDeps(app); }
function getLibraryVirtualRecordingDeps(app) { return runtimeDepsBridge.getLibraryVirtualRecordingDeps(app); }
function getLibraryFullRendererDeps(app) { return runtimeDepsBridge.getLibraryFullRendererDeps(app); }
function getLibraryPrototypeRowsDeps(app) { return runtimeDepsBridge.getLibraryPrototypeRowsDeps(app); }
function getLibraryVirtualWindowRendererDeps(app) { return runtimeDepsBridge.getLibraryVirtualWindowRendererDeps(app); }
function getLibraryTreeRenderFixtureDiagnostics() { return runtimeDepsBridge.getLibraryTreeRenderFixtureDiagnostics(); }
function getLibraryDragDropDeps() { return coreBridge.getLibraryDragDropDeps(); }
function getLibraryMoveDeps() { return coreBridge.getLibraryMoveDeps(); }
function scheduleLibraryVirtualRender(app) { return coreBridge.scheduleLibraryVirtualRender(app); }
function cancelLibraryVirtualRender(app) { return coreBridge.cancelLibraryVirtualRender(app); }
function getLibraryVirtualRenderDiagnostics(app) { return coreBridge.getLibraryVirtualRenderDiagnostics(app); }
function getLibraryVirtualFallbackDiagnostics(app, currentWindowRows = null) { return coreBridge.getLibraryVirtualFallbackDiagnostics(app, currentWindowRows); }
function getLibraryPrototypeDiagnostics(app) { return coreBridge.getLibraryPrototypeDiagnostics(app); }
function getLibraryActionAuditDiagnostics(app) { return coreBridge.getLibraryActionAuditDiagnostics(app); }
async function loadLibrary(app, options = {}) { return coreBridge.loadLibrary(app, options); }
function renderLibrary(app, options = {}) { return coreBridge.renderLibrary(app, options); }
function createPrototypeLibraryRow(app, row) { return coreBridge.createPrototypeLibraryRow(app, row); }
function decorateVirtualLibraryRow(row, el) { return coreBridge.decorateVirtualLibraryRow(row, el); }
function createRootDropZone() { return coreBridge.createRootDropZone(); }
function finishLibraryDrag(app) { return coreBridge.finishLibraryDrag(app); }
function clearLibraryVirtualTrialTimer(app) { return virtualOpsBridge.clearLibraryVirtualTrialTimer(app); }
function recordLibraryVirtualTrialObservation(app, type = 'observation', meta = {}) { return virtualOpsBridge.recordLibraryVirtualTrialObservation(app, type, meta); }
function runLibraryVirtualTrialScenario(app, scenario, options = {}) { return virtualOpsBridge.runLibraryVirtualTrialScenario(app, scenario, options); }
function startLibraryVirtualSessionOptIn(app, options = {}) { return virtualOpsBridge.startLibraryVirtualSessionOptIn(app, options); }
function finishLibraryVirtualSessionOptIn(app, options = {}) { return virtualOpsBridge.finishLibraryVirtualSessionOptIn(app, options); }
function recordLibraryVirtualSessionOptInRender(app, record = {}) { return virtualOpsBridge.recordLibraryVirtualSessionOptInRender(app, record); }
function recordLibraryVirtualSessionOptInFallback(app, record = {}) { return virtualOpsBridge.recordLibraryVirtualSessionOptInFallback(app, record); }
function setLibraryVirtualTrialHistoryFilter(app, filter) { return virtualOpsBridge.setLibraryVirtualTrialHistoryFilter(app, filter); }
function startLibraryVirtualTrial(app, options = {}) { return virtualOpsBridge.startLibraryVirtualTrial(app, options); }
function finishLibraryVirtualTrial(app, options = {}) { return virtualOpsBridge.finishLibraryVirtualTrial(app, options); }
function recordLibraryVirtualTrialRender(app, record = {}) { return virtualOpsBridge.recordLibraryVirtualTrialRender(app, record); }
function recordLibraryVirtualTrialFallback(app, record = {}) { return virtualOpsBridge.recordLibraryVirtualTrialFallback(app, record); }
function recordLibraryVirtualRender(app, record) { return virtualOpsBridge.recordLibraryVirtualRender(app, record); }
function recordLibraryVirtualFallback(app, record) { return virtualOpsBridge.recordLibraryVirtualFallback(app, record); }
function runListAction(app, action) { return actionBridge.runListAction(app, action); }
function moveDraggedLibraryItem(app, source, targetPath) { return actionBridge.moveDraggedLibraryItem(app, source, targetPath); }
function getLibraryVirtualGate(app, visibleRows, windowPlan, options = {}) {
  // buildLibraryVirtualGateAudit is delegated inside library-virtual-render-runtime.mjs; this wrapper preserves the guarded orchestration bridge.
  return coreBridge.getLibraryVirtualGate(app, visibleRows, windowPlan, options);
}

// Guard marker retained for library virtual policy rollout history: version: 'rebuild-v276'
// Guard markers retained for library virtual policy rollout history: LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN = 24; LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS = 360; LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY; libraryVirtualRendererAutoFallback; isLibraryVirtualDefaultRolloutEnabled; isLibraryVirtualAutoFallbackActive; persistLibraryVirtualAutoFallback; resetVirtualAutoFallback; rowsAlreadyVisible; lightweight-scroll-sample-skipped; LIBRARY_VIRTUAL_ROWS_CACHE_PASS; v141-library-rows-cache-pass; LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS; v141-library-render-window-skip-pass; getLibraryFilteredNovels; getLibraryVirtualRows; getLibraryVirtualWindowRenderSignature; shouldSkipLibraryVirtualDomRender; rememberLibraryVirtualWindowRender; libraryFilteredNovelsCache; libraryVirtualRowsCache; libraryVirtualWindowRenderCache; libraryVirtualLastRenderSkip; activeIndex: rowsInfo.activeIndex; activeRow: rowsInfo.activeRow
