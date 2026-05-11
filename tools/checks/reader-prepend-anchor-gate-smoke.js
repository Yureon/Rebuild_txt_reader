const fs = require('fs');
const path = require('path');

const READER_PREPEND_ANCHOR_GATE_SMOKE_PASS = 'v284-reader-prepend-anchor-gate-smoke-pass';

function runReaderPrependAnchorGateSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const virtualLayout = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
  const chunkWindow = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader/chunk-window.mjs'), 'utf8');
  const requiredVirtualMarkers = [
    "READER_PREPEND_ANCHOR_GATED_PASS = 'v284-reader-prepend-anchor-gated-pass'",
    'resolvePrependAnchorGate(reader, v, options)',
    "reason = 'idle prepend uses height-delta fallback'",
    "source === READER_SCROLL_BUFFER_PASS",
    "isUserScrollSource(lastUserScrollSource)",
    'activeUserScroll && nearTop && bufferPrepend && backwardIntent',
    'recordPrependAnchorGate(v, gate)',
    'if (!gate.allowed) return null;',
    'prependAnchorGateReason',
    'v.lastPrependAnchorGate'
  ];
  const missingVirtual = requiredVirtualMarkers.filter(marker => !virtualLayout.includes(marker));
  if (missingVirtual.length) throw new Error('reader prepend anchor gate smoke missing virtual-layout markers: ' + missingVirtual.join(', '));
  const requiredChunkMarkers = [
    "v.lastScrollBufferDirection = 'backward';",
    "v.lastScrollBufferDirection = 'forward';",
    'return v.lastScrollBufferDirection || \'forward\';'
  ];
  const missingChunk = requiredChunkMarkers.filter(marker => !chunkWindow.includes(marker));
  if (missingChunk.length) throw new Error('reader prepend anchor gate smoke missing chunk-window markers: ' + missingChunk.join(', '));
  console.log('reader prepend anchor gate smoke OK');
  return { pass: READER_PREPEND_ANCHOR_GATE_SMOKE_PASS, ok: true };
}

module.exports = { READER_PREPEND_ANCHOR_GATE_SMOKE_PASS, runReaderPrependAnchorGateSmoke };
if (require.main === module) runReaderPrependAnchorGateSmoke();
