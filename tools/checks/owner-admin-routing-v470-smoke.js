#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const PASS = 'v470-owner-admin-routing-smoke-pass';
const auth = read('server/middleware/auth.js');
const api = read('public/scripts/rebuild/core/api.mjs');
const runner = read('tools/run_smoke_tests.js');
assert.ok(auth.includes("OWNER_READER_ENTRY_REDIRECT_PASS = 'v441-owner-session-entry-redirect-pass'"), 'owner entry redirect marker must remain');
assert.ok(auth.includes("READER_ENTRY_PATHS = new Set(['/', '/index.html', '/site.html', '/mobile.html'])"), 'owner reader entry allowlist must remain bounded');
assert.ok(auth.includes('shouldRedirectOwnerEntry(req.path, session)'), 'owner entry redirect guard must remain wired');
assert.ok(auth.includes("res.redirect('/admin/users.html')"), 'owner entry redirect target must remain admin/users.html');
assert.ok(api.includes("OWNER_SESSION_READER_SHELL_REDIRECT_PASS = 'v455-owner-session-reader-shell-redirect-pass'"), 'cached reader shell owner redirect marker must remain');
assert.ok(api.includes("data.error === 'reader_user_session_required'"), 'reader_user_session_required must still trigger redirect');
assert.ok(api.includes("location.href = '/admin/users.html'"), 'cached owner reader shell must still redirect to admin/users.html');
assert.ok(runner.includes('tools/checks/owner-session-entry-redirect-smoke.js'), 'owner entry smoke must remain in runner');
assert.ok(runner.includes('tools/checks/owner-session-reader-shell-redirect-smoke.js'), 'owner shell smoke must remain in runner');
console.log(JSON.stringify({ pass: PASS }));
