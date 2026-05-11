const fs = require('fs');
const path = require('path');

const LIBRARY_RUNTIME_CONFIG_SMOKE_PASS = 'v300-library-runtime-config-smoke-pass';

function runLibraryRuntimeConfigSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const configPath = path.join(projectRoot, 'public/scripts/rebuild/features/library-runtime-config.mjs');
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const config = fs.readFileSync(configPath, 'utf8');
  const library = fs.readFileSync(libraryPath, 'utf8');
  [
    'LIBRARY_RUNTIME_CONFIG_PASS',
    'v300-library-runtime-config-pass',
    'LIBRARY_FILTER_RENDER_WAIT',
    'LIBRARY_VIRTUAL_HISTORY_LIMIT',
    'LIBRARY_VIRTUAL_DEFAULT_ROLLOUT_PASS',
    'LIBRARY_VIRTUAL_AUTO_FALLBACK_STORAGE_KEY',
    'LIBRARY_VIRTUAL_WIDE_WINDOW_OVERSCAN',
    'LIBRARY_VIRTUAL_WIDE_MAX_WINDOW_ROWS',
    'LIBRARY_VIRTUAL_RENDER_WINDOW_SKIP_PASS',
    'LIBRARY_VIRTUAL_AUTO_ENABLE_ROW_THRESHOLD'
  ].forEach(marker => {
    if (!config.includes(marker)) throw new Error('library runtime config marker missing: ' + marker);
  });
  if (!library.includes("from './library-runtime-config.mjs'")) throw new Error('library.mjs does not import runtime config');
  if (/const\s+LIBRARY_FILTER_RENDER_WAIT\s*=/.test(library)) throw new Error('library.mjs still owns LIBRARY_FILTER_RENDER_WAIT literal');
  if (/const\s+LIBRARY_VIRTUAL_HISTORY_LIMIT\s*=/.test(library)) throw new Error('library.mjs still owns virtual history limit literal');
  return { pass: LIBRARY_RUNTIME_CONFIG_SMOKE_PASS };
}

module.exports = { LIBRARY_RUNTIME_CONFIG_SMOKE_PASS, runLibraryRuntimeConfigSmoke };
if (require.main === module) runLibraryRuntimeConfigSmoke();
