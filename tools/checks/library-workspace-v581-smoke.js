#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const shell = read('public/fragments/app-shell.html');
const css = read('public/styles/app.css');
const shelf = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const explorer = read('public/scripts/rebuild/features/library-explorer-renderer.mjs');
const orchestrator = read('public/scripts/rebuild/features/library-render-orchestrator.mjs');
const state = read('public/scripts/rebuild/state/app-state.mjs');
const helper = read('extensions/metadata-login-helper/popup.js');

assert(shell.includes('id="library-view-explorer"'), 'explorer view tab missing');
assert(shell.includes('data-library-view="explorer"'), 'explorer view contract missing');
assert(css.includes('min(1680px'), 'wide library workspace missing');
assert(css.includes('body[data-client-profile="library"].library-header-compact .sb-header'), 'compact sticky header missing');
assert(css.includes('.library-explorer-shell'), 'split-pane explorer shell missing');
assert(css.includes('grid-template-columns:260px minmax(0,1fr)'), 'desktop split-pane sizing missing');
assert(shelf.includes("LIBRARY_SHELF_AUTOLOAD_COOLDOWN_MS = 1200"), 'autoload cooldown missing');
assert(shelf.includes("source:`auto-${source}`"), 'autoload request source missing');
assert(shelf.includes("libraryShelfAutoLoadNotBefore"), 'autoload throttle state missing');
assert(!shelf.includes("dataset:{ libraryShelfAction:'load-more' }"), 'manual load-more button must not be rendered');
assert(explorer.includes('v581-library-explorer-renderer-pass'), 'explorer renderer marker missing');
assert(explorer.includes("class:'library-explorer-navigation'"), 'explorer navigation pane missing');
assert(explorer.includes("class:'library-explorer-folder-grid'"), 'explorer folder tile grid missing');
assert(explorer.includes("class:'library-explorer-content'"), 'explorer scroll pane missing');
assert(explorer.includes("library-header-compact"), 'explorer scroll header compaction missing');
assert(orchestrator.includes("libraryViewMode === 'explorer'"), 'explorer render branch missing');
assert(state.includes('libraryExplorerPath'), 'explorer path persistence missing');
assert(state.includes("['shelf','files','explorer']"), 'three-way view persistence missing');
assert(helper.includes('findRenderedSearchCandidates'), 'rendered search candidate discovery missing');
assert(helper.includes("chrome.tabs.update"), 'candidate-to-detail navigation missing');
assert(helper.includes("provider?.id !== 'builtin-kakaopage' && provider?.id !== 'builtin-naver-series'"), 'candidate discovery must support Kakao and Naver search results');
assert(!helper.includes('outerHTML:'), 'raw HTML must not enter helper payload');
console.log('v581-library-workspace-smoke-pass');
