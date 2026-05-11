(function(global){
  'use strict';
  var PASS = 'v560-admin-site-language-packs-pass';
  function normalizeId(value){ return String(value || '').trim().toLowerCase().replace(/^site:/, '').replace(/^custom:/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32); }
  function parseMap(raw){
    var text = String(raw || '').trim();
    if (!text) return {};
    if (text[0] === '{') return JSON.parse(text);
    var out = {};
    text.split(/\r?\n/).forEach(function(line){
      var trimmed = line.trim();
      if (!trimmed || trimmed[0] === '#') return;
      var sep = trimmed.indexOf('=>') >= 0 ? '=>' : trimmed.indexOf('\t') >= 0 ? '\t' : '=';
      var idx = trimmed.indexOf(sep);
      if (idx <= 0) return;
      var key = trimmed.slice(0, idx).trim().replace(/\s+/g, ' ');
      var value = trimmed.slice(idx + sep.length).trim();
      if (key && value) out[key] = value;
    });
    return out;
  }
  function serializeMap(map){
    return Object.keys(map || {}).sort().map(function(key){ return key + '=' + map[key]; }).join('\n');
  }
  function setStatus(ctx, msg){ var el = ctx.$('language-pack-status'); if (el) el.textContent = msg || ''; }
  function formPayload(ctx){
    var $ = ctx.$;
    var id = normalizeId($('language-pack-id').value);
    var map = parseMap($('language-pack-map').value);
    return { id:id, name:$('language-pack-name').value.trim(), description:$('language-pack-description').value.trim(), enabled:$('language-pack-enabled').checked !== false, map:map };
  }
  function renderList(ctx, languages){
    var box = ctx.$('language-pack-list');
    if (!box) return;
    var esc = ctx.esc;
    languages = languages || [];
    if (!languages.length) { box.innerHTML = '<p class="muted small">공통 언어팩이 없습니다.</p>'; return; }
    box.innerHTML = languages.map(function(lang){
      var count = lang.map ? Object.keys(lang.map).length : 0;
      var source = lang.bundled ? '기본 제공' : '관리자';
      var deleteAttrs = lang.bundled ? ' disabled title="기본 제공 언어팩은 삭제할 수 없습니다."' : '';
      return '<article class="user-row language-pack-row"><div><div class="user-title">' + esc(lang.name || lang.id) + '</div><div class="user-meta"><span class="pill">site:' + esc(lang.id) + '</span><span class="pill">' + source + '</span><span class="pill ' + (lang.enabled === false ? 'off' : 'ok') + '">' + (lang.enabled === false ? '비활성' : '활성') + '</span><span class="pill">문구 ' + count + '개</span><span class="pill">' + esc((lang.updatedAt || '').slice(0, 10) || '-') + '</span></div><p class="muted small">' + esc(lang.description || '') + '</p></div><div class="actions"><button type="button" data-lang-edit="' + esc(lang.id) + '">편집</button><button class="danger" type="button" data-lang-delete="' + esc(lang.id) + '"' + deleteAttrs + '>삭제</button></div></article>';
    }).join('');
  }
  function loadSiteLanguages(ctx){
    if (!ctx.$('language-pack-list')) return Promise.resolve({ languages:[] });
    return ctx.jf('/api/admin/site-languages').then(function(data){ renderList(ctx, data.languages || []); return data; });
  }
  function resetForm(ctx){
    ['language-pack-id','language-pack-name','language-pack-description','language-pack-map'].forEach(function(id){ var el = ctx.$(id); if (el) el.value = ''; });
    var enabled = ctx.$('language-pack-enabled');
    if (enabled) enabled.checked = true;
    setStatus(ctx, '입력 대기');
  }
  function saveSiteLanguage(ctx){
    var payload;
    try { payload = formPayload(ctx); }
    catch (err) { setStatus(ctx, '문구 형식 오류: ' + (err && err.message || err)); return Promise.resolve(null); }
    if (!payload.id) { setStatus(ctx, '언어 코드가 필요합니다. 예: ja, zh-cn'); return Promise.resolve(null); }
    if (!payload.name) { setStatus(ctx, '언어 이름이 필요합니다.'); return Promise.resolve(null); }
    if (!Object.keys(payload.map || {}).length) { setStatus(ctx, '표시 문구를 1개 이상 입력하세요.'); return Promise.resolve(null); }
    return ctx.jf('/api/admin/site-languages', { method:'POST', body:JSON.stringify(payload) }).then(function(d){ setStatus(ctx, '저장됨: ' + (d.language && d.language.name || payload.id)); return loadSiteLanguages(ctx).then(function(){ return d; }); });
  }
  function fillTemplate(ctx){
    var map = ctx.$('language-pack-map');
    if (!map) return;
    map.value = ['설정=Settings','검색=Search','소설 목록=Novel list','전체검색=Full search','북마크=Bookmarks','닫기=Close','저장=Save','삭제=Delete'].join('\n');
    if (!ctx.$('language-pack-name').value) ctx.$('language-pack-name').value = 'Custom shared language';
    setStatus(ctx, '기본 템플릿을 채웠습니다. 오른쪽 표시 문구를 원하는 언어로 바꿔 저장하세요.');
  }
  function bindSiteLanguageActions(ctx){
    if (ctx.$('language-pack-form')) ctx.$('language-pack-form').onsubmit = function(e){ e.preventDefault(); saveSiteLanguage(ctx).catch(ctx.log); };
    if (ctx.$('language-pack-refresh-btn')) ctx.$('language-pack-refresh-btn').onclick = function(){ loadSiteLanguages(ctx).catch(ctx.log); };
    if (ctx.$('language-pack-reset-btn')) ctx.$('language-pack-reset-btn').onclick = function(){ resetForm(ctx); };
    if (ctx.$('language-pack-template-btn')) ctx.$('language-pack-template-btn').onclick = function(){ fillTemplate(ctx); };
    if (ctx.$('language-pack-list')) ctx.$('language-pack-list').onclick = function(e){
      var edit = e.target.closest('button[data-lang-edit]');
      var del = e.target.closest('button[data-lang-delete]');
      if (edit) {
        var id = edit.getAttribute('data-lang-edit');
        ctx.jf('/api/admin/site-languages').then(function(data){
          var lang = (data.languages || []).find(function(x){ return x.id === id; });
          if (!lang) return;
          ctx.$('language-pack-id').value = lang.id || '';
          ctx.$('language-pack-name').value = lang.name || '';
          ctx.$('language-pack-description').value = lang.description || '';
          ctx.$('language-pack-enabled').checked = lang.enabled !== false;
          ctx.$('language-pack-map').value = serializeMap(lang.map || {});
          setStatus(ctx, '편집 중: ' + (lang.name || lang.id));
        }).catch(ctx.log);
      }
      if (del) {
        var delId = del.getAttribute('data-lang-delete');
        if (!global.confirm('공통 언어팩 site:' + delId + ' 을 삭제할까요?')) return;
        ctx.jf('/api/admin/site-languages/' + encodeURIComponent(delId), { method:'DELETE' }).then(function(d){ setStatus(ctx, '삭제됨: ' + delId); return loadSiteLanguages(ctx).then(function(){ return d; }); }).catch(ctx.log);
      }
    };
  }
  global.AdminSiteLanguages = { PASS:PASS, bindSiteLanguageActions:bindSiteLanguageActions, loadSiteLanguages:loadSiteLanguages, parseMap:parseMap, serializeMap:serializeMap };
})(window);
