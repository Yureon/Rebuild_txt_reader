export const PREPROCESS_SUMMARY_HELPER_PASS = 'v211-preprocess-summary-helper-pass';

export const PREPROCESS_OPTION_LABELS = {
  removeNoise: '광고·링크 제거',
  chapterSpacing: '장·화 제목 여백',
  collapseBreaks: '과도한 줄바꿈',
  splitDense: '붙은 문장 띄우기',
  dialogueBreak: '대화문 줄바꿈',
  paragraphOptimize: '문단 밀도 최적화',
  aggressive: '후기·공지 제거 강화'
};

export function normalizePreprocessSummaryOptions(options = {}, keys = Object.keys(PREPROCESS_OPTION_LABELS)) {
  const src = options && typeof options === 'object' ? options : {};
  return keys.reduce((out, key) => {
    out[key] = !!src[key];
    return out;
  }, {});
}

export function summarizePreprocessOptions(options, keys = Object.keys(PREPROCESS_OPTION_LABELS), labels = PREPROCESS_OPTION_LABELS) {
  const normalized = normalizePreprocessSummaryOptions(options, keys);
  const active = keys.filter(key => normalized[key]).map(key => labels[key] || key);
  const inactive = keys.length - active.length;
  return active.length
    ? `활성 옵션 ${active.length}개: ${active.join(', ')} · 비활성 ${inactive}개`
    : `활성 옵션 없음 · 비활성 ${inactive}개`;
}

export function formatPreprocessPreviewStats(formatStats, options, keys = Object.keys(PREPROCESS_OPTION_LABELS), labels = PREPROCESS_OPTION_LABELS) {
  const summary = summarizePreprocessOptions(options, keys, labels);
  if (!formatStats || typeof formatStats !== 'object') return summary;
  const pairs = Object.entries(formatStats)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .slice(0, 8)
    .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
  return pairs.length ? `${summary} · 서버 통계: ${pairs.join(' / ')}` : summary;
}
