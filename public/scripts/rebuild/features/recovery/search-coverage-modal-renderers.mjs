import { createEl } from '../../core/utils.mjs';
import { formatCoverageModalSummary } from './search-diagnostics.mjs';
import { createRecoveryLowLevelActionRow } from './action-button-layout.mjs';

export const RECOVERY_SEARCH_COVERAGE_MODAL_RENDERERS_PASS = 'v243-recovery-search-coverage-modal-renderers-pass';

export function createRecoveryCoverageModalShell(rows, coverage, { onClose = () => {} } = {}) {
  const overlay = createEl('div', { class:'recovery-chunk-overlay' });
  const modal = createEl('div', { class:'recovery-chunk-modal' });
  const title = createEl('div', { class:'recovery-chunk-title', text:'검색 coverage 후보 목록' });
  const sub = createEl('div', { class:'recovery-chunk-sub', text:formatCoverageModalSummary(rows, coverage) });
  const closeBtn = createEl('button', { class:'recovery-chunk-close', type:'button', text:'✕', 'aria-label':'닫기' });
  const list = createEl('div', { class:'recovery-chunk-list' });
  const count = createEl('div', { class:'recovery-chunk-count' });
  const moreBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'더 보기' });
  const saveBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'선택 저장' });
  const deleteBtn = createEl('button', { class:'devdbg-btn danger', type:'button', text:'선택 캐시 삭제' });
  const selectMissingBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'저장 후보 선택' });
  const selectCachedBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'캐시 항목 선택' });
  const clearSelectionBtn = createEl('button', { class:'devdbg-btn', type:'button', text:'선택 해제' });
  const filterBtns = ['missing','cached','all'].map(value => {
    const label = value === 'missing' ? '저장 후보' : value === 'cached' ? '캐시/표시중' : '전체';
    const btn = createEl('button', { class:'devdbg-btn tiny', type:'button', text:label });
    btn.dataset.filter = value;
    return btn;
  });
  closeBtn.addEventListener('click', onClose);
  modal.append(
    createEl('div', { class:'recovery-chunk-head' }, [createEl('div', {}, [title, sub]), closeBtn]),
    createRecoveryLowLevelActionRow(filterBtns, { className:'recovery-chunk-toolbar recovery-low-level-action-row', group:'search-coverage-filter', tiny:true }),
    createRecoveryLowLevelActionRow([selectMissingBtn, selectCachedBtn, clearSelectionBtn, saveBtn, deleteBtn], { className:'recovery-chunk-actions recovery-low-level-action-row', group:'search-coverage-actions' }),
    count,
    list,
    createRecoveryLowLevelActionRow([moreBtn], { className:'recovery-chunk-footer recovery-low-level-action-row', group:'search-coverage-footer' })
  );
  overlay.append(modal);
  return { overlay, modal, filterBtns, list, count, moreBtn, saveBtn, deleteBtn, selectMissingBtn, selectCachedBtn, clearSelectionBtn };
}

export function renderRecoveryCoverageRows(rows = [], selected = new Set(), onToggle = () => {}) {
  return rows.map(row => renderRecoveryCoverageRow(row, selected, onToggle));
}

export function renderRecoveryCoverageRow(row, selected = new Set(), onToggle = () => {}) {
  const checkbox = createEl('input', { type:'checkbox' });
  checkbox.checked = selected.has(row.chunk);
  checkbox.addEventListener('change', () => onToggle(row.chunk, checkbox.checked));
  return createEl('label', { class:'recovery-chunk-row ' + row.type }, [
    checkbox,
    createEl('span', { class:'recovery-chunk-no', text:String(row.chunk) }),
    createEl('span', { class:'recovery-chunk-state', text:row.label }),
    createEl('span', { class:'recovery-chunk-hint', text:row.hint })
  ]);
}
