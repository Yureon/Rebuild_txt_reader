(function themeBoot() {
  'use strict';
  var PREFIX = 'txt-reader.rebuild.';
  var ACTIVE_THEME_SCOPE_KEY = PREFIX + 'activeThemeScope';
  var SCOPED_PREFIX = PREFIX + 'scope.';
  var OWNER_SCOPE = 'owner';
  var PRESETS = {
    paper:{bg:'#f1ece3',surface:'#fffaf2',text:'#201a15',accent:'#7a4f2d',readerBg:'#fbf6ed',readerText:'#2a2118'},
    graphite:{bg:'#17191d',surface:'#22252b',text:'#ebe3d9',accent:'#dca05d',readerBg:'#15171a',readerText:'#e1d9ce'},
    'olive-gray':{bg:'#e8e7df',surface:'#f7f6ef',text:'#20211d',accent:'#6b705c',readerBg:'#f4f3ea',readerText:'#24251f'},
    stone:{bg:'#e9e5dc',surface:'#f8f5ef',text:'#211f1b',accent:'#7a6654',readerBg:'#f4f1ea',readerText:'#25221e'},
    charcoal:{bg:'#121416',surface:'#1d2023',text:'#eee8df',accent:'#d99552',readerBg:'#0f1113',readerText:'#ded8cf'},
    'moss-dark':{bg:'#151a16',surface:'#20261f',text:'#e5e2d8',accent:'#d29a5d',readerBg:'#121612',readerText:'#dad7cc'},
    'sepia-dark':{bg:'#1d1712',surface:'#261f18',text:'#eadfce',accent:'#d69a58',readerBg:'#17120e',readerText:'#dfd2bf'},
    'blue-gray':{bg:'#e8edf0',surface:'#f7fafb',text:'#1d2225',accent:'#587182',readerBg:'#f3f6f7',readerText:'#20272b'}
  };
  var OWNER_THEME = {
    bg:'#0d0d0d',surface:'#171717',text:'#ece7df',accent:'#4ade80',readerBg:'#111111',readerText:'#ece7df'
  };
  var LEGACY_PRESETS = {
    graphite:{bg:'#1a1b1e',surface:'#212227',text:'#e8e0d8',accent:'#e0a060',readerBg:'#18191c',readerText:'#e0d8cc'},
    charcoal:{bg:'#141516',surface:'#1e1f20',text:'#eee8df',accent:'#d99552',readerBg:'#101112',readerText:'#ded8cf'},
    'moss-dark':{bg:'#181c17',surface:'#20241d',text:'#e4e2d8',accent:'#d59a5a',readerBg:'#141811',readerText:'#d9d7cc'}
  };
  function normalizeScope(value) {
    var text = String(value || '').trim().normalize ? String(value || '').trim().normalize('NFC') : String(value || '').trim();
    var cleaned = text.replace(/[^a-zA-Z0-9._@-]/g, '_').slice(0, 160);
    return cleaned || '';
  }
  function readJson(key) {
    try {
      var raw = localStorage.getItem(key);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) { return {}; }
  }
  function readThemeContext() {
    var scope = '';
    try { scope = String(localStorage.getItem(ACTIVE_THEME_SCOPE_KEY) || '').trim(); } catch (_) {}
    if (scope === OWNER_SCOPE) {
      return { scope:OWNER_SCOPE, prefs:{ themeMode:'dark', themePresetId:'owner-console', themeColors:OWNER_THEME, readerBg:OWNER_THEME.readerBg, readerText:OWNER_THEME.readerText } };
    }
    var normalized = normalizeScope(scope);
    if (normalized) return { scope:normalized, prefs:readJson(SCOPED_PREFIX + normalized + '.prefs') };
    return { scope:'', prefs:{} };
  }
  function migrateLegacyPreset(presetId, colors) {
    var legacy = LEGACY_PRESETS[presetId];
    var current = PRESETS[presetId];
    if (!legacy || !current || !colors || typeof colors !== 'object') return colors;
    var keys = ['bg','surface','text','accent','readerBg','readerText'];
    var exact = keys.every(function (key) { return String(colors[key] || '').toLowerCase() === legacy[key].toLowerCase(); });
    return exact ? current : colors;
  }
  function validColor(value) { return /^#[0-9a-f]{6}$/i.test(String(value || '').trim()); }
  function setVar(style, name, value) { if (validColor(value)) style.setProperty(name, String(value).trim()); }
  function mixVariables(style, colors) {
    var bg = colors.bg, surface = colors.surface, text = colors.text, accent = colors.accent;
    setVar(style,'--bg',bg); setVar(style,'--surface',surface); setVar(style,'--text',text); setVar(style,'--accent',accent);
    setVar(style,'--reader-bg',colors.readerBg); setVar(style,'--reader-text',colors.readerText);
    if (validColor(bg) && validColor(text)) {
      style.setProperty('--bg2','color-mix(in srgb, '+bg+' 90%, '+text+' 10%)');
      style.setProperty('--bg3','color-mix(in srgb, '+bg+' 80%, '+text+' 20%)');
      style.setProperty('--text2','color-mix(in srgb, '+text+' 74%, '+bg+' 26%)');
      style.setProperty('--text3','color-mix(in srgb, '+text+' 50%, '+bg+' 50%)');
      style.setProperty('--border','color-mix(in srgb, '+text+' 15%, transparent)');
    }
    if (validColor(accent)) style.setProperty('--accent2','color-mix(in srgb, '+accent+' 76%, #fff 24%)');
    if (validColor(surface) && validColor(accent)) style.setProperty('--cat-bg','color-mix(in srgb, '+surface+' 80%, '+accent+' 20%)');
    if (validColor(text) && validColor(accent)) style.setProperty('--cat-text','color-mix(in srgb, '+text+' 84%, '+accent+' 16%)');
  }
  var context = readThemeContext();
  var prefs = context.prefs || {};
  var systemDark = false;
  try { systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches; } catch (_) {}
  var owner = context.scope === OWNER_SCOPE;
  var dark = owner || prefs.themeMode === 'dark' || (prefs.themeMode == null && systemDark);
  var presetId = String(prefs.themePresetId || '');
  var colors = owner
    ? OWNER_THEME
    : prefs.themeColors && typeof prefs.themeColors === 'object'
      ? migrateLegacyPreset(presetId, prefs.themeColors)
      : PRESETS[presetId] || (dark ? PRESETS.graphite : PRESETS.paper);
  var root = document.documentElement;
  root.dataset.theme = dark ? 'dark' : 'light';
  root.dataset.themeScope = context.scope || 'default';
  root.style.colorScheme = dark ? 'dark' : 'light';
  mixVariables(root.style, colors || {});
  var background = validColor(colors && colors.bg) ? colors.bg : (dark ? '#17191d' : '#f1ece3');
  root.style.backgroundColor = background;
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', background);
  window.__TXT_READER_BOOT_THEME__ = { dark:dark, colors:colors || {}, scope:context.scope || '', owner:owner, pass:'v680-user-scoped-theme-first-paint-pass' };
  function applyBodyTheme() {
    if (!document.body) return false;
    document.body.dataset.theme = dark ? 'dark' : 'light';
    document.body.dataset.themeScope = context.scope || 'default';
    document.body.classList.toggle('light', !dark);
    document.body.style.backgroundColor = background;
    mixVariables(document.body.style, colors || {});
    return true;
  }
  if (!applyBodyTheme() && typeof MutationObserver === 'function') {
    var observer = new MutationObserver(function () {
      if (applyBodyTheme()) observer.disconnect();
    });
    observer.observe(root, { childList:true, subtree:true });
  }
  document.addEventListener('DOMContentLoaded', applyBodyTheme, { once:true });
}());
