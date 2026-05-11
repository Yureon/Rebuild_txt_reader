const DEFAULT_FONT_FAMILY = 'var(--font-rd)';
const MAX_FONT_VALUE_LENGTH = 160;

const BUILTIN_FONT_STYLESHEETS = {
  'var(--font-rd)': '',
  'var(--font-ui)': '',
  'var(--font-noto-sans)': 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700&display=swap',
  'var(--font-nanum-m)': 'https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap',
  'var(--font-nanum-g)': 'https://fonts.googleapis.com/css2?family=Nanum+Gothic:wght@400;700&display=swap',
  'var(--font-nanum-bg)': 'https://fonts.googleapis.com/css2?family=Nanum+Barun+Gothic:wght@400;700&display=swap',
  'var(--font-ibm)': 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;700&display=swap',
  'var(--font-coding)': 'https://fonts.googleapis.com/css2?family=Nanum+Gothic+Coding:wght@400;700&display=swap'
};

const BUILTIN_FONT_ALIAS = new Map([
  ['Noto Serif KR', 'var(--font-rd)'], ['Noto 명조', 'var(--font-rd)'], ['serif', 'var(--font-rd)'],
  ['Pretendard', 'var(--font-ui)'], ['sans', 'var(--font-ui)'],
  ['Noto Sans KR', 'var(--font-noto-sans)'], ['Noto 고딕', 'var(--font-noto-sans)'], ['noto-sans', 'var(--font-noto-sans)'],
  ['Nanum Myeongjo', 'var(--font-nanum-m)'], ['나눔명조', 'var(--font-nanum-m)'], ['nanum-m', 'var(--font-nanum-m)'],
  ['Nanum Gothic', 'var(--font-nanum-g)'], ['나눔고딕', 'var(--font-nanum-g)'], ['nanum-g', 'var(--font-nanum-g)'],
  ['Nanum Barun Gothic', 'var(--font-nanum-bg)'], ['나눔바른고딕', 'var(--font-nanum-bg)'], ['nanum-bg', 'var(--font-nanum-bg)'],
  ['IBM Plex Sans KR', 'var(--font-ibm)'], ['IBM Plex', 'var(--font-ibm)'], ['ibm', 'var(--font-ibm)'],
  ['Nanum Gothic Coding', 'var(--font-coding)'], ['나눔코딩', 'var(--font-coding)'], ['coding', 'var(--font-coding)']
]);

const BUILTIN_FONT_LABELS = new Map([
  ['var(--font-rd)', 'Noto Serif KR'],
  ['var(--font-noto-sans)', 'Noto Sans KR'],
  ['var(--font-ui)', 'Pretendard'],
  ['var(--font-nanum-m)', 'Nanum Myeongjo'],
  ['var(--font-nanum-g)', 'Nanum Gothic'],
  ['var(--font-nanum-bg)', 'Nanum Barun Gothic'],
  ['var(--font-ibm)', 'IBM Plex Sans KR'],
  ['var(--font-coding)', 'Nanum Gothic Coding']
]);

export const BUILTIN_FONT_CHOICES = [
  ['Noto Serif KR', 'var(--font-rd)'], ['Noto Sans KR', 'var(--font-noto-sans)'], ['Pretendard', 'var(--font-ui)'],
  ['Nanum Myeongjo', 'var(--font-nanum-m)'], ['Nanum Gothic', 'var(--font-nanum-g)'], ['Nanum Barun Gothic', 'var(--font-nanum-bg)'],
  ['IBM Plex Sans KR', 'var(--font-ibm)'], ['Nanum Gothic Coding', 'var(--font-coding)']
];

export function normalizeFontFamilyValue(value, fallback = '') {
  const raw = String(value == null ? '' : value).trim().slice(0, MAX_FONT_VALUE_LENGTH);
  if (!raw) return fallback;
  const unquoted = raw.replace(/^['"]|['"]$/g, '').trim();
  const alias = BUILTIN_FONT_ALIAS.get(unquoted) || BUILTIN_FONT_ALIAS.get(raw);
  if (alias) return alias;
  if (/^var\(--font-[a-z0-9_-]+\)$/i.test(raw)) return raw;
  if (/^['"][^\n\r'"]{1,140}['"]$/.test(raw)) return raw;
  if (/^[a-zA-Z0-9가-힣 _.,()\-]{1,140}$/.test(raw)) return JSON.stringify(raw);
  return fallback;
}

export function makeCustomFontFamilyValue(family) {
  const safe = String(family || '').trim().slice(0, 120) || 'Custom Font';
  return JSON.stringify(safe);
}

export function resolveSharedFontFamily(prefs = {}) {
  return normalizeFontFamilyValue(prefs.fontFamilyShared || prefs.fontFamily, DEFAULT_FONT_FAMILY);
}

export function resolveDeviceFontFamily(prefs = {}) {
  return normalizeFontFamilyValue(prefs.fontFamilyDevice, '');
}

export function resolveActiveFontFamily(prefs = {}) {
  return resolveDeviceFontFamily(prefs) || resolveSharedFontFamily(prefs);
}

export function isDeviceFontOverrideActive(prefs = {}) {
  return !!resolveDeviceFontFamily(prefs);
}

export function ensureFontStylesheetForFamily(value) {
  const normalized = normalizeFontFamilyValue(value, String(value || ''));
  const raw = String(normalized || '').replace(/^['"]|['"]$/g, '');
  const key = BUILTIN_FONT_ALIAS.get(raw) || normalized;
  const href = BUILTIN_FONT_STYLESHEETS[key];
  if (!href) return;
  const id = `builtin-font-${key.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

export function displayFontName(value) {
  const normalized = normalizeFontFamilyValue(value, String(value || ''));
  if (!normalized) return '기본 글꼴';
  if (BUILTIN_FONT_LABELS.has(normalized)) return BUILTIN_FONT_LABELS.get(normalized);
  return String(normalized)
    .replace(/^var\(--font-/, '')
    .replace(/\)$/, '')
    .replace(/^['"]|['"]$/g, '') || '기본 글꼴';
}
