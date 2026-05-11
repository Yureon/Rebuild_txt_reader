import { clamp } from '../../core/utils.mjs';
import {
  SAFE_BOTTOM_MAX,
  SAFE_BOTTOM_MIN,
  SAFE_PROFILE_LIMIT,
  SAFE_TOP_MAX,
  SAFE_TOP_MIN
} from './safe-area-constants.mjs';
import { buildSafeViewportContextLabels } from './safe-area-context-labels.mjs';

export const SAFE_AREA_CONTEXT_SPLIT_PASS = 'v194-safe-area-context-split-pass';

export function normalizeSafeViewportProfiles(input = []) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  input.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id || `safe-profile-${index + 1}`).trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
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
      safeTopInsetExtra: clamp(item.safeTopInsetExtra == null ? 0 : item.safeTopInsetExtra, SAFE_TOP_MIN, SAFE_TOP_MAX),
      safeBottomInsetExtra: clamp(item.safeBottomInsetExtra == null ? 0 : item.safeBottomInsetExtra, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  return out.slice(0, SAFE_PROFILE_LIMIT);
}

export function getEffectiveSafeViewportPrefs(app, p) {
  const prefs = p || {};
  const profiles = normalizeSafeViewportProfiles(prefs.safeViewportProfiles || []);
  const context = getSafeViewportContext(app);
  const selectedId = String(prefs.safeViewportProfileId || '');
  const selected = profiles.find(profile => profile.id === selectedId && profile.contextKey === context.key);
  const activeId = String(app.state?.viewportFit?.activeSafeProfileId || '');
  const active = profiles.find(profile => profile.id === activeId && profile.contextKey === context.key);
  const match = selected || active || profiles.find(profile => profile.contextKey === context.key);
  if (!match) return prefs;
  return {
    ...prefs,
    safeViewportAutoFit: !!match.safeViewportAutoFit,
    safeTopInsetExtra: match.safeTopInsetExtra,
    safeBottomInsetExtra: match.safeBottomInsetExtra
  };
}

export function findSafeProfileById(prefs, id) {
  return normalizeSafeViewportProfiles(prefs?.safeViewportProfiles || []).find(profile => profile.id === id) || null;
}

export function getSafeViewportContext(app) {
  const metrics = app.state?.viewportFit || app.viewportFit?.measure?.() || {};
  const uaKey = getBrowserKey();
  const displayMode = metrics.isBrowserFullscreen ? 'browser-fullscreen' : (metrics.displayMode || 'browser');
  const labels = buildSafeViewportContextLabels({ displayMode, uaKey, metrics });
  return {
    key: `${uaKey}|${displayMode}|${metrics.isMobile ? 'mobile' : 'desktop'}`,
    label: labels.label,
    defaultName: labels.defaultName,
    uaKey,
    displayMode,
    isBrowserFullscreen: !!metrics.isBrowserFullscreen,
    isStandalone: !!metrics.isStandalone
  };
}

export function getBrowserKey() {
  const ua = String(navigator.userAgent || '').toLowerCase();
  if (ua.includes('samsungbrowser')) return 'Samsung Internet';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Firefox';
  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('crios')) return 'Chrome iOS';
  if (ua.includes('chrome') || ua.includes('chromium')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return 'Browser';
}
