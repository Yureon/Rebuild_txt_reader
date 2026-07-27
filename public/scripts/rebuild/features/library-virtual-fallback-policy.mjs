export const LIBRARY_VIRTUAL_FALLBACK_POLICY_SPLIT_PASS = 'v196-library-virtual-fallback-policy-split-pass';

const LIBRARY_VIRTUAL_FALLBACK_CATEGORY_LABELS = {
  'duplicate-key': 'Duplicate row key',
  'missing-dataset': 'Missing dataset',
  'action-audit-unsafe': 'Action audit unsafe',
  'prototype-mismatch': 'Prototype mismatch',
  'interaction-safety': 'Interaction safety',
  'render-exception': 'Render exception',
  'windowed-render': 'Windowed render',
  informational: 'Informational full render',
  unknown: 'Unknown'
};

const LIBRARY_VIRTUAL_FALLBACK_SUGGESTIONS = {
  'duplicate-key': 'stable key 생성 규칙과 folder/novel/episode key 중복 여부를 확인하세요.',
  'missing-dataset': 'prototype row의 필수 data-* 및 action button dataset 누락 여부를 확인하세요.',
  'action-audit-unsafe': 'folder toggle, open, favorite, rename, move, delete, DnD, long-press action target의 data-* 누락을 확인하세요.',
  'prototype-mismatch': '기존 full DOM row와 detached prototype/window row의 dataset/class/action button 비교 결과를 확인하세요.',
  'interaction-safety': 'DnD, long-press, action sheet target이 row identity를 안정적으로 해석하는지 확인하세요.',
  'render-exception': 'windowed renderer 실행 중 발생한 message/stack을 확인하고 full fallback 상태에서 재현 조건을 좁히세요.',
  'windowed-render': 'windowed renderer가 정상 실행된 정보성 기록입니다. renderedRows/window range와 실제 DOM row 수를 함께 확인하세요.',
  informational: '정보성 full renderer 기록입니다. blocking gate failure는 fallback history에서 별도로 확인하세요.',
  unknown: '목록 진단 JSON과 fallback sample JSON을 복사해 전체 gate/render 상태를 확인하세요.'
};

export function getLibraryVirtualFailureCategoryLabel(category) {
  return LIBRARY_VIRTUAL_FALLBACK_CATEGORY_LABELS[category] || LIBRARY_VIRTUAL_FALLBACK_CATEGORY_LABELS.unknown;
}

export function getLibraryVirtualFailureSuggestion(category) {
  return LIBRARY_VIRTUAL_FALLBACK_SUGGESTIONS[category] || LIBRARY_VIRTUAL_FALLBACK_SUGGESTIONS.unknown;
}

export function classifyLibraryVirtualFailure(reason = '', gate = null, error = null) {
  const text = [reason, gate?.reason, ...(Array.isArray(gate?.problems) ? gate.problems : []), error?.message || '']
    .join(' ')
    .toLowerCase();
  if (/duplicate|duplicate-row-key|duplicate-key/.test(text)) return 'duplicate-key';
  if (/missing-dataset|dataset-missing|required-dataset|missingrequired|missing required|dataset:/.test(text)) return 'missing-dataset';
  if (/action-audit-unsafe/.test(text)) return 'action-audit-unsafe';
  if (/actual-dom-mismatch|prototype-mismatch|prototype.*mismatch|dom-mismatch/.test(text)) return 'prototype-mismatch';
  if (/interaction-target-unsafe|interaction-safety|long-press|dnd/.test(text)) return 'interaction-safety';
  if (/render-exception|exception|error/.test(text)) return 'render-exception';
  return 'unknown';
}

export function buildLibraryVirtualFailureCategories(problems = [], gate = null) {
  const grouped = {};
  (Array.isArray(problems) ? problems : []).forEach(problem => {
    const category = classifyLibraryVirtualFailure(problem, gate);
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(problem);
  });
  return Object.entries(grouped).map(([category, items]) => ({
    category,
    label: getLibraryVirtualFailureCategoryLabel(category),
    count: items.length,
    problems: items,
    suggestedAction: getLibraryVirtualFailureSuggestion(category)
  }));
}

export function getLibraryVirtualFallbackKind(record = {}) {
  const reason = String(record?.reason || '').toLowerCase();
  if (record?.blocking === true) return 'blocking-failure';
  if (record?.kind) return String(record.kind);
  if (record?.mode === 'windowed') return 'windowed-render';
  if (record?.blocking === false) return 'informational-full-render';
  if (reason === 'windowed') return 'windowed-render';
  if (reason === 'flag-off' || reason === 'full-render') return 'informational-full-render';
  if (reason === 'empty-list' || reason === 'no-visible-rows') return 'informational-empty-state';
  if (/^recovery-safe-trial-(pass|stop)/.test(reason)) return 'informational-full-render';
  if (record?.mode === 'full' && !record?.gate && !record?.error) return 'informational-full-render';
  return 'blocking-failure';
}

export function isLibraryVirtualBlockingFallbackRecord(record = {}) {
  return getLibraryVirtualFallbackKind(record) === 'blocking-failure';
}

export function normalizeLibraryVirtualFallbackRecord(record = {}) {
  const gate = record.gate || null;
  const kind = getLibraryVirtualFallbackKind(record);
  const blocking = kind === 'blocking-failure';
  const category = blocking
    ? (record.category || classifyLibraryVirtualFailure(record.reason || '', gate, record.error || null))
    : (record.category || (kind === 'windowed-render' ? 'windowed-render' : 'informational'));
  const normalized = {
    ...(record || {}),
    kind,
    blocking,
    category,
    categoryLabel: getLibraryVirtualFailureCategoryLabel(category),
    suggestedAction: record.suggestedAction || getLibraryVirtualFailureSuggestion(category),
    at: record?.at || Date.now()
  };
  if (record.error && typeof record.error === 'object') {
    normalized.error = {
      name: record.error.name || 'Error',
      message: record.error.message || String(record.error),
      stack: record.error.stack || ''
    };
  }
  return normalized;
}
