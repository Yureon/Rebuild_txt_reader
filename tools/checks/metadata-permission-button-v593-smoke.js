#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const shell = fs.readFileSync('public/fragments/app-shell.html','utf8');
const loader = fs.readFileSync('public/scripts/rebuild/features/library-catalog-loader.mjs','utf8');
const actions = fs.readFileSync('public/scripts/rebuild/features/library-list-actions.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
assert.match(shell, /id="library-metadata-page-link"[^>]*hidden/);
assert.match(shell, /id="list-action-metadata"[^>]*hidden/);
for (const token of ['libraryMetadataPageLink','listActionMetadata','metadataAccessPermissionPass']) assert(loader.includes(token), `missing permission UI token: ${token}`);
assert(/\.hidden\s*=\s*!allowed/.test(loader), 'metadata controls must follow permission visibility');
assert(actions.includes("action === 'metadata'") && actions.includes('metadataAccessAllowed'));
assert(css.includes('.library-header-link[hidden]{display:none!important}'));
console.log(JSON.stringify({ pass:'v593-metadata-permission-button-smoke-pass' }));
