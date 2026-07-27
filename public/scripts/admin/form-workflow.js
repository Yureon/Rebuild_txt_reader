(function(global){
  'use strict';
  var PASS = 'v596-admin-user-form-workflow-pass';

  function countLines(value){
    return String(value || '').split(/\r?\n/).map(function(line){ return line.trim(); }).filter(Boolean).length;
  }

  function node(tag, attrs, children){
    var element = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(key){
      var value = attrs[key];
      if (key === 'className') element.className = value;
      else if (key === 'text') element.textContent = value;
      else if (key === 'open') element.open = !!value;
      else element.setAttribute(key, value);
    });
    (children || []).forEach(function(child){ if (child) element.appendChild(child); });
    return element;
  }

  function wrapStep(form, config){
    var existing = form.querySelector('details[data-user-form-step="' + config.id + '"]');
    if (existing) return existing;
    var items = config.selectors.map(function(selector){ return form.querySelector(selector); }).filter(Boolean);
    if (!items.length) return null;
    var titleId = form.id + '-' + config.id + '-title';
    var summary = node('summary', { className:'user-form-step-summary', 'aria-labelledby':titleId }, [
      node('span', { className:'user-form-step-index', text:String(config.index) }),
      node('span', { className:'user-form-step-copy' }, [
        node('strong', { id:titleId, text:config.title }),
        node('small', { text:config.description })
      ]),
      node('span', { className:'user-form-step-state', 'aria-hidden':'true', text:'열기' })
    ]);
    var body = node('div', { className:'user-form-step-body' });
    var details = node('details', {
      className:'user-form-step' + (config.advanced ? ' is-advanced' : ''),
      'data-user-form-step':config.id,
      'data-user-form-prefix':config.prefix,
      open:config.open
    }, [summary, body]);
    form.insertBefore(details, items[0]);
    items.forEach(function(item){ body.appendChild(item); });
    details.addEventListener('toggle', function(){
      details.classList.toggle('is-open', details.open);
      var state = details.querySelector('.user-form-step-state');
      if (state) state.textContent = details.open ? '닫기' : '열기';
      details.dispatchEvent(new CustomEvent('admin-form-step-toggle', { bubbles:true, detail:{ open:details.open } }));
    });
    details.classList.toggle('is-open', details.open);
    var state = details.querySelector('.user-form-step-state');
    if (state) state.textContent = details.open ? '닫기' : '열기';
    return details;
  }

  function installStickyActions(form, prefix){
    var actions = form.querySelector('.user-panel-actions');
    if (!actions || actions.dataset.v596Sticky === 'true') return;
    actions.dataset.v596Sticky = 'true';
    if (prefix === 'edit') {
      var secondaryButtons = Array.from(actions.querySelectorAll('button')).filter(function(button){ return button.type !== 'submit'; });
      if (secondaryButtons.length) {
        var secondary = node('div', { className:'actions user-form-secondary-actions', 'aria-label':'사용자 계정 보조 작업' });
        secondaryButtons.forEach(function(button){ secondary.appendChild(button); });
        var accessBody = form.querySelector('details[data-user-form-step="access"] .user-form-step-body');
        (accessBody || form).appendChild(secondary);
      }
    }
    actions.classList.add('user-form-sticky-actions');
    var summary = node('output', {
      id:prefix + '-change-summary',
      className:'user-form-change-summary',
      'aria-live':'polite',
      text:'변경 내용을 확인하세요.'
    });
    actions.insertBefore(summary, actions.firstChild);
    form.appendChild(actions);
  }

  function updateSummary(form, prefix){
    var target = document.getElementById(prefix + '-change-summary');
    if (!target) return;
    var accessMode = document.getElementById(prefix + '-access-mode');
    var accessFolders = document.getElementById(prefix + '-folders');
    var moveFolders = document.getElementById(prefix + '-move-folders');
    var deleteFolders = document.getElementById(prefix + '-delete-folders');
    var fullSearch = document.getElementById(prefix + '-full-search');
    var metadata = document.getElementById(prefix + '-metadata-access');
    var parts = [];
    if (prefix === 'create') {
      var username = String(document.getElementById('create-username')?.value || '').trim();
      parts.push(username ? '계정 ' + username : '새 계정');
    } else {
      parts.push(String(document.getElementById('edit-title')?.textContent || '선택 사용자'));
    }
    var mode = accessMode ? accessMode.value : 'none';
    parts.push(mode === 'all' ? '서재 전체' : mode === 'folders' ? '접근 폴더 ' + countLines(accessFolders?.value) + '개' : '서재 차단');
    parts.push('이동 ' + countLines(moveFolders?.value) + '개');
    parts.push('삭제 ' + countLines(deleteFolders?.value) + '개');
    var featureCount = (fullSearch && fullSearch.checked ? 1 : 0) + (metadata && metadata.checked ? 1 : 0);
    parts.push('기능 권한 ' + featureCount + '개');
    target.textContent = parts.join(' · ');
  }

  function bindSummary(form, prefix){
    if (form.dataset.v596SummaryBound === 'true') return;
    form.dataset.v596SummaryBound = 'true';
    var refresh = function(){ updateSummary(form, prefix); };
    form.addEventListener('input', refresh);
    form.addEventListener('change', refresh);
    form.addEventListener('reset', function(){ setTimeout(refresh, 0); });
    global.addEventListener('admin-user-form-refresh', function(event){
      if (!event.detail || !event.detail.prefix || event.detail.prefix === prefix) refresh();
    });
    refresh();
  }

  function enhanceForm(form, prefix){
    if (!form || form.dataset.v596Workflow === 'true') return;
    form.dataset.v596Workflow = 'true';
    var configs = prefix === 'create' ? [
      { id:'account', prefix:prefix, index:1, title:'계정 정보', description:'아이디와 초기 비밀번호를 입력합니다.', selectors:['.user-form-row-compact'], open:true },
      { id:'access', prefix:prefix, index:2, title:'서재 접근과 기능 권한', description:'접근 범위와 검색·메타데이터 권한을 설정합니다.', selectors:['.user-form-row-access','.app-permission-panel','.access-picker-panel'], open:true },
      { id:'advanced', prefix:prefix, index:3, title:'고급 파일 작업 권한', description:'이동·삭제가 필요한 사용자에게만 별도로 부여합니다.', selectors:['.user-mutation-row'], advanced:true, open:false }
    ] : [
      { id:'access', prefix:prefix, index:1, title:'계정 상태와 서재 접근', description:'활성 상태, 접근 범위와 기능 권한을 조정합니다.', selectors:['.edit-toolbar','.user-form-row-access','.app-permission-panel','.access-picker-panel'], open:true },
      { id:'advanced', prefix:prefix, index:2, title:'고급 파일 작업 권한', description:'이동·삭제 범위를 필요한 경우에만 확장합니다.', selectors:['.user-mutation-row'], advanced:true, open:false },
      { id:'maintenance', prefix:prefix, index:3, title:'계정 유지보수와 위험 작업', description:'비밀번호·독서 데이터·계정 삭제 작업을 관리합니다.', selectors:['.edit-subsections'], advanced:true, open:false }
    ];
    configs.forEach(function(config){ wrapStep(form, config); });
    installStickyActions(form, prefix);
    bindSummary(form, prefix);
  }

  function bindTabs(){
    var tabs = Array.from(document.querySelectorAll('[data-user-panel-tab]'));
    tabs.forEach(function(tab, index){
      var panelName = tab.getAttribute('data-user-panel-tab');
      var panel = document.querySelector('[data-user-panel="' + panelName + '"]');
      if (panel) {
        panel.id = panel.id || 'admin-user-panel-' + panelName;
        tab.id = tab.id || 'admin-user-tab-' + panelName;
        tab.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
      }
      tab.tabIndex = tab.classList.contains('active') ? 0 : -1;
      tab.addEventListener('keydown', function(event){
        var delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0;
        var nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : delta ? (index + delta + tabs.length) % tabs.length : -1;
        if (nextIndex < 0) return;
        event.preventDefault();
        tabs[nextIndex].focus();
        tabs[nextIndex].click();
      });
    });
  }

  function refresh(prefix){
    global.dispatchEvent(new CustomEvent('admin-user-form-refresh', { detail:{ prefix:prefix || '' } }));
  }

  function start(){
    enhanceForm(document.getElementById('create-form'), 'create');
    enhanceForm(document.getElementById('edit-form'), 'edit');
    bindTabs();
    document.documentElement.dataset.adminUserWorkflowPass = PASS;
  }

  global.AdminUserFormWorkflow = { PASS:PASS, enhanceForm:enhanceForm, refresh:refresh, updateSummary:updateSummary };
  start();
})(window);
