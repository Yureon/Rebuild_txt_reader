const path = require('path');
const { pathToFileURL } = require('url');
const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const READER_VIRTUAL_SCROLL_STABILITY_SMOKE_PASS = 'v239-reader-virtual-scroll-stability-smoke-pass';
const READER_VIRTUAL_SCROLL_STABILITY_IN_PROCESS_PASS = 'v254-reader-virtual-scroll-stability-in-process-pass';

async function runReaderVirtualScrollStabilitySmoke(projectRoot) {
  if (!projectRoot) throw new Error('runReaderVirtualScrollStabilitySmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    source: 'rebuild/features/reader/virtual-scroll-stability.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  ['v239-reader-virtual-scroll-stability-pass', 'captureVirtualScrollAnchor', 'applyVirtualScrollAnchor'].forEach(marker => {
    if (!sources.source.includes(marker)) throw new Error('virtual scroll stability source marker missing: ' + marker);
  });
  const mod = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-scroll-stability.mjs')).href + '?smoke=v254');
  const { READER_VIRTUAL_SCROLL_STABILITY_PASS, applyVirtualScrollAnchor, captureVirtualScrollAnchor } = mod;
  if (READER_VIRTUAL_SCROLL_STABILITY_PASS !== 'v239-reader-virtual-scroll-stability-pass') throw new Error('stale scroll stability marker');
  const rows = [{ id:'1:h' }, { id:'1:b:0' }, { id:'1:b:1' }];
  const reader = { scrollTop: 110 };
  const anchor = captureVirtualScrollAnchor({ reader, rows, prefix:[0, 76, 176, 276], anchorOffsetPx:36 });
  if (!anchor || anchor.rowId !== '1:b:0') throw new Error('failed to capture the visible row anchor');
  const applied = applyVirtualScrollAnchor({ reader, rows, prefix:[0, 126, 226, 326], anchor });
  if (!applied.applied) throw new Error('height delta above the anchor row should be compensated');
  if (reader.scrollTop !== 160) throw new Error('unexpected compensated scrollTop: ' + reader.scrollTop);
  const stable = applyVirtualScrollAnchor({ reader, rows, prefix:[0, 126, 226, 326], anchor:captureVirtualScrollAnchor({ reader, rows, prefix:[0, 126, 226, 326] }) });
  if (stable.applied) throw new Error('below-threshold unchanged layout should not adjust scrollTop');
  return { pass: READER_VIRTUAL_SCROLL_STABILITY_SMOKE_PASS, inProcessPass: READER_VIRTUAL_SCROLL_STABILITY_IN_PROCESS_PASS, sourceManifestPass: sourceSummary.pass };
}

module.exports = {
  READER_VIRTUAL_SCROLL_STABILITY_SMOKE_PASS,
  READER_VIRTUAL_SCROLL_STABILITY_IN_PROCESS_PASS,
  runReaderVirtualScrollStabilitySmoke
};
