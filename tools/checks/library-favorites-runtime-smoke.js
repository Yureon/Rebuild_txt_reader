const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const LIBRARY_FAVORITES_RUNTIME_SMOKE_PASS = 'v296-library-favorites-runtime-smoke-pass';

async function runLibraryFavoritesRuntimeSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const rel = 'public/scripts/rebuild/features/library-favorites-runtime.mjs';
  const full = path.join(projectRoot, rel);
  const source = fs.readFileSync(full, 'utf8');
  ['v296-library-favorites-runtime-pass', 'toggleLibraryFavoriteRuntime', 'getLibraryFavoritesRuntimeContract'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('library favorites runtime marker missing: ' + marker);
  });
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  if (!library.includes("from './library-favorites-runtime.mjs'") && !library.includes("from './library-favorites-bridge.mjs'")) throw new Error('library.mjs does not import favorites runtime or v301 bridge');
  if (library.includes('if (app.state.favorites.has(novelId)) app.state.favorites.delete(novelId);')) throw new Error('favorite implementation still lives in library.mjs');
  const mod = await import(pathToFileURL(full).href);
  const calls = [];
  const app = { state:{ favorites:new Set() } };
  const deps = {
    getLibraryScrollAnchor: () => ({ top:12 }),
    persistBookData: () => calls.push('persist'),
    renderLibrary: (_app, opts) => calls.push(['render', opts.source, opts.followActive]),
    toast: (_app, tone, title, message) => calls.push(['toast', tone, title, message])
  };
  const added = mod.toggleLibraryFavoriteRuntime(app, 'n1', deps);
  const removed = mod.toggleLibraryFavoriteRuntime(app, 'n1', deps);
  if (!added.changed || !added.isFavorite) throw new Error('favorite add result invalid');
  if (!removed.changed || removed.isFavorite) throw new Error('favorite remove result invalid');
  if (calls.filter(item => item === 'persist').length !== 2) throw new Error('favorite persistence not called twice');
  return { pass: LIBRARY_FAVORITES_RUNTIME_SMOKE_PASS, calls: calls.length };
}

module.exports = { LIBRARY_FAVORITES_RUNTIME_SMOKE_PASS, runLibraryFavoritesRuntimeSmoke };
if (require.main === module) runLibraryFavoritesRuntimeSmoke().catch(error => { console.error(error && error.stack || error); process.exit(1); });
