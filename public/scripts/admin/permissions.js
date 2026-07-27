(function(global){
  'use strict';
  // v641-admin-folder-explorer-picker-pass — legacy explorer contract retained.
  // v491-admin-folder-mutation-picker-pass — retained for the established folder permission contract.
  var PASS = 'v643-admin-folder-explorer-segmented-pass';
  function core(){ return global.AdminUsersCore || {}; }
  function esc(v){ var c = core(); return c.esc ? c.esc(v) : String(v == null ? '' : v); }
  function linesFrom(ctx, value){ return ctx && ctx.lines ? ctx.lines(value) : String(value || '').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function uniqFrom(ctx, values){ return ctx && ctx.uniq ? ctx.uniq(values) : Array.from(new Set(values || [])).sort(); }

  var ACCESS_MODE_OPTIONS = [
    { value:'none', label:'접근 없음', hint:'라이브러리를 표시하지 않음' },
    { value:'all', label:'전체 허용', hint:'모든 폴더와 작품 허용' },
    { value:'folders', label:'선택 폴더', hint:'선택한 폴더와 하위 폴더' }
  ];
  function syncAccessModeControl(ctx, selectId) {
    var $ = ctx.$, select = $(selectId);
    if (!select) return;
    var wrapper = select.parentElement && select.parentElement.querySelector('[data-access-mode-segmented="' + selectId + '"]');
    if (wrapper) wrapper.querySelectorAll('button[data-access-mode-value]').forEach(function(button){
      var active = button.dataset.accessModeValue === select.value;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    var prefix = selectId.replace(/-access-mode$/, '');
    var form = select.closest('form');
    var panel = form && form.querySelector('.access-picker-panel');
    if (panel && (prefix === 'create' || prefix === 'edit')) {
      panel.hidden = select.value !== 'folders';
      panel.dataset.accessMode = select.value;
    }
  }
  function enhanceAccessModeControl(ctx, selectId) {
    var $ = ctx.$, select = $(selectId);
    if (!select || select.dataset.segmentedEnhanced === 'true') { syncAccessModeControl(ctx, selectId); return; }
    select.dataset.segmentedEnhanced = 'true';
    select.classList.add('access-mode-native-select');
    var wrapper = document.createElement('div');
    wrapper.className = 'access-mode-segmented';
    wrapper.dataset.accessModeSegmented = selectId;
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', '라이브러리 권한 방식');
    ACCESS_MODE_OPTIONS.forEach(function(option){
      var button = document.createElement('button');
      button.type = 'button';
      button.dataset.accessModeValue = option.value;
      button.innerHTML = '<strong>' + esc(option.label) + '</strong><small>' + esc(option.hint) + '</small>';
      button.addEventListener('click', function(){
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles:true }));
        syncAccessModeControl(ctx, selectId);
      });
      wrapper.appendChild(button);
    });
    select.insertAdjacentElement('afterend', wrapper);
    select.addEventListener('change', function(){ syncAccessModeControl(ctx, selectId); });
    syncAccessModeControl(ctx, selectId);
  }
  function enhanceAccessModeControls(ctx) {
    ['create-access-mode','edit-access-mode','signup-code-access-mode'].forEach(function(id){ enhanceAccessModeControl(ctx,id); });
  }

  function accessLabel(a){ a = a || { mode:'none', folders:[] }; if (a.mode === 'all') return '전체 허용'; if (a.mode === 'folders') return '폴더 ' + (a.folders || []).length + '개'; return '접근 없음'; }
  function mutationAccessLabel(a){ a = a || {}; return '이동 ' + ((a.moveFolders || []).length) + ' · 삭제 ' + ((a.deleteFolders || []).length); }
  function getFolderTree(ctx){ return ctx && ctx.getFolderTree ? ctx.getFolderTree() : []; }
  function renderSelection(ctx, tid, sid){ var $ = ctx.$; var textarea = $(tid), target = $(sid); if (!textarea || !target) return; var vals = linesFrom(ctx, textarea.value); target.innerHTML = vals.length ? vals.map(function(v){ return '<span class="chip">' + esc(v) + '</span>'; }).join('') : '<span class="chip">선택 없음</span>'; }
  function visibleFolders(ctx, searchValue){ var q = String(searchValue || '').trim().toLowerCase(); var tree = getFolderTree(ctx); if (!q) return tree; return tree.filter(function(n){ return String(n.path || '').toLowerCase().indexOf(q) >= 0 || String(n.name || '').toLowerCase().indexOf(q) >= 0; }); }
  function syncChecks(ctx, pid, tid, sid){ var $ = ctx.$; var picker = $(pid), textarea = $(tid); if (!picker || !textarea) return; var vals = linesFrom(ctx, textarea.value).reduce(function(m, v){ m[v] = 1; return m; }, {}); picker.querySelectorAll('input[data-path]').forEach(function(b){ b.checked = !!vals[b.getAttribute('data-path')]; var row=b.closest('[data-folder-permission-row]'); var state=row && row.querySelector('.folder-explorer-state'); if (row) row.dataset.selectionState=b.checked?'selected':'unselected'; if (state) state.textContent=b.checked?'선택':'미선택'; }); renderSelection(ctx, tid, sid); }
  function attachPicker(ctx, pid, tid, sid, searchId){
    var $ = ctx.$, picker = $(pid), search = searchId ? $(searchId) : null;
    if (!picker) return;
    picker.classList.add('folder-picker-explorer');
    var workflowForm = picker.closest('form[data-v596-workflow="true"]');
    var hiddenWorkflow = !!(workflowForm && workflowForm.hidden);
    var hiddenUserPanel = !!picker.closest('[data-user-panel][hidden]');
    var step = picker.closest('details[data-user-form-step]');
    renderSelection(ctx, tid, sid);
    if (hiddenWorkflow || hiddenUserPanel || (step && !step.open)) {
      picker.dataset.lazyPickerPending = 'true';
      if (step && step.dataset.lazyPickerBound !== 'true') {
        step.dataset.lazyPickerBound = 'true';
        step.addEventListener('toggle', function(){ if (step.open) attachPicker(ctx, pid, tid, sid, searchId); });
      }
      return;
    }
    delete picker.dataset.lazyPickerPending;
    var tree = getFolderTree(ctx);
    var items = visibleFolders(ctx, search && search.value);
    if (!tree.length) { picker.innerHTML = '<p class="muted small">선택 가능한 하위 폴더가 없습니다. root 파일만 있는 경우 all 모드를 사용하세요.</p>'; renderSelection(ctx, tid, sid); return; }
    if (!items.length) { picker.innerHTML = '<p class="muted small">검색 결과가 없습니다.</p>'; renderSelection(ctx, tid, sid); return; }
    picker.innerHTML = '<div class="folder-explorer-head" aria-hidden="true"><span>선택</span><span>폴더</span><span>위치</span><span>내용</span></div>' + items.map(function(n){
      var path = String(n.path || '');
      var parts = path.split('/').filter(Boolean);
      var name = String(n.name || parts[parts.length - 1] || path || 'root');
      var parent = parts.length > 1 ? parts.slice(0, -1).join(' / ') : '라이브러리';
      return '<label class="folder-line folder-explorer-row" title="' + esc(path) + '" data-folder-permission-row="true">'
        + '<span class="folder-explorer-check"><input type="checkbox" data-path="' + esc(path) + '" aria-label="' + esc(name) + ' 폴더 선택"><span class="folder-explorer-state" aria-hidden="true">미선택</span></span>'
        + '<span class="folder-explorer-name"><span class="folder-explorer-icon" aria-hidden="true">📁</span><strong>' + esc(name) + '</strong></span>'
        + '<span class="folder-explorer-parent">' + esc(parent) + '</span>'
        + '<span class="folder-line-meta">작품 ' + Number(n.novelCount || 0) + ' · 하위 ' + Number(n.childCount || 0) + '</span>'
        + '</label>';
    }).join('');
    picker.onchange = function(e){ if (!e.target || !e.target.matches('input[data-path]')) return; var textarea = $(tid); if (!textarea) return; var set = linesFrom(ctx, textarea.value).reduce(function(m, v){ m[v] = 1; return m; }, {}); var p = e.target.getAttribute('data-path'); if (e.target.checked) set[p] = 1; else delete set[p]; textarea.value = Object.keys(set).sort().join('\n'); renderSelection(ctx, tid, sid); };
    var textarea = $(tid);
    if (textarea) textarea.oninput = function(){ syncChecks(ctx, pid, tid, sid); };
    if (search) search.oninput = function(){ attachPicker(ctx, pid, tid, sid, searchId); };
    syncChecks(ctx, pid, tid, sid);
  }
  function renderPickers(ctx){ enhanceAccessModeControls(ctx); attachPicker(ctx, 'create-folder-picker', 'create-folders', 'create-selection', 'create-folder-search'); attachPicker(ctx, 'create-move-folder-picker', 'create-move-folders', 'create-move-selection', 'create-move-folder-search'); attachPicker(ctx, 'create-delete-folder-picker', 'create-delete-folders', 'create-delete-selection', 'create-delete-folder-search'); attachPicker(ctx, 'edit-folder-picker', 'edit-folders', 'edit-selection', 'edit-folder-search'); attachPicker(ctx, 'edit-move-folder-picker', 'edit-move-folders', 'edit-move-selection', 'edit-move-folder-search'); attachPicker(ctx, 'edit-delete-folder-picker', 'edit-delete-folders', 'edit-delete-selection', 'edit-delete-folder-search'); attachPicker(ctx, 'signup-code-move-folder-picker', 'signup-code-move-folders', 'signup-code-move-selection', 'signup-code-move-folder-search'); attachPicker(ctx, 'signup-code-delete-folder-picker', 'signup-code-delete-folders', 'signup-code-delete-selection', 'signup-code-delete-folder-search'); }
  function fmtNovel(n){ return '- ' + (n.title || n.id) + ' [' + (n.categoryPath || 'root') + ']' + (n.isMultiFile ? ' · ' + n.episodeCount + ' episodes' : ''); }
  function accessPayload(ctx){ var $ = ctx.$; return { mode:$('edit-access-mode').value, folders:uniqFrom(ctx, linesFrom(ctx, $('edit-folders').value)) }; }
  function mutationAccessPayload(ctx, prefix){ var $ = ctx.$; prefix = prefix || 'edit'; return { moveFolders:uniqFrom(ctx, linesFrom(ctx, $(prefix + '-move-folders') && $(prefix + '-move-folders').value)), deleteFolders:uniqFrom(ctx, linesFrom(ctx, $(prefix + '-delete-folders') && $(prefix + '-delete-folders').value)) }; }
  function previewUser(ctx, id){ if (!id) { ctx.log('미리보기할 사용자를 선택하세요.'); return Promise.resolve(); } return ctx.jf('/api/admin/users/' + encodeURIComponent(id) + '/library-preview').then(function(d){ var sample = (d.sample || []).map(function(n){ return '- ' + n.title + ' [' + (n.categoryPath || 'root') + ']' + (n.isMultiFile ? ' · ' + n.episodeCount + ' episodes' : ''); }).join('\n'); ctx.log('사용자 ' + ((d.user && d.user.username) || id) + ' 목록 미리보기\n접근 가능: ' + d.accessibleNovelCount + ' / ' + d.totalNovelCount + '\naccessVersion: ' + ((d.user && d.user.accessVersion) || 1) + '\n\n' + (sample || '접근 가능한 작품이 없습니다.')); return d; }); }
  function compareSelectedAccess(ctx){ var selected = ctx.getSelectedUser ? ctx.getSelectedUser() : null; if (!selected) { ctx.log('사용자를 먼저 선택하세요.'); return Promise.resolve(); } var $ = ctx.$; var id = $('edit-user-id').value; return ctx.jf('/api/admin/users/' + encodeURIComponent(id) + '/library-preview/compare', { method:'POST', body:JSON.stringify({ libraryAccess:accessPayload(ctx) }) }).then(function(d){ var added = (d.diff && d.diff.addedSample || []).map(fmtNovel).join('\n'); var revoked = (d.diff && d.diff.revokedSample || []).map(fmtNovel).join('\n'); var warnings = (d.warnings || []).join('\n'); ctx.log('권한 변경 영향 미리보기\npass: ' + (d.pass || '') + '\n전체 작품: ' + d.totalNovelCount + '\n현재 접근 가능: ' + d.current.accessibleNovelCount + '\n변경 후 접근 가능: ' + d.proposed.accessibleNovelCount + '\n추가: ' + d.diff.addedCount + ' · 회수: ' + d.diff.revokedCount + ' · 유지: ' + d.diff.retainedCount + '\n\n[추가될 작품]\n' + (added || '없음') + '\n\n[회수될 작품]\n' + (revoked || '없음') + (warnings ? '\n\n[주의]\n' + warnings : '')); return d; }); }
  function bindPermissionActions(ctx){ var $ = ctx.$; enhanceAccessModeControls(ctx); if ($('preview-user-btn')) $('preview-user-btn').onclick = function(){ previewUser(ctx, $('edit-user-id').value).catch(ctx.log); }; if ($('compare-access-btn')) $('compare-access-btn').onclick = function(){ compareSelectedAccess(ctx).catch(ctx.log); }; }
  global.AdminPermissions = { PASS:PASS, accessLabel:accessLabel, mutationAccessLabel:mutationAccessLabel, renderSelection:renderSelection, visibleFolders:visibleFolders, syncChecks:syncChecks, attachPicker:attachPicker, renderPickers:renderPickers, accessPayload:accessPayload, mutationAccessPayload:mutationAccessPayload, previewUser:previewUser, compareSelectedAccess:compareSelectedAccess, bindPermissionActions:bindPermissionActions, enhanceAccessModeControls:enhanceAccessModeControls, syncAccessModeControl:syncAccessModeControl };
})(window);
