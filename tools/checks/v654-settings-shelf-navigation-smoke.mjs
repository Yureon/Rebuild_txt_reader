#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeLibraryRecentNovelState } from '../../public/scripts/rebuild/features/library-shelf-runtime.mjs';
import { revealLibraryQuickItemInList } from '../../public/scripts/rebuild/features/library-quick-actions.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('public/styles/deferred-ui.css');
const appCss = read('public/styles/app.css');
const ui = read('public/scripts/rebuild/features/ui.mjs');
const shelf = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const quick = read('public/scripts/rebuild/features/library-quick-actions.mjs');

for (const marker of [
  'height:var(--app-vh,100dvh)!important',
  'grid-template-rows:auto minmax(0,1fr)!important',
  'height:auto!important',
  'min-height:0!important',
  'overflow-y:auto!important',
  'touch-action:pan-y!important',
  'scrollbar-gutter:stable',
  '.settings-panel.settings-page .setting-block',
  '.settings-panel.settings-page .sp-section'
]) assert(css.includes(marker), `settings page scroll/UI marker missing: ${marker}`);

assert(ui.includes("const SETTINGS_PAGE_HISTORY_KEY = 'txtReaderSettingsPageV654'"));
assert(ui.includes('try { history.back(); } catch { finalizeSettingsPageClose(); }'), 'explicit settings close must consume only the single internal entry');
assert(ui.includes("setSettingsMobileView('index');"), 'mobile settings back must return to the category index');
assert(!ui.includes('history.go(detail ? -2 : -1)'), 'settings close must not jump across two browser history entries');
assert(!ui.includes('pushHistory:fromIndex'), 'mobile category selection must not add a second browser history entry');

const state = {
  recents:[
    { novelId:'main', episodeId:'e1' },
    { novelId:'alias', episodeId:'e2' },
    { novelId:'other', episodeId:'e3' }
  ],
  novelById:new Map([['main',{ id:'main', progressAliases:['main','alias'] }]]),
  libraryShelfItems:[]
};
const removed = removeLibraryRecentNovelState(state, 'main');
assert.deepEqual(removed, { changed:true, novelId:'main', removed:2 });
assert.deepEqual(state.recents, [{ novelId:'other', episodeId:'e3' }]);
assert(shelf.includes("libraryShelfAction:'scope-remove'"), 'shelf cards need an explicit scope removal action');
assert(shelf.includes("deps.removeRecent?.(app, novelId)"), 'recent scope removal is not connected');
assert(appCss.includes('.library-shelf-scope-remove-btn'), 'shelf scope removal control has no responsive styling');

const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;
const frames = [];
globalThis.localStorage = { setItem(){}, getItem(){ return null; } };
globalThis.window = {
  requestAnimationFrame(callback){ frames.push(callback); callback(); return frames.length; },
  setTimeout(callback){ callback(); return 1; },
  CSS:{ escape:value => String(value) }
};
let renderOptions = null;
let toastMessage = '';
const novel = { id:'novel-1', title:'작품', categoryPath:'장르 > 하위', progressAliases:['novel-1'] };
const app = {
  state:{
    libraryViewMode:'explorer',
    libraryExplorerPath:'',
    novelById:new Map([[novel.id, novel]]),
    collapsedFolders:new Set(['장르','장르>하위']),
    expandedEpisodeNovels:new Set(),
    current:null
  },
  els:{ novelList:{ querySelector(){ return null; } } }
};
const revealed = revealLibraryQuickItemInList(app, { dataset:{ novelId:'novel-1', episodeId:'' } }, {
  renderLibrary(_app, options){ renderOptions = options; },
  toast(_app, _kind, _title, message){ toastMessage = message; }
});
assert.equal(revealed, true);
assert.equal(app.state.libraryExplorerPath, '장르>하위');
assert.equal(renderOptions?.source, 'quick-reveal-explorer');
assert.equal(renderOptions?.resetScroll, true);
assert.match(toastMessage, /폴더로 이동|루트로 이동/);
assert(quick.includes("app.state.libraryViewMode === 'explorer'"), 'Windows explorer navigation branch missing');

globalThis.window = originalWindow;
globalThis.localStorage = originalLocalStorage;

console.log(JSON.stringify({
  pass:'v657-settings-shelf-navigation-compat-smoke-pass',
  settingsScroll:true,
  settingsCloseSafe:true,
  shelfScopeRemoval:true,
  explorerQuickNavigation:true
}));
