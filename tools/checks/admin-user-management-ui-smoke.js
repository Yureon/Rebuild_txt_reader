#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
function read(rel) { return fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8'); }
function runAdminUserManagementUiSmoke() {
  const page = read('public/admin/users.html');
  const script = read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/actions.js') + '\n' + read('public/scripts/admin/sections.js') + '\n' + read('public/scripts/admin/ops.js') + '\n' + read('public/scripts/admin/state-actions.js') + '\n' + read('public/scripts/admin/permissions.js');
  const ui = page + '\n' + script;
  const routes = read('server/routes/admin-users-routes.js');
  const app = read('server/app.js');
  assert.ok(page.includes('OWNER CONSOLE · v417 skeleton UI'), 'owner console v406 badge must exist');
  assert.ok(page.includes('사용자 편집'), 'user edit panel must exist');
  assert.ok(page.includes('비밀번호 초기화'), 'password reset panel must exist');
  assert.ok(page.includes('권한 변경 영향 미리보기'), 'access compare button must exist');
  assert.ok(page.includes('세션 강제 만료'), 'session revoke button must exist');
  assert.ok(page.includes('계정 삭제'), 'account delete button must exist');
  assert.ok(page.includes('create-user-snapshot-btn') && page.includes('list-user-snapshots-btn'), 'state snapshot buttons must exist');
  assert.ok(ui.includes('restoreUserStateSnapshot') && ui.includes('downloadUserStateSnapshot'), 'state snapshot handlers must exist');
  assert.ok(page.includes('create-folder-picker') && page.includes('edit-folder-picker'), 'folder picker controls must exist');
  assert.ok(page.includes('create-move-folders') && page.includes('edit-delete-folders') && page.includes('signup-code-move-folders'), 'folder mutation permission controls must exist');
  assert.ok(ui.includes('/api/admin/library-tree'), 'admin UI must fetch library tree');
  assert.ok(ui.includes('/password') && ui.includes('resetUserPassword'), 'password reset request must be wired');
  assert.ok(ui.includes('folderMutationAccess') && ui.includes('mutationAccessPayload'), 'folder mutation permission payload must be wired');
  assert.ok(routes.includes("router.get('/admin/library-tree'"), 'library tree route must exist');
  assert.ok(routes.includes('folderTreeEndpoint'), 'status endpoint must advertise folder tree endpoint');
  assert.ok(routes.includes('folderMutationAccess'), 'status endpoint must advertise folder mutation access policy');
  assert.ok(app.includes("app.get('/admin/users.html'"), 'owner-only admin page route must exist');
  assert.ok(app.includes("session.kind !== 'owner'"), 'admin page route must reject non-owner sessions');
  assert.ok(app.includes('libraryService,'), 'admin router must receive libraryService');
  return { pass: 'v389-admin-user-management-ui-smoke-pass' };
}
if (require.main === module) console.log(JSON.stringify(runAdminUserManagementUiSmoke()));
module.exports = { runAdminUserManagementUiSmoke };
