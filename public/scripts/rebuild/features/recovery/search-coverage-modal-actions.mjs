export const RECOVERY_SEARCH_COVERAGE_MODAL_ACTIONS_PASS = 'v244-recovery-search-coverage-modal-actions-pass';

export function getSelectedRecoveryCoverageChunks(rows = [], selected = new Set(), type = 'missing') {
  return rows.filter(row => selected.has(row.chunk) && (type === 'missing' ? row.type === 'missing' : row.type !== 'missing')).map(row => row.chunk);
}

export function selectRecoveryCoveragePreset(rows = [], selected = new Set(), preset = 'missing') {
  const nextType = preset === 'cached' ? 'cached' : 'missing';
  rows.filter(row => nextType === 'missing' ? row.type === 'missing' : row.type !== 'missing').forEach(row => selected.add(row.chunk));
  return selected;
}

export function getRecoveryCoverageRenderState(rows = [], selected = new Set(), { filter = 'missing', visibleLimit = 300, online = true } = {}) {
  const filtered = rows.filter(row => filter === 'all' || (filter === 'missing' ? row.type === 'missing' : row.type !== 'missing'));
  const visible = filtered.slice(0, visibleLimit);
  const hasMissingSelection = getSelectedRecoveryCoverageChunks(rows, selected, 'missing').length > 0;
  const hasCachedSelection = getSelectedRecoveryCoverageChunks(rows, selected, 'cached').length > 0;
  return {
    filtered,
    visible,
    countLabel: '표시 ' + visible.length + '/' + filtered.length + ' · 선택 ' + selected.size + ' · 전체 ' + rows.length,
    hasMore: visible.length < filtered.length,
    saveDisabled: !hasMissingSelection || online === false,
    deleteDisabled: !hasCachedSelection
  };
}
