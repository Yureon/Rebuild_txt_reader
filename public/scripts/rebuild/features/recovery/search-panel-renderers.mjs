import { createEl } from '../../core/utils.mjs';

export const RECOVERY_SEARCH_PANEL_RENDERERS_PASS = 'v242-recovery-search-panel-renderers-pass';

export function createRecoverySearchStatusTable(rows = []) {
  return createEl('div', { class:'recovery-status-table' }, rows.map(([k, v]) => createEl('div', { class:'recovery-status-row' }, [
    createEl('div', { class:'recovery-status-key', text:k }),
    createEl('div', { class:'recovery-status-val', text:v })
  ])));
}

export function createRecoverySearchActionButton({ text = '', title = '', danger = false, disabled = false, onClick = null } = {}) {
  const btn = createEl('button', { class:'devdbg-btn' + (danger ? ' danger' : ''), type:'button', text });
  btn.disabled = !!disabled;
  if (title) btn.title = title;
  if (typeof onClick === 'function') btn.addEventListener('click', onClick);
  return btn;
}

export function createRecoverySearchPanelSection(rows = [], buttons = []) {
  return createEl('section', { class:'recovery-section recovery-search-panel', dataset:{ recoverySection:'search-coverage' } }, [
    createEl('div', { class:'recovery-section-title', text:'검색/오프라인 진단' }),
    createEl('div', { class:'recovery-section-desc', text:'현재 작품의 검색 가능 범위와 오프라인 캐시 작업을 Recovery Center에서 바로 연결합니다.' }),
    createRecoverySearchStatusTable(rows),
    createEl('div', { class:'recovery-inline-actions recovery-cache-actions' }, buttons)
  ]);
}
