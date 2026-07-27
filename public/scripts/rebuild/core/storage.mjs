import { safeJsonParse } from './utils.mjs';

const PREFIX = 'txt-reader.rebuild.';
const SCOPED_PREFIX = `${PREFIX}scope.`;
const MIGRATION_MARKER_PREFIX = `${PREFIX}scopeMigration.v613.`;
let activeScope = 'anonymous';

function normalizeScope(value) {
  const text = String(value || 'anonymous').trim().normalize('NFC');
  const cleaned = text.replace(/[^a-zA-Z0-9._@-]/g, '_').slice(0, 160);
  return cleaned || 'anonymous';
}

export function setStorageScope(userId) {
  activeScope = normalizeScope(userId);
  return activeScope;
}

export function getStorageScope() {
  return activeScope;
}

export function getScopedStorageKey(key, scope = activeScope) {
  return `${SCOPED_PREFIX}${normalizeScope(scope)}.${String(key || '')}`;
}

export function loadLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(getScopedStorageKey(key));
    return raw == null ? fallback : safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function saveLocal(key, value) {
  try {
    localStorage.setItem(getScopedStorageKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function saveLocalSerialized(key, serializedValue) {
  try {
    localStorage.setItem(getScopedStorageKey(key), String(serializedValue));
    return true;
  } catch {
    return false;
  }
}

export function removeLocal(key) {
  try { localStorage.removeItem(getScopedStorageKey(key)); } catch {}
}

export function loadLegacy(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? fallback : safeJsonParse(raw, fallback);
  } catch {
    return fallback;
  }
}

export function purgeUnscopedUserStorage(userId) {
  const scope = normalizeScope(userId);
  if (scope === 'anonymous') return { removed:0, skipped:true, scope };
  const marker = `${MIGRATION_MARKER_PREFIX}${scope}`;
  try {
    if (localStorage.getItem(marker) === '1') return { removed:0, skipped:true, scope };
    const preserve = new Set([
      `${PREFIX}deviceId`,
      `${PREFIX}deviceName`,
      marker
    ]);
    const removals = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(PREFIX) || key.startsWith(SCOPED_PREFIX) || preserve.has(key) || key.startsWith(MIGRATION_MARKER_PREFIX)) continue;
      removals.push(key);
    }
    removals.forEach(key => localStorage.removeItem(key));
    localStorage.setItem(marker, '1');
    return { removed:removals.length, skipped:false, scope };
  } catch (error) {
    return { removed:0, skipped:false, scope, error:error?.message || String(error) };
  }
}

export function clearCurrentStorageScope({ preservePrefs = false } = {}) {
  const prefix = `${SCOPED_PREFIX}${normalizeScope(activeScope)}.`;
  const removed = [];
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      if (preservePrefs && key === `${prefix}prefs`) continue;
      removed.push(key);
    }
    removed.forEach(key => localStorage.removeItem(key));
  } catch {}
  return removed.length;
}
