import { collectFolderKeys, getLibraryFlattenDiagnostics, getLibraryWindowDiagnostics, getProgressRatioForState, itemKey } from './library-model.mjs';
import { getLibraryWindowDomMetrics, getLibraryRowHeightMeasurementDiagnostics } from './library-row-diagnostics.mjs';
import { getLibraryCurrentWindowRows } from './library-virtual-rows-runtime.mjs';
import { getLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { getLibraryVirtualSessionOptInDiagnostics } from './library-virtual-session-diagnostics.mjs';
import { getLibraryVirtualTrialDiagnostics, normalizeLibraryVirtualTrialHistoryFilter } from './library-runtime-config.mjs';
import { installLibraryQuickListDelegation, removeLibraryQuickRecentItem } from './library-quick-list.mjs';
import { openLibraryQuickItem, revealLibraryQuickItemInList } from './library-quick-actions.mjs';
import { installListActionSheet } from './library-list-actions.mjs';
import { createLibraryAppApiRuntime } from './library-app-api.mjs';
import { cleanupLibraryRuntime, createLibraryFilteredRenderRuntime, installLibraryControlHandlersRuntime } from './library-install-controls-runtime.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { persistLibraryUi } from '../state/app-state.mjs';
import { LIBRARY_FILTER_RENDER_WAIT } from './library-runtime-config.mjs';
import { toast } from './ui.mjs';

export const LIBRARY_INSTALL_ORCHESTRATOR_PASS = 'v304-library-install-orchestrator-pass';

export const LIBRARY_ASYNC_EVENT_GUARD_PASS='v612-library-async-event-guard-pass';
function reportLibraryAsyncEventError(app,error,type){void import('./library-async-event-errors.mjs').then(m=>m.reportLibraryAsyncEventError(app,error,type)).catch(()=>{})}
export function createLibrarySafeEventRegistrar(app,disposers=[]){return(target,type,handler,options)=>{if(!target||typeof handler!=='function')return;const safeHandler=event=>{try{const result=handler(event);if(result&&typeof result.then==='function')Promise.resolve(result).catch(error=>reportLibraryAsyncEventError(app,error,type))}catch(error){reportLibraryAsyncEventError(app,error,type)}};target.addEventListener(type,safeHandler,options);disposers.push(()=>target.removeEventListener(type,safeHandler,options))}}

export function createLibraryInstallOrchestrator(refs = {}) {
  return function installLibrary(app) {
    app.libraryCleanup?.();
    const disposers = [];
    const on = createLibrarySafeEventRegistrar(app, disposers);
    const renderFilteredLibrary = createLibraryFilteredRenderRuntime(app, { filterRenderWait: LIBRARY_FILTER_RENDER_WAIT, loadShelfPage: refs.loadShelfPage, renderLibrary: refs.renderLibrary });
    app.library = createLibraryAppApiRuntime(app, { preloadLibraryDiagnostics: refs.preloadLibraryDiagnostics, ensureNovelEpisodesLoaded: refs.ensureNovelEpisodesLoaded, ensureShelfNovelLoaded: refs.ensureShelfNovelLoaded, finishLibraryVirtualSessionOptIn: refs.finishLibraryVirtualSessionOptIn, finishLibraryVirtualTrial: refs.finishLibraryVirtualTrial, getLibraryActionAuditDiagnostics: refs.getLibraryActionAuditDiagnostics, getLibraryCurrentWindowRows, getLibraryFlattenDiagnostics, getLibraryPrototypeDiagnostics: refs.getLibraryPrototypeDiagnostics, getLibraryRowHeightMeasurementDiagnostics, getLibraryScrollAnchor, getLibraryTreeRenderFixtureDiagnostics: refs.getLibraryTreeRenderFixtureDiagnostics, getLibraryVirtualFallbackDiagnostics: refs.getLibraryVirtualFallbackDiagnostics, getLibraryVirtualRenderDiagnostics: refs.getLibraryVirtualRenderDiagnostics, getLibraryVirtualSessionOptInDiagnostics, getLibraryVirtualTrialDiagnostics, getLibraryWindowDiagnostics, getLibraryWindowDomMetrics, getProgressRatioForState, itemKey, loadFullCatalog: refs.loadFullCatalog, loadLibrary: refs.loadLibrary, loadShelfPage: refs.loadShelfPage, normalizeLibraryVirtualTrialHistoryFilter, recordLibraryVirtualTrialObservation: refs.recordLibraryVirtualTrialObservation, renderFilteredLibrary, renderLibrary: refs.renderLibrary, resetLibraryVirtualAutoFallback: refs.resetLibraryVirtualAutoFallback, runLibraryVirtualTrialScenario: refs.runLibraryVirtualTrialScenario, setLibraryShelfScope: refs.setLibraryShelfScope, setLibraryVirtualTrialHistoryFilter: refs.setLibraryVirtualTrialHistoryFilter, startLibraryVirtualSessionOptIn: refs.startLibraryVirtualSessionOptIn, startLibraryVirtualTrial: refs.startLibraryVirtualTrial, switchLibraryView: refs.switchLibraryView });
    refs.installLibraryShelfControls?.(app, on, { loadShelfPage: refs.loadShelfPage, openNovelFromElement: refs.openNovelFromElement, removeRecent: refs.removeRecent, renderLibrary: refs.renderLibrary, setScope: refs.setLibraryShelfScope, switchView: refs.switchLibraryView, syncLibraryChrome: refs.syncLibraryChrome, toggleFavorite: refs.toggleFavorite });
    refs.installLibraryEventDelegation?.(app, on);
    installLibraryQuickListDelegation(app, on, { open: item => openLibraryQuickItem(app, item, { closeSidebarAfterLibraryOpen: refs.closeSidebarAfterLibraryOpen }), reveal: item => revealLibraryQuickItemInList(app, item, { getLibraryFilteredNovels, renderLibrary: refs.renderLibrary, toast }), favoriteToggle: item => refs.toggleFavorite?.(app, item?.dataset?.novelId || ''), removeRecent: item => removeLibraryQuickRecentItem(app, item) });
    installListActionSheet(app, on, { runAction: action => refs.runListAction?.(app, action) });
    installLibraryControlHandlersRuntime(app, on, renderFilteredLibrary, { collectFolderKeys, getLibraryScrollAnchor, loadShelfPage: refs.loadShelfPage, persistLibraryUi, renderLibrary: refs.renderLibrary, scheduleLibraryVirtualRender: refs.scheduleLibraryVirtualRender });
    app.libraryCleanup = () => cleanupLibraryRuntime(app, renderFilteredLibrary, disposers, { cancelLibraryVirtualRender: refs.cancelLibraryVirtualRender, clearLibraryVirtualTrialTimer: refs.clearLibraryVirtualTrialTimer, clearLongPress: refs.clearLongPress, finishLibraryDrag: refs.finishLibraryDrag });
  };
}
