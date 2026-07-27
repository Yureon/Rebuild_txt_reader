import { THEME_PRESETS } from './theme-presets.mjs';

export const SETTINGS_THEME_COLOR_UTILS_PASS = 'v213-settings-theme-color-utils-pass';

export const THEME_COLOR_KEYS = ['bg','surface','text','accent','readerBg','readerText'];
export const THEME_COLOR_INPUTS = {
  bg: 'themeColorBg',
  surface: 'themeColorSurface',
  text: 'themeColorText',
  accent: 'themeColorAccent',
  readerBg: 'themeColorReaderBg',
  readerText: 'themeColorReaderText'
};
export const DEFAULT_COLORS = THEME_PRESETS[0]?.colors || { bg:'#f0ece4', surface:'#fffaf4', text:'#1f1b17', accent:'#6f6258', readerBg:'#fbf7f0', readerText:'#26211d' };

export function safeThemeColor(value, fallback) {
  const text = String(value || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text;
  if (/^#[0-9a-fA-F]{3}$/.test(text)) return '#' + text.slice(1).split('').map(ch => ch + ch).join('');
  return fallback;
}

export function normalizeThemeColors(input = null) {
  if (!input || typeof input !== 'object') return { ...DEFAULT_COLORS };
  const out = {};
  THEME_COLOR_KEYS.forEach(key => { out[key] = safeThemeColor(input[key], DEFAULT_COLORS[key]); });
  return out;
}

export function normalizeCustomThemes(input = []) {
  const list = Array.isArray(input) ? input : [];
  const out = [];
  const seen = new Set();
  list.slice(0, 24).forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `custom-theme-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
    if (!id || seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name: String(item.name || '').trim().slice(0, 40) || '이름 없는 테마',
      colors: normalizeThemeColors(item.colors || item.themeColors || item),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out;
}

export function colorsEqual(a, b) {
  const left = normalizeThemeColors(a);
  const right = normalizeThemeColors(b);
  return THEME_COLOR_KEYS.every(key => String(left[key]).toLowerCase() === String(right[key]).toLowerCase());
}
