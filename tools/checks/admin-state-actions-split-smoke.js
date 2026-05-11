const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const page = r('public/admin/users.html');
const main = r('public/scripts/admin-users.js');
const stateActions = r('public/scripts/admin/state-actions.js');
assert.ok(page.includes('/scripts/admin/state-actions.js?v=rebuild-v564'), 'state action module must be loaded');
assert.ok(stateActions.includes('v417-admin-state-actions-split-pass'), 'state action marker missing');
for (const token of ['downloadUserState', 'resetUserState', 'loadUserStateSnapshots', 'createUserStateSnapshot', 'downloadUserStateSnapshot', 'restoreUserStateSnapshot', 'bindStateActions']) assert.ok(stateActions.includes(token), token + ' must live in state action module');
for (const api of ['/state/export', '/state/reset', '/state/snapshots']) assert.ok(stateActions.includes(api), api + ' must live in state action module');
assert.ok(main.includes('AdminStateActions') && main.includes('bindStateActions'), 'main must delegate state action wiring');
assert.ok(!main.includes('/state/export') && !main.includes('/state/reset') && !main.includes('/state/snapshots'), 'main must not directly call state APIs');
assert.ok(!main.includes('function downloadUserState') && !main.includes('function resetUserState') && !main.includes('function createUserStateSnapshot') && !main.includes('function restoreUserStateSnapshot'), 'main must not define state mutation actions');
console.log('v417-admin-state-actions-split-smoke-pass');
