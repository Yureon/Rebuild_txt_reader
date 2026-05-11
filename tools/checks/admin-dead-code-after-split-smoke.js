const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const main = r('public/scripts/admin-users.js');
const stateActions = r('public/scripts/admin/state-actions.js');
const permissions = r('public/scripts/admin/permissions.js');
const forbiddenMainTokens = [
  'function downloadUserState',
  'function resetUserState',
  'function createUserStateSnapshot',
  'function downloadUserStateSnapshot',
  'function restoreUserStateSnapshot',
  'function attachPicker',
  'function visibleFolders',
  'function compareSelectedAccess',
  '/library-preview/compare',
  '/state/export',
  '/state/reset',
  '/api/admin/signup-codes',
  '/api/admin/audit-log'
];
for (const token of forbiddenMainTokens) assert.ok(!main.includes(token), token + ' should not remain in admin-users.js');
assert.ok(main.includes('AdminStateActions') && main.includes('AdminPermissions') && main.includes('AdminSignupActions') && main.includes('AdminAuditActions'), 'main must reference split modules');
assert.ok(stateActions.includes('/state/export') && stateActions.includes('/state/reset') && stateActions.includes('/state/snapshots'), 'state API wiring must be in state-actions.js');
assert.ok(permissions.includes('attachPicker') && permissions.includes('/library-preview/compare'), 'folder picker/compare logic must be in permissions.js');
console.log('v417-admin-dead-code-after-split-smoke-pass');
