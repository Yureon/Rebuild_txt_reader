export const READER_CHUNK_HEADING_POLICY_PASS = 'v240-reader-chunk-heading-policy-pass';

export function getVirtualChunkHeading(entry = {}) {
  const chunk = Math.max(1, Math.round(Number(entry?.chunk) || 1));
  if (chunk !== 1) return '';
  return String(entry?.title || '').trim();
}

export function hasVirtualChunkHeading(row = {}) {
  return String(row?.title || '').trim().length > 0;
}
