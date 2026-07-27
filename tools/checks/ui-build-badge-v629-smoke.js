#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const current = require('./current-rebuild-version.js');
const metadata = fs.readFileSync(path.join(root, 'public/metadata.html'), 'utf8');
const owner = fs.readFileSync(path.join(root, 'public/admin/users.html'), 'utf8');
const expected = `v${current.CURRENT_REBUILD_VERSION_NUMBER}`;
assert(new RegExp(`class="metadata-build-badge"[^>]*>${expected}<\\/span>`).test(metadata), 'metadata visible build badge must match current package version');
assert(metadata.includes(`data-build-version="${current.CURRENT_REBUILD_VERSION}"`), 'metadata data-build-version must match current marker');
assert(owner.includes(`data-current-build="${expected}">OWNER CONSOLE · ${expected}</span>`), 'owner visible build badge must match current package version');
console.log(JSON.stringify({ pass:'v629-ui-build-badge-smoke-pass', expected }));
