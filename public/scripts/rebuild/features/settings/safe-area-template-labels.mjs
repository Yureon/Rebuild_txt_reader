export const SAFE_AREA_TEMPLATE_LABELS_PASS = 'v218-safe-area-template-labels-pass';

export function formatSafeTemplateModeLabel(context = {}) {
  const mode = String(context.displayMode || 'browser');
  if (mode === 'standalone' || context.isStandalone) return 'PWA';
  if (mode === 'browser-fullscreen' || context.isBrowserFullscreen) return '브라우저 전체화면';
  return '현재 모드';
}

export function formatSafeTemplateStrengthLabel(templateKey = '') {
  const key = String(templateKey || '');
  if (key === 'browser-punchhole') return '브라우저 펀치홀';
  if (key === 'pwa-punchhole') return 'PWA 펀치홀';
  if (key.endsWith('soft')) return '약하게';
  if (key.endsWith('strong')) return '강하게';
  return '보통';
}

export function formatSafeTemplateName(context = {}, templateKey = '') {
  const ua = String(context.uaKey || 'Browser');
  return formatSafeTemplateModeLabel(context) + ' ' + ua + ' ' + formatSafeTemplateStrengthLabel(templateKey);
}
