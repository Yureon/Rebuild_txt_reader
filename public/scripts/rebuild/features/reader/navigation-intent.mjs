import { clamp } from '../../core/utils.mjs';

export const READER_NAVIGATION_INTENT_PASS = 'v245-reader-navigation-intent-pass';

export function buildReaderTargetAddress(options = {}) {
  if (options.targetAddress) return options.targetAddress;
  if (options.globalBlockIndex != null) {
    return {
      globalBlockIndex: options.globalBlockIndex,
      blockIndex: options.blockIndex,
      charIndex: options.charIndex,
      align: options.align || 'start'
    };
  }
  if (options.blockIndex != null || options.charIndex != null) {
    return {
      blockIndex: options.blockIndex,
      charIndex: options.charIndex,
      align: options.align || 'start'
    };
  }
  return null;
}

export function buildReaderOpenNovelLoadIntent(options = {}) {
  const targetAddress = options.globalBlockIndex != null
    ? { globalBlockIndex: options.globalBlockIndex, charIndex: options.charIndex, align: options.align || 'start' }
    : (options.blockIndex != null || options.charIndex != null ? { blockIndex: options.blockIndex, charIndex: options.charIndex, align: options.align || 'start' } : null);
  return {
    restoreRatio: clamp(options.ratio || 0, 0, 1),
    searchIndex: options.searchIndex,
    query: options.query,
    matchLength: options.matchLength,
    targetAddress,
    source: options.source || ''
  };
}

export function buildReaderChunkNavigationIntent(chunk, options = {}) {
  return {
    pass: READER_NAVIGATION_INTENT_PASS,
    chunk,
    keepHighlight: !!options.keepHighlight,
    loadOptions: {
      restoreRatio: clamp(options.ratio || 0, 0, 1),
      searchIndex: options.searchIndex,
      query: options.query,
      targetAddress: buildReaderTargetAddress(options),
      source: options.source || ''
    },
    warmDirection: options.warmDirection || 'forward',
    statusMessage: options.statusMessage || '위치 이동 완료'
  };
}
