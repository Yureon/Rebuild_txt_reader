const fs = require('fs');
const path = require('path');

const LIBRARY_VIRTUAL_RECORDING_RUNTIME_SMOKE_PASS = 'v293-library-virtual-recording-runtime-smoke-pass';

function runLibraryVirtualRecordingRuntimeSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-recording-runtime.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_VIRTUAL_RECORDING_RUNTIME_PASS',
    'v293-library-virtual-recording-runtime-pass',
    'recordLibraryVirtualRenderRuntime',
    'recordLibraryVirtualFallbackRuntime',
    'getLibraryVirtualRecordingRuntimeContract',
    'compactLibraryVirtualHistoryRecord',
    'normalizeLibraryVirtualFallbackRecord',
    'pushCappedHistory',
    'libraryVirtualRenderHistory',
    'libraryVirtualFallbackHistory'
  ].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library virtual recording runtime marker missing: ' + marker);
  });
  if (!library.includes("from './library-virtual-recording-runtime.mjs'")) throw new Error('library.mjs does not import virtual recording runtime');
  if (!library.includes('getLibraryVirtualRecordingDeps')) throw new Error('library.mjs recording deps bridge missing');
  if (library.includes('compactLibraryVirtualHistoryRecord')) throw new Error('library.mjs still imports compact history directly');
  if (library.includes('normalizeLibraryVirtualFallbackRecord')) throw new Error('library.mjs still normalizes fallback directly');
  return { pass: LIBRARY_VIRTUAL_RECORDING_RUNTIME_SMOKE_PASS };
}

module.exports = { LIBRARY_VIRTUAL_RECORDING_RUNTIME_SMOKE_PASS, runLibraryVirtualRecordingRuntimeSmoke };
if (require.main === module) runLibraryVirtualRecordingRuntimeSmoke();
