#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const shell = read('public/fragments/app-shell.html');
const site = read('public/site.html');
const mobile = read('public/mobile.html');
const appCss = read('public/styles/app.css');
const ui = read('public/scripts/rebuild/features/ui.mjs');
const search = read('public/scripts/rebuild/features/search/results-view.mjs');
const searchMain = read('public/scripts/rebuild/features/search.mjs');
const admin = read('public/admin/users.html');

assert.ok(site.includes('id="boot-skeleton"') && mobile.includes('id="boot-skeleton"'), 'boot skeleton missing from entry pages');
assert.ok(shell.includes('class="library-skeleton"'), 'library skeleton missing from app shell');
assert.ok(shell.includes('class="reader-load-skeleton"'), 'reader loading skeleton missing from app shell');
assert.ok(appCss.includes('v417 skeleton UI') && appCss.includes('@keyframes skeletonShimmer'), 'app skeleton CSS missing');
assert.ok(ui.includes("v417-skeleton-ui-pass") && ui.includes('createLibrarySkeletonNode'), 'ui skeleton runtime marker missing');
assert.ok(search.includes("v417-search-skeleton-ui-pass") && search.includes('createSearchSkeletonNode'), 'search skeleton runtime marker missing');
assert.ok(searchMain.includes('beginSearchRun') && searchMain.includes('renderResults(app);\n  try'), 'search skeleton render trigger missing');
assert.ok(admin.includes('admin-skeleton-list'), 'owner console skeleton placeholder missing');
console.log('v417-skeleton-ui-smoke-pass');
