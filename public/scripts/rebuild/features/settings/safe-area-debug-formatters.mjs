export const SAFE_AREA_DEBUG_FORMATTERS_PASS = 'v224-safe-area-debug-formatters-pass';
export const SAFE_AREA_DEBUG_ROW_FORMATTER_PASS = 'v225-safe-area-debug-row-formatter-pass';
export const SAFE_AREA_DEBUG_TEXT_FORMATTER_PASS = 'v226-safe-area-debug-text-formatter-pass';

function boolText(value) {
  return value ? 'true' : 'false';
}

function formatDebugDate(value) {
  return value ? new Date(value).toISOString() : 'n/a';
}

export function formatSafeViewportDebugProfile(selected = null) {
  return selected ? `${selected.name} (${selected.id})` : 'none';
}

export function buildSafeViewportDebugRows({ metrics = {}, context = {}, selected = null, matchingProfileCount = 0, windowLike = globalThis } = {}) {
  const viewport = windowLike?.visualViewport || null;
  return [
    ['context', context.label],
    ['profile', formatSafeViewportDebugProfile(selected)],
    ['contextKey', context.key],
    ['selectedProfileContext', selected?.contextKey || ''],
    ['matchingProfileCount', matchingProfileCount],
    ['displayMode', metrics.displayMode],
    ['isStandalone', metrics.isStandalone],
    ['isFullscreen', metrics.isFullscreen],
    ['isBrowserFullscreen', metrics.isBrowserFullscreen],
    ['isMobile', metrics.isMobile],
    ['innerWidth', windowLike?.innerWidth],
    ['innerHeight', windowLike?.innerHeight],
    ['visualViewport.width', viewport?.width ?? 'n/a'],
    ['visualViewport.height', viewport?.height ?? 'n/a'],
    ['visualViewport.offsetTop', viewport?.offsetTop ?? 'n/a'],
    ['visualViewport.offsetLeft', viewport?.offsetLeft ?? 'n/a'],
    ['bottomOcclusion', metrics.bottomOcclusion],
    ['autoTopExtra', metrics.autoTopExtra],
    ['autoBottomExtra', metrics.autoBottomExtra],
    ['manualTop', metrics.manualTop],
    ['manualBottom', metrics.manualBottom],
    ['safeTopExtra', metrics.safeTopExtra],
    ['safeBottomExtra', metrics.safeBottomExtra],
    ['readerNavGap', metrics.readerNavGap],
    ['activeProfileId', metrics.activeSafeProfileId || ''],
    ['activeProfileName', metrics.activeSafeProfileName || ''],
    ['activeProfileContext', metrics.activeSafeProfileContextKey || ''],
    ['reentryReady', boolText(metrics.safeProfileReentryReady)],
    ['usingLivePrefs', boolText(metrics.usingLiveSafePrefs)],
    ['sampleCount', metrics.sampleCount ?? 'n/a'],
    ['stableCount', metrics.stableCount ?? 'n/a'],
    ['isStable', metrics.isStable ?? 'n/a'],
    ['updatedAt', formatDebugDate(metrics.updatedAt)],
    ['reason', metrics.reason || '']
  ];
}

export function formatSafeViewportDebugRow(row = []) {
  const [key, value] = Array.isArray(row) ? row : ['', ''];
  return `${key}: ${value}`;
}

export function formatSafeViewportDebugRows(rows = []) {
  return rows.map(row => formatSafeViewportDebugRow(row)).join('\n');
}

export function buildSafeViewportDebugText(options = {}) {
  return formatSafeViewportDebugRows(buildSafeViewportDebugRows(options));
}
