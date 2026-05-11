#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const PASS = 'v408-version-toast-smoke-pass';
const version = 'rebuild-v564';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
assert.ok(read('public/scripts/rebuild/core/utils.mjs').includes(`REBUILD_VERSION = '${version}'`), 'core REBUILD_VERSION must match package version');
assert.ok(read('public/scripts/rebuild/features/ui.mjs').includes('UI 유지 · ${REBUILD_VERSION}'), 'boot toast must render REBUILD_VERSION');
assert.ok(read('public/scripts/rebuild/core/app-shell.mjs').includes(`/fragments/app-shell.html?v=${version}`), 'app shell cachebuster must match package version');
assert.ok(read('public/scripts/rebuild/state/app-state.mjs').includes(`version: '${version}'`), 'client state version must match package version');
assert.ok(read('public/site.html').includes(`v=${version}`), 'site html cachebuster must include current version');
assert.ok(read('public/mobile.html').includes(`v=${version}`), 'mobile html cachebuster must include current version');
console.log(JSON.stringify({ pass: PASS }));
