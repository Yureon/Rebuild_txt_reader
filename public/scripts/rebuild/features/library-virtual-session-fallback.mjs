import { classifyLibraryVirtualFailure, getLibraryVirtualFailureCategoryLabel, getLibraryVirtualFailureSuggestion } from './library-virtual-fallback-policy.mjs';

export const LIBRARY_VIRTUAL_SESSION_FALLBACK_PASS = 'v210-library-virtual-session-fallback-pass';

export function buildLibraryVirtualSessionFallbackFailure(record = {}) {
  const category = record.category || classifyLibraryVirtualFailure(record.reason || '', record.gate || null, record.error || null);
  return {
    reason: record.reason || 'fallback',
    category,
    categoryLabel: getLibraryVirtualFailureCategoryLabel(category),
    suggestedAction: getLibraryVirtualFailureSuggestion(category),
    source: record.source || '',
    gateReason: record.gate?.reason || '',
    errorMessage: record.error?.message || '',
    stack: record.error?.stack || '',
    at: record.at || Date.now(),
    pass: LIBRARY_VIRTUAL_SESSION_FALLBACK_PASS
  };
}

export function isLibraryVirtualSessionExceptionFailure(failure = {}) {
  return failure.category === 'render-exception' || /exception/i.test(String(failure.reason || ''));
}
