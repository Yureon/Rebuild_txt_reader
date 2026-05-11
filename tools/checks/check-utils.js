const FRONTEND_CHECK_COMMON_UTILS_PASS = 'v184-frontend-check-utils-pass';
const FRONTEND_CHECK_STALE_MARKER_UTILS_PASS = 'v213-check-utils-stale-marker-helper-pass';

function requireConstArrayEntries(source, constName, entries, label) {
  const pattern = new RegExp('const ' + constName + ' = \\[([\\s\\S]*?)\\];');
  const match = source.match(pattern);
  if (!match) throw new Error('Missing ' + label + ' array constant: ' + constName);
  entries.forEach((entry) => {
    if (!match[1].includes("'" + entry + "'") && !match[1].includes('"' + entry + '"')) {
      throw new Error('Missing ' + label + ' array entry in ' + constName + ': ' + entry);
    }
  });
}

function requireAllMarkers(source, markers, label) {
  if (!Array.isArray(markers)) throw new Error('requireAllMarkers requires marker array for ' + label);
  markers.forEach((marker) => {
    if (!source.includes(marker)) throw new Error('Missing ' + label + ' marker: ' + marker);
  });
}

function requirePolicyMarker(source, key, expected) {
  const pattern = new RegExp('\\b' + key + '\\s*:\\s*' + expected + '\\b');
  if (!pattern.test(source)) throw new Error('Missing diagnostic-only policy marker: ' + key + ': ' + expected);
}

function countMatches(source, pattern) {
  const matches = source.match(pattern);
  return matches ? matches.length : 0;
}

function requireNoForbiddenPattern(source, pattern, label) {
  if (pattern.test(source)) throw new Error('Forbidden policy pattern detected: ' + label);
}

function requireFunctionBodyNoPattern(source, functionName, pattern, label) {
  const start = source.indexOf('function ' + functionName + '(');
  if (start < 0) throw new Error('Missing function for policy body check: ' + functionName);
  const next = source.indexOf('\nfunction ', start + 10);
  const body = source.slice(start, next < 0 ? source.length : next);
  if (pattern.test(body)) throw new Error('Forbidden policy pattern in ' + functionName + ': ' + label);
}

function requireCurrentVersionAndNoStaleMarkers(source, currentVersion, staleMarkers, label) {
  if (!source.includes(currentVersion)) throw new Error('Missing ' + currentVersion + ' cache/version marker in ' + label);
  (Array.isArray(staleMarkers) ? staleMarkers : []).forEach((stale) => {
    if (stale && stale !== currentVersion && source.includes(stale)) throw new Error('Stale ' + stale + ' marker remains in ' + label);
  });
}

module.exports = {
  FRONTEND_CHECK_COMMON_UTILS_PASS,
  FRONTEND_CHECK_STALE_MARKER_UTILS_PASS,
  requireConstArrayEntries,
  requireAllMarkers,
  requirePolicyMarker,
  countMatches,
  requireNoForbiddenPattern,
  requireFunctionBodyNoPattern,
  requireCurrentVersionAndNoStaleMarkers
};
