function jsonSizeOf(value) {
  try {
    return Buffer.byteLength(JSON.stringify(value), 'utf8');
  } catch (e) {
    return Infinity;
  }
}

function ensurePlainObject(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function firstDefined() {
  for (let i = 0; i < arguments.length; i += 1) {
    if (arguments[i] !== null && typeof arguments[i] !== 'undefined') return arguments[i];
  }
  return undefined;
}

function sanitizeTextValue(value, maxLen, fallback) {
  const out = String(value == null ? '' : value).trim().slice(0, Math.max(0, Number(maxLen) || 0));
  if (!out) return typeof fallback === 'undefined' ? '' : fallback;
  return out;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return Number(fallback) || 0;
  return Math.min(Number(max), Math.max(Number(min), n));
}

function sanitizeStringList(input, maxItems, maxLen) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  const out = [];
  input.slice(0, Math.max(0, Number(maxItems) || 0)).forEach((item) => {
    const text = sanitizeTextValue(item, maxLen, '');
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
}

module.exports = {
  jsonSizeOf,
  ensurePlainObject,
  firstDefined,
  sanitizeTextValue,
  clampNumber,
  sanitizeStringList
};
