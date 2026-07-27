(function(global){
  'use strict';
  var PASS = 'v417-admin-user-state-split-pass';
  function renderSnapshotList(data, helpers){
    helpers = helpers || {};
    var esc = helpers.esc || function(v){ return String(v == null ? '' : v); };
    var snaps = data && data.snapshots || [];
    return snaps.length ? snaps.map(function(x){
      return '<div class="user-row"><div><div class="user-title">' + esc(x.id) + '</div><div class="user-meta"><span class="pill">' + esc((x.createdAt || '').slice(0, 19)) + '</span><span class="pill">' + esc(x.reason || '') + '</span><span class="pill">' + String(x.sizeBytes || 0) + ' bytes</span></div></div><div class="actions"><button type="button" data-snapshot-download="' + esc(x.id) + '">다운로드</button><button class="danger" type="button" data-snapshot-restore="' + esc(x.id) + '">복원</button></div></div>';
    }).join('') : 'snapshot이 없습니다.';
  }
  global.AdminUserState = { PASS:PASS, renderSnapshotList:renderSnapshotList };
})(window);
