export const LIBRARY_RUNTIME_DEPENDENCY_BAGS_PASS = 'v299-library-runtime-dependency-bags-pass';

export function createLibraryVirtualTrialRuntimeDeps(app, refs) {
  return {
    getLibraryCurrentWindowRows: refs.getLibraryCurrentWindowRows,
    getLibraryScrollAnchor: refs.getLibraryScrollAnchor,
    isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled,
    notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics,
    renderLibrary: refs.renderLibrary,
    toast: refs.toast,
    trialHistoryLimit: refs.trialHistoryLimit
  };
}

export function createLibraryVirtualSessionRuntimeDeps(app, refs) {
  return {
    getLibraryVirtualSessionOptInDiagnostics: refs.getLibraryVirtualSessionOptInDiagnostics,
    notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics,
    renderLibrary: refs.renderLibrary,
    sessionOptInHistoryLimit: refs.sessionOptInHistoryLimit,
    summarizeLibraryVirtualTrialForSession: refs.summarizeLibraryVirtualTrialForSession,
    toast: refs.toast
  };
}

export function createLibraryVirtualDiagnosticsDeps(app, refs) {
  return {
    autoEnableRowThreshold: refs.autoEnableRowThreshold,
    defaultRolloutPass: refs.defaultRolloutPass,
    getLibraryActionAuditDiagnostics: refs.getLibraryActionAuditDiagnostics,
    getLibraryCurrentWindowRows: refs.getLibraryCurrentWindowRows,
    getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics,
    getLibraryVirtualSessionOptInDiagnostics: refs.getLibraryVirtualSessionOptInDiagnostics,
    getLibraryVirtualTrialDiagnostics: refs.getLibraryVirtualTrialDiagnostics,
    historyLimit: refs.historyLimit,
    isLibraryVirtualAutoFallbackActive: refs.isLibraryVirtualAutoFallbackActive,
    isLibraryVirtualDefaultRolloutEnabled: refs.isLibraryVirtualDefaultRolloutEnabled,
    isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled,
    isLibraryVirtualRendererRequested: refs.isLibraryVirtualRendererRequested,
    wideWindow: refs.wideWindow
  };
}

export function createLibraryVirtualRecordingDeps(app, refs) {
  return {
    defaultRolloutPass: refs.defaultRolloutPass,
    historyLimit: refs.historyLimit,
    notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics,
    persistLibraryVirtualAutoFallback: refs.persistLibraryVirtualAutoFallback,
    recordLibraryVirtualSessionOptInFallback: refs.recordLibraryVirtualSessionOptInFallback,
    recordLibraryVirtualSessionOptInRender: refs.recordLibraryVirtualSessionOptInRender,
    recordLibraryVirtualTrialFallback: refs.recordLibraryVirtualTrialFallback,
    recordLibraryVirtualTrialRender: refs.recordLibraryVirtualTrialRender,
    storageKey: refs.storageKey
  };
}

export function createLibraryFullRendererDeps(app, refs) {
  return {
    getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics,
    libraryDraggableAttrs: refs.libraryDraggableAttrs,
    recordLibraryVirtualRender: refs.recordLibraryVirtualRender,
    restoreLibraryScrollAnchor: refs.restoreLibraryScrollAnchor,
    summarizeLibraryRowHeightMeasurement: refs.summarizeLibraryRowHeightMeasurement
  };
}

export function createLibraryPrototypeRowsDeps(app, refs) {
  return {
    formatNovelMeta: refs.formatNovelMeta,
    getLibraryFilteredNovels: refs.getLibraryFilteredNovels,
    getLibraryVirtualRows: refs.getLibraryVirtualRows,
    getLibraryWindowDomMetrics: refs.getLibraryWindowDomMetrics,
    libraryDraggableAttrs: refs.libraryDraggableAttrs
  };
}

export function createLibraryVirtualWindowRendererDeps(app, refs) {
  return {
    createRootDropZone: refs.createRootDropZone,
    createPrototypeLibraryRow: refs.createPrototypeLibraryRow,
    decorateVirtualLibraryRow: refs.decorateVirtualLibraryRow
  };
}

export function createLibraryActionOrchestratorDeps(app, refs) {
  return {
    chooseLibraryMoveTarget: refs.chooseLibraryMoveTarget,
    closeListActionSheet: refs.closeListActionSheet,
    closeSidebarAfterLibraryOpen: refs.closeSidebarAfterLibraryOpen,
    confirmLibraryDelete: refs.confirmLibraryDelete,
    confirmLibraryMove: refs.confirmLibraryMove,
    describeLibraryMutationError: refs.describeLibraryMutationError,
    formatFolderPath: refs.formatFolderPath,
    getLibraryDragDropDeps: refs.getLibraryDragDropDeps,
    getLibraryMoveDeps: refs.getLibraryMoveDeps,
    getLibraryScrollAnchor: refs.getLibraryScrollAnchor,
    isCurrentDeletedByTarget: refs.isCurrentDeletedByTarget,
    loadLibrary: refs.loadLibrary,
    openNovelFromElement: refs.openNovelFromElement,
    openOptionsFromSnapshot: refs.openOptionsFromSnapshot,
    persistLibraryUi: refs.persistLibraryUi,
    promptLibraryRename: refs.promptLibraryRename,
    renderLibrary: refs.renderLibrary,
    runLibraryDeleteRequest: refs.runLibraryDeleteRequest,
    runLibraryMoveRequest: refs.runLibraryMoveRequest,
    runLibraryRenameRequest: refs.runLibraryRenameRequest,
    showLoading: refs.showLoading,
    status: refs.status,
    targetTypeLabel: refs.targetTypeLabel,
    toast: refs.toast,
    toggleFavorite: refs.toggleFavorite,
    validateLibraryMoveTarget: refs.validateLibraryMoveTarget
  };
}

export function createLibraryDragDropDeps(refs) {
  return {
    getLibraryActionTarget: refs.getLibraryActionTarget,
    clearLongPress: refs.clearLongPress,
    formatFolderPath: refs.formatFolderPath,
    parentFolderPath: refs.parentFolderPath,
    normalizePromptCategory: refs.normalizePromptCategory,
    getCurrentLibraryPath: refs.getCurrentLibraryPath,
    moveDraggedLibraryItem: refs.moveDraggedLibraryItem
  };
}

export function createLibraryMoveDeps(refs) {
  return {
    formatFolderPath: refs.formatFolderPath,
    getCurrentLibraryPath: refs.getCurrentLibraryPath,
    normalizePromptCategory: refs.normalizePromptCategory,
    validateLibraryMoveTarget: refs.validateLibraryMoveTarget
  };
}

export function createLibraryNavigationDeps(refs) {
  return {
    closeSidebarAfterLibraryOpen: refs.closeSidebarAfterLibraryOpen,
    ensureNovelEpisodesLoaded: refs.ensureNovelEpisodesLoaded,
    findEpisodeForSnapshot: refs.findEpisodeForSnapshot,
    openOptionsFromSnapshot: refs.openOptionsFromSnapshot,
    persistLibraryUi: refs.persistLibraryUi,
    renderLibrary: refs.renderLibrary,
    toast: refs.toast
  };
}
