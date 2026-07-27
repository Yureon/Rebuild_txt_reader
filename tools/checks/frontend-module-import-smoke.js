const fs = require('fs');
const path = require('path');

const FRONTEND_MODULE_IMPORT_SMOKE_PASS = 'v225-frontend-module-import-smoke-pass';
const FRONTEND_MODULE_IMPORT_EXPANDED_SMOKE_PASS = 'v228-frontend-module-import-settings-controls-smoke-pass';
const FRONTEND_MODULE_IMPORT_STATIC_LIST_PASS = 'v242-frontend-module-import-static-list-pass';

function runFrontendModuleImportSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runFrontendModuleImportSmoke requires projectRoot');
  const modules = [
    './public/scripts/rebuild/main.mjs',
    './public/scripts/rebuild/features/library.mjs',
    './public/scripts/rebuild/features/library-virtual-rows-runtime.mjs',
    './public/scripts/rebuild/features/library-tree-renderer.mjs',
    './public/scripts/rebuild/features/library-full-renderer.mjs',
    './public/scripts/rebuild/features/library-virtual-recording-runtime.mjs',
    './public/scripts/rebuild/features/library-virtual-window-renderer.mjs',
    './public/scripts/rebuild/features/library-action-orchestrator.mjs',
    './public/scripts/rebuild/features/library-event-delegation.mjs',
    './public/scripts/rebuild/features/library-navigation-actions.mjs',
    './public/scripts/rebuild/features/library-favorites-runtime.mjs',
    './public/scripts/rebuild/features/library-virtual-render-runtime.mjs',
    './public/scripts/rebuild/features/library-virtual-render-scheduler.mjs',
    './public/scripts/rebuild/features/library-empty-renderer.mjs',
    './public/scripts/rebuild/features/library-app-api.mjs',
    './public/scripts/rebuild/features/library-catalog-loader.mjs',
    './public/scripts/rebuild/features/library-render-orchestrator.mjs',
    './public/scripts/rebuild/features/library-install-controls-runtime.mjs',
    './public/scripts/rebuild/features/library-runtime-dependency-bags.mjs',
    './public/scripts/rebuild/features/library-runtime-config.mjs',
    './public/scripts/rebuild/features/library-virtual-diagnostics-event.mjs',
    './public/scripts/rebuild/features/library-navigation-bridge.mjs',
    './public/scripts/rebuild/features/library-favorites-bridge.mjs',
    './public/scripts/rebuild/features/library-event-delegation-bridge.mjs',
    './public/scripts/rebuild/features/library-virtual-auto-fallback-reset.mjs',
    './public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs',
    './public/scripts/rebuild/features/library-runtime-deps-bridge.mjs',
    './public/scripts/rebuild/features/library-virtual-operations-bridge.mjs',
    './public/scripts/rebuild/features/library-core-operations-bridge.mjs',
    './public/scripts/rebuild/features/library-install-orchestrator.mjs',
    './public/scripts/rebuild/features/library-virtual-diagnostics-formatters.mjs',
    './public/scripts/rebuild/features/library-virtual-diagnostics-capture.mjs',
    './public/scripts/rebuild/features/library-quick-list.mjs',
    './public/scripts/rebuild/features/library-load-state.mjs',
    './public/scripts/rebuild/features/library-virtual-gate-diagnostics.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-readiness-reports.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-static-policy-guard.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-manual-review-workflow.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-manual-review-bundle-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-row-height-diagnostics-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-trial-result-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-fallback-sample-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-export-copy-button.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-context-resolvers.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-adapter-methods.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-readiness-passive-reports.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-readiness-final-panel-utils.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-readiness-section-factories.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-final-summary-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-formatters.mjs',
    './public/scripts/rebuild/features/reader/scroll-side-effects.mjs',
    './public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs',
    './public/scripts/rebuild/features/reader/failure-reporting.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-panel.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-manual-review-bundle-renderers.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-manual-review-checklist-renderers.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-optin-audit-helpers.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-panel-context.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-panel-copy-buttons.mjs',
    './public/scripts/rebuild/features/recovery/json-copy-button-factory.mjs',
    './public/scripts/rebuild/features/recovery/library-dom-snapshot-payload.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-panel-composition.mjs',
    './public/scripts/rebuild/features/recovery/button-wiring-safety-manifest.mjs',
    './public/scripts/rebuild/features/recovery/button-wiring-safety-renderer.mjs',
    './public/scripts/rebuild/features/recovery/orchestration.mjs',
    './public/scripts/rebuild/features/recovery/search-panel-actions.mjs',
    './public/scripts/rebuild/features/recovery/search-panel-renderers.mjs',
    './public/scripts/rebuild/features/recovery/search-coverage-modal-renderers.mjs',
    './public/scripts/rebuild/features/reader/request-guards.mjs',
    './public/scripts/rebuild/features/reader/navigation-intent.mjs',
    './public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs',
    './public/scripts/rebuild/features/reader/manual-diagnostics-storage.mjs',
    './public/scripts/rebuild/features/reader/open-state.mjs',
    './public/scripts/rebuild/features/recovery/search-coverage-modal-actions.mjs',
    './public/scripts/rebuild/features/recovery/search-diagnostics-copy-payload.mjs',
    './public/scripts/rebuild/features/recovery/cache-management-panel-actions.mjs',
    './public/scripts/rebuild/features/recovery/library-virtual-readiness-passive-payloads.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-callbacks.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-virtual-panels.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-panels.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-renderers.mjs',
    './public/scripts/rebuild/features/recovery/sync-devtools-bridges.mjs',
    './public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs',
    './public/scripts/rebuild/features/reader/chunk-headings.mjs',
    './public/scripts/rebuild/features/reader/virtual-scroll-stability.mjs',
    './public/scripts/rebuild/features/reader/virtual-layout-report-labels.mjs',
    './public/scripts/rebuild/features/settings/safe-area-debug.mjs',
    './public/scripts/rebuild/features/settings/safe-area-debug-formatters.mjs',
    './public/scripts/rebuild/features/settings/controls.mjs',
    './public/scripts/rebuild/features/settings/tab-switching.mjs',
    './public/scripts/rebuild/features/search/coverage-summary.mjs',
    './public/scripts/rebuild/features/search/session-runtime.mjs',
    './public/scripts/rebuild/features/search/run-actions.mjs',
    './public/scripts/rebuild/features/search/retry-actions.mjs',
    './public/scripts/rebuild/features/search/live-dom-diagnostics-snapshot.mjs',
    './public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-state.mjs',
    './public/scripts/rebuild/features/recovery/reader-failure-diagnostics-panel.mjs',
    './public/scripts/rebuild/features/settings/manual-diagnostics-controls.mjs',
    './public/scripts/rebuild/features/recovery/action-button-layout.mjs',
    './public/scripts/rebuild/features/recovery/reader-failure-diagnostics-trends.mjs',
    './public/scripts/rebuild/features/recovery/reader-failure-summary-card.mjs',
    './public/scripts/rebuild/features/library-move-picker.mjs',
    './public/scripts/rebuild/features/library-drag-drop.mjs',
    './public/scripts/rebuild/features/theme-settings.mjs'
  ];
  for (const spec of modules) {
    const full = path.join(projectRoot, spec.slice(2));
    if (!fs.existsSync(full)) throw new Error('missing frontend import smoke module: ' + spec);
  }
  const postFormatter = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-formatters.mjs'), 'utf8');
  if (!postFormatter.includes('v241-library-virtual-post-stabilization-review-formatters-pass')) throw new Error('post-stabilization formatter module marker missing');
  const readerScrollEffects = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/scroll-side-effects.mjs'), 'utf8');
  if (!readerScrollEffects.includes('v242-reader-scroll-side-effects-pass')) throw new Error('reader scroll side-effect module marker missing');
  const readerLoadChunkEffects = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs'), 'utf8');
  if (!readerLoadChunkEffects.includes('v243-reader-load-chunk-side-effects-pass')) throw new Error('reader load chunk side-effects module marker missing');
  const recoverySearchActions = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/search-panel-actions.mjs'), 'utf8');
  if (!recoverySearchActions.includes('v242-recovery-search-panel-actions-pass')) throw new Error('recovery search action module marker missing');
  const coverageModalRenderers = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/search-coverage-modal-renderers.mjs'), 'utf8');
  if (!coverageModalRenderers.includes('v243-recovery-search-coverage-modal-renderers-pass')) throw new Error('recovery search coverage modal renderer marker missing');
  const orchestrationSource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/orchestration.mjs'), 'utf8');
  if (!orchestrationSource.includes('v243-recovery-center-orchestration-pass')) throw new Error('recovery orchestration module marker missing');
  const buttonSafetyManifest = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/button-wiring-safety-manifest.mjs'), 'utf8');
  if (!buttonSafetyManifest.includes('v243-recovery-button-wiring-safety-manifest-pass')) throw new Error('button wiring safety manifest marker missing');
  const buttonSafetyRenderer = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/button-wiring-safety-renderer.mjs'), 'utf8');
  if (!buttonSafetyRenderer.includes('v243-recovery-button-wiring-safety-renderer-pass')) throw new Error('button wiring safety renderer marker missing');
  const coverageSummary = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/search/coverage-summary.mjs'), 'utf8');
  if (!coverageSummary.includes('SEARCH_COVERAGE_SUMMARY_HELPER_PASS')) throw new Error('coverage summary module marker missing');
  const v244Markers = [
    ['public/scripts/rebuild/features/recovery/sync-devtools-bridges.mjs', 'v244-recovery-sync-devtools-bridges-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-callbacks.mjs', 'v244-library-diagnostics-callback-factory-pass'],
    ['public/scripts/rebuild/features/recovery/library-virtual-readiness-passive-payloads.mjs', 'v244-library-virtual-readiness-passive-payloads-pass'],
    ['public/scripts/rebuild/features/recovery/cache-management-panel-actions.mjs', 'v244-recovery-cache-management-panel-actions-pass'],
    ['public/scripts/rebuild/features/recovery/search-diagnostics-copy-payload.mjs', 'v244-recovery-search-diagnostics-copy-payload-pass'],
    ['public/scripts/rebuild/features/recovery/search-coverage-modal-actions.mjs', 'v244-recovery-search-coverage-modal-actions-pass'],
    ['public/scripts/rebuild/features/reader/request-guards.mjs', 'v244-reader-request-guards-pass']
  ];
  for (const [rel, marker] of v244Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v244 split marker missing: ' + marker);
  }

  const v245Markers = [
    ['public/scripts/rebuild/features/recovery/library-diagnostics-virtual-panels.mjs', 'v245-recovery-library-diagnostics-virtual-panels-pass'],
    ['public/scripts/rebuild/features/recovery/library-virtual-reports.mjs', 'v245-library-virtual-reports-surface-shrink-pass'],
    ['public/scripts/rebuild/features/reader/navigation-intent.mjs', 'v245-reader-navigation-intent-pass'],
    ['public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs', 'v245-reader-manual-diagnostics-snapshot-pass']
  ];
  for (const [rel, marker] of v245Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v245 split marker missing: ' + marker);
  }

  const v246Markers = [
    ['public/scripts/rebuild/features/reader/open-state.mjs', 'v246-reader-open-state-boundary-pass'],
    ['public/scripts/rebuild/features/search/session-runtime.mjs', 'v246-search-session-runtime-boundary-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-panels.mjs', 'v246-recovery-library-diagnostics-virtual-review-panels-pass'],
    ['public/scripts/rebuild/features/reader/manual-diagnostics-snapshot.mjs', 'v246-reader-manual-diagnostics-history-pass']
  ];
  for (const [rel, marker] of v246Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v246 import smoke marker missing: ' + marker);
  }


  const v247Markers = [
    ['public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-renderers.mjs', 'v247-recovery-library-diagnostics-virtual-review-row-renderers-pass'],
    ['public/scripts/rebuild/features/search/run-actions.mjs', 'v247-search-run-actions-pass'],
    ['public/scripts/rebuild/features/search/retry-actions.mjs', 'v247-search-retry-actions-pass'],
    ['public/scripts/rebuild/features/reader/failure-reporting.mjs', 'v247-reader-failure-reporting-pass'],
    ['public/scripts/rebuild/features/reader/manual-diagnostics-storage.mjs', 'v251-reader-manual-diagnostics-storage-pass']
  ];
  for (const [rel, marker] of v247Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v247 import smoke marker missing: ' + marker);
  }



  const v248Markers = [
    ['public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-state.mjs', 'v248-recovery-library-diagnostics-virtual-review-row-state-pass'],
    ['public/scripts/rebuild/features/recovery/reader-failure-diagnostics-panel.mjs', 'v251-recovery-reader-failure-diagnostics-panel-pass'],
    ['public/scripts/rebuild/features/settings/manual-diagnostics-controls.mjs', 'v251-settings-manual-diagnostics-controls-pass']
  ];
  for (const [rel, marker] of v248Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v248 import smoke marker missing: ' + marker);
  }



  const v292Markers = [
    ['public/scripts/rebuild/features/library-virtual-rows-runtime.mjs', 'v292-library-virtual-rows-runtime-pass'],
    ['public/scripts/rebuild/features/library-tree-renderer.mjs', 'v292-library-tree-renderer-pass'],
    ['public/scripts/rebuild/features/library-tree-render-fixture.mjs', 'v292-library-tree-render-fixture-contract-pass']
  ];
  for (const [rel, marker] of v292Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v292 import smoke marker missing: ' + marker);
  }

  const v293Markers = [
    ['public/scripts/rebuild/features/library-full-renderer.mjs', 'v293-library-full-renderer-pass'],
    ['public/scripts/rebuild/features/library-virtual-recording-runtime.mjs', 'v293-library-virtual-recording-runtime-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs', 'v293-recovery-library-diagnostics-adapter-pass'],
    ['public/scripts/rebuild/features/library-tree-render-fixture.mjs', 'v293-library-tree-render-fixture-dom-snapshot-pass']
  ];
  for (const [rel, marker] of v293Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v293 import smoke marker missing: ' + marker);
  }


  const v294Markers = [
    ['public/scripts/rebuild/features/library-virtual-window-renderer.mjs', 'v294-library-virtual-window-renderer-pass'],
    ['public/scripts/rebuild/features/library-action-orchestrator.mjs', 'v294-library-action-orchestrator-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs', 'v294-recovery-library-copy-payload-adapter-pass'],
    ['public/scripts/rebuild/features/library-tree-render-fixture.mjs', 'v294-library-tree-render-fixture-browser-sample-pass']
  ];
  for (const [rel, marker] of v294Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v294 import smoke marker missing: ' + marker);
  }


  const v295Markers = [
    ['public/scripts/rebuild/features/library-event-delegation.mjs', 'v295-library-event-delegation-runtime-pass'],
    ['public/scripts/rebuild/features/recovery/json-copy-button-factory.mjs', 'v295-recovery-json-copy-button-factory-pass'],
    ['public/scripts/rebuild/features/recovery/library-dom-snapshot-payload.mjs', 'v295-recovery-library-dom-snapshot-payload-pass'],
    ['public/scripts/rebuild/features/library-tree-render-fixture.mjs', 'v295-library-tree-render-fixture-validation-matrix-pass']
  ];
  for (const [rel, marker] of v295Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v295 import smoke marker missing: ' + marker);
  }


  const v297Markers = [
    ['public/scripts/rebuild/features/library-virtual-render-runtime.mjs', 'v297-library-virtual-render-runtime-pass'],
    ['public/scripts/rebuild/features/library-virtual-render-scheduler.mjs', 'v297-library-virtual-render-scheduler-pass'],
    ['public/scripts/rebuild/features/library-empty-renderer.mjs', 'v297-library-empty-renderer-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs', 'v297-recovery-library-virtual-payload-context-pass']
  ];
  for (const [rel, marker] of v297Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v297 import smoke marker missing: ' + marker);
  }

  const v298Markers = [
    ['public/scripts/rebuild/features/library-app-api.mjs', 'v298-library-app-api-runtime-pass'],
    ['public/scripts/rebuild/features/library-catalog-loader.mjs', 'v298-library-catalog-loader-pass'],
    ['public/scripts/rebuild/features/library-render-orchestrator.mjs', 'v298-library-render-orchestrator-pass'],
    ['public/scripts/rebuild/features/library-install-controls-runtime.mjs', 'v298-library-install-controls-runtime-pass'],
    ['public/scripts/rebuild/features/library-runtime-dependency-bags.mjs', 'v299-library-runtime-dependency-bags-pass']
  ];
  for (const [rel, marker] of v298Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v298 import smoke marker missing: ' + marker);
  }

  const v300Markers = [
    ['public/scripts/rebuild/features/library-runtime-config.mjs', 'v300-library-runtime-config-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs', 'v300-recovery-library-manual-review-context-pass']
  ];
  for (const [rel, marker] of v300Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v300 import smoke marker missing: ' + marker);
  }


  const v305Markers = [
    ['public/scripts/rebuild/features/recovery/library-diagnostics-panel-context.mjs', 'v305-recovery-library-diagnostics-panel-context-pass'],
    ['public/scripts/rebuild/features/recovery/library-diagnostics-panel-copy-buttons.mjs', 'v305-recovery-library-diagnostics-panel-copy-buttons-pass']
  ];
  for (const [rel, marker] of v305Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v305 import smoke marker missing: ' + marker);
  }

  const v301Markers = [
    ['public/scripts/rebuild/features/library-virtual-diagnostics-event.mjs', 'v301-library-virtual-diagnostics-event-pass'],
    ['public/scripts/rebuild/features/library-navigation-bridge.mjs', 'v301-library-navigation-bridge-pass'],
    ['public/scripts/rebuild/features/library-favorites-bridge.mjs', 'v301-library-favorites-bridge-pass'],
    ['public/scripts/rebuild/features/library-event-delegation-bridge.mjs', 'v301-library-event-delegation-bridge-pass'],
    ['public/scripts/rebuild/features/library-virtual-auto-fallback-reset.mjs', 'v301-library-virtual-auto-fallback-reset-pass'],
    ['public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs', 'v301-library-action-orchestrator-bridge-pass']
  ];
  for (const [rel, marker] of v301Markers) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error('v301 import smoke marker missing: ' + marker);
  }

  const { assertSourceMarkersFromManifest } = require('./source-loader-manifest.js');
  const markerResult = assertSourceMarkersFromManifest(path.join(projectRoot, 'public/scripts/rebuild'), {
    'features/recovery/library-diagnostics-row-factory.mjs':'v249-recovery-library-diagnostics-row-factory-pass',
    'features/recovery/reader-failure-diagnostics-actions.mjs':'v251-recovery-reader-failure-diagnostics-actions-pass',
    'features/recovery/reader-failure-diagnostics-payload.mjs':'v251-recovery-reader-failure-diagnostics-payload-pass',
    'features/recovery/action-button-layout.mjs':['v251-recovery-action-button-layout-pass','v251-recovery-action-button-low-level-layout-pass'],
    'features/recovery/reader-failure-diagnostics-trends.mjs':'v251-recovery-reader-failure-trends-pass',
    'features/search/live-dom-diagnostics-snapshot.mjs':'v251-search-live-dom-diagnostics-snapshot-pass',
    'features/recovery/reader-failure-summary-card.mjs':'v251-recovery-reader-failure-summary-card-pass'
  });
  if (markerResult.checked !== 7) throw new Error('frontend module import smoke manifest marker count mismatch');

  return { pass: FRONTEND_MODULE_IMPORT_SMOKE_PASS, expandedPass: FRONTEND_MODULE_IMPORT_EXPANDED_SMOKE_PASS, staticListPass: FRONTEND_MODULE_IMPORT_STATIC_LIST_PASS, modules: modules.length };
}

module.exports = {
  FRONTEND_MODULE_IMPORT_SMOKE_PASS,
  FRONTEND_MODULE_IMPORT_EXPANDED_SMOKE_PASS,
  FRONTEND_MODULE_IMPORT_STATIC_LIST_PASS,
  runFrontendModuleImportSmoke
};
