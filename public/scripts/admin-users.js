(function(){
  'use strict';
  var users = [];
  var folderTree = [];
  var selectedUser = null;
  var output = document.getElementById('status-output');
  var wrap = document.getElementById('users-wrap');
  var core = window.AdminUsersCore || {};
  var sections = window.AdminUsersSections || {};
  var ops = window.AdminUsersOps || {};
  var userList = window.AdminUsersList || {};
  var actions = window.AdminUserActions || {};
  var permissions = window.AdminPermissions || {};
  var stateActions = window.AdminStateActions || {};
  var auditActions = window.AdminAuditActions || {};
  var signupActions = window.AdminSignupActions || {};
  var siteLanguageActions = window.AdminSiteLanguages || {};
  var libraryCleanup = window.AdminLibraryCleanup || {};
  var libraryOrganization = window.AdminLibraryOrganization || {};
  var MAIN_PASS = 'v643-owner-console-library-organization-pass';
  var $ = core.$ || function(id){ return document.getElementById(id); };
  var esc = core.esc || function(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]; }); };
  var lines = core.lines || function(v){ return String(v || '').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean); };
  var uniq = core.uniq || function(a){ var s = {}, o = []; (a || []).forEach(function(v){ v = String(v || '').trim(); if (v && !s[v]) { s[v] = 1; o.push(v); } }); return o.sort(); };
  var api = core.createJsonApi ? core.createJsonApi() : null;
  function log(v){ if (output) output.textContent = typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
  function jf(url, opt){
    if (api && api.fetchJson) return api.fetchJson(url, opt);
    opt = opt || {};
    opt.credentials = 'same-origin';
    opt.headers = Object.assign({ 'Content-Type':'application/json' }, opt.headers || {});
    return fetch(url, opt).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw d; return d; }); });
  }
  function csrf(){ return api && api.refreshCsrf ? api.refreshCsrf() : jf('/api/csrf'); }
  function showAdminSection(name, opts){ return sections.showAdminSection ? sections.showAdminSection(name, opts) : undefined; }
  function bindAdminSections(){ return sections.bindAdminSections ? sections.bindAdminSections() : undefined; }
  function showUserPanel(name){
    name = name || 'create';
    document.querySelectorAll('[data-user-panel]').forEach(function(panel){
      var active = panel.getAttribute('data-user-panel') === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-user-panel-tab]').forEach(function(button){
      var active = button.getAttribute('data-user-panel-tab') === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
  }
  function bindUserPanelTabs(){
    document.querySelectorAll('[data-user-panel-tab]').forEach(function(button){
      button.setAttribute('role', 'tab');
      button.addEventListener('click', function(){ showUserPanel(button.getAttribute('data-user-panel-tab')); });
    });
  }
  function getUsers(){ return users; }
  function getFolderTree(){ return folderTree; }
  function getSelectedUser(){ return selectedUser; }
  function setSelectedUser(next){ selectedUser = next; }
  function baseContext(){ return { PASS:MAIN_PASS, $:$, wrap:wrap, jf:jf, log:log, esc:esc, lines:lines, uniq:uniq, refresh:refresh, getUsers:getUsers, getFolderTree:getFolderTree, getSelectedUser:getSelectedUser, setSelectedUser:setSelectedUser, showAdminSection:showAdminSection, showUserPanel:showUserPanel }; }
  function permissionContext(){ return Object.assign(baseContext(), { accessPayload:accessPayload }); }
  function stateContext(){ return baseContext(); }
  function signupContext(){ return Object.assign(baseContext(), { mutationAccessPayload:mutationAccessPayload }); }
  function auditContext(){ return baseContext(); }
  function siteLanguageContext(){ return baseContext(); }
  function accessLabel(a){ return permissions.accessLabel ? permissions.accessLabel(a) : (a && a.mode === 'all' ? '전체 허용' : a && a.mode === 'folders' ? '폴더 ' + ((a.folders || []).length) + '개' : '접근 없음'); }
  function mutationAccessLabel(a){ return permissions.mutationAccessLabel ? permissions.mutationAccessLabel(a) : '이동 ' + (((a && a.moveFolders) || []).length) + ' · 삭제 ' + (((a && a.deleteFolders) || []).length); }
  function renderPickers(){ if (permissions.renderPickers) permissions.renderPickers(permissionContext()); }
  function syncEditPermission(){ if (permissions.syncChecks) permissions.syncChecks(permissionContext(), 'edit-folder-picker', 'edit-folders', 'edit-selection'); }
  function accessPayload(){ return permissions.accessPayload ? permissions.accessPayload(permissionContext()) : { mode:$('edit-access-mode').value, folders:uniq(lines($('edit-folders').value)) }; }
  function mutationAccessPayload(prefix){ return permissions.mutationAccessPayload ? permissions.mutationAccessPayload(baseContext(), prefix) : { moveFolders:uniq(lines($(prefix + '-move-folders').value)), deleteFolders:uniq(lines($(prefix + '-delete-folders').value)) }; }
  function previewUser(id){ return permissions.previewUser ? permissions.previewUser(permissionContext(), id) : Promise.resolve(null); }
  function loadUserStateSnapshots(id){ return stateActions.loadUserStateSnapshots ? stateActions.loadUserStateSnapshots(stateContext(), id) : Promise.resolve(null); }
  function loadSignupCodes(){ return signupActions.loadSignupCodes ? signupActions.loadSignupCodes(signupContext()) : Promise.resolve(null); }
  function loadSiteLanguages(){ return siteLanguageActions.loadSiteLanguages ? siteLanguageActions.loadSiteLanguages(siteLanguageContext()) : Promise.resolve(null); }
  function renderUsers(){ if (userList && userList.renderUsers) { wrap.innerHTML = userList.renderUsers(users, { esc:esc, accessLabel:accessLabel, mutationAccessLabel:mutationAccessLabel }); return; } if (!users.length) wrap.innerHTML = '<p class="muted">아직 생성된 일반 사용자가 없습니다.</p>'; }
  function renderAdminDiagnostics(d, extra){ if (ops && ops.renderAdminDiagnostics) { ops.renderAdminDiagnostics(d, extra); return; } log('운영 진단 ' + ((d && d.summary && d.summary.grade) || 'ok')); }
  function loadAdminDiagnostics(){ return jf('/api/admin/diagnostics').then(function(d){ renderAdminDiagnostics(d); log('운영 진단\npass: ' + (d.pass || '') + '\ngrade: ' + ((d.summary && d.summary.grade) || 'ok') + '\nmessage: ' + ((d.summary && d.summary.message) || '')); return d; }); }
  function runDeploymentPreflight(){ return ops && ops.runDeploymentPreflight ? ops.runDeploymentPreflight(jf) : Promise.resolve(null); }
  function fillEdit(u){
    selectedUser = u;
    showUserPanel('edit');
    $('edit-empty').hidden = true;
    $('edit-form').hidden = false;
    $('edit-title').textContent = u.username + ' 편집';
    $('edit-user-id').value = u.id;
    $('edit-enabled').checked = u.enabled !== false;
    var a = u.libraryAccess || { mode:'none', folders:[] };
    $('edit-access-mode').value = a.mode || 'none';
    $('edit-folders').value = (a.folders || []).join('\n');
    var m = u.folderMutationAccess || { moveFolders:[], deleteFolders:[] };
    $('edit-move-folders').value = (m.moveFolders || []).join('\n');
    $('edit-delete-folders').value = (m.deleteFolders || []).join('\n');
    if ($('edit-full-search')) $('edit-full-search').checked = !u.appPermissions || u.appPermissions.fullSearch !== false;
    if ($('edit-metadata-access')) $('edit-metadata-access').checked = !!(u.appPermissions && u.appPermissions.metadataAccess === true);
    $('reset-password').value = '';
    if ($('temporary-password-output')) $('temporary-password-output').textContent = '임시 비밀번호는 발급 응답에 한 번만 표시됩니다.';
    syncEditPermission();
    renderPickers();
    if (window.AdminUserFormWorkflow && window.AdminUserFormWorkflow.refresh) window.AdminUserFormWorkflow.refresh('edit');
    loadUserStateSnapshots(u.id).catch(log);
  }
  function refresh(){
    return jf('/api/admin/users/status').then(function(s){
      log(s);
      return Promise.all([jf('/api/admin/users'), jf('/api/admin/library-tree').catch(function(e){ log(e); return { libraryTree:{ flattened:[] } }; })]);
    }).then(function(all){
      users = all[0].users || [];
      folderTree = (all[1].libraryTree && all[1].libraryTree.flattened) || [];
      renderUsers();
      renderPickers();
      loadSignupCodes().catch(log);
      loadSiteLanguages().catch(log);
      if (selectedUser) {
        var u = users.find(function(x){ return x.id === selectedUser.id; });
        if (u) fillEdit(u);
      }
    });
  }
  var actionContext = Object.assign(baseContext(), { accessPayload:accessPayload, mutationAccessPayload:mutationAccessPayload, fillEdit:fillEdit, previewUser:previewUser });
  if (actions && actions.bindUserListActions) actions.bindUserListActions(actionContext);
  if (actions && actions.bindAccountActionControls) actions.bindAccountActionControls(actionContext);
  if (permissions && permissions.bindPermissionActions) permissions.bindPermissionActions(permissionContext());
  if (stateActions && stateActions.bindStateActions) stateActions.bindStateActions(stateContext());
  if (auditActions && auditActions.bindAuditActions) auditActions.bindAuditActions(auditContext());
  if (signupActions && signupActions.bindSignupActions) signupActions.bindSignupActions(signupContext());
  if (siteLanguageActions && siteLanguageActions.bindSiteLanguageActions) siteLanguageActions.bindSiteLanguageActions(siteLanguageContext());
  if (libraryCleanup && libraryCleanup.bind) libraryCleanup.bind(baseContext());
  if (libraryOrganization && libraryOrganization.bind) libraryOrganization.bind(baseContext());
  if ($('refresh-btn')) $('refresh-btn').onclick = function(){ refresh().catch(log); };
  if ($('owner-logout-btn')) $('owner-logout-btn').onclick = function(){ $('owner-logout-btn').disabled = true; jf('/api/logout', { method:'POST', body:'{}' }).catch(function(){ return null; }).finally(function(){ try { localStorage.removeItem('csrf_token'); } catch(_e) {} location.replace('/login.html'); }); };
  if ($('admin-diagnostics-btn')) $('admin-diagnostics-btn').onclick = function(){ showAdminSection('ops'); loadAdminDiagnostics().catch(log); };
  if ($('admin-preflight-btn')) $('admin-preflight-btn').onclick = function(){ showAdminSection('ops'); runDeploymentPreflight().catch(log); };
  bindUserPanelTabs();
  showUserPanel('create');
  bindAdminSections();
  if (ops && ops.bindDiagnosticsFilter) ops.bindDiagnosticsFilter();
  if (ops && ops.renderHistory) ops.renderHistory();
  csrf().then(refresh).catch(log);
})();
