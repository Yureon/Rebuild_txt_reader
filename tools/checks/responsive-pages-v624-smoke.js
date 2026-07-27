#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const metadataHtml = read('public/metadata.html');
const metadataCss = read('public/styles/metadata-page.css');
const adminCss = read('public/styles/admin-users.css');
const appCss = read('public/styles/app.css');
const deferredCss = read('public/styles/deferred-ui.css');
const loginCss = read('public/styles/login.css');
const shell = read('public/fragments/app-shell.html');

assert(metadataHtml.includes('metadata-page-header-menu'));
assert(metadataHtml.includes('<details class="metadata-page-overflow">'));
assert(metadataHtml.includes('</details>\n      <div class="metadata-page-header-actions">'));
assert(metadataCss.includes('.metadata-page-header-menu>.metadata-page-overflow[open]+.metadata-page-header-actions'));
assert(metadataCss.includes('@media(min-width:761px)'));
assert(metadataCss.includes('.metadata-page-header-menu>.metadata-page-overflow{display:none}'));
assert(metadataCss.includes('.metadata-page-back{width:44px;height:44px;min-width:44px;min-height:44px}'));

assert(adminCss.includes('@media(max-width:1200px)'));
assert(adminCss.includes('grid-template-columns:minmax(0,1fr)!important'));
assert(adminCss.includes('.picker-column-summary{width:100%!important;min-width:0!important;max-width:100%!important}'));

assert(appCss.includes('@media(max-width:360px)'));
assert(appCss.includes('body[data-client-profile="site"] #theme-toggle-btn'));
assert(appCss.includes('.library-view-tab>span:last-child'));
assert(appCss.includes('.toolbar #menu-btn{width:44px;min-width:44px;flex:0 0 44px}'));
assert(shell.includes('aria-label="카드형 보기"'));
assert(shell.includes('aria-label="폴더 트리 보기"'));
assert(shell.includes('aria-label="탐색기형 보기"'));

assert(deferredCss.includes('.tem-close,.sp-close,.rdm-close,#font-modal-close{width:44px;min-width:44px;height:44px;min-height:44px}'));
assert(loginCss.includes('.tab-btn{min-height:44px}'));
assert(loginCss.includes('.btn-login{min-height:48px}'));
console.log(JSON.stringify({ pass:'v624-responsive-pages-contract-pass' }));
