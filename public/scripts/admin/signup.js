(function(global){
  'use strict';
  // v491-admin-signup-folder-mutation-picker-pass retained for split smoke.
  var PASS = 'v588-admin-signup-metadata-access-permission-pass';
  function renderSignupCodes(codes, helpers){
    helpers = helpers || {};
    var esc = helpers.esc || function(v){ return String(v == null ? '' : v); };
    codes = codes || [];
    return codes.length ? codes.map(function(c){
      var a = c.libraryAccess || { mode:'none', folders:[] };
      var m = c.folderMutationAccess || { moveFolders:[], deleteFolders:[] };
      var p = c.appPermissions || { fullSearch:true, metadataAccess:false };
      var state = c.enabled && !c.expired && !c.exhausted ? 'ok' : (c.exhausted || c.expired ? 'warn' : 'off');
      return '<div class="user-row"><div><div class="user-title">' + esc(c.label || c.id) + '</div><div class="user-meta"><span class="pill ' + state + '">' + (c.enabled ? 'enabled' : 'disabled') + '</span><span class="pill">uses ' + c.usedCount + '/' + c.maxUses + '</span><span class="pill">' + esc(a.mode) + '</span><span class="pill">expires ' + esc((c.expiresAt || '').slice(0, 10)) + '</span><span class="pill">이동 ' + ((m.moveFolders || []).length) + ' · 삭제 ' + ((m.deleteFolders || []).length) + '</span><span class="pill ' + (p.fullSearch === false ? 'off' : 'ok') + '">전체검색 ' + (p.fullSearch === false ? '차단' : '허용') + '</span><span class="pill ' + (p.metadataAccess === true ? 'ok' : 'off') + '">메타데이터 ' + (p.metadataAccess === true ? '허용' : '차단') + '</span></div><p class="muted small">' + esc((a.folders || []).join(', ') || '폴더 없음') + '</p></div><div class="actions"><button class="danger" type="button" data-signup-delete="' + esc(c.id) + '">폐기</button></div></div>';
    }).join('') : '<p class="muted small">가입코드가 없습니다.</p>';
  }
  global.AdminSignup = { PASS:PASS, renderSignupCodes:renderSignupCodes };
})(window);
