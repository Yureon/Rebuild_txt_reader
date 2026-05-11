export const READER_PREFETCH_SCHEDULE_HELPER_PASS = 'v214-reader-prefetch-schedule-helper-pass';

export function buildReaderPrefetchCandidates(base, total, radius, direction = 'forward') {
  const out = [];
  const safeBase = Math.max(1, Number(base) || 1);
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeRadius = Math.max(0, Number(radius) || 0);
  const halfRadius = Math.max(1, Math.floor(safeRadius / 2));
  if (direction === 'backward') {
    for (let i = 1; i <= safeRadius; i += 1) if (safeBase - i >= 1) out.push(safeBase - i);
    for (let i = 1; i <= halfRadius; i += 1) if (safeBase + i <= safeTotal) out.push(safeBase + i);
  } else {
    for (let i = 1; i <= safeRadius; i += 1) if (safeBase + i <= safeTotal) out.push(safeBase + i);
    for (let i = 1; i <= halfRadius; i += 1) if (safeBase - i >= 1) out.push(safeBase - i);
  }
  return out;
}

export function buildReaderPrefetchScheduleSignature({ warmupPass = '', readerSessionId = 0, current = null, base = 1, total = 1, radius = 0, direction = 'forward', candidates = [], preprocess = {} } = {}) {
  const preprocessSignature = Object.keys(preprocess || {}).sort().map(key => `${key}:${preprocess[key] ? 1 : 0}`).join('|');
  return [
    warmupPass,
    readerSessionId || 0,
    current?.novel?.id || '',
    current?.episode?.id || 'single',
    Math.max(1, Number(base) || 1),
    Math.max(1, Number(total) || 1),
    Math.max(0, Number(radius) || 0),
    direction || 'forward',
    Array.isArray(candidates) ? candidates.join(',') : '',
    preprocessSignature
  ].join('::');
}

export function getReaderPrefetchRadiusFromNetwork({ explicitRadius, connection = null, isMobileProfile = false, velocityPxMs = 0 } = {}) {
  if (Number.isFinite(Number(explicitRadius))) return Math.max(0, Math.min(10, Number(explicitRadius)));
  if (connection?.saveData) return 1;
  const type = String(connection?.effectiveType || '').toLowerCase();
  if (type.includes('2g')) return 1;
  if (type.includes('3g')) return isMobileProfile ? 2 : 3;
  const velocity = Math.max(0, Number(velocityPxMs) || 0);
  const base = isMobileProfile ? 3 : 5;
  if (velocity >= 2.4) return Math.min(10, base + 3);
  if (velocity >= 1.35) return Math.min(10, base + 2);
  return base;
}
