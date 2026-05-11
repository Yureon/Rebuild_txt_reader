import { collectFolderKeys, getLibraryFlattenDiagnostics, getLibraryWindowDiagnostics, getProgressRatioForState, itemKey } from './library-model.mjs';
import { getLibraryWindowDomMetrics, getLibraryRowHeightMeasurementDiagnostics } from './library-row-diagnostics.mjs';
import { getLibraryCurrentWindowRows } from './library-virtual-rows-runtime.mjs';
import { getLibraryScrollAnchor } from './library-scroll-anchor.mjs';
import { getLibraryVirtualSessionOptInDiagnostics } from './library-virtual-session-diagnostics.mjs';
import { getLibraryVirtualTrialDiagnostics, normalizeLibraryVirtualTrialHistoryFilter } from './library-virtual-trial-diagnostics.mjs';
import { installLibraryQuickListDelegation, removeLibraryQuickRecentItem } from './library-quick-list.mjs';
import { openLibraryQuickItem, revealLibraryQuickItemInList } from './library-quick-actions.mjs';
import { installListActionSheet } from './library-list-actions.mjs';
import { createLibraryAppApiRuntime } from './library-app-api.mjs';
import { cleanupLibraryRuntime, createLibraryFilteredRenderRuntime, installLibraryControlHandlersRuntime } from './library-install-controls-runtime.mjs';
import { getLibraryFilteredNovels } from './library-current-selection.mjs';
import { persistLibraryUi } from '../state/app-state.mjs';
import { toast } from './ui.mjs';
import { LIBRARY_FILTER_RENDER_WAIT } from './library-runtime-config.mjs';

export const LIBRARY_INSTALL_ORCHESTRATOR_PASS = 'v304-library-install-orchestrator-pass';

export function createLibraryInstallOrchestrator(refs = {}) {
  return function installLibrary(app) {
    app.libraryCleanup?.();
    const disposers = [];
    const on = (target, type, handler, options) => { if (!target) return; target.addEventListener(type, handler, options); disposers.push(() => target.removeEventListener(type, handler, options)); };
    const renderFilteredLibrary = createLibraryFilteredRenderRuntime(app, { filterRenderWait: LIBRARY_FILTER_RENDER_WAIT, renderLibrary: refs.renderLibrary });
    app.library = createLibraryAppApiRuntime(app, { finishLibraryVirtualSessionOptIn: refs.finishLibraryVirtualSessionOptIn, finishLibraryVirtualTrial: refs.finishLibraryVirtualTrial, getLibraryActionAuditDiagnostics: refs.getLibraryActionAuditDiagnostics, getLibraryCurrentWindowRows, getLibraryFlattenDiagnostics, getLibraryPrototypeDiagnostics: refs.getLibraryPrototypeDiagnostics, getLibraryRowHeightMeasurementDiagnostics, getLibraryScrollAnchor, getLibraryTreeRenderFixtureDiagnostics: refs.getLibraryTreeRenderFixtureDiagnostics, getLibraryVirtualFallbackDiagnostics: refs.getLibraryVirtualFallbackDiagnostics, getLibraryVirtualRenderDiagnostics: refs.getLibraryVirtualRenderDiagnostics, getLibraryVirtualSessionOptInDiagnostics, getLibraryVirtualTrialDiagnostics, getLibraryWindowDiagnostics, getLibraryWindowDomMetrics, getProgressRatioForState, itemKey, loadLibrary: refs.loadLibrary, normalizeLibraryVirtualTrialHistoryFilter, recordLibraryVirtualTrialObservation: refs.recordLibraryVirtualTrialObservation, renderFilteredLibrary, renderLibrary: refs.renderLibrary, resetLibraryVirtualAutoFallback: refs.resetLibraryVirtualAutoFallback, runLibraryVirtualTrialScenario: refs.runLibraryVirtualTrialScenario, setLibraryVirtualTrialHistoryFilter: refs.setLibraryVirtualTrialHistoryFilter, startLibraryVirtualSessionOptIn: refs.startLibraryVirtualSessionOptIn, startLibraryVirtualTrial: refs.startLibraryVirtualTrial });
    refs.installLibraryEventDelegation?.(app, on);
    installLibraryQuickListDelegation(app, on, { open: item => openLibraryQuickItem(app, item, { closeSidebarAfterLibraryOpen: refs.closeSidebarAfterLibraryOpen }), reveal: item => revealLibraryQuickItemInList(app, item, { getLibraryFilteredNovels, renderLibrary: refs.renderLibrary, toast }), favoriteToggle: item => refs.toggleFavorite?.(app, item?.dataset?.novelId || ''), removeRecent: item => removeLibraryQuickRecentItem(app, item) });
    installListActionSheet(app, on, { runAction: action => refs.runListAction?.(app, action) });
    installLibraryControlHandlersRuntime(app, on, renderFilteredLibrary, { collectFolderKeys, persistLibraryUi, renderLibrary: refs.renderLibrary, scheduleLibraryVirtualRender: refs.scheduleLibraryVirtualRender });
    app.libraryCleanup = () => cleanupLibraryRuntime(app, renderFilteredLibrary, disposers, { cancelLibraryVirtualRender: refs.cancelLibraryVirtualRender, clearLibraryVirtualTrialTimer: refs.clearLibraryVirtualTrialTimer, clearLongPress: refs.clearLongPress, finishLibraryDrag: refs.finishLibraryDrag });
  };
}
