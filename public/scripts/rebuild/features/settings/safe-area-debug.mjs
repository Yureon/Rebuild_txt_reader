import {
  findSafeProfileById,
  getSafeViewportContext,
  normalizeSafeViewportProfiles
} from './safe-area-profiles.mjs';
import { buildSafeViewportDebugText } from './safe-area-debug-formatters.mjs';

export function renderSafeViewportDebug(app) {
  if (!app.els.safeViewportDebug) return;
  const text = formatSafeViewportDebug(app);
  app.els.safeViewportDebug.textContent = text;
}


export async function copySafeViewportDebug(app) {
  const text = formatSafeViewportDebug(app);
  try {
    await navigator.clipboard?.writeText(text);
  } catch {
    window.prompt('Viewport 디버그 값 복사', text);
  }
}

export function formatSafeViewportDebug(app) {
  const metrics = app.state?.viewportFit || app.viewportFit?.measure?.() || {};
  const context = getSafeViewportContext(app);
  const p = app.state?.prefs || {};
  const selected = findSafeProfileById(p, p.safeViewportProfileId);
  const matchingProfileCount = normalizeSafeViewportProfiles(p.safeViewportProfiles || []).filter(profile => profile.contextKey === context.key).length;
  return buildSafeViewportDebugText({ metrics, context, selected, matchingProfileCount, windowLike: window });
}
