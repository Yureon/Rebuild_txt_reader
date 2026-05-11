import { toast } from '../ui.mjs';
import { getNetworkProfile } from '../reader/offline-status.mjs';
import { prepareOfflineChunks } from '../reader/dom-actions.mjs';
import { buildCoverageRows } from './search-diagnostics.mjs';
import { createRecoveryCoverageModalShell, renderRecoveryCoverageRows } from './search-coverage-modal-renderers.mjs';
import { markRecoverySubModalLayer } from './modal-layer.mjs';
import { deleteRecoveryCacheChunks } from './cache-actions.mjs';
import { getRecoveryCoverageRenderState, getSelectedRecoveryCoverageChunks, selectRecoveryCoveragePreset } from './search-coverage-modal-actions.mjs';

export const RECOVERY_SEARCH_ACTIONS_REFACTOR_PASS = 'v175-recovery-search-actions-pass';

export function openRecoveryCoverageModal(app, coverage, options = {}) {
  const refreshRecovery = options.refreshRecovery || noopAsync;
  if (!app.state.current) return toast(app, 'info', '후보 목록', '먼저 작품을 열어주세요.');
  const rows = buildCoverageRows(coverage);
  if (!rows.length) return toast(app, 'info', '후보 목록', '표시할 chunk 상태가 없습니다.');
  let filter = 'missing';
  let visibleLimit = 300;
  const selected = new Set();
  const close = () => overlay.remove();
  const { overlay, modal, filterBtns, list, count, moreBtn, saveBtn, deleteBtn, selectMissingBtn, selectCachedBtn, clearSelectionBtn } = createRecoveryCoverageModalShell(rows, coverage, { onClose: close });
  markRecoverySubModalLayer(overlay, modal, 'search-coverage');
  filterBtns.forEach(btn => btn.addEventListener('click', () => { filter = btn.dataset.filter || 'missing'; visibleLimit = 300; render(); }));
  overlay.addEventListener('click', ev => { if (ev.target === overlay) close(); });
  selectMissingBtn.addEventListener('click', () => { selectRecoveryCoveragePreset(rows, selected, 'missing'); render(); });
  selectCachedBtn.addEventListener('click', () => { selectRecoveryCoveragePreset(rows, selected, 'cached'); render(); });
  clearSelectionBtn.addEventListener('click', () => { selected.clear(); render(); });
  moreBtn.addEventListener('click', () => { visibleLimit += 300; render(); });
  saveBtn.addEventListener('click', () => {
    const chunks = getSelectedRecoveryCoverageChunks(rows, selected, 'missing');
    if (!chunks.length) return toast(app, 'info', '선택 저장', '선택된 저장 후보 chunk가 없습니다.');
    if (getNetworkProfile().online === false) return toast(app, 'info', '선택 저장', '오프라인 상태에서는 누락 chunk를 새로 저장할 수 없습니다.');
    close();
    app.closeLayer?.('recoveryCenterOverlay', 'recoveryCenterModal');
    prepareOfflineChunks(app, chunks, { label:'선택 후보', confirmLarge:true });
  });
  deleteBtn.addEventListener('click', () => {
    const chunks = getSelectedRecoveryCoverageChunks(rows, selected, 'cached');
    if (!chunks.length) return toast(app, 'info', '선택 캐시 삭제', '선택된 캐시/표시중 chunk가 없습니다.');
    deleteRecoveryCacheChunks(app, chunks, { label:'선택 chunk 캐시', refreshRecovery }).then(() => close());
  });
  document.body.append(overlay);
  render();

  function render() {
    filterBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
    const renderState = getRecoveryCoverageRenderState(rows, selected, { filter, visibleLimit, online: getNetworkProfile().online !== false });
    count.textContent = renderState.countLabel;
    moreBtn.hidden = !renderState.hasMore;
    saveBtn.disabled = renderState.saveDisabled;
    deleteBtn.disabled = renderState.deleteDisabled;
    list.replaceChildren(...renderRecoveryCoverageRows(renderState.visible, selected, (chunk, checked) => {
      if (checked) selected.add(chunk);
      else selected.delete(chunk);
      render();
    }));
  }
}

async function noopAsync() {}
