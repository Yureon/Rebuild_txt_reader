export const READER_VIRTUAL_ROW_SIGNATURE_HELPER_PASS = 'v221-reader-virtual-row-signature-helper-pass';

export function buildVirtualRowDomSignature({ app = null, row = null, rowDomPoolPass = '' } = {}) {
  const h = app?.state?.search?.highlights || null;
  const query = h && h.chunk === row?.chunk ? String(h.query || '') : '';
  const targetIndex = query ? String(Number.isFinite(Number(h.index)) ? Number(h.index) : '') : '';
  const matchLength = query ? String(Number(h.matchLength) || query.length) : '';
  if (row?.type === 'header') {
    return [rowDomPoolPass, row.id, row.type, row.chunk, row.title || '', row.totalChunks || 0].join('|');
  }
  return [
    rowDomPoolPass,
    row?.id,
    row?.type,
    row?.chunk,
    row?.blockIndex,
    row?.globalBlockIndex ?? '',
    row?.start,
    row?.end,
    row?.totalChunks || 0,
    query,
    targetIndex,
    matchLength,
    getVirtualRowTextSignature(row?.text)
  ].join('|');
}

export function getVirtualRowTextSignature(text) {
  const source = String(text || '');
  if (source.length <= 96) return source;
  return `${source.length}:${source.slice(0, 48)}:${source.slice(-48)}`;
}
