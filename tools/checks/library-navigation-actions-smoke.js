const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const LIBRARY_NAVIGATION_ACTIONS_SMOKE_PASS = 'v371-library-navigation-actions-smoke-pass';

async function runLibraryNavigationActionsSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const rel = 'public/scripts/rebuild/features/library-navigation-actions.mjs';
  const full = path.join(projectRoot, rel);
  const source = fs.readFileSync(full, 'utf8');
  [
    'v296-library-navigation-actions-pass',
    'openNovelFromElementRuntime',
    'openEpisodeFromElementRuntime',
    'closeSidebarAfterLibraryOpenRuntime',
    'getLibraryNavigationActionsContract',
    'v371-library-multifile-open-no-auto-expand-pass'
  ].forEach(marker => {
    if (!source.includes(marker)) throw new Error('library navigation actions marker missing: ' + marker);
  });
  const library = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs'), 'utf8');
  if (!library.includes("from './library-navigation-actions.mjs'") && !library.includes("from './library-navigation-bridge.mjs'")) throw new Error('library.mjs does not import navigation actions runtime or v301 bridge');
  if (library.includes('function openNovelFromElement(app, item) {\n  const novel =')) throw new Error('openNovelFromElement implementation still lives in library.mjs');
  const mod = await import(pathToFileURL(full).href);
  const opened = [];
  const app = {
    isMobileProfile: true,
    closeSidebar: () => opened.push(['close']),
    state: {
      novelById: new Map([['n1', { id:'n1', isMultiFile:false, title:'Novel' }], ['n2', { id:'n2', isMultiFile:true, episodes:[{ id:'e1' }] }]]),
      expandedEpisodeNovels: new Set(),
      progress: { byNovel:{ n1:{ chunk:2 }, n2:{ episodeId:'e1' } }, lastRead:{ episodeId:'e1' }, readMeta:{ 'n2-e1':{ chunk:4 } } }
    },
    reader: { openNovel: (novel, options) => opened.push([novel.id, options]) }
  };
  const deps = {
    closeSidebarAfterLibraryOpen: () => opened.push(['close-dep']),
    findEpisodeForSnapshot: (novel) => novel.episodes[0],
    openOptionsFromSnapshot: (base, snap) => ({ ...base, snap }),
    persistLibraryUi: () => opened.push(['persist-ui']),
    renderLibrary: () => opened.push(['render'])
  };
  const one = mod.openNovelFromElementRuntime(app, { dataset:{ novelId:'n1' } }, deps);
  const two = mod.openNovelFromElementRuntime(app, { dataset:{ novelId:'n2' } }, deps);
  const three = mod.openEpisodeFromElementRuntime(app, { dataset:{ novelId:'n2', episodeId:'e1' } }, deps);
  if (!one.opened || one.type !== 'single-file') throw new Error('single-file navigation did not open');
  if (!two.opened || two.type !== 'multi-file' || app.state.expandedEpisodeNovels.has('n2')) throw new Error('multi-file navigation should open without auto-expanding');
  if (!three.opened || three.type !== 'episode') throw new Error('episode navigation did not open');
  return { pass: LIBRARY_NAVIGATION_ACTIONS_SMOKE_PASS, opened: opened.length };
}

module.exports = { LIBRARY_NAVIGATION_ACTIONS_SMOKE_PASS, runLibraryNavigationActionsSmoke };
if (require.main === module) runLibraryNavigationActionsSmoke().catch(error => { console.error(error && error.stack || error); process.exit(1); });
