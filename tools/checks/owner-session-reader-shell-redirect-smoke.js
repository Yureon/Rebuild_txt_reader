const assert = require('assert');
const fs = require('fs');
const src = fs.readFileSync('public/scripts/rebuild/core/api.mjs', 'utf-8');
assert(src.includes("OWNER_SESSION_READER_SHELL_REDIRECT_PASS = 'v455-owner-session-reader-shell-redirect-pass'"), 'owner reader shell redirect marker missing');
assert(src.includes("data.error === 'reader_user_session_required'"), 'reader user session error must be detected');
assert(src.includes("location.href = '/admin/users.html'"), 'cached owner reader shell must redirect to owner console');
console.log('v455-owner-session-reader-shell-redirect-smoke-pass');
