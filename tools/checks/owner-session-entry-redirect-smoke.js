#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v441-owner-session-entry-redirect-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const auth = read('server/middleware/auth.js');
const serverSmoke = read('tools/smoke_server_http.js');
const docs = read('docs/release-history.md') + '\n' + read('docs/smoke-tests.md');
assert.ok(auth.includes("OWNER_READER_ENTRY_REDIRECT_PASS = 'v441-owner-session-entry-redirect-pass'"), 'owner entry redirect marker missing');
assert.ok(auth.includes("READER_ENTRY_PATHS = new Set(['/', '/index.html', '/site.html', '/mobile.html'])"), 'reader entry path allowlist missing');
assert.ok(auth.includes('shouldRedirectOwnerEntry(req.path, session)'), 'auth gate must call owner entry redirect guard');
assert.ok(auth.includes("res.redirect('/admin/users.html')"), 'owner entry redirect must target owner console');
assert.ok(auth.includes("X-Owner-Entry-Redirect"), 'owner redirect response marker header missing');
assert.ok(serverSmoke.includes("owner site entry redirect status"), 'server HTTP smoke must assert owner /site.html redirect');
assert.ok(serverSmoke.includes("owner mobile entry redirect status"), 'server HTTP smoke must assert owner /mobile.html redirect');
assert.ok(serverSmoke.includes("reader site entry status"), 'server HTTP smoke must assert reader /site.html still works');
assert.ok(docs.includes(PASS), 'docs must mention owner redirect smoke marker');
console.log(JSON.stringify({ pass: PASS }));
