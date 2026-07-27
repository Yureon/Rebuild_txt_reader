import { createEl } from '../../core/utils.mjs';
import { READ_DATA_IMPORT_TYPES } from './read-data-import-constants.mjs';
import { emptyImportDetail } from './read-data-import-merge.mjs';
import { activateModalFocus } from '../ui/modal-focus-manager.mjs';
import {
  createImportOverrideSelect,
  formatImportEntryMeta,
  importEntryNote,
  renderImportEntryFacts
} from './read-data-preview-results.mjs';

export const READ_DATA_PREVIEW_DETAIL_MODAL_SPLIT_PASS = 'v194-read-data-preview-detail-modal-split-pass';

export function openReadDataImportDetailModal(app, typeId, { renderPreview } = {}) {
  const preview = app.state.readDataImportPreview;
  const type = READ_DATA_IMPORT_TYPES.find(item => item.id === typeId);
  if (!preview || !type) return;
  const detail = preview.details?.[typeId] || emptyImportDetail();
  const overlay = createEl('div', { class: 'rdm-detail-overlay' });
  const titleId = `rdm-detail-title-${Date.now()}`;
  const modal = createEl('div', { class: 'rdm-detail-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby':titleId, tabindex:'-1' });
  let deactivateFocus = () => {};
  const close = () => {
    deactivateFocus();
    overlay.remove();
    if (typeof renderPreview === 'function') renderPreview(app);
  };
  overlay.addEventListener('click', ev => {
    if (ev.target === overlay) close();
  });
  modal.append(
    createEl('div', { class: 'rdm-detail-header' }, [
      createEl('div', {}, [
        createEl('h4', { id:titleId, text: `${type.label} 가져오기 상세` }),
        createEl('p', { text: `신규 ${detail.added.length} · 충돌 ${detail.conflicts.length} · 목록 없음 ${detail.stale.length}` })
      ]),
      createEl('button', { class: 'rdm-detail-close', type: 'button', text: '✕', onclick: close })
    ])
  );
  if (!detail.conflicts.length && !detail.added.length && !detail.stale.length) {
    modal.append(createEl('div', { class: 'rdm-detail-empty', text: '표시할 충돌이나 신규 항목이 없습니다.' }));
  } else {
    if (detail.conflicts.length) modal.append(renderConflictDetailList(preview, typeId, detail.conflicts));
    if (detail.added.length) modal.append(renderImportDetailSection(preview, typeId, '신규 항목', detail.added, 'incoming'));
    if (detail.stale.length) modal.append(renderImportDetailSection(preview, typeId, '목록에서 찾을 수 없는 항목', detail.stale, 'stale'));
  }
  modal.append(createEl('div', { class: 'rdm-detail-footer' }, [
    createEl('button', { type: 'button', text: '닫기', onclick: close })
  ]));
  overlay.append(modal);
  document.body.append(overlay);
  deactivateFocus = activateModalFocus({ overlay, dialog:modal, onRequestClose:close, accessibleName:`${type.label} 가져오기 상세` });
}

export function renderConflictDetailList(preview, typeId, conflicts) {
  const list = createEl('div', { class: 'rdm-detail-section' }, [
    createEl('h5', { text: '충돌 항목' }),
    createEl('p', { text: '항목별로 기본 정책을 따르거나 현재값/가져올 값/최신값을 선택할 수 있습니다.' })
  ]);
  conflicts.slice(0, 120).forEach(entry => {
    list.append(renderImportDetailEntryRow(preview, typeId, { ...entry, status: 'conflict' }, false));
  });
  if (conflicts.length > 120) list.append(createEl('div', { class: 'rdm-detail-more', text: `외 ${conflicts.length - 120}개 충돌 항목은 기본 정책으로 처리됩니다.` }));
  return list;
}

export function renderImportDetailSection(preview, typeId, title, entries, tone) {
  const list = createEl('div', { class: `rdm-detail-section rdm-detail-${tone}` }, [
    createEl('h5', { text: `${title} ${entries.length}` }),
    tone === 'incoming'
      ? createEl('p', { text: '신규 항목도 개별 선택에서 “가져오지 않음”으로 제외할 수 있습니다.' })
      : createEl('p', { text: '현재 라이브러리 목록에 없는 novelId를 참조하는 항목입니다. 필요하면 개별적으로 제외하세요.' })
  ]);
  entries.slice(0, 120).forEach(entry => {
    const status = tone === 'stale' ? 'stale' : 'added';
    list.append(renderImportDetailEntryRow(preview, typeId, { ...entry, status }, true));
  });
  if (entries.length > 120) list.append(createEl('div', { class: 'rdm-detail-more', text: `외 ${entries.length - 120}개` }));
  return list;
}

export function renderImportDetailEntryRow(preview, typeId, entry, compact = false) {
  const row = createEl('div', { class: `rdm-detail-row${compact ? ' compact' : ''}` });
  const info = createEl('div', { class: 'rdm-detail-info' }, [
    createEl('div', { class: 'rdm-detail-name', text: entry.label }),
    createEl('div', { class: 'rdm-detail-meta', text: formatImportEntryMeta(entry) }),
    createEl('div', { class: 'rdm-detail-key', text: entry.key })
  ]);
  const facts = renderImportEntryFacts(entry);
  if (facts) info.append(facts);
  const note = importEntryNote(entry);
  if (note) info.append(createEl('div', { class: 'rdm-detail-note', text: note }));
  row.append(info, createImportOverrideSelect(preview, typeId, entry));
  return row;
}
