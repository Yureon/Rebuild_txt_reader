export const SETTINGS_THEME_FILE_UTILS_PASS = 'v214-settings-theme-file-utils-pass';

export function sanitizeThemeFileSlug(name, fallback = 'theme') {
  return String(name || '').trim().replace(/[^a-zA-Z0-9가-힣_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || fallback;
}

export function sanitizeThemeId(value, fallback = '') {
  return String(value || fallback || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

export function buildThemeExportPayload({ id = 'custom-current', name = 'txt-reader-theme', colors = {}, exportedAt = new Date().toISOString() } = {}) {
  return {
    type: 'txt-reader-theme',
    version: 1,
    exportedAt,
    theme: {
      id: id || 'custom-current',
      name: String(name || 'txt-reader-theme').trim() || 'txt-reader-theme',
      colors: { ...(colors || {}) }
    }
  };
}

export function buildThemeExportFilename(name = 'txt-reader-theme') {
  return `txt-reader-theme-${sanitizeThemeFileSlug(name, 'theme')}.json`;
}

export function buildImportedThemeRecord({ raw = {}, fileName = '', colors = {}, existingThemes = [], now = () => Date.now() } = {}) {
  const timestamp = now();
  const fileBase = String(fileName || '').replace(/\.json$/i, '') || '가져온 테마';
  const name = String(raw.name || fileBase || '가져온 테마').trim().slice(0, 40) || '가져온 테마';
  const fallbackId = `custom-theme-${timestamp.toString(36)}`;
  const id = sanitizeThemeId(raw.id, fallbackId) || fallbackId;
  const uniqueId = Array.isArray(existingThemes) && existingThemes.some(theme => theme && theme.id === id)
    ? `${id}-${timestamp.toString(36).slice(-4)}`
    : id;
  return { id: uniqueId, name, colors: { ...(colors || {}) }, updatedAt: timestamp };
}
