import { safeJsonParse } from './utils.mjs';

const PREFIX = 'txt-reader.rebuild.';

export function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw == null ? fallback : safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function saveLocal(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key) {
  try { localStorage.removeItem(PREFIX + key); } catch {}
}

export function loadLegacy(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}
