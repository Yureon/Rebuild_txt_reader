import { isSafeStateRecordKey } from '../../state/app-state.mjs';
import { createEl } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import {
  exportReadDataImportDiff,
  formatImportChoiceLabel
} from './read-data-import-diff-export.mjs';

export const READ_DATA_PREVIEW_BULK_TOOLBAR_SPLIT_PASS = 'v195-read-data-preview-bulk-toolbar-split-pass';

export function renderImportPreviewBulkToolbar(app, preview, matched, filter, { renderPreview } = {}) {
  const conflictCount = matched.filter(entry => entry.status === 'conflict').length;
  const addLikeCount = matched.filter(entry => entry.status !== 'conflict').length;
  return createEl('div', { class: 'rdm-preview-bulkbar' }, [
    createEl('div', { class: 'rdm-preview-bulk-title', text: `필터 결과 ${matched.length}개 · 충돌 ${conflictCount} · 신규/목록없음 ${addLikeCount}` }),
    createEl('div', { class: 'rdm-preview-bulk-actions' }, [
      createEl('button', { type: 'button', text: '가져오기', disabled: !matched.length, onclick: () => setFilteredImportOverrides(app, preview, matched, 'incoming', { renderPreview }) }),
      createEl('button', { type: 'button', text: '현재/제외', disabled: !matched.length, onclick: () => setFilteredImportOverrides(app, preview, matched, 'current', { renderPreview }) }),
      createEl('button', { type: 'button', text: '충돌 최신값', disabled: !conflictCount, onclick: () => setFilteredImportOverrides(app, preview, matched.filter(entry => entry.status === 'conflict'), 'newer', { renderPreview }) }),
      createEl('button', { type: 'button', text: '기본정책', disabled: !matched.length, onclick: () => clearFilteredImportOverrides(app, preview, matched, { renderPreview }) }),
      createEl('button', { type: 'button', text: '필터 Diff JSON', disabled: !matched.length, onclick: () => exportReadDataImportDiff(app, preview, 'filtered', matched, filter) })
    ])
  ]);
}

export function setFilteredImportOverrides(app, preview, entries, choice, { renderPreview } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return;
  list.forEach(entry => {
    if (!isSafeStateRecordKey(entry.typeId) || !isSafeStateRecordKey(entry.key)) return;
    preview.overrides[entry.typeId] = preview.overrides[entry.typeId] || {};
    preview.overrides[entry.typeId][entry.key] = choice;
  });
  if (typeof renderPreview === 'function') renderPreview(app);
  toast(app, 'info', '가져오기 선택 반영', `필터 결과 ${list.length}개를 “${formatImportChoiceLabel(choice)}”로 지정했습니다.`);
}

export function clearFilteredImportOverrides(app, preview, entries, { renderPreview } = {}) {
  const list = Array.isArray(entries) ? entries : [];
  if (!list.length) return;
  list.forEach(entry => {
    if (preview.overrides?.[entry.typeId]) delete preview.overrides[entry.typeId][entry.key];
  });
  if (typeof renderPreview === 'function') renderPreview(app);
  toast(app, 'info', '가져오기 선택 초기화', `필터 결과 ${list.length}개의 항목별 선택을 기본 정책으로 되돌렸습니다.`);
}
