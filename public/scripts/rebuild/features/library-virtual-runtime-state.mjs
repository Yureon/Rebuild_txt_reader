import { removeLocal, saveLocal } from '../core/storage.mjs';
import { classifyLibraryVirtualFailure } from './library-virtual-fallback-policy.mjs';

export const LIBRARY_VIRTUAL_RUNTIME_STATE_PASS = 'v282-library-virtual-runtime-state-pass';
const LIBRARY_VIRTUAL_AUTO_FALLBACK_RUNTIME_VERSION = 'rebuild-v161';

export function normalizeLibraryVirtualAutoFallbackForRuntime(record = {}, options = {}) {
  const error = record?.error || null;
  const category = record?.category || classifyLibraryVirtualFailure(record?.reason || '', record?.gate || null, error);
  return {
    active: true,
    reason: String(record?.reason || 'blocking-fallback').slice(0, 160),
    category,
    source: String(record?.source || 'library-virtual-render').slice(0, 120),
    message: String(error?.message || record?.message || record?.gate?.reason || '').slice(0, 240),
    stack: String(error?.stack || record?.stack || '').slice(0, 2000),
    at: record?.at || Date.now(),
    version: String(options.runtimeVersion || LIBRARY_VIRTUAL_AUTO_FALLBACK_RUNTIME_VERSION),
    mode: 'auto-full-fallback',
    pass: String(options.defaultRolloutPass || ''),
    window: record?.window || record?.gate?.window || null,
    gateReason: record?.gate?.reason || ''
  };
}

export function isLibraryVirtualAutoFallbackActive(app) {
  return !!app?.state?.libraryVirtualAutoFallback?.active;
}

export function isLibraryVirtualSessionOptInActive(app) {
  return !!app?.state?.libraryVirtualSessionOptIn?.active;
}

export function isLibraryVirtualTrialActive(app) {
  return !!app?.state?.libraryVirtualTrial?.active;
}

export function isLibraryVirtualDefaultRolloutEnabled(app) {
  return app?.state?.defaults?.libraryVirtualRenderer === true && !isLibraryVirtualAutoFallbackActive(app);
}

export function isLibraryVirtualRendererRequested(app) {
  return isLibraryVirtualDefaultRolloutEnabled(app)
    || !!app?.state?.prefs?.libraryVirtualRenderer
    || isLibraryVirtualTrialActive(app)
    || isLibraryVirtualSessionOptInActive(app);
}

export function isLibraryVirtualRendererEnabled(app) {
  if (isLibraryVirtualAutoFallbackActive(app)) return false;
  return isLibraryVirtualDefaultRolloutEnabled(app)
    || !!app?.state?.prefs?.libraryVirtualRenderer
    || isLibraryVirtualTrialActive(app)
    || isLibraryVirtualSessionOptInActive(app);
}

export function persistLibraryVirtualAutoFallback(app, record = {}, options = {}) {
  const fallback = normalizeLibraryVirtualAutoFallbackForRuntime(record, options);
  app.state.libraryVirtualAutoFallback = fallback;
  try { saveLocal(options.storageKey || 'libraryVirtualRendererAutoFallback', fallback); } catch {}
  return fallback;
}

export function resetLibraryVirtualAutoFallbackState(app, reason = 'manual-reset', options = {}) {
  app.state.libraryVirtualAutoFallback = {
    active: false,
    reason: String(reason || 'manual-reset'),
    at: Date.now(),
    version: String(options.runtimeVersion || LIBRARY_VIRTUAL_AUTO_FALLBACK_RUNTIME_VERSION),
    mode: 'reset',
    pass: String(options.defaultRolloutPass || '')
  };
  try { removeLocal(options.storageKey || 'libraryVirtualRendererAutoFallback'); } catch {}
  return app.state.libraryVirtualAutoFallback;
}
