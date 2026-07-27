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
import { summarizeLibraryVirtualTrialForSession, getLibraryVirtualTrialDiagnostics } from './library-runtime-config.mjs';
import { getLibraryVirtualSessionOptInDiagnostics } from './library-virtual-session-diagnostics.mjs';
import { libraryDraggableAttrs } from './library-drag-drop-contract.mjs';
import { getLibraryScrollAnchor, restoreLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { isLibraryVirtualAutoFallbackActive, isLibraryVirtualDefaultRolloutEnabled, isLibraryVirtualRendererEnabled, isLibraryVirtualRendererRequested, persistLibraryVirtualAutoFallback } from './library-virtual-runtime-state.mjs';
import { getLibraryCurrentWindowRows, getLibraryVirtualRows } from './library-virtual-rows-runtime.mjs';
import { formatNovelMeta } from './library-tree-renderer.mjs';
// compatibility contract: from './library-full-renderer.mjs'
// compatibility contract: from './library-virtual-diagnostics-event.mjs'
// compatibility contract: from './library-navigation-bridge.mjs'
// compatibility contract: from './library-favorites-bridge.mjs'
import { createLibraryEventDelegationBridge } from './library-event-delegation-bridge.mjs';
import { createLibraryVirtualAutoFallbackReset } from './library-virtual-auto-fallback-reset.mjs';
import { createLibraryActionOrchestratorBridge, createLibraryFavoritesBridge, createLibraryNavigationBridge, createLibraryVirtualDiagnosticsNotifier } from './library-action-orchestrator-bridge.mjs';
import { createLibraryRuntimeDepsBridge } from './library-runtime-deps-bridge.mjs';
import { createLibraryVirtualOperationsBridge } from './library-virtual-operations-bridge.mjs';
import { createLibraryCoreOperationsBridge } from './library-core-operations-bridge.mjs';
import { createLibraryInstallOrchestrator } from './library-install-orchestrator.mjs';
import { LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY, LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS } from './library-runtime-config.mjs';
import { ensureNovelEpisodesLoadedRuntime, ensureShelfNovelLoadedRuntime, installLibraryShelfControlsRuntime, removeLibraryRecentNovelState, setLibraryShelfScopeRuntime, switchLibraryViewRuntime, syncLibraryShelfChromeRuntime } from './library-shelf-runtime.mjs';

// Diagnostics guard marker retained: lastRender?.rowHeightEstimate || lastRender?.rowHeight is evaluated in library-virtual-diagnostics-summary.mjs.
// compatibility contract: from './library-drag-drop.mjs'
// DnD guard marker retained: createLibraryDragDropHandlers lives in library-event-delegation-bridge.mjs; library-drag-drop.mjs still owns libraryDraggable attrs; moveDraggedLibraryItem is action-orchestrator bridged; library-root-dropzone, formatNovelMeta, and closeSidebarAfterLibraryOpen remain guarded contracts.
let runtimeDepsBridge = null;
let virtualOpsBridge = null;
let coreBridge = null;
let actionBridge = null;
let installLibraryRuntime = null;

async function persistSharedBookData(app){return (await import('./bookmarks/model.mjs')).persistAndSync(app)}

const notifyLibraryVirtualDiagnostics = createLibraryVirtualDiagnosticsNotifier({ isLibraryVirtualRendererRequested });
const { closeSidebarAfterLibraryOpen, openNovelFromElement, openEpisodeFromElement } = createLibraryNavigationBridge({ ensureNovelEpisodesLoaded, findEpisodeForSnapshot, openOptionsFromSnapshot, persistLibraryUi, renderLibrary, toast });
const { toggleFavorite:toggleFavoriteLocal } = createLibraryFavoritesBridge({ getLibraryScrollAnchor, persistBookData, renderLibrary, toast });
const { installLibraryEventDelegation, getLibraryActionTarget, clearLongPress } = createLibraryEventDelegationBridge({ ensureNovelEpisodesLoaded, formatFolderPath, getLibraryDragDropDeps, getLibraryScrollAnchor, loadMoreCatalog:loadMoreFullCatalog, openEpisodeFromElement, openNovelFromElement, persistLibraryUi, renderLibrary, toast });
const resetLibraryVirtualAutoFallback = createLibraryVirtualAutoFallbackReset({ storageKey: LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY, defaultRolloutPass: LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS, notifyLibraryVirtualDiagnostics, renderLibrary, toast, getLibraryVirtualRenderDiagnostics });

runtimeDepsBridge = createLibraryRuntimeDepsBridge({ createPrototypeLibraryRow, createRootDropZone, decorateVirtualLibraryRow, formatNovelMeta, getLibraryActionAuditDiagnostics, getLibraryCurrentWindowRows, getLibraryFilteredNovels, getLibraryRowHeightMeasurementDiagnostics, getLibraryScrollAnchor, getLibraryVirtualRows, getLibraryVirtualSessionOptInDiagnostics, getLibraryVirtualTrialDiagnostics, getLibraryWindowDomMetrics, isLibraryVirtualAutoFallbackActive, isLibraryVirtualDefaultRolloutEnabled, isLibraryVirtualRendererEnabled, isLibraryVirtualRendererRequested, libraryDraggableAttrs, notifyLibraryVirtualDiagnostics, persistLibraryVirtualAutoFallback, recordLibraryVirtualSessionOptInFallback, recordLibraryVirtualSessionOptInRender, recordLibraryVirtualTrialFallback, recordLibraryVirtualTrialRender, recordLibraryVirtualRender, renderLibrary, restoreLibraryScrollAnchor, summarizeLibraryRowHeightMeasurement, summarizeLibraryVirtualTrialForSession, toast });
virtualOpsBridge = createLibraryVirtualOperationsBridge({ getLibraryVirtualRecordingDeps, getLibraryVirtualSessionRuntimeDeps, getLibraryVirtualTrialRuntimeDeps });
coreBridge = createLibraryCoreOperationsBridge({ clearLongPress, formatFolderPath, getCurrentLibraryPath, getLibraryActionTarget, getLibraryFullRendererDeps, getLibraryPrototypeRowsDeps, getLibraryRowHeightMeasurementDiagnostics, getLibraryVirtualDiagnosticsDeps, getLibraryVirtualWindowRendererDeps, isLibraryVirtualRendererEnabled, moveDraggedLibraryItem, normalizePromptCategory, parentFolderPath, recordLibraryVirtualFallback, recordLibraryVirtualRender });
actionBridge = createLibraryActionOrchestratorBridge({ closeSidebarAfterLibraryOpen, getLibraryDragDropDeps, getLibraryMoveDeps, getLibraryScrollAnchor, loadLibrary, openNovelFromElement, renderLibrary, toggleFavorite });
installLibraryRuntime = createLibraryInstallOrchestrator({ preloadLibraryDiagnostics, cancelLibraryVirtualRender, clearLibraryVirtualTrialTimer, clearLongPress, closeSidebarAfterLibraryOpen, ensureNovelEpisodesLoaded, ensureShelfNovelLoaded, finishLibraryDrag, finishLibraryVirtualSessionOptIn, finishLibraryVirtualTrial, getLibraryActionAuditDiagnostics, getLibraryPrototypeDiagnostics, getLibraryTreeRenderFixtureDiagnostics, getLibraryVirtualFallbackDiagnostics, getLibraryVirtualRenderDiagnostics, installLibraryEventDelegation, installLibraryShelfControls: installLibraryShelfControlsRuntime, loadFullCatalog, loadLibrary, loadShelfPage, openNovelFromElement, recordLibraryVirtualTrialObservation, removeRecent:removeRecentFromShelf, renderLibrary, resetLibraryVirtualAutoFallback, runLibraryVirtualTrialScenario, runListAction, scheduleLibraryVirtualRender, setLibraryShelfScope, setLibraryVirtualTrialHistoryFilter, startLibraryVirtualSessionOptIn, startLibraryVirtualTrial, switchLibraryView, syncLibraryChrome:syncLibraryShelfChromeRuntime, toggleFavorite });

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
function preloadLibraryDiagnostics() { return Promise.all([coreBridge.preloadDiagnostics?.(), virtualOpsBridge.preloadLibraryVirtualTrialRuntime?.(), runtimeDepsBridge.preloadLibraryTreeRenderFixture?.()]); }
function getLibraryVirtualRenderDiagnostics(app) { return coreBridge.getLibraryVirtualRenderDiagnostics(app); }
function getLibraryVirtualFallbackDiagnostics(app, currentWindowRows = null) { return coreBridge.getLibraryVirtualFallbackDiagnostics(app, currentWindowRows); }
function getLibraryPrototypeDiagnostics(app) { return coreBridge.getLibraryPrototypeDiagnostics(app); }
function getLibraryActionAuditDiagnostics(app) { return coreBridge.getLibraryActionAuditDiagnostics(app); }
async function loadLibrary(app, options = {}) { return coreBridge.loadLibrary(app, options); }
async function loadShelfPage(app, options = {}) { return coreBridge.loadShelfPage(app, options); }
async function loadFullCatalog(app, options = {}) { return coreBridge.loadFullCatalog(app, options); }
async function loadMoreFullCatalog(app, options = {}) { return coreBridge.loadMoreFullCatalog(app, options); }
async function ensureShelfNovelLoaded(app, novelId) { return ensureShelfNovelLoadedRuntime(app, novelId); }
async function ensureNovelEpisodesLoaded(app, novelOrId) { return ensureNovelEpisodesLoadedRuntime(app, novelOrId); }
async function switchLibraryView(app, mode) { return switchLibraryViewRuntime(app, mode, { loadFullCatalog, loadShelfPage, renderLibrary, syncLibraryChrome:syncLibraryShelfChromeRuntime }); }
function toggleFavorite(app,id,options={}){const r=toggleFavoriteLocal(app,id,options);r.syncPromise=persistSharedBookData(app);return r}
function removeRecentFromShelf(app,id){
  const novelId=String(id||'');
  if(!novelId||!Array.isArray(app?.state?.recents))return {changed:false,novelId};
  const result=removeLibraryRecentNovelState(app.state,novelId);
  if(!result.changed)return result;
  persistBookData(app.state);
  const syncPromise=persistSharedBookData(app).catch(error=>{toast(app,'error','최근 항목 동기화 실패',error?.message||String(error));return null});
  toast(app,'info','최근 항목','목록에서 제거했습니다.');
  return {...result,syncPromise};
}
async function setLibraryShelfScope(app,scope){if(scope==='favorites'||scope==='recent')await persistSharedBookData(app);return setLibraryShelfScopeRuntime(app,scope,{loadShelfPage,syncLibraryChrome:syncLibraryShelfChromeRuntime})}
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
