import { createEl } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import {
  READ_DATA_IMPORT_TYPES,
  READ_DATA_IMPORT_POLICIES
} from './read-data-import-constants.mjs';
import {
  emptyImportDetail,
  emptyImportSummary,
  formatImportSummary,
  formatLimitedList
} from './read-data-import-merge.mjs';
import {
  exportReadDataImportDiff,
  renderReadDataImportCompactSummary
} from './read-data-import-diff-export.mjs';
import {
  collectImportPreviewEntries,
  renderReadDataImportFilterPanel
} from './read-data-preview-filter.mjs';
import { openReadDataImportDetailModal } from './read-data-preview-detail-modal.mjs';
import {
  exportReadDataRollbackPreview,
  loadReadDataRollbackSnapshot,
  renderReadDataRollbackPanel
} from './read-data-rollback.mjs';

export const READ_DATA_PREVIEW_ORCHESTRATOR_SPLIT_PASS = 'v194-read-data-preview-orchestrator-split-pass';

let applyPreviewAction = null;

export function setReadDataPreviewActions(actions = {}) {
  applyPreviewAction = typeof actions.applyPreview === 'function' ? actions.applyPreview : null;
}
export { collectImportPreviewEntries } from './read-data-preview-filter.mjs';
export { openReadDataImportDetailModal } from './read-data-preview-detail-modal.mjs';

export function renderReadDataImportPreview(app) {
  const box = app.els.rdmImportPreview;
  if (!box) return;
  const preview = app.state.readDataImportPreview;
  box.innerHTML = '';
  if (!preview) {
    const rollback = loadReadDataRollbackSnapshot();
    if (!rollback) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    renderReadDataRollbackPanel(app, box, rollback);
    return;
  }
  box.hidden = false;
  box.append(
    createEl('div', { class: 'rdm-preview-head' }, [
      createEl('div', { class: 'rdm-preview-title', text: '가져오기 미리보기' }),
      createEl('div', { class: 'rdm-preview-file', text: preview.fileName || '선택한 JSON' })
    ]),
    createEl('div', { class: 'rdm-preview-help', text: '적용 전 현재 데이터와 가져올 데이터의 차이를 확인하고, 항목별 적용 정책을 선택하세요. 적용 직전 rollback snapshot이 로컬에 저장됩니다.' })
  );
  box.append(renderReadDataImportCompactSummary(app, preview));
  READ_DATA_IMPORT_TYPES.forEach(type => {
    const item = preview.summary[type.id] || emptyImportSummary();
    const detail = preview.details?.[type.id] || emptyImportDetail();
    box.append(createEl('div', { class: 'rdm-preview-row' }, [
      createEl('div', { class: 'rdm-preview-info' }, [
        createEl('div', { class: 'rdm-preview-name', text: type.label }),
        createEl('div', { class: 'rdm-preview-meta', text: formatImportSummary(item) }),
        item.staleList?.length ? createEl('div', { class: 'rdm-preview-stale', text: `목록에 없는 항목: ${formatLimitedList(item.staleList, 8)}` }) : null
      ]),
      createEl('div', { class: 'rdm-preview-controls' }, [
        createPolicySelect(app, preview, type.id),
        createEl('button', {
          class: 'rdm-preview-detail',
          type: 'button',
          text: `상세 ${detail.conflicts.length || detail.added.length || detail.stale.length ? '' : '없음'}`.trim(),
          disabled: !detail.conflicts.length && !detail.added.length && !detail.stale.length,
          onclick: () => openReadDataImportDetail(app, type.id)
        })
      ])
    ]));
  });
  renderReadDataImportFilterPanel(app, box, preview, { renderPreview: renderReadDataImportPreview });
  box.append(createEl('div', { class: 'rdm-preview-actions' }, [
    createEl('button', { class: 'rdm-preview-apply', type: 'button', text: '선택 정책으로 적용', onclick: () => applyPreviewAction?.(app) }),
    createEl('button', { class: 'rdm-preview-cancel', type: 'button', text: '취소', onclick: () => cancelReadDataImportPreview(app) }),
    createEl('button', { class: 'rdm-preview-rollback', type: 'button', text: 'Rollback JSON 내보내기', onclick: () => exportReadDataRollbackPreview(app) }),
    createEl('button', { class: 'rdm-preview-rollback', type: 'button', text: '전체 Diff JSON', onclick: () => exportReadDataImportDiff(app, preview, 'all', collectImportPreviewEntries(app, preview)) })
  ]));
}

function createPolicySelect(app, preview, typeId) {
  const select = createEl('select', { class: 'rdm-preview-policy', dataset: { rdmPolicy: typeId }, title: '가져오기 적용 정책' });
  READ_DATA_IMPORT_POLICIES.forEach(policy => {
    const option = createEl('option', { value: policy.id, text: policy.label });
    if ((preview.policies?.[typeId] || 'merge') === policy.id) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', () => {
    preview.policies[typeId] = select.value;
    renderReadDataImportPreview(app);
  });
  return select;
}

function cancelReadDataImportPreview(app) {
  app.state.readDataImportPreview = null;
  renderReadDataImportPreview(app);
  toast(app, 'info', '가져오기 취소', '현재 데이터는 변경되지 않았습니다.');
}

export function openReadDataImportDetail(app, typeId) {
  return openReadDataImportDetailModal(app, typeId, { renderPreview: renderReadDataImportPreview });
}
