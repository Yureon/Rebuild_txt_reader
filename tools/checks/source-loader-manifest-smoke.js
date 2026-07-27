const { readDefaultSourceManifest, readFullSourceGroupManifest, combineSourceManifest, assertSourceMarkersFromManifest, FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS, DEFAULT_SOURCE_MANIFEST, FRONTEND_CHECK_PROJECT_SOURCE_MANIFEST_PASS, readProjectSourceManifest, readProjectJson, buildProjectSourceManifestSummary, assertHistoricalDocMarkers, assertProjectSourceEntriesExist, FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS, FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS } = require('./source-loader-manifest.js');

const SOURCE_LOADER_MANIFEST_SMOKE_PASS = 'v251-source-loader-manifest-smoke-pass';

function runSourceLoaderManifestSmoke(projectRoot) {
  const root = require('path').join(projectRoot, 'public', 'scripts', 'rebuild');
  const sources = readDefaultSourceManifest(root);
  const combined = combineSourceManifest(sources);
  [
    'v244-recovery-sync-devtools-bridges-pass',
    'v244-reader-request-guards-pass',
    'v245-reader-navigation-intent-pass',
    'v245-reader-manual-diagnostics-snapshot-pass',
    'v245-recovery-library-diagnostics-virtual-panels-pass',
    'v246-recovery-library-diagnostics-virtual-review-panels-pass',
    'v245-library-virtual-reports-surface-shrink-pass',
    'v246-search-session-runtime-boundary-pass',
    'v246-reader-open-state-boundary-pass',
    'v251-reader-manual-diagnostics-storage-pass',
    'v247-reader-failure-reporting-pass',
    'v247-recovery-library-diagnostics-virtual-review-row-renderers-pass',
    'v247-search-run-actions-pass',
    'v247-search-retry-actions-pass',
    'v248-recovery-library-diagnostics-virtual-review-row-state-pass',
    'v251-recovery-reader-failure-diagnostics-panel-pass',
    'v251-settings-manual-diagnostics-controls-pass',
    'v249-recovery-library-diagnostics-row-factory-pass',
    'v251-recovery-reader-failure-diagnostics-actions-pass',
    'v251-recovery-reader-failure-diagnostics-payload-pass',
    'v251-recovery-action-button-layout-pass',
    'v251-recovery-action-button-low-level-layout-pass',
    'v251-recovery-reader-failure-trends-pass',
    'v251-search-live-dom-diagnostics-snapshot-pass',
    'v251-recovery-reader-failure-summary-card-pass',
    'v253-reader-manual-diagnostics-recovery-summary-pass',
    'v253-recovery-reader-failure-manual-diagnostics-summary-pass',
    'v253-recovery-reader-failure-manual-summary-card-pass',
    'v255-reader-manual-diagnostics-trend-bundle-pass',
    'v255-recovery-action-button-state-matrix-pass',
    'v256-recovery-action-button-panel-matrix-pass',
    'v257-recovery-action-button-panel-matrix-render-pass',
    'v258-reader-manual-diagnostics-real-export-trend-pass',
    'v258-recovery-summary-real-browser-export-trend-pass'
  ].forEach(marker => {
    if (!combined.includes(marker)) throw new Error('source-loader manifest smoke missing marker: ' + marker);
  });
  const markerResult = assertSourceMarkersFromManifest(root, {
    'features/recovery/action-button-layout.mjs':['v251-recovery-action-button-layout-pass','v251-recovery-action-button-low-level-layout-pass','v254-recovery-action-button-state-summary-pass','v255-recovery-action-button-state-matrix-pass','v256-recovery-action-button-panel-matrix-pass','v257-recovery-action-button-panel-matrix-render-pass'],
    'features/recovery/reader-failure-diagnostics-trends.mjs':'v251-recovery-reader-failure-trends-pass',
    'features/search/live-dom-diagnostics-snapshot.mjs':'v251-search-live-dom-diagnostics-snapshot-pass',
    'features/reader/manual-diagnostics-snapshot.mjs':['v253-reader-manual-diagnostics-recovery-summary-pass','v255-reader-manual-diagnostics-trend-bundle-pass','v258-reader-manual-diagnostics-real-export-trend-pass'],
    'features/recovery/reader-failure-diagnostics-payload.mjs':'v253-recovery-reader-failure-manual-diagnostics-summary-pass',
    'features/recovery/reader-failure-summary-card.mjs':['v251-recovery-reader-failure-summary-card-pass','v253-recovery-reader-failure-manual-summary-card-pass'],
    'features/recovery/summary-panel.mjs':['v255-recovery-summary-manual-browser-trend-pass','v258-recovery-summary-real-browser-export-trend-pass']
  });
  if (markerResult.checked !== 7) throw new Error('source manifest marker helper did not check v253 modules');
  const docExistence = assertProjectSourceEntriesExist(projectRoot, { packageJson:{ path:'package.json' }, latestDocGuard:'checks/latest-doc-index-guard.js' });
  if (docExistence.pass !== FRONTEND_CHECK_DOC_EXISTENCE_SOURCE_MANIFEST_PASS || docExistence.checked !== 2) throw new Error('project source existence manifest smoke mismatch');
  const projectSources = readProjectSourceManifest(projectRoot, { packageScript:'tools/package_rebuild.js', latestDocGuard:'checks/latest-doc-index-guard.js' });
  const projectSummary = buildProjectSourceManifestSummary(projectSources);
  if (projectSummary.pass !== FRONTEND_CHECK_PROJECT_SOURCE_MANIFEST_PASS || projectSummary.files !== 2) throw new Error('project source manifest summary mismatch');
  const packageManifest = readProjectJson(projectRoot, { path:'package.json' });
  if (packageManifest.pass !== 'v255-project-source-json-manifest-pass' || !packageManifest.value?.scripts?.['check:frontend']) throw new Error('project JSON source manifest smoke mismatch');
  const historicalDocs = assertHistoricalDocMarkers(projectRoot, {
    'rebuild-phase144.md': ['Rebuild Phase 144', 'v144-reader-cache-warmup-pass'],
    'rebuild-phase145.md': ['Rebuild Phase 145', 'v145-search-performance-pass'],
    'rebuild-phase157.md': ['Rebuild Phase 157', 'Recovery Center']
  });
  if (historicalDocs.pass !== FRONTEND_CHECK_HISTORICAL_DOC_SOURCE_MANIFEST_PASS || historicalDocs.summary.docs !== 3) throw new Error('historical doc source manifest smoke mismatch');
  const fullSources = readFullSourceGroupManifest(projectRoot);
  if (Object.keys(fullSources).length <= Object.keys(sources).length) throw new Error('full source group manifest did not expand beyond default manifest');
  if (!combineSourceManifest(fullSources, ['features/reader.mjs']).includes('installReader')) throw new Error('full source group manifest missing reader source');
  return { pass: SOURCE_LOADER_MANIFEST_SMOKE_PASS, sourceLoaderManifestPass: FRONTEND_CHECK_SOURCE_LOADER_MANIFEST_PASS, manifestEntries: Object.keys(DEFAULT_SOURCE_MANIFEST).length, sources: Object.keys(sources).length, projectSourcePass: projectSummary.pass, projectJsonPass: packageManifest.pass, docExistencePass: docExistence.pass, historicalDocPass: historicalDocs.pass, fullSources: Object.keys(fullSources).length };
}

module.exports = { SOURCE_LOADER_MANIFEST_SMOKE_PASS, runSourceLoaderManifestSmoke };
