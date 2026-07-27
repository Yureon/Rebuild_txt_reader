const fs = require('fs');
const path = require('path');

const READER_PREPEND_ANCHOR_SMOKE_PASS = 'v283-reader-prepend-anchor-smoke-pass';

function runReaderPrependAnchorSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const src = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
  const required = [
    "READER_PREPEND_ANCHOR_PRESERVE_PASS = 'v283-reader-prepend-anchor-preserve-pass'",
    'const prependAnchor = capturePrependRebuildAnchor(app, mode, options);',
    "mode !== 'prepend'",
    "restorePrependRebuildAnchor(app, prependAnchor, 'post-layout')",
    'schedulePrependRebuildAnchorRecheck(app, prependAnchor)',
    'v.lastPrependScrollStability',
    'prependAnchorRecheckRaf',
    'prependAnchorPreservePass: READER_PREPEND_ANCHOR_PRESERVE_PASS'
  ];
  const missing = required.filter(marker => !src.includes(marker));
  if (missing.length) throw new Error('reader prepend anchor smoke missing markers: ' + missing.join(', '));
  console.log('reader prepend anchor smoke OK');
  return { pass: READER_PREPEND_ANCHOR_SMOKE_PASS, ok: true };
}

module.exports = { READER_PREPEND_ANCHOR_SMOKE_PASS, runReaderPrependAnchorSmoke };
if (require.main === module) runReaderPrependAnchorSmoke();
