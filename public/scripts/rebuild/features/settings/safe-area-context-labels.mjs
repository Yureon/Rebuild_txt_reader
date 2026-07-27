export const SAFE_AREA_CONTEXT_LABELS_PASS = 'v221-safe-area-context-labels-pass';

export function formatSafeDisplayModeLabel(displayMode) {
  const value = String(displayMode || 'browser');
  if (value === 'browser-fullscreen') return '브라우저 전체화면';
  if (value === 'standalone') return 'PWA';
  if (value === 'fullscreen') return '전체화면';
  return '브라우저';
}

export function formatSafeViewportSizeLabel(metrics = {}) {
  const width = Math.round(metrics.visualWidth || window.innerWidth || 0);
  const height = Math.round(metrics.visualHeight || window.innerHeight || 0);
  return `${width}x${height}`;
}

export function buildSafeViewportContextLabels({ displayMode = 'browser', uaKey = 'Browser', metrics = {} } = {}) {
  const modeLabel = formatSafeDisplayModeLabel(displayMode);
  const size = formatSafeViewportSizeLabel(metrics);
  return {
    modeLabel,
    size,
    label: `${modeLabel} · ${uaKey} · ${size}`,
    defaultName: `${modeLabel} ${uaKey}`
  };
}
