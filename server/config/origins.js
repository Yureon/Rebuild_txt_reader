const { APP_ORIGIN, REQUIRE_STRICT_ORIGIN } = require('./env');

function stripWrappingQuotes(value) {
  const raw = String(value || '').trim();
  if (raw.length >= 2) {
    const first = raw[0];
    const last = raw[raw.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return raw.slice(1, -1).trim();
    }
  }
  return raw;
}

function normalizeOrigin(value) {
  const raw = stripWrappingQuotes(value).replace(/\/+$/, '');
  if (!raw) return '';
  try {
    return new URL(raw).origin.replace(/\/+$/, '');
  } catch (error) {
    return raw.replace(/\/+$/, '');
  }
}

function splitOriginList(value) {
  return String(value || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);
}

function uniqueOrigins(origins) {
  return Array.from(new Set((origins || []).map(normalizeOrigin).filter(Boolean)));
}

function shouldUseHostFallbackOrigin() {
  return !(process.env.NODE_ENV === 'production' && REQUIRE_STRICT_ORIGIN);
}

function getAllowedOrigins(req) {
  const list = uniqueOrigins(splitOriginList(APP_ORIGIN));

  const fallbackOrigin = req && req.get && req.get('host')
    ? normalizeOrigin(`${req.protocol}://${req.get('host')}`)
    : '';

  if (list.length === 0 && fallbackOrigin && shouldUseHostFallbackOrigin()) {
    list.push(fallbackOrigin);
  }

  return list;
}

module.exports = {
  getAllowedOrigins,
  normalizeOrigin,
  splitOriginList,
  uniqueOrigins,
  shouldUseHostFallbackOrigin
};
