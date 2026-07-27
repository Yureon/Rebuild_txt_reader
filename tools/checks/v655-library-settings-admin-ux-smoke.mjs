#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { toggleLibraryExplorerFolderRuntime } from '../../public/scripts/rebuild/features/library-event-delegation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const appCss = read('public/styles/app.css');
const settingsCss = read('public/styles/deferred-ui.css');
const explorer = read('public/scripts/rebuild/features/library-explorer-renderer.mjs');
const shelf = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const stateSource = read('public/scripts/rebuild/state/app-state.mjs');
const cleanup = read('public/scripts/admin/library-cleanup.js');
const adminCss = read('public/styles/admin-users.css');

assert(appCss.includes('body[data-client-profile="library"]:not(.library-shelf-mode) #library-quick-list'), 'tree/explorer quick list width contract missing');
assert(appCss.includes('width:min(1680px,calc(100% - clamp(20px,3vw,48px)))'), 'quick list does not share the workspace width');
assert(explorer.includes('data') && explorer.includes('libraryExplorerToggle:key'), 'Explorer folder collapse control missing');
assert(explorer.includes('library-explorer-nav-children'), 'Explorer child folder container missing');
assert(stateSource.includes("libraryExplorerCollapsedFolders: new Set((value => Array.isArray(value) ? value : [])(loadLocal('libraryExplorerCollapsedFolders', [])))"), 'Explorer collapse state is not restored safely');
assert(stateSource.includes("saveLocal('libraryExplorerCollapsedFolders'"), 'Explorer collapse state is not persisted');

let renderOptions = null;
let persisted = 0;
const app = { state:{ libraryViewMode:'explorer', libraryExplorerCollapsedFolders:new Set() } };
let result = toggleLibraryExplorerFolderRuntime(app, '장르>하위', {
  persistLibraryUi(){ persisted += 1; },
  renderLibrary(_app, options){ renderOptions = options; }
});
assert.deepEqual(result, { key:'장르>하위', collapsed:true });
assert(app.state.libraryExplorerCollapsedFolders.has('장르>하위'));
assert.equal(renderOptions?.source, 'explorer-folder-toggle');
result = toggleLibraryExplorerFolderRuntime(app, '장르>하위', { persistLibraryUi(){ persisted += 1; }, renderLibrary(){} });
assert.equal(result.collapsed, false);
assert.equal(persisted, 2);

assert(shelf.includes("' has-scope-remove'"), 'shelf card scope action has no reserved footer state');
assert(shelf.includes("text:activeScope === 'favorites' ? '즐겨찾기 해제' : '최근에서 제거'"), 'scope action copy was not repositioned/clarified');
assert(appCss.includes('.library-shelf-card.has-scope-remove .library-shelf-card-copy{padding-bottom:52px}'), 'scope action still overlays card metadata');

for (const marker of [
  '.settings-panel.settings-page .settings-page-layout{',
  'grid-template-rows:auto minmax(0,1fr)!important;',
  'height:auto!important;',
  'min-height:0!important;',
  'overflow-y:auto!important;',
  '.settings-panel.settings-page .sp-section>:is(.setting-select',
  '.settings-panel.settings-page .setting-select{width:min(100%,520px)',
  '.settings-panel .setting-actions,.settings-panel .site-language-actions{display:grid'
]) assert(settingsCss.includes(marker), `settings scroll/language layout marker missing: ${marker}`);

assert(cleanup.includes('검토 후보는 자동 정리 대상이 아닙니다.'), 'review candidate behavior explanation missing');
assert(cleanup.includes("openLabel:'비교 열기'"), 'review candidate disclosure has no explicit action label');
assert(cleanup.includes('아직 정리 대상에는 포함되지 않았습니다.'), 'review disclosure status feedback missing');
assert(cleanup.includes('현재 상태 · 검토 전용'), 'review pair state missing');
assert(adminCss.includes('.library-cleanup-review-guide'), 'review guide has no styling');
assert(adminCss.includes('.library-cleanup-disclosure-affordance'), 'review disclosure affordance has no styling');

console.log(JSON.stringify({
  pass:'v657-library-settings-admin-ux-compat-smoke-pass',
  quickWidth:true,
  explorerCollapse:true,
  shelfActionPosition:true,
  settingsScroll:true,
  siteLanguageLayout:true,
  cleanupReviewGuidance:true
}));
