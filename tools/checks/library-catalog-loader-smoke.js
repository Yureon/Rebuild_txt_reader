const fs = require('fs');
const path = require('path');

const LIBRARY_CATALOG_LOADER_SMOKE_PASS = 'v298-library-catalog-loader-smoke-pass';

function runLibraryCatalogLoaderSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const runtime = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library-catalog-loader.mjs'), 'utf8');
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  ['LIBRARY_CATALOG_LOADER_PASS', 'v298-library-catalog-loader-pass', 'loadLibraryCatalogRuntime', 'app.api.novels()', 'applyLibraryCatalogState'].forEach(marker => {
    if (!runtime.includes(marker)) throw new Error('library catalog loader marker missing: ' + marker);
  });
  if (!library.includes("from './library-catalog-loader.mjs'")) throw new Error('library.mjs does not import catalog loader runtime');
  if (!library.includes('loadLibraryCatalogRuntime(app, options,')) throw new Error('library.mjs catalog loader bridge missing');
  if (library.includes('const payload = await app.api.novels()')) throw new Error('library.mjs still owns catalog fetch body');
  return { pass: LIBRARY_CATALOG_LOADER_SMOKE_PASS };
}

module.exports = { LIBRARY_CATALOG_LOADER_SMOKE_PASS, runLibraryCatalogLoaderSmoke };
if (require.main === module) runLibraryCatalogLoaderSmoke();
