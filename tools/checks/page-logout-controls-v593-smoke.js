#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const shell = fs.readFileSync('public/fragments/app-shell.html','utf8');
const elements = fs.readFileSync('public/scripts/rebuild/features/ui/elements.mjs','utf8');
const controls = fs.readFileSync('public/scripts/rebuild/features/library-install-controls-runtime.mjs','utf8');
const logoutRuntime = fs.readFileSync('public/scripts/rebuild/features/library-logout-runtime.mjs','utf8');
const metadataHtml = fs.readFileSync('public/metadata.html','utf8');
const metadataJs = fs.readFileSync('public/scripts/rebuild/metadata-page.mjs','utf8');
assert(shell.includes('id="library-logout-btn"'));
assert(elements.includes("'library-logout-btn'"));
assert(controls.includes("import('./library-logout-runtime.mjs')"), 'library logout must stay outside the initial static graph');
for (const token of ['app.reader?.persistProgress?.()','allowBackground:true','app.api.logout()','localStorage.removeItem(\'csrf_token\')',"location.replace('/login.html')"]) assert(logoutRuntime.includes(token), `library logout token missing: ${token}`);
assert(metadataHtml.includes('id="metadata-page-logout"'));
for (const token of ["'metadata-page-logout'",'await api.logout()','localStorage.removeItem(\'csrf_token\')',"location.replace('/login.html')"]) assert(metadataJs.includes(token), `metadata logout token missing: ${token}`);
console.log(JSON.stringify({ pass:'v593-page-logout-controls-smoke-pass' }));
