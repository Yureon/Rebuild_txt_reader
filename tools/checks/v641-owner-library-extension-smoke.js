#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname,'../..');
const read = rel => fs.readFileSync(path.join(root,rel),'utf8');

const permissions = read('public/scripts/admin/permissions.js');
const adminCss = read('public/styles/admin-users.css');
assert(permissions.includes('v641-admin-folder-explorer-picker-pass'));
assert(permissions.includes('folder-explorer-head'));
assert(permissions.includes('folder-explorer-name'));
assert(permissions.includes('folder-explorer-parent'));
assert(!permissions.includes('padding-left:${Math.max(0,Number(n.depth'));
assert(adminCss.includes('.folder-explorer-head,.folder-explorer-row'));

const scroll = read('public/scripts/scroll-to-top.js');
assert(scroll.includes('lastScrolledRoot'));
assert(!/setTimeout\([^)]*classList\.remove\(['"]is-visible/.test(scroll));
assert(scroll.includes("'#novel-list'") && scroll.includes("'.sidebar'"));

const quick = read('public/scripts/rebuild/features/library-quick-list.mjs');
assert(quick.includes('collapsed:{ recents:true, favorites:true }'));
assert(quick.includes("if (ui.active === key) ui.collapsed[key] = !ui.collapsed[key]"));
assert(quick.includes('hidden: collapsed ? true : false'));

const shell = read('public/fragments/app-shell.html');
const statusStart = shell.indexOf('library-shelf-status-row');
const tagButton = shell.indexOf('id="library-user-tags-btn"');
assert(statusStart >= 0 && tagButton > statusStart);
assert(shell.includes('library-card-only-action'));
const appCss = read('public/styles/app.css');
assert(appCss.includes('body:not(.library-shelf-mode) .library-card-only-action{display:none!important}'));

const extManifest = JSON.parse(read('extensions/metadata-login-helper/manifest.json'));
assert.equal(extManifest.version,JSON.parse(read('package.json')).version);
assert(extManifest.host_permissions.includes('https://ssn.so/*'));
assert(extManifest.host_permissions.every(item => !item.includes('://*.')));
const popup = read('extensions/metadata-login-helper/popup.js');
const background = read('extensions/metadata-login-helper/background.js');
assert(popup.includes('canonicalDetailTarget(provider?.id'));
assert(popup.includes("providerId === 'builtin-ssn'"));
assert(popup.includes('captureAndImportCurrent'));
assert(popup.includes('readerTabId:tab.id'));
assert(popup.includes('autoActionStarted'));
assert(background.includes("importScripts('url-policy.js')"));
assert(background.includes('canonicalDetailTarget(providerId, href)'));
const policyPath = path.join(root,'extensions/metadata-login-helper/url-policy.js');
delete require.cache[policyPath]; require(policyPath);
const policy = globalThis.TxtReaderMetadataUrlPolicy;
assert.equal(policy.canonicalDetailTarget('builtin-ssn','https://ssn.so/series/283549/'),'https://ssn.so/series/283549/');
assert.equal(policy.canonicalDetailTarget('builtin-ssn','https://ssn.so/series/?keyword=test'),null);
assert.equal(policy.canonicalDetailTarget('builtin-ssn','https://ssn.so/'),null);
const popupHtml = read('extensions/metadata-login-helper/popup.html');
const popupCss = read('extensions/metadata-login-helper/popup.css');
assert(popupHtml.includes('flow-step'));
assert(popupHtml.includes('stage-badge'));
assert(popupCss.includes('.flow-step'));

console.log(JSON.stringify({ pass:'v641-owner-library-extension-pass', areas:['windows-picker','persistent-scroll-top','collapsed-quick-sections','card-only-tags','ssn-detail','two-step-extension'] }));
