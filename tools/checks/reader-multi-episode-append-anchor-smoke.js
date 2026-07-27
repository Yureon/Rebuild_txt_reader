const fs = require('fs');
const path = require('path');
const assert = require('assert');

const PASS = 'v355-reader-multi-episode-append-anchor-smoke-pass';

function read(root, relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

function runReaderMultiEpisodeAppendAnchorSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const layout = read(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs');
  assert.ok(layout.includes("READER_MULTI_EPISODE_APPEND_ANCHOR_PASS = 'v355-reader-multi-episode-append-anchor-pass'"), 'missing v355 append anchor pass marker');
  assert.ok(layout.includes("READER_APPEND_MEASURE_ANCHOR_PASS = 'v355-reader-append-measure-anchor-pass'"), 'missing v355 append measure pass marker');
  assert.ok(layout.includes("reason = 'active forward buffer append keeps native scrollTop without append anchor'"), 'active forward buffer append must yield to native scrollTop');
  assert.ok(layout.includes('const allowed = nativeBottomGrowth ? false : shouldPreserve;'), 'native forward append must not capture append anchor');
  assert.ok(layout.includes('nativeBottomGrowth,'), 'append gate diagnostics must retain nativeBottomGrowth field');
  assert.ok(layout.includes('hasRecentAppendAnchorRestore(v)'), 'measure commit must detect recent append anchor restoration');
  assert.ok(layout.includes('recordAppendMeasureAnchorBypass(v,'), 'measure commit must record freeze bypass after append anchor');
  assert.ok(!layout.includes('const allowed = shouldPreserve && !nativeBottomGrowth;'), 'old native-bottom-growth anchor suppression must not return');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runReaderMultiEpisodeAppendAnchorSmoke()));

module.exports = { PASS, runReaderMultiEpisodeAppendAnchorSmoke };
