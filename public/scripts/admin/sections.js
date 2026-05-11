(function(global){
  'use strict';
  var PASS = 'v417-admin-users-sections-split-pass';
  function validAdminSection(name){ return !!document.querySelector('[data-admin-section="' + String(name || '').replace(/"/g, '') + '"]'); }
  function showAdminSection(name, opts){
    opts = opts || {};
    name = validAdminSection(name) ? name : 'users';
    document.querySelectorAll('[data-admin-section]').forEach(function(section){ section.hidden = section.getAttribute('data-admin-section') !== name; });
    document.querySelectorAll('[data-admin-tab]').forEach(function(button){
      var active = button.getAttribute('data-admin-tab') === name;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    try { sessionStorage.setItem('admin_active_section', name); } catch(_e) {}
    if (!opts.skipHash && location.hash !== '#' + name) {
      try { history.replaceState(null, '', '#' + name); } catch(_e) { location.hash = name; }
    }
  }
  function bindAdminSections(){
    var initial = (location.hash || '').replace(/^#/, '') || 'users';
    try { initial = (location.hash || '').replace(/^#/, '') || sessionStorage.getItem('admin_active_section') || initial; } catch(_e) {}
    document.querySelectorAll('[data-admin-tab]').forEach(function(button){
      button.setAttribute('role', 'tab');
      button.addEventListener('click', function(){ showAdminSection(button.getAttribute('data-admin-tab')); });
    });
    window.addEventListener('hashchange', function(){ showAdminSection((location.hash || '').replace(/^#/, ''), { skipHash:true }); });
    showAdminSection(initial, { skipHash:true });
  }
  global.AdminUsersSections = { PASS:PASS, showAdminSection:showAdminSection, bindAdminSections:bindAdminSections };
})(window);
