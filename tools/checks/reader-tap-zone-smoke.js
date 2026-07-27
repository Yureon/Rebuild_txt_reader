const fs = require('fs');
const path = require('path');

const READER_TAP_ZONE_SMOKE_PASS = 'v281-reader-tap-zone-smoke-pass';

function runReaderTapZoneSmoke(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/reader.mjs'), 'utf8');
  const required = [
    "READER_TAP_ZONE_PASS = 'v281-reader-third-tap-zone-pass'",
    'reader.dataset.readerTapZonePass = READER_TAP_ZONE_PASS',
    'const zone = resolveReaderTapZone(yRatio)',
    "if (zone === 'middle')",
    "scrollReaderByPage(app, zone === 'top' ? -1 : 1, 'tap')",
    'function resolveReaderTapZone(yRatio)',
    "if (yRatio < 1 / 3) return 'top'",
    "if (yRatio > 2 / 3) return 'bottom'",
    "return 'middle'"
  ];
  const missing = required.filter(marker => !source.includes(marker));
  if (missing.length) throw new Error('reader tap zone smoke missing markers: ' + missing.join(', '));
  if (source.includes('function isReaderCenterZone') || source.includes('function getTapDirection')) {
    throw new Error('legacy center/axis tap helpers must not remain after third-zone tap routing');
  }
  console.log('reader tap zone smoke OK');
  return { pass: READER_TAP_ZONE_SMOKE_PASS, ok: true };
}

module.exports = { runReaderTapZoneSmoke, READER_TAP_ZONE_SMOKE_PASS };
