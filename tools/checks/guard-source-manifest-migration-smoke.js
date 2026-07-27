const GUARD_SOURCE_MANIFEST_MIGRATION_SMOKE_PASS = 'v251-guard-source-manifest-migration-smoke-pass';
const GUARD_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS = 'v252-guard-source-manifest-migration-summary-pass';
const GUARD_SOURCE_MANIFEST_ADDITIONAL_MIGRATION_PASS = 'v254-guard-source-manifest-additional-migration-pass';
const GUARD_SOURCE_MANIFEST_V255_MIGRATION_PASS = 'v255-guard-source-manifest-reader-search-recovery-pass';
const GUARD_SOURCE_MANIFEST_V256_HISTORICAL_DOC_PASS = 'v256-guard-source-manifest-historical-doc-pass';
const GUARD_SOURCE_MANIFEST_V257_DOC_EXISTENCE_PASS = 'v257-guard-source-manifest-doc-existence-pass';
const GUARD_SOURCE_MANIFEST_V258_CLOSEOUT_PASS = 'v258-guard-source-manifest-closeout-pass';

function runGuardSourceManifestMigrationSmoke(projectRoot) {
  const path = require('path');
  const { assertSourceMarkersFromManifest, assertHistoricalDocMarkers, assertProjectSourceEntriesExist } = require('./source-loader-manifest.js');
  const root = path.join(projectRoot, 'public', 'scripts', 'rebuild');
  const result = assertSourceMarkersFromManifest(root, {
    'features/recovery/action-button-layout.mjs':['v251-recovery-action-button-layout-pass','v251-recovery-action-button-low-level-layout-pass','v254-recovery-action-button-state-summary-pass','v255-recovery-action-button-state-matrix-pass','v257-recovery-action-button-panel-matrix-render-pass'],
    'features/search/live-dom-diagnostics-snapshot.mjs':['v251-search-live-dom-diagnostics-snapshot-pass','v252-search-live-dom-retry-fixture-bridge-pass'],
    'features/recovery/reader-failure-summary-card.mjs':['v251-recovery-reader-failure-summary-card-pass','v254-recovery-reader-failure-manual-detail-rows-pass'],
    'features/reader/manual-diagnostics-storage.mjs':['v251-reader-manual-diagnostics-import-export-pass','v258-reader-manual-diagnostics-browser-export-import-pass'],
    'features/reader/manual-diagnostics-snapshot.mjs':['v255-reader-manual-diagnostics-trend-bundle-pass','v258-reader-manual-diagnostics-real-export-trend-pass'],
    'features/settings/manual-diagnostics-controls.mjs':['v251-settings-manual-diagnostics-import-export-pass','v252-settings-manual-diagnostics-browser-verification-pass','v258-settings-manual-diagnostics-browser-export-import-pass'],
    'features/recovery/summary-panel.mjs':['v255-recovery-summary-manual-browser-trend-pass','v258-recovery-summary-real-browser-export-trend-pass']
  });
  if (result.checked !== 7) throw new Error('guard source manifest migration smoke checked unexpected count');
  if (result.summary?.pass !== 'v252-source-manifest-migration-summary-pass') throw new Error('guard source manifest summary missing');

  const historical = assertHistoricalDocMarkers(projectRoot, {
    'rebuild-phase144.md': ['Rebuild Phase 144', 'v144-reader-cache-warmup-pass'],
    'search-performance-v145.md': ['Search Performance v145', 'search performance pass'],
    'recovery-search-diagnostics-extraction-v157.md': ['Recovery Search Diagnostics Extraction v157', 'Search diagnostics']
  });
  if (historical.pass !== 'v256-historical-doc-source-manifest-pass' || historical.summary.docs !== 3) throw new Error('guard historical source manifest summary mismatch');

  const checksRoot = path.join(projectRoot, 'tools', 'checks');
  const migrated = assertSourceMarkersFromManifest(checksRoot, {
    'reader-virtual-scroll-smoothness-smoke.js':['v254-reader-virtual-scroll-smoothness-source-manifest-pass','readProjectSourceManifest'],
    'reader-manual-diagnostics-snapshot-smoke.js':['v254-reader-manual-diagnostics-snapshot-source-manifest-pass','readProjectSourceManifest'],
    'reader-search-core-preservation-guards.js':['v254-reader-search-diagnostics-only-boundary-pass','v256-reader-search-runtime-log-only-preservation-pass','v257-reader-search-runtime-log-only-boundary-pass','v258-reader-search-final-log-gated-completion-pass'],
    'reader-open-state-smoke.js':'readProjectSourceManifest',
    'search-session-runtime-smoke.js':'readProjectSourceManifest',
    'recovery-reader-failure-actions-smoke.js':'readProjectSourceManifest'
  });
  if (migrated.checked !== 6) throw new Error('guard source manifest additional migration count mismatch');
  const docExistence = assertProjectSourceEntriesExist(projectRoot, {
    phase:{ root:'docs', parts:['rebuild-phase257.md'] },
    index:{ root:'docs', parts:['latest-doc-index-v257.md'] },
    estimate:{ root:'docs', parts:['code-separation-remaining-estimate-v257.md'] }
  });
  if (docExistence.pass !== 'v257-doc-existence-source-manifest-pass' || docExistence.checked !== 3) throw new Error('guard doc existence manifest mismatch');
  return {
    pass: GUARD_SOURCE_MANIFEST_MIGRATION_SMOKE_PASS,
    summaryPass: GUARD_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS,
    additionalMigrationPass: GUARD_SOURCE_MANIFEST_ADDITIONAL_MIGRATION_PASS,
    v255MigrationPass: GUARD_SOURCE_MANIFEST_V255_MIGRATION_PASS,
    v256HistoricalDocPass: GUARD_SOURCE_MANIFEST_V256_HISTORICAL_DOC_PASS,
    v257DocExistencePass: GUARD_SOURCE_MANIFEST_V257_DOC_EXISTENCE_PASS,
    v258CloseoutPass: GUARD_SOURCE_MANIFEST_V258_CLOSEOUT_PASS,
    historicalDocPass: historical.pass,
    sourceManifestPass: result.pass,
    checked: result.checked,
    migratedChecks: migrated.checked,
    markers: result.summary.markers + migrated.summary.markers + historical.summary.docs + docExistence.checked
  };
}

module.exports = { GUARD_SOURCE_MANIFEST_MIGRATION_SMOKE_PASS, GUARD_SOURCE_MANIFEST_MIGRATION_SUMMARY_PASS, GUARD_SOURCE_MANIFEST_ADDITIONAL_MIGRATION_PASS, GUARD_SOURCE_MANIFEST_V255_MIGRATION_PASS, GUARD_SOURCE_MANIFEST_V256_HISTORICAL_DOC_PASS, GUARD_SOURCE_MANIFEST_V257_DOC_EXISTENCE_PASS, GUARD_SOURCE_MANIFEST_V258_CLOSEOUT_PASS, runGuardSourceManifestMigrationSmoke };
