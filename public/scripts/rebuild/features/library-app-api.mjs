export const LIBRARY_APP_API_RUNTIME_PASS = 'v298-library-app-api-runtime-pass';

export function createLibraryAppApiRuntime(app, deps = {}) {
  return {
    preloadDiagnostics: () => deps.preloadLibraryDiagnostics?.(app),
    load: () => deps.loadLibrary?.(app),
    loadShelf: (options = {}) => deps.loadShelfPage?.(app, options),
    loadFullCatalog: (options = {}) => deps.loadFullCatalog?.(app, options),
    captureScrollAnchor: () => deps.getLibraryScrollAnchor?.(app) || null,
    switchView: mode => deps.switchLibraryView?.(app, mode),
    setShelfScope: scope => deps.setLibraryShelfScope?.(app, scope),
    ensureNovelLoaded: novelId => deps.ensureShelfNovelLoaded?.(app, novelId),
    ensureNovelEpisodes: novelOrId => deps.ensureNovelEpisodesLoaded?.(app, novelOrId),
    render: (options = {}) => deps.renderLibrary?.(app, options),
    activeKey: deps.itemKey,
    getProgressRatio: novel => deps.getProgressRatioForState?.(app.state, novel),
    getFlattenDiagnostics: () => deps.getLibraryFlattenDiagnostics?.(app.state.novels, {
      query: app.state.libraryFilter,
      collapsedFolders: app.state.collapsedFolders,
      expandedEpisodeNovels: app.state.expandedEpisodeNovels,
      current: app.state.current
    }),
    getWindowDiagnostics: () => deps.getLibraryWindowDiagnostics?.(app.state.novels, {
      query: app.state.libraryFilter,
      collapsedFolders: app.state.collapsedFolders,
      expandedEpisodeNovels: app.state.expandedEpisodeNovels,
      current: app.state.current,
      ...deps.getLibraryWindowDomMetrics?.(app)
    }),
    getPrototypeDiagnostics: () => deps.getLibraryPrototypeDiagnostics?.(app),
    getRenderDiagnostics: () => deps.getLibraryVirtualRenderDiagnostics?.(app),
    getActionAuditDiagnostics: () => deps.getLibraryActionAuditDiagnostics?.(app),
    getFallbackDiagnostics: () => deps.getLibraryVirtualFallbackDiagnostics?.(app),
    getRowHeightDiagnostics: () => deps.getLibraryRowHeightMeasurementDiagnostics?.(app),
    getVirtualTrialDiagnostics: () => deps.getLibraryVirtualTrialDiagnostics?.(app),
    getVirtualSessionOptInDiagnostics: () => deps.getLibraryVirtualSessionOptInDiagnostics?.(app),
    getTreeRenderFixtureDiagnostics: () => deps.getLibraryTreeRenderFixtureDiagnostics?.(),
    startVirtualSessionOptIn: (options = {}) => deps.startLibraryVirtualSessionOptIn?.(app, options),
    stopVirtualSessionOptIn: (reason = 'manual-stop') => deps.finishLibraryVirtualSessionOptIn?.(app, { status:'stopped', reason, renderFull:true, toast:true }),
    resetVirtualAutoFallback: (reason = 'manual-reset') => deps.resetLibraryVirtualAutoFallback?.(app, reason),
    setVirtualTrialHistoryFilter: filter => deps.setLibraryVirtualTrialHistoryFilter?.(app, filter),
    getVirtualTrialHistoryFilter: () => deps.normalizeLibraryVirtualTrialHistoryFilter?.(app.state.libraryVirtualTrialHistoryFilter),
    startVirtualTrial: (options = {}) => deps.startLibraryVirtualTrial?.(app, options),
    stopVirtualTrial: (reason = 'manual-stop') => deps.finishLibraryVirtualTrial?.(app, { status:'stopped', reason, renderFull:true, toast:false }),
    runVirtualTrialScenario: (scenario, options = {}) => deps.runLibraryVirtualTrialScenario?.(app, scenario, options),
    recordVirtualTrialObservation: (type, meta = {}) => deps.recordLibraryVirtualTrialObservation?.(app, type, meta),
    getCurrentWindowRows: () => deps.getLibraryCurrentWindowRows?.(app),
    forceFollowActive: () => deps.renderLibrary?.(app, { source:'recovery-follow-active-test', followActive:true }),
    testTopAnchorRestore: () => {
      const anchor = deps.getLibraryScrollAnchor?.(app);
      deps.renderLibrary?.(app, { source:'recovery-anchor-restore-test', scrollAnchor:anchor, followActive:false });
      return anchor;
    },
    cancelPendingRender: () => deps.renderFilteredLibrary?.cancel?.()
  };
}
