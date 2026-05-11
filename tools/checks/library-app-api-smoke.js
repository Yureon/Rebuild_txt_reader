const fs = require('fs');
const path = require('path');

const LIBRARY_APP_API_SMOKE_PASS = 'v298-library-app-api-smoke-pass';

function runLibraryAppApiSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-app-api.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  [
    'LIBRARY_APP_API_RUNTIME_PASS',
    'v298-library-app-api-runtime-pass',
    'createLibraryAppApiRuntime',
    'cancelPendingRender',
    'testTopAnchorRestore',
    'forceFollowActive'
  ].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library app api marker missing: ' + marker);
  });
  if (!library.includes("from './library-app-api.mjs'")) throw new Error('library.mjs does not import app api runtime');
  if (!library.includes('app.library = createLibraryAppApiRuntime(app,')) throw new Error('library.mjs app api bridge missing');
  if (library.includes('getFlattenDiagnostics: () => getLibraryFlattenDiagnostics')) throw new Error('library.mjs still owns inline app.library diagnostics API');
  return { pass: LIBRARY_APP_API_SMOKE_PASS };
}

module.exports = { LIBRARY_APP_API_SMOKE_PASS, runLibraryAppApiSmoke };
if (require.main === module) runLibraryAppApiSmoke();
