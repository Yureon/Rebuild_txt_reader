const FRONTEND_CHECK_UI_LAYERING_PASS = 'v182-frontend-check-split-pass';

function extractHtmlIds(source) {
  return Array.from(source.matchAll(/\bid=["']([^"']+)["']/g)).map(match => match[1]);
}
function requireNoDuplicateHtmlIds(source, label) {
  const counts = new Map();
  for (const id of extractHtmlIds(source)) counts.set(id, (counts.get(id) || 0) + 1);
  const duplicates = Array.from(counts.entries()).filter(([, count]) => count > 1);
  if (duplicates.length) {
    throw new Error(label + ' contains duplicate ids: ' + duplicates.map(([id, count]) => id + ' x' + count).join(', '));
  }
}
function camelElementKeyToId(key) {
  return String(key).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}
function extractModalLayerPairs(source) {
  const installStart = source.indexOf('function installModalBasics(');
  if (installStart < 0) throw new Error('Missing installModalBasics for modal coverage check');
  const pairsStart = source.indexOf('const pairs = [', installStart);
  if (pairsStart < 0) throw new Error('Missing modal layer pairs array');
  const pairsEnd = source.indexOf('];', pairsStart);
  if (pairsEnd < 0) throw new Error('Unterminated modal layer pairs array');
  const pairsSource = source.slice(pairsStart, pairsEnd);
  return Array.from(pairsSource.matchAll(/\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g))
    .map(match => ({ overlayKey: match[1], panelKey: match[2], overlayId: camelElementKeyToId(match[1]), panelId: camelElementKeyToId(match[2]) }));
}
function requireModalLayerCoverage({ shellSource, elementsSource, uiSource }) {
  const pairs = extractModalLayerPairs(uiSource);
  if (pairs.length < 8) throw new Error('Modal coverage check found too few layer pairs: ' + pairs.length);
  for (const pair of pairs) {
    for (const [kind, id, key] of [['overlay', pair.overlayId, pair.overlayKey], ['panel', pair.panelId, pair.panelKey]]) {
      if (!shellSource.includes('id="' + id + '"')) throw new Error('Modal layer ' + kind + ' id missing from app-shell: ' + id);
      if (!elementsSource.includes("'" + id + "'") && !elementsSource.includes('"' + id + '"')) {
        throw new Error('Modal layer ' + kind + ' id missing from collectElements ids: ' + id);
      }
    }
    const panelOpen = shellSource.indexOf('id="' + pair.panelId + '"');
    if (panelOpen < 0) throw new Error('Modal panel missing from shell: ' + pair.panelId);
    const panelFragment = shellSource.slice(panelOpen, Math.min(shellSource.length, panelOpen + 500));
    if (!panelFragment.includes('role="dialog"')) throw new Error('Modal panel missing role dialog: ' + pair.panelId);
    if (!panelFragment.includes('aria-labelledby="')) throw new Error('Modal panel missing aria-labelledby: ' + pair.panelId);
    if (!panelFragment.includes('data-modal-a11y-pass="v140"')) throw new Error('Modal panel missing v140 a11y marker: ' + pair.panelId);
  }
  ['defaultPanels','settingsChildLayerKeys','getTopOpenLayer','trapFocusWithinPanel','modal-layer-scroll-locked'].forEach((marker) => {
    if (!uiSource.includes(marker)) throw new Error('Modal layer runtime coverage marker missing: ' + marker);
  });
}

module.exports = {
  FRONTEND_CHECK_UI_LAYERING_PASS,
  requireModalLayerCoverage,
  requireNoDuplicateHtmlIds
};
