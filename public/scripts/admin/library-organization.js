(function(global){
  'use strict';

  var PASS = 'v643-library-organization-ui-pass';
  var bound = false;
  var plan = null;

  function el(tag, attrs, children){
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function(key){
      var value = attrs[key];
      if (key === 'class') node.className = String(value || '');
      else if (key === 'text') node.textContent = String(value == null ? '' : value);
      else if (key === 'disabled') node.disabled = !!value;
      else node.setAttribute(key, String(value));
    });
    (Array.isArray(children) ? children : children ? [children] : []).filter(Boolean).forEach(function(child){
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function formatNumber(value){ return Math.max(0, Number(value) || 0).toLocaleString('ko-KR'); }
  function config(ctx){
    var checked = document.querySelector('input[name="library-organization-mode"]:checked');
    return {
      layout:String(ctx.$('library-organization-layout') && ctx.$('library-organization-layout').value || 'author-title'),
      mode:String(checked && checked.value || 'copy')
    };
  }

  function setStatus(ctx, text, error){
    var target = ctx.$('library-organization-status');
    if (!target) return;
    target.textContent = String(text || '');
    target.classList.toggle('error', !!error);
  }

  function render(ctx, next){
    plan = next || null;
    var target = ctx.$('library-organization-list');
    var summary = ctx.$('library-organization-summary');
    var hash = ctx.$('library-organization-plan-hash');
    var download = ctx.$('library-organization-download-btn');
    if (!target) return;
    target.replaceChildren();
    if (!plan) {
      target.appendChild(el('p',{class:'muted small',text:'변환 계획이 없습니다.'}));
      if (download) download.disabled = true;
      return;
    }
    var info = plan.summary || {};
    if (summary) summary.textContent = '작품 ' + formatNumber(info.novelCount) + '개 · 변환 파일 ' + formatNumber(info.moveCount) + '개 · 유지 ' + formatNumber(info.unchangedCount) + '개 · 제외 ' + formatNumber(info.skippedCount) + '개';
    if (hash) {
      hash.textContent = '계획 ' + String(plan.planHash || '').slice(0, 12);
      hash.title = String(plan.planHash || '');
    }
    var sample = Array.isArray(plan.sample) ? plan.sample : [];
    if (!sample.length) {
      target.appendChild(el('p',{class:'muted small',text:'현재 선택한 구조로 이동할 파일이 없습니다.'}));
    } else {
      sample.forEach(function(item){
        target.appendChild(el('article',{class:'library-organization-item'},[
          el('div',{class:'library-organization-item-title'},[
            el('strong',{text:String(item.title || '제목 없음')}),
            item.author ? el('span',{class:'muted small',text:String(item.author)}) : null
          ]),
          el('div',{class:'library-organization-paths'},[
            el('code',{text:String(item.sourcePath || '')}),
            el('span',{class:'library-organization-arrow','aria-hidden':'true',text:'→'}),
            el('code',{text:String(item.targetPath || '')})
          ])
        ]));
      });
      if (plan.truncated) target.appendChild(el('p',{class:'muted small',text:'표시는 300개로 제한됩니다. 다운로드되는 스크립트에는 전체 계획이 포함됩니다.'}));
    }
    if (download) download.disabled = Number(info.moveCount || 0) < 1;
  }

  function preview(ctx){
    var button = ctx.$('library-organization-preview-btn');
    var cfg = config(ctx);
    if (button) button.disabled = true;
    setStatus(ctx, '현재 라이브러리와 적용된 메타데이터를 기준으로 경로를 계산하는 중입니다.');
    var query = new URLSearchParams(cfg).toString();
    return ctx.jf('/api/admin/library-organization/plan?' + query).then(function(result){
      render(ctx, result);
      setStatus(ctx, '미리보기 완료 · ' + formatNumber(result.summary && result.summary.moveCount) + '개 파일의 변환 경로를 계산했습니다.');
      return result;
    }).catch(function(error){
      render(ctx, null);
      setStatus(ctx, '변환 미리보기에 실패했습니다: ' + String(error && (error.message || error.error) || error), true);
      throw error;
    }).finally(function(){ if (button) button.disabled = false; });
  }

  function download(ctx){
    if (!plan || Number(plan.summary && plan.summary.moveCount || 0) < 1) return Promise.resolve(null);
    var button = ctx.$('library-organization-download-btn');
    var cfg = config(ctx);
    if (button) button.disabled = true;
    setStatus(ctx, '전체 변환 계획을 다시 계산하고 PowerShell 스크립트를 생성하는 중입니다.');
    return ctx.jf('/api/admin/library-organization/script', { method:'POST', body:JSON.stringify(cfg) }).then(function(result){
      var blob = new Blob(['\ufeff', String(result.script || '')], { type:result.contentType || 'text/plain;charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = String(result.fileName || 'txt-reader-library-organization.ps1');
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      setStatus(ctx, '변환 스크립트 생성 완료 · ' + formatNumber(result.summary && result.summary.moveCount) + '개 파일');
      return result;
    }).catch(function(error){
      setStatus(ctx, '변환 스크립트 생성에 실패했습니다: ' + String(error && (error.message || error.error) || error), true);
      throw error;
    }).finally(function(){ if (button) button.disabled = !plan || Number(plan.summary && plan.summary.moveCount || 0) < 1; });
  }

  function showPanel(name){
    name = name === 'organization' ? 'organization' : 'duplicates';
    document.querySelectorAll('[data-cleanup-panel]').forEach(function(panel){
      var active = panel.getAttribute('data-cleanup-panel') === name;
      panel.hidden = !active;
      panel.classList.toggle('is-active', active);
    });
    document.querySelectorAll('[data-cleanup-panel-tab]').forEach(function(button){
      var active = button.getAttribute('data-cleanup-panel-tab') === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
    try { sessionStorage.setItem('admin_cleanup_panel', name); } catch(_error) {}
  }

  function bind(ctx){
    if (bound) return;
    bound = true;
    document.querySelectorAll('[data-cleanup-panel-tab]').forEach(function(button){
      button.setAttribute('role','tab');
      button.addEventListener('click', function(){ showPanel(button.getAttribute('data-cleanup-panel-tab')); });
    });
    var initial = 'duplicates';
    try { initial = sessionStorage.getItem('admin_cleanup_panel') || initial; } catch(_error) {}
    showPanel(initial);
    var previewButton = ctx.$('library-organization-preview-btn');
    var downloadButton = ctx.$('library-organization-download-btn');
    if (previewButton) previewButton.addEventListener('click', function(){ preview(ctx).catch(function(){}); });
    if (downloadButton) downloadButton.addEventListener('click', function(){ download(ctx).catch(function(){}); });
    var layout = ctx.$('library-organization-layout');
    if (layout) layout.addEventListener('change', function(){ plan = null; render(ctx, null); });
    document.querySelectorAll('input[name="library-organization-mode"]').forEach(function(input){
      input.addEventListener('change', function(){ plan = null; render(ctx, null); });
    });
  }

  global.AdminLibraryOrganization = { PASS:PASS, bind:bind, preview:preview, render:render, showPanel:showPanel };
})(window);
