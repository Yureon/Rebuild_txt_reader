const { ensurePlainObject } = require('./state-normalizer-core');

/**
 * CSS 인젝션 방어: </style> 시퀀스를 무력화합니다.
 * styleEl.textContent로 삽입해도 서버 저장본이 오염되지 않도록 양쪽에서 처리합니다.
 */
function sanitizeCustomCss(value) {
  return String(value || '').replace(/<\/style/gi, '< /style');
}

function sanitizeFontFamilyValue(value, fallback) {
  const raw = String(value == null ? '' : value).trim().slice(0, 160);
  if (!raw) return typeof fallback === 'undefined' ? '' : fallback;
  if (/^var\(--font-[a-z0-9_-]+\)$/i.test(raw)) return raw;
  if (/^['"][^\n\r'"]{1,140}['"]$/.test(raw)) return raw;
  if (/^[a-zA-Z0-9가-힣 _.,()\-]{1,140}$/.test(raw)) return JSON.stringify(raw);
  return typeof fallback === 'undefined' ? '' : fallback;
}

const CSS_COLOR_RE = /^(#[0-9a-fA-F]{3,8}|rgba?\([^\n\r]+\)|hsla?\([^\n\r]+\)|[a-zA-Z]{3,30})$/;
const MAX_CUSTOM_CSS_CHARS = 80 * 1024;
const ALLOWED_VIEWER_PREF_KEYS = new Set([
  'theme','themeMode','safeClockShow','safeClockPos','safeProgressShow','safeProgressPos','safeNetworkPos','safeRemainingShow','safeViewportAutoFit','safeTopInsetExtra','safeBottomInsetExtra','safeViewportProfileId','safeViewportProfiles',
  'showClock','showProgress','showNetwork','clockHour12','clockAmPm','lineWidth','fontSize','readerFontSize','lineHeight','width','brightness','uiFontSize',
  'readerBg','readerText','animationsMs','animStrength','rdPadH','rdPadV','padH','padV','fontType','fontFamily','fontFamilyShared','tapNavEnabled',
  'tapDirection','tapScrollPercent','tapAnim','tapSpeed','swipeNav','swipeThreshold','libraryDndHoverOpenDelay','timezone','timezoneOffset',
  'serverCommNotify','serverCommNotifyInterval','themePresetId','themeColors','themeCustomThemes','customCssShared','shortcuts','preprocess','preprocessPresetId','preprocessPresetApplyKeys','preprocessPresets','siteLanguage','siteCustomLanguages'
]);
const ALLOWED_DEVICE_PREF_KEYS = new Set([
  'settingsMainTab','viewerSubTab','funcSubTab','searchByFilename','customCssDevice','fontFamilyDevice'
]);


const THEME_COLOR_KEYS = ['bg','surface','text','accent','readerBg','readerText'];
const DEFAULT_THEME_COLORS = { bg:'#f0ece4', surface:'#fffaf4', text:'#1f1b17', accent:'#6f6258', readerBg:'#fbf7f0', readerText:'#26211d' };

function normalizeThemeColorValue(value, fallback) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  if (/^#[0-9a-fA-F]{3}$/.test(text)) return '#' + text.slice(1).split('').map((ch) => ch + ch).join('');
  return fallback;
}

function normalizeThemeColors(input) {
  if (!ensurePlainObject(input)) return null;
  const out = {};
  THEME_COLOR_KEYS.forEach((key) => { out[key] = normalizeThemeColorValue(input[key], DEFAULT_THEME_COLORS[key]); });
  return out;
}

function normalizeCustomThemes(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  input.slice(0, 24).forEach((item, index) => {
    if (!ensurePlainObject(item)) return;
    const id = String(item.id || ('custom-theme-' + (index + 1))).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!id || seen.has(id)) return;
    const colors = normalizeThemeColors(item.colors || item.themeColors || item);
    if (!colors) return;
    seen.add(id);
    out.push({
      id,
      name: String(item.name || '').trim().slice(0, 40) || '이름 없는 테마',
      colors,
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out;
}

const PREPROCESS_KEYS = ['removeNoise','chapterSpacing','collapseBreaks','splitDense','dialogueBreak','paragraphOptimize','aggressive'];

function normalizePreprocessOptions(input) {
  if (!ensurePlainObject(input)) input = {};
  const out = {};
  PREPROCESS_KEYS.forEach((key) => { out[key] = !!input[key]; });
  return out;
}

function normalizePreprocessApplyKeys(input) {
  if (!ensurePlainObject(input)) input = {};
  const out = {};
  PREPROCESS_KEYS.forEach((key) => {
    out[key] = Object.prototype.hasOwnProperty.call(input, key) ? !!input[key] : true;
  });
  if (!PREPROCESS_KEYS.some((key) => out[key])) out.chapterSpacing = true;
  return out;
}

function normalizePreprocessPresets(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  input.slice(0, 24).forEach((item, index) => {
    if (!ensurePlainObject(item)) return;
    const rawId = String(item.id || ('preset-custom-' + (index + 1))).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!rawId || seen.has(rawId)) return;
    seen.add(rawId);
    const name = String(item.name || '').trim().slice(0, 40) || '이름 없는 프리셋';
    out.push({
      id: rawId,
      name,
      builtIn: !!item.builtIn,
      options: normalizePreprocessOptions(item.options || item.preprocess || {}),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out;
}

function normalizeSafeViewportProfiles(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  input.slice(0, 16).forEach((item, index) => {
    if (!ensurePlainObject(item)) return;
    const id = String(item.id || ('safe-profile-' + (index + 1))).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: String(item.name || '').trim().slice(0, 40) || '이름 없는 보정값',
      contextKey: String(item.contextKey || '').trim().slice(0, 180),
      contextLabel: String(item.contextLabel || '').trim().slice(0, 120),
      uaKey: String(item.uaKey || '').trim().slice(0, 80),
      displayMode: String(item.displayMode || '').trim().slice(0, 40),
      isBrowserFullscreen: !!item.isBrowserFullscreen,
      isStandalone: !!item.isStandalone,
      safeViewportAutoFit: !!item.safeViewportAutoFit,
      safeTopInsetExtra: Math.max(-12, Math.min(180, Math.round(Number(item.safeTopInsetExtra) || 0))),
      safeBottomInsetExtra: Math.max(-12, Math.min(240, Math.round(Number(item.safeBottomInsetExtra) || 0))),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out;
}


function normalizeSiteLanguageValue(value) {
  const raw = String(value || 'auto').trim().toLowerCase();
  if (raw === 'system' || raw === 'browser') return 'auto';
  if (raw === 'ko' || raw === 'kr' || raw === 'korean') return 'ko';
  if (raw === 'en' || raw === 'english') return 'en';
  const custom = raw.match(/^(custom|site):([a-z0-9_-]{1,32})$/);
  if (custom) return `${custom[1]}:${custom[2]}`;
  return 'auto';
}

function normalizeSiteLanguageMap(input) {
  const out = {};
  if (!ensurePlainObject(input)) return out;
  Object.keys(input).slice(0, 600).forEach((rawKey) => {
    const key = String(rawKey || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    const value = String(input[rawKey] == null ? '' : input[rawKey]).trim().replace(/\r\n/g, '\n').slice(0, 800);
    if (key && value) out[key] = value;
  });
  return out;
}

function normalizeSiteCustomLanguages(input) {
  if (!Array.isArray(input)) return [];
  const out = [];
  const seen = new Set();
  input.slice(0, 12).forEach((item, index) => {
    if (!ensurePlainObject(item)) return;
    const id = String(item.id || item.code || ('custom-' + (index + 1))).trim().toLowerCase().replace(/^custom:/, '').replace(/^site:/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);
    if (!id || seen.has(id)) return;
    const map = normalizeSiteLanguageMap(item.map || item.translations || item.entries || {});
    if (!Object.keys(map).length) return;
    seen.add(id);
    out.push({
      id,
      name: String(item.name || item.label || id).trim().slice(0, 40) || id,
      map,
      updatedAt: Math.max(0, Number(item.updatedAt) || Date.now())
    });
  });
  return out;
}

function normalizeDevicePrefs(input) {
  if (!ensurePlainObject(input)) return {};
  const out = {};
  Object.keys(input).forEach((key) => {
    if (!ALLOWED_DEVICE_PREF_KEYS.has(key)) return;
    const value = input[key];
    if (key === 'searchByFilename') {
      out[key] = !!value;
      return;
    }
    if (key === 'customCssDevice') {
      out[key] = sanitizeCustomCss(String(value || '').slice(0, MAX_CUSTOM_CSS_CHARS));
      return;
    }
    if (key === 'fontFamilyDevice') {
      const fontValue = sanitizeFontFamilyValue(value, '');
      out[key] = fontValue;
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, 80);
      if (trimmed) out[key] = trimmed;
    }
  });
  return out;
}

function normalizeViewerPrefs(input) {
  if (!ensurePlainObject(input)) return {};
  const out = {};
  Object.keys(input).forEach((key) => {
    if (!ALLOWED_VIEWER_PREF_KEYS.has(key)) return;
    const value = input[key];
    if (key === 'customCssShared') {
      out[key] = sanitizeCustomCss(String(value || '').slice(0, MAX_CUSTOM_CSS_CHARS));
      return;
    }
    if (key === 'fontFamily' || key === 'fontFamilyShared') {
      const fontValue = sanitizeFontFamilyValue(value, '');
      if (fontValue) out[key] = fontValue;
      return;
    }
    if (key === 'shortcuts') {
      out[key] = normalizeShortcutPrefs(value);
      return;
    }
    if (key === 'themeColors') {
      const colors = normalizeThemeColors(value);
      if (colors) out[key] = colors;
      return;
    }
    if (key === 'themeCustomThemes') {
      out[key] = normalizeCustomThemes(value);
      return;
    }
    if (key === 'preprocess') {
      out[key] = normalizePreprocessOptions(value);
      return;
    }
    if (key === 'preprocessPresetApplyKeys') {
      out[key] = normalizePreprocessApplyKeys(value);
      return;
    }
    if (key === 'preprocessPresets') {
      out[key] = normalizePreprocessPresets(value);
      return;
    }
    if (key === 'safeViewportProfiles') {
      out[key] = normalizeSafeViewportProfiles(value);
      return;
    }
    if (key === 'siteLanguage') {
      out[key] = normalizeSiteLanguageValue(value);
      return;
    }
    if (key === 'siteCustomLanguages') {
      out[key] = normalizeSiteCustomLanguages(value);
      return;
    }
    if (key === 'safeViewportProfileId') {
      const profileId = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
      if (profileId) out[key] = profileId;
      return;
    }
    if (key === 'preprocessPresetId') {
      const presetId = String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
      if (presetId) out[key] = presetId;
      return;
    }
    if (typeof value === 'boolean') {
      out[key] = value;
      return;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      out[key] = value;
      return;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, 120);
      if (!trimmed) return;
      if ((key === 'readerBg' || key === 'readerText') && !CSS_COLOR_RE.test(trimmed)) return;
      out[key] = trimmed;
    }
  });
  return out;
}


function normalizeShortcutPrefs(input) {
  if (!ensurePlainObject(input)) return {};
  const allowed = new Set([
    'searchOpen','searchNext','searchPrev','readerNext','readerPrev','readerPageNext','readerPagePrev','fullscreen','bookmarksOpen','settingsOpen','themeToggle'
  ]);
  const out = {};
  Object.keys(input).forEach((key) => {
    if (!allowed.has(key)) return;
    const text = String(input[key] == null ? '' : input[key]).trim().slice(0, 40);
    if (!text) out[key] = '';
    else if (/^[a-zA-Z0-9 ,./;='\[\]\\`~-]+$/.test(text) || /^(Ctrl|Alt|Shift|Meta|Arrow|Page|Home|End|Escape|F\d)/i.test(text)) out[key] = text;
  });
  return out;
}

function sanitizeThemeBucket(input) {
  if (!ensurePlainObject(input)) return { activeThemeId: 'default', themes: {} };
  const activeThemeId = String(input.activeThemeId || 'default').trim().slice(0, 80) || 'default';
  const themes = {};
  if (ensurePlainObject(input.themes)) {
    Object.keys(input.themes).slice(0, 20).forEach((themeId) => {
      const themeObj = input.themes[themeId];
      if (!ensurePlainObject(themeObj)) return;
      const safeVars = {};
      Object.keys(themeObj).slice(0, 64).forEach((varKey) => {
        const key = String(varKey || '').trim();
        const value = String(themeObj[varKey] || '').trim();
        if (!/^--[a-zA-Z0-9_-]{1,64}$/.test(key)) return;
        if (!value || value.length > 120) return;
        safeVars[key] = value;
      });
      themes[String(themeId).trim().slice(0, 80) || 'default'] = safeVars;
    });
  }
  return { activeThemeId, themes };
}

module.exports = {
  normalizeDevicePrefs,
  normalizeViewerPrefs,
  sanitizeThemeBucket
};
