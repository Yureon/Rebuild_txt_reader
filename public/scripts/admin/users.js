(function(global){
  'use strict';
  // v502-admin-users-horizontal-row-list-pass retained for owner-layout smoke.
  var PASS = 'v588-admin-users-metadata-access-permission-list-pass';
  function renderUsers(users, helpers){
    helpers = helpers || {};
    var esc = helpers.esc || function(v){ return String(v == null ? '' : v); };
    var accessLabel = helpers.accessLabel || function(a){ return a && a.mode || 'none'; };
    var mutationAccessLabel = helpers.mutationAccessLabel || function(a){ a = a || {}; return '이동 ' + ((a.moveFolders || []).length) + ' · 삭제 ' + ((a.deleteFolders || []).length); };
    if (!users || !users.length) return '<p class="muted">아직 생성된 일반 사용자가 없습니다.</p>';
    return users.map(function(u){
      var a = u.libraryAccess || { mode:'none', folders:[] };
      var m = u.folderMutationAccess || { moveFolders:[], deleteFolders:[] };
      var p = u.appPermissions || { fullSearch:true, metadataAccess:false };
      return '<article class="user-row admin-user-list-row"><div class="user-identity"><div class="user-title">' + esc(u.username) + '</div><div class="muted small">' + esc(u.id) + '</div></div><div class="user-access-pills"><span class="pill ' + (u.enabled ? 'ok' : 'off') + '">' + (u.enabled ? 'enabled' : 'disabled') + '</span><span class="pill">' + esc(a.mode) + '</span><span class="pill ' + (a.mode === 'none' ? 'warn' : '') + '">' + esc(accessLabel(a)) + '</span><span class="pill">' + esc(mutationAccessLabel(m)) + '</span><span class="pill ' + (p.fullSearch === false ? 'off' : 'ok') + '">전체검색 ' + (p.fullSearch === false ? '차단' : '허용') + '</span><span class="pill ' + (p.metadataAccess === true ? 'ok' : 'off') + '">메타데이터 ' + (p.metadataAccess === true ? '허용' : '차단') + '</span><span class="pill">session v' + esc(u.sessionVersion || 1) + '</span><span class="pill">login ' + esc(u.lastLoginAt ? u.lastLoginAt.slice(0, 10) : '-') + '</span></div><div class="actions user-row-actions"><button type="button" data-action="edit" data-id="' + esc(u.id) + '">편집</button><button type="button" data-action="preview" data-id="' + esc(u.id) + '">미리보기</button><button type="button" data-action="toggle" data-id="' + esc(u.id) + '">' + (u.enabled ? '비활성' : '활성') + '</button><button class="danger" type="button" data-action="delete" data-id="' + esc(u.id) + '">삭제</button></div></article>';
    }).join('');
  }
  global.AdminUsersList = { PASS:PASS, renderUsers:renderUsers };
})(window);
