export const LIBRARY_RENDER_OPTIONS_PASS = 'v279-library-render-options-split-pass';

export function normalizeLibraryRenderOptions(options = {}) {
  const source = String(options.source || 'render');
  return {
    ...options,
    source,
    resetScroll: !!options.resetScroll,
    followActive: options.followActive ?? (source === 'reader-open' || source === 'relink-current' || source === 'recovery-toggle'),
    scrollAnchor: options.scrollAnchor || null
  };
}

export function getLibrarySetSignature(value) {
  const set = value instanceof Set ? value : new Set(Array.isArray(value) ? value : []);
  if (!set.size) return '';
  return Array.from(set).map(item => String(item)).sort().join('\n');
}
