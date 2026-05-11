(function(global){
  'use strict';
  // v491-admin-user-actions-folder-mutation-picker-pass retained for split smoke.
  var PASS = 'v551-admin-user-actions-full-search-permission-pass';
  function callLog(ctx, value){ if (ctx && ctx.log) ctx.log(value); }
  function findUser(ctx, id){ var list = ctx && ctx.getUsers ? ctx.getUsers() : []; return (list || []).find(function(u){ return u.id === id; }); }
  function labelFor(ctx, id){ var u = findUser(ctx, id); return (u && u.username) || id || ''; }
  function appPermissionsPayload(ctx, prefix){ var $ = ctx.$; var el = $(prefix + '-full-search'); return { fullSearch: !el || el.checked !== false }; }
  function updateUser(ctx, id, payload){ return ctx.jf('/api/admin/users/' + encodeURIComponent(id), { method:'PATCH', body:JSON.stringify(payload) }); }
  function createUserFromForm(ctx){
    var $ = ctx.$;
    var payload = { username:$('create-username').value.trim(), password:$('create-password').value, libraryAccess:{ mode:$('create-access-mode').value, folders:ctx.uniq(ctx.lines($('create-folders').value)) }, folderMutationAccess:ctx.mutationAccessPayload ? ctx.mutationAccessPayload('create') : { moveFolders:ctx.uniq(ctx.lines($('create-move-folders').value)), deleteFolders:ctx.uniq(ctx.lines($('create-delete-folders').value)) }, appPermissions:appPermissionsPayload(ctx, 'create') };
    return ctx.jf('/api/admin/users', { method:'POST', body:JSON.stringify(payload) }).then(function(d){ callLog(ctx, d); $('create-password').value = ''; $('create-username').value = ''; $('create-move-folders').value = ''; $('create-delete-folders').value = ''; if ($('create-full-search')) $('create-full-search').checked = true; if (ctx.showUserPanel) ctx.showUserPanel('list'); return ctx.refresh(); });
  }
  function updateSelectedUserFromForm(ctx){ var $ = ctx.$; var id = $('edit-user-id').value; if (!id) return Promise.resolve(null); return updateUser(ctx, id, { enabled:$('edit-enabled').checked, libraryAccess:ctx.accessPayload(), folderMutationAccess:ctx.mutationAccessPayload ? ctx.mutationAccessPayload('edit') : { moveFolders:ctx.uniq(ctx.lines($('edit-move-folders').value)), deleteFolders:ctx.uniq(ctx.lines($('edit-delete-folders').value)) }, appPermissions:appPermissionsPayload(ctx, 'edit') }).then(function(d){ callLog(ctx, d); return ctx.refresh(); }); }
  function toggleSelectedEnabled(ctx){ var $ = ctx.$; if (!ctx.getSelectedUser()) return Promise.resolve(null); $('edit-enabled').checked = !$('edit-enabled').checked; return updateSelectedUserFromForm(ctx); }
  function toggleUserEnabled(ctx, id){ var u = findUser(ctx, id); if (!u) return Promise.resolve(null); return updateUser(ctx, id, { enabled:!u.enabled }).then(function(d){ callLog(ctx, d); return ctx.refresh(); }); }
  function revokeUserSessions(ctx, id){
    var label = labelFor(ctx, id);
    if (!id) { callLog(ctx, '사용자를 먼저 선택하세요.'); return Promise.resolve(null); }
    if (!global.confirm(label + ' 사용자의 기존 로그인 세션을 모두 만료합니다. 계속할까요?')) return Promise.resolve(null);
    return ctx.jf('/api/admin/users/' + encodeURIComponent(id) + '/sessions/revoke', { method:'POST', body:JSON.stringify({ confirmText:'REVOKE' }) }).then(function(d){ callLog(ctx, '사용자 ' + label + ' 세션 강제 만료 완료\nsessionVersion: ' + ((d.user && d.user.sessionVersion) || '') + '\npass: ' + (d.pass || '')); return ctx.refresh().then(function(){ return d; }); });
  }
  function deleteUserAccount(ctx, id){
    var $ = ctx.$;
    var label = labelFor(ctx, id);
    if (!id) { callLog(ctx, '사용자를 먼저 선택하세요.'); return Promise.resolve(null); }
    var expected = 'DELETE:' + label;
    var typed = global.prompt(label + ' 계정을 삭제합니다. 확인 문구를 입력하세요: ' + expected);
    if (typed !== expected) { callLog(ctx, '삭제 취소: 확인 문구가 일치하지 않습니다.'); return Promise.resolve(null); }
    var stateAction = global.confirm('계정 삭제와 함께 서버 독서 데이터를 초기화할까요?\n확인: reset, 취소: preserve') ? 'reset' : 'preserve';
    return ctx.jf('/api/admin/users/' + encodeURIComponent(id), { method:'DELETE', body:JSON.stringify({ confirmText:typed, stateAction:stateAction }) }).then(function(d){ ctx.setSelectedUser(null); $('edit-form').hidden = true; $('edit-empty').hidden = false; callLog(ctx, '사용자 ' + label + ' 계정 삭제 완료\nstateAction: ' + stateAction + '\npass: ' + (d.pass || '')); return ctx.refresh().then(function(){ return d; }); });
  }
  function resetUserPassword(ctx, generateTemporary){
    var $ = ctx.$;
    var id = $('edit-user-id').value;
    var pw = $('reset-password').value;
    if (!id) { callLog(ctx, '사용자를 먼저 선택하세요.'); return Promise.resolve(null); }
    if (!generateTemporary && !pw) { callLog(ctx, '새 비밀번호를 입력하세요.'); return Promise.resolve(null); }
    var body = generateTemporary ? { generateTemporary:true } : { password:pw };
    return ctx.jf('/api/admin/users/' + encodeURIComponent(id) + '/password', { method:'POST', body:JSON.stringify(body) }).then(function(d){ $('reset-password').value = ''; if ($('temporary-password-output')) $('temporary-password-output').textContent = d.temporaryPassword ? '임시 비밀번호: ' + d.temporaryPassword + '\n지금 복사하세요. 서버는 원문을 다시 표시하지 않습니다.' : '비밀번호 초기화 완료. 기존 세션은 만료됩니다.'; callLog(ctx, d); return ctx.refresh().then(function(){ return d; }); });
  }
  function bindUserListActions(ctx){
    if (!ctx.wrap) return;
    ctx.wrap.onclick = function(e){
      var b = e.target.closest('button[data-action]');
      if (!b) return;
      var id = b.getAttribute('data-id');
      var u = findUser(ctx, id);
      if (!u) return;
      var action = b.getAttribute('data-action');
      if (action === 'edit') ctx.fillEdit(u);
      if (action === 'preview') ctx.previewUser(id).catch(ctx.log);
      if (action === 'toggle') toggleUserEnabled(ctx, id).catch(ctx.log);
      if (action === 'delete') deleteUserAccount(ctx, id).catch(ctx.log);
    };
  }
  function bindAccountActionControls(ctx){
    var $ = ctx.$;
    $('create-form').onsubmit = function(e){ e.preventDefault(); createUserFromForm(ctx).catch(ctx.log); };
    $('edit-form').onsubmit = function(e){ e.preventDefault(); updateSelectedUserFromForm(ctx).catch(ctx.log); };
    $('edit-disable-toggle').onclick = function(){ toggleSelectedEnabled(ctx).catch(ctx.log); };
    $('revoke-user-sessions-btn').onclick = function(){ revokeUserSessions(ctx, $('edit-user-id').value).catch(ctx.log); };
    $('delete-user-btn').onclick = function(){ deleteUserAccount(ctx, $('edit-user-id').value).catch(ctx.log); };
    $('reset-password-btn').onclick = function(){ resetUserPassword(ctx, false).catch(ctx.log); };
    $('generate-temp-password-btn').onclick = function(){ resetUserPassword(ctx, true).catch(ctx.log); };
  }
  global.AdminUserActions = { PASS:PASS, bindUserListActions:bindUserListActions, bindAccountActionControls:bindAccountActionControls, createUserFromForm:createUserFromForm, updateSelectedUserFromForm:updateSelectedUserFromForm, toggleSelectedEnabled:toggleSelectedEnabled, toggleUserEnabled:toggleUserEnabled, revokeUserSessions:revokeUserSessions, deleteUserAccount:deleteUserAccount, resetUserPassword:resetUserPassword };
})(window);
