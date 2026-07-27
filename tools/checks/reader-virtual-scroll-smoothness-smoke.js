const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_VIRTUAL_SCROLL_SMOOTHNESS_SMOKE_PASS = 'v239-reader-virtual-scroll-smoothness-smoke-pass';
const READER_VIRTUAL_SCROLL_SMOOTHNESS_SOURCE_MANIFEST_PASS = 'v254-reader-virtual-scroll-smoothness-source-manifest-pass';

function runReaderVirtualScrollSmoothnessSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderVirtualScrollSmoothnessSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    layoutSource: 'rebuild/features/reader/virtual-layout.mjs',
    readerSource: 'rebuild/features/reader.mjs',
    diagnosticsSource: 'rebuild/features/reader/virtual-layout-diagnostics.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);

  const requiredLayoutMarkers = [
    'export function markVirtualScrollActivity',
    'function isVirtualScrollActive',
    'function scheduleIdleMeasure',
    'if (!v.pendingScrollTarget && !v.pendingSliderMeasureTarget && isVirtualScrollActive(v))',
    'function canReuseRenderedWindow',
    'renderReuseCount',
    'measureDeferralCount'
  ];
  for (const marker of requiredLayoutMarkers) {
    if (!sources.layoutSource.includes(marker)) throw new Error('missing virtual scroll smoothness layout marker: ' + marker);
  }

  if (!sources.readerSource.includes('markVirtualScrollActivity(app, { source: \'scroll\' })')) {
    throw new Error('reader scroll handler must mark active scroll before virtual render scheduling');
  }
  if (!sources.readerSource.includes("markVirtualScrollActivity(app, { source: 'drag-pan', durationMs: 220 })")) {
    throw new Error('desktop drag panning must mark active scroll before programmatic scrollTop writes');
  }
  if (!sources.readerSource.includes("markVirtualScrollActivity(app, { source: 'tap-animation', durationMs: 120 })")) {
    throw new Error('tap animation scrolls must be treated as active scroll to defer measuring');
  }

  for (const marker of ['userScrollActive', 'measureIdleScheduled', 'lastRenderReuse']) {
    if (!sources.diagnosticsSource.includes(marker)) throw new Error('diagnostics missing smoothness field: ' + marker);
  }

  return {
    pass: READER_VIRTUAL_SCROLL_SMOOTHNESS_SMOKE_PASS,
    sourceManifestPass: READER_VIRTUAL_SCROLL_SMOOTHNESS_SOURCE_MANIFEST_PASS,
    projectSourceManifestPass: sourceSummary.pass,
    files: sourceSummary.files
  };
}

module.exports = {
  READER_VIRTUAL_SCROLL_SMOOTHNESS_SMOKE_PASS,
  READER_VIRTUAL_SCROLL_SMOOTHNESS_SOURCE_MANIFEST_PASS,
  runReaderVirtualScrollSmoothnessSmoke
};
