#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const PASS = 'v408-version-toast-smoke-pass';
const { CURRENT_REBUILD_VERSION: version } = require('./current-rebuild-version.js');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
assert.ok(read('public/scripts/rebuild/core/utils.mjs').includes(`REBUILD_VERSION = '${version}'`), 'core REBUILD_VERSION must match package version');
assert.ok(read('public/scripts/rebuild/features/ui.mjs').includes('txt_reader_ui_build_seen') && read('public/scripts/rebuild/features/ui.mjs').includes('업데이트 적용 · ${REBUILD_VERSION}'), 'boot toast must render current version once per build');
const shellRuntime = read('public/scripts/rebuild/core/app-shell.mjs');
assert.ok(shellRuntime.includes(`/fragments/app-shell.html?v=${version}`), 'reader shell cachebuster must match package version');
assert.ok(shellRuntime.includes(`/fragments/library-shell.html?v=${version}`), 'library shell cachebuster must match package version');
assert.ok(read('public/scripts/rebuild/state/app-state.mjs').includes(`version: '${version}'`), 'client state version must match package version');
assert.ok(read('public/library.html').includes(`v=${version}`), 'library html cachebuster must include current version');
assert.ok(read('public/site.html').includes(`v=${version}`), 'site html cachebuster must include current version');
assert.ok(read('public/mobile.html').includes(`v=${version}`), 'mobile html cachebuster must include current version');
console.log(JSON.stringify({ pass: PASS }));
