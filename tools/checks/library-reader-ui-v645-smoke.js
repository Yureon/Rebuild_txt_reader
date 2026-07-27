#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const appCss = read('public/styles/app.css');
const deferredCss = read('public/styles/deferred-ui.css');
const deferredHtml = read('public/fragments/deferred-ui.html');
const scroll = read('public/scripts/scroll-to-top.js');

assert(appCss.includes('grid-template-areas:"heading heading" "search search" "view view" "scope scope" "status status" "chips chips";'), 'mobile library view/scope rows must use the full viewport width');
assert(appCss.includes('flex-direction:row') && appCss.includes('writing-mode:horizontal-tb') && appCss.includes('.library-scope-tab>span'), 'library scope labels must remain horizontally arranged');
assert(!appCss.includes('grid-template-areas:"heading heading" "search search" "view scope"'), 'half-width mobile scope layout must not remain');
assert(scroll.includes("PASS = 'v645-scroll-to-top-reader-suppression-pass'"), 'reader scroll-to-top suppression marker missing');
assert(scroll.includes('function isReaderScrollRoot(root)'), 'reader root detector missing');
assert(scroll.includes('!isReaderScrollRoot(activeRoot)'), 'reader root must suppress the global scroll-to-top button');
assert(!/selectors\s*=\s*\[[\s\S]*?'\.reader'/.test(scroll), 'reader must not be selected as a general scroll-to-top root');
assert(deferredHtml.includes('id="nsearch-run"') && deferredHtml.includes('enterkeyhint="search"'), 'reader search must expose a mobile-friendly explicit search action');
assert(appCss.includes('body[data-client-profile="mobile"] #nsearch-panel,'), 'mobile search panel selector must reference the real panel id');
assert(!appCss.includes('#nsearch-modal'), 'stale mobile search modal id must not remain in app CSS');
assert(!deferredCss.includes('#nsearch-modal'), 'stale mobile search modal id must not remain in deferred CSS');
assert(deferredCss.includes('.nsearch-run-btn') && deferredCss.includes('.nsearch-input-wrap{display:grid'), 'search run button layout CSS missing');
console.log(JSON.stringify({ pass:'v645-library-reader-ui-pass' }));
