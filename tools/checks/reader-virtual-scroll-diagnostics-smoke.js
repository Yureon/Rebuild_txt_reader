const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_VIRTUAL_SCROLL_DIAGNOSTICS_SMOKE_PASS = 'v241-reader-virtual-scroll-diagnostics-smoke-pass';
const READER_VIRTUAL_SCROLL_PROJECT_SOURCE_PASS = 'v253-reader-virtual-scroll-project-source-pass';

function runReaderVirtualScrollDiagnosticsSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderVirtualScrollDiagnosticsSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    layoutSource: 'rebuild/features/reader/virtual-layout.mjs',
    diagnosticsSource: 'rebuild/features/reader/virtual-layout-diagnostics.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  for (const marker of [
    'v241-reader-scroll-input-diagnostics-pass',
    'function createScrollInputStats',
    'stats.bySource[sourceLabel]',
    'stats.lastActiveUntil'
  ]) {
    if (!sources.layoutSource.includes(marker)) throw new Error('missing scroll diagnostics layout marker: ' + marker);
  }
  for (const marker of ['scrollInputDiagnosticsPass', 'scrollInputStats']) {
    if (!sources.diagnosticsSource.includes(marker)) throw new Error('missing scroll diagnostics report field: ' + marker);
  }
  return { pass: READER_VIRTUAL_SCROLL_DIAGNOSTICS_SMOKE_PASS, projectSourcePass: READER_VIRTUAL_SCROLL_PROJECT_SOURCE_PASS, sourceSummary };
}

module.exports = {
  READER_VIRTUAL_SCROLL_DIAGNOSTICS_SMOKE_PASS,
  READER_VIRTUAL_SCROLL_PROJECT_SOURCE_PASS,
  runReaderVirtualScrollDiagnosticsSmoke
};
