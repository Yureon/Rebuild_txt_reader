const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const page = r('public/admin/users.html');
const actions = r('public/scripts/admin/actions.js');
const main = r('public/scripts/admin-users.js');
assert.ok(page.includes('/scripts/admin/actions.js?v=rebuild-v679'), 'admin actions module not loaded');
assert.ok(actions.includes('v491-admin-user-actions-folder-mutation-picker-pass'), 'actions module marker missing');
for (const token of ['bindUserListActions', 'bindAccountActionControls', 'revokeUserSessions', 'deleteUserAccount', 'resetUserPassword', 'folderMutationAccess']) assert.ok(actions.includes(token), token + ' missing from actions module');
assert.ok(main.includes('AdminUserActions') && main.includes('bindAccountActionControls') && main.includes('bindUserListActions'), 'main must delegate account action wiring');
assert.ok(!main.includes('/sessions/revoke') && !main.includes('/password') && !main.includes('function deleteUserAccount') && !main.includes('function resetUserPassword'), 'account mutation API paths should live in actions module');
console.log('v417-admin-user-actions-split-smoke-pass');
