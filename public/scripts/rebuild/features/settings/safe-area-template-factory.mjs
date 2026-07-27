export const SAFE_AREA_TEMPLATE_FACTORY_SPLIT_PASS = 'v194-safe-area-template-factory-split-pass';

import { formatSafeTemplateName } from './safe-area-template-labels.mjs';

export function getSafeTemplate(context, templateKey) {
  const mode = String(context.displayMode || 'browser');
  const ua = String(context.uaKey || 'Browser');
  const isPwa = mode === 'standalone' || context.isStandalone;
  const isBrowserFullscreen = mode === 'browser-fullscreen' || context.isBrowserFullscreen;
  const browserBase = getBrowserTemplateBase(ua);
  const pwaBase = { top: 28, bottom: 32 };
  const base = isPwa ? pwaBase : browserBase;
  const withScale = (key, scale) => ({
    key,
    top: Math.round(base.top * scale),
    bottom: Math.round(base.bottom * scale)
  });
  let tpl;
  if (templateKey === 'current-soft') tpl = withScale('current-soft', 0.72);
  else if (templateKey === 'current-strong') tpl = withScale('current-strong', 1.35);
  else if (templateKey === 'browser-punchhole') tpl = { key: 'browser-punchhole', top: browserBase.top + 18, bottom: browserBase.bottom + 8 };
  else if (templateKey === 'pwa-punchhole') tpl = { key: 'pwa-punchhole', top: pwaBase.top + 16, bottom: pwaBase.bottom + 6 };
  else tpl = withScale('current-balanced', 1);
  tpl.name = formatSafeTemplateName(context, templateKey);
  return tpl;
}

export function getBrowserTemplateBase(uaKey) {
  const key = String(uaKey || '').toLowerCase();
  if (key.includes('samsung')) return { top: 62, bottom: 64 };
  if (key.includes('firefox')) return { top: 46, bottom: 54 };
  if (key.includes('edge')) return { top: 50, bottom: 56 };
  if (key.includes('safari')) return { top: 44, bottom: 48 };
  return { top: 54, bottom: 60 };
}

export function makeSafeTemplateId(context, templateKey) {
  const raw = 'safe-template-' + context.key + '-' + templateKey;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').slice(0, 80);
}
