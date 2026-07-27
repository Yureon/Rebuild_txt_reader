#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const os = require('os');
const { createAccountService, normalizeFolderMutationAccess, isFolderPathInsideLibraryAccess, assertFolderMutationAccessInsideLibraryAccess } = require('../../server/services/account-service');
const { createSignupCodeService } = require('../../server/services/signup-code-service');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function mustCallbackError(fn, code) {
  let callbackError = null;
  const result = fn((err) => { callbackError = err || null; });
  assert.strictEqual(result, null, 'invalid account/signup write should return null');
  assert.ok(callbackError, 'expected callback error');
  if (code) assert.strictEqual(callbackError.code, code);
}

function run() {
  const normalized = normalizeFolderMutationAccess({ moveFolders:[' 판타지 ', '판타지/../차단', '무협\\작가A', '무협/작가A'], deleteFolders:['완결', '', '.'] });
  assert.deepStrictEqual(normalized.moveFolders, ['무협/작가A', '판타지']);
  assert.deepStrictEqual(normalized.deleteFolders, ['완결']);
  assert.ok(isFolderPathInsideLibraryAccess({ mode:'folders', folders:['판타지'] }, '판타지/완결'));
  assert.ok(!isFolderPathInsideLibraryAccess({ mode:'folders', folders:['판타지'] }, '무협'));
  assert.deepStrictEqual(assertFolderMutationAccessInsideLibraryAccess({ mode:'folders', folders:['판타지'] }, { moveFolders:['판타지/완결'], deleteFolders:[] }), { moveFolders:['판타지/완결'], deleteFolders:[] });
  assert.throws(() => assertFolderMutationAccessInsideLibraryAccess({ mode:'folders', folders:['판타지'] }, { moveFolders:['무협'], deleteFolders:[] }), /폴더 이동\/삭제 권한/);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-folder-mutation-'));
  const accountService = createAccountService({ accountsPath:path.join(dir, 'accounts.json'), logger:{ error(){} } });
  accountService.load();
  const created = accountService.createUser({ username:'reader-a', password:'password8', libraryAccess:{ mode:'folders', folders:['판타지'] }, folderMutationAccess:{ moveFolders:['판타지'], deleteFolders:['판타지/완결'] } });
  assert.ok(created && created.folderMutationAccess, 'created user must expose folder mutation access');
  assert.deepStrictEqual(accountService.getUserFolderMutationAccess('reader-a'), { moveFolders:['판타지'], deleteFolders:['판타지/완결'] });
  accountService.updateUser('reader-a', { libraryAccess:{ mode:'folders', folders:['판타지', '무협'] }, folderMutationAccess:{ moveFolders:['무협'], deleteFolders:[] } });
  assert.deepStrictEqual(accountService.getUserFolderMutationAccess('reader-a'), { moveFolders:['무협'], deleteFolders:[] });
  mustCallbackError((cb) => accountService.updateUser('reader-a', { libraryAccess:{ mode:'folders', folders:['판타지'] } }, cb), 'FOLDER_MUTATION_ACCESS_OUTSIDE_LIBRARY_ACCESS');
  mustCallbackError((cb) => accountService.createUser({ username:'reader-b', password:'password8', libraryAccess:{ mode:'none', folders:[] }, folderMutationAccess:{ moveFolders:['비공개'], deleteFolders:[] } }, cb), 'FOLDER_MUTATION_ACCESS_OUTSIDE_LIBRARY_ACCESS');

  const signupService = createSignupCodeService({ signupCodesPath:path.join(dir, 'signup-codes.json'), logger:{ error(){} } });
  signupService.load();
  assert.ok(signupService.createCode({ label:'ok', libraryAccess:{ mode:'folders', folders:['공개'] }, folderMutationAccess:{ moveFolders:['공개/작품'], deleteFolders:[] } }));
  mustCallbackError((cb) => signupService.createCode({ label:'bad', libraryAccess:{ mode:'folders', folders:['공개'] }, folderMutationAccess:{ moveFolders:['비공개'], deleteFolders:[] } }, cb), 'FOLDER_MUTATION_ACCESS_OUTSIDE_LIBRARY_ACCESS');

  const fileopsRoutes = read('server/routes/fileops-routes.js');
  const adminPage = read('public/admin/users.html');
  const adminActions = read('public/scripts/admin/actions.js');
  const signupActions = read('public/scripts/admin/signup-actions.js');
  const adminPermissions = read('public/scripts/admin/permissions.js');
  const userAccessRoutes = read('server/routes/user-access-routes.js');
  const libraryListActions = read('public/scripts/rebuild/features/library-list-actions.mjs');
  const libraryDragDrop = read('public/scripts/rebuild/features/library-drag-drop.mjs');
  const libraryMovePicker = read('public/scripts/rebuild/features/library-move-picker.mjs');
  const libraryMutationActions = read('public/scripts/rebuild/features/library-mutation-actions.mjs');
  const app = read('server/app.js');
  const securityDoc = read('docs/security.md');
  const accessDoc = read('docs/multi-user-access-control.md');
  const apiDoc = read('docs/api-contract.md');
  const opsDoc = read('docs/operations-checklist.md');

  assert.ok(fileopsRoutes.includes("requireFolderMutationSession('move'") && fileopsRoutes.includes("requireFolderMutationSession('delete'"), 'folder move/delete routes must use folder mutation session guard');
  assert.ok(fileopsRoutes.includes('move_target_not_allowed') && fileopsRoutes.includes('isMoveTargetAllowed'), 'move target must be checked against library access');
  assert.ok(fileopsRoutes.includes('isSourceInsideLibraryAccess') && fileopsRoutes.includes("'_source_not_in_library_access'"), 'source folder must also be checked against library access');
  assert.ok(fileopsRoutes.includes('expectedFolderDeleteConfirmText') && fileopsRoutes.includes("'DELETE:' + String(req.body && req.body.categoryPath"), 'user folder delete must require DELETE:<categoryPath>');
  assert.ok(fileopsRoutes.includes('library.folder.move') && fileopsRoutes.includes('library.folder.delete') && fileopsRoutes.includes('appendFolderMutationAudit'), 'user folder move/delete audit events must be recorded');
  assert.ok(app.includes('auditLogService') && app.includes('createFileopsRouter'), 'fileops router must receive auditLogService');
  assert.ok(app.includes('sessionStore,') && app.includes('accountService'), 'fileops router must receive session/account services');
  for (const id of ['create-move-folders', 'create-delete-folders', 'edit-move-folders', 'edit-delete-folders', 'signup-code-move-folders', 'signup-code-delete-folders']) assert.ok(adminPage.includes(id), id + ' control missing');
  for (const id of ['create-move-folder-picker', 'create-delete-folder-picker', 'edit-move-folder-picker', 'edit-delete-folder-picker', 'signup-code-move-folder-picker', 'signup-code-delete-folder-picker']) assert.ok(adminPage.includes(id), id + ' picker missing');
  assert.ok(adminActions.includes('folderMutationAccess') && signupActions.includes('folderMutationAccess'), 'admin payloads must include folderMutationAccess');
  assert.ok(adminPermissions.includes('v491-admin-folder-mutation-picker-pass'), 'admin permission picker marker missing');
  for (const token of ['create-move-folder-picker', 'edit-delete-folder-picker', 'signup-code-delete-folder-picker']) assert.ok(adminPermissions.includes(token), token + ' must be wired to attachPicker');
  assert.ok(userAccessRoutes.includes('folderMutationAccess') && userAccessRoutes.includes('v491-user-access-folder-mutation-snapshot-pass'), 'user access snapshot must expose folder mutation permissions');
  assert.ok(libraryListActions.includes('LIBRARY_ACTION_PERMISSION_UI_PASS') && libraryListActions.includes('canUseLibraryAction'), 'library action permission helper missing');
  assert.ok(libraryListActions.includes('isUserLibraryPathAllowed') && libraryListActions.includes('snapshot.libraryAccess'), 'action visibility must include libraryAccess source policy');
  assert.ok(libraryListActions.includes('folderMutationAccess') && libraryListActions.includes('listActionDelete.hidden = !canUseLibraryAction'), 'action sheet must hide unauthorized mutation buttons');
  assert.ok(libraryDragDrop.includes('LIBRARY_DRAG_PERMISSION_UI_PASS') && libraryDragDrop.includes('v493-library-drag-target-policy-ui-pass'), 'drag permission marker missing');
  assert.ok(libraryDragDrop.includes('canDragLibraryItem') && libraryDragDrop.includes('canStartLibraryDrag'), 'drag permission helpers missing');
  assert.ok(libraryDragDrop.includes("libraryDraggable:allowed ? 'true' : 'false'") && libraryDragDrop.includes("draggable: allowed ? 'true' : null"), 'unauthorized rows must not be native draggable');
  assert.ok(libraryDragDrop.includes("if (type !== 'folder') return false"), 'user sessions must not drag novel/episode rows');
  assert.ok(libraryDragDrop.includes('이동 대상은 현재 계정의 라이브러리 접근 범위 안이어야 합니다.'), 'drag/drop target must reject outside-library targets in UI');
  assert.ok(libraryMovePicker.includes('v493-library-move-picker-target-policy-pass') && libraryMovePicker.includes('validateLibraryMoveTarget?.(target, next, app)'), 'move picker direct input must validate target against user policy');
  assert.ok(libraryMutationActions.includes('DELETE:${categoryPath}') && libraryMutationActions.includes('userAccessSnapshot'), 'user folder delete must send DELETE:<categoryPath> confirmation');
  for (const doc of [securityDoc, accessDoc, apiDoc, opsDoc]) {
    assert.ok(doc.includes('folderMutationAccess'), 'policy docs must mention folderMutationAccess');
    assert.ok(doc.includes('libraryAccess'), 'policy docs must mention libraryAccess coupling');
  }
  return { pass:'v493-folder-mutation-policy-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(run()));
module.exports = { run };
