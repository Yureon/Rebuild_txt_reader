(function(global){
  'use strict';
  var PASS = 'v417-admin-users-core-split-pass';
  function $(id){ return document.getElementById(id); }
  function esc(v){ return String(v == null ? '' : v).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function lines(v){ return String(v || '').split(/\r?\n/).map(function(x){ return x.trim(); }).filter(Boolean); }
  function uniq(a){ var seen = {}, out = []; (a || []).forEach(function(v){ v = String(v || '').trim(); if (v && !seen[v]) { seen[v] = 1; out.push(v); } }); return out.sort(); }
  function createJsonApi(){
    var csrfToken = '';
    function fetchJson(url, opt){
      opt = opt || {};
      opt.credentials = 'same-origin';
      opt.headers = Object.assign({'Content-Type':'application/json'}, opt.headers || {});
      if (csrfToken && !/^(GET|HEAD)$/i.test(opt.method || 'GET')) opt.headers['X-CSRF-Token'] = csrfToken;
      return fetch(url, opt).then(function(r){ return r.json().then(function(d){ if (!r.ok) throw d; if (d && d.csrfToken) csrfToken = d.csrfToken; return d; }); });
    }
    function refreshCsrf(){ return fetchJson('/api/csrf').then(function(d){ csrfToken = d.csrfToken || csrfToken; return d; }); }
    return { fetchJson:fetchJson, refreshCsrf:refreshCsrf };
  }
  global.AdminUsersCore = { PASS:PASS, $:$, esc:esc, lines:lines, uniq:uniq, createJsonApi:createJsonApi };
})(window);
