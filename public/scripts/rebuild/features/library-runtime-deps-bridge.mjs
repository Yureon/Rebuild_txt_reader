import { LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT } from './library-virtual-session-diagnostics.mjs';
import { LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT } from './library-runtime-config.mjs';
// compatibility contract: from './library-tree-render-fixture.mjs'
import { createLibraryFullRendererDeps, createLibraryPrototypeRowsDeps, createLibraryVirtualDiagnosticsDeps, createLibraryVirtualRecordingDeps, createLibraryVirtualSessionRuntimeDeps, createLibraryVirtualTrialRuntimeDeps, createLibraryVirtualWindowRendererDeps } from './library-runtime-dependency-bags.mjs';
import { LIBRARY_VIRTUAL_AUTO_ENABLE_ROW_THRESHOLD, LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY, LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS, LIBRARY_VIRTUAL_HISTORY_LIMIT, LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS, LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN } from './library-runtime-config.mjs';

export const LIBRARY_RUNTIME_DEPS_BRIDGE_PASS = 'v304-library-runtime-deps-bridge-pass';

export const LIBRARY_TREE_FIXTURE_LAZY_PASS = 'v599-library-tree-fixture-lazy-pass';
let treeFixtureModule = null;
let treeFixturePromise = null;
export function preloadLibraryTreeRenderFixture() {
  if (treeFixtureModule) return Promise.resolve(treeFixtureModule);
  if (!treeFixturePromise) {
    treeFixturePromise = import('./library-tree-render-fixture.mjs').then(module => {
      treeFixtureModule = module;
      return module;
    }).finally(() => { treeFixturePromise = null; });
  }
  return treeFixturePromise;
}
function getLibraryTreeRenderFixtureDiagnostics() {
  return treeFixtureModule?.getLibraryTreeRenderFixtureContract?.() || {
    pass: LIBRARY_TREE_FIXTURE_LAZY_PASS,
    lazy: true,
    module: 'library-tree-render-fixture.mjs'
  };
}

export function createLibraryRuntimeDepsBridge(refs = {}) {
  function getLibraryVirtualTrialRuntimeDeps(app) {
    return createLibraryVirtualTrialRuntimeDeps(app, { getLibraryCurrentWindowRows: refs.getLibraryCurrentWindowRows, getLibraryScrollAnchor: refs.getLibraryScrollAnchor, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics, renderLibrary: refs.renderLibrary, toast: refs.toast, trialHistoryLimit: LIBRARY_VIRTUAL_TRIAL_HISTORY_LIMIT });
  }
  function getLibraryVirtualSessionRuntimeDeps(app) {
    return createLibraryVirtualSessionRuntimeDeps(app, { getLibraryVirtualSessionOptInDiagnostics: refs.getLibraryVirtualSessionOptInDiagnostics, notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics, renderLibrary: refs.renderLibrary, sessionOptInHistoryLimit: LIBRARY_VIRTUAL_SESSION_OPT_IN_HISTORY_LIMIT, summarizeLibraryVirtualTrialForSession: refs.summarizeLibraryVirtualTrialForSession, toast: refs.toast });
  }
  function getLibraryVirtualDiagnosticsDeps(app) {
    return createLibraryVirtualDiagnosticsDeps(app, { autoEnableRowThreshold: LIBRARY_VIRTUAL_AUTO_ENABLE_ROW_THRESHOLD, defaultRolloutPass: LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS, getLibraryActionAuditDiagnostics: refs.getLibraryActionAuditDiagnostics, getLibraryCurrentWindowRows: refs.getLibraryCurrentWindowRows, getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics, getLibraryVirtualSessionOptInDiagnostics: refs.getLibraryVirtualSessionOptInDiagnostics, getLibraryVirtualTrialDiagnostics: refs.getLibraryVirtualTrialDiagnostics, historyLimit: LIBRARY_VIRTUAL_HISTORY_LIMIT, isLibraryVirtualAutoFallbackActive: refs.isLibraryVirtualAutoFallbackActive, isLibraryVirtualDefaultRolloutEnabled: refs.isLibraryVirtualDefaultRolloutEnabled, isLibraryVirtualRendererEnabled: refs.isLibraryVirtualRendererEnabled, isLibraryVirtualRendererRequested: refs.isLibraryVirtualRendererRequested, wideWindow: { overscan: LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN, maxWindowRows: LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS } });
  }
  function getLibraryVirtualRecordingDeps(app) {
    return createLibraryVirtualRecordingDeps(app, { defaultRolloutPass: LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS, historyLimit: LIBRARY_VIRTUAL_HISTORY_LIMIT, notifyLibraryVirtualDiagnostics: refs.notifyLibraryVirtualDiagnostics, persistLibraryVirtualAutoFallback: refs.persistLibraryVirtualAutoFallback, recordLibraryVirtualSessionOptInFallback: refs.recordLibraryVirtualSessionOptInFallback, recordLibraryVirtualSessionOptInRender: refs.recordLibraryVirtualSessionOptInRender, recordLibraryVirtualTrialFallback: refs.recordLibraryVirtualTrialFallback, recordLibraryVirtualTrialRender: refs.recordLibraryVirtualTrialRender, storageKey: LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY });
  }
  function getLibraryFullRendererDeps(app) {
    return createLibraryFullRendererDeps(app, { getLibraryRowHeightMeasurementDiagnostics: refs.getLibraryRowHeightMeasurementDiagnostics, libraryDraggableAttrs: refs.libraryDraggableAttrs, recordLibraryVirtualRender: refs.recordLibraryVirtualRender, restoreLibraryScrollAnchor: refs.restoreLibraryScrollAnchor, summarizeLibraryRowHeightMeasurement: refs.summarizeLibraryRowHeightMeasurement });
  }
  function getLibraryPrototypeRowsDeps(app) {
    return createLibraryPrototypeRowsDeps(app, { formatNovelMeta: refs.formatNovelMeta, getLibraryFilteredNovels: refs.getLibraryFilteredNovels, getLibraryVirtualRows: refs.getLibraryVirtualRows, getLibraryWindowDomMetrics: refs.getLibraryWindowDomMetrics, libraryDraggableAttrs: refs.libraryDraggableAttrs });
  }
  function getLibraryVirtualWindowRendererDeps(app) {
    return createLibraryVirtualWindowRendererDeps(app, { createRootDropZone: refs.createRootDropZone, createPrototypeLibraryRow: refs.createPrototypeLibraryRow, decorateVirtualLibraryRow: refs.decorateVirtualLibraryRow });
  }
  return { getLibraryFullRendererDeps, getLibraryPrototypeRowsDeps, getLibraryTreeRenderFixtureDiagnostics, preloadLibraryTreeRenderFixture, getLibraryVirtualDiagnosticsDeps, getLibraryVirtualRecordingDeps, getLibraryVirtualSessionRuntimeDeps, getLibraryVirtualTrialRuntimeDeps, getLibraryVirtualWindowRendererDeps };
}

export function getLibraryRuntimeDepsBridgeContract() {
  return { pass: LIBRARY_RUNTIME_DEPS_BRIDGE_PASS, depsFactory: 'library-runtime-dependency-bags.mjs' };
}
