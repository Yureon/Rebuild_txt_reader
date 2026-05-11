import { createEl } from '../../core/utils.mjs';
import {
  READ_DATA_IMPORT_FILTER_STATUSES,
  READ_DATA_IMPORT_FILTER_TYPES,
  READ_DATA_IMPORT_PAGE_SIZE
} from './read-data-import-constants.mjs';
import { countImportOverrides } from './read-data-import-diff-export.mjs';
import { renderImportPreviewBulkToolbar } from './read-data-preview-bulk-toolbar.mjs';
import {
  collectImportPreviewEntries,
  importEntryMatchesFilter,
  normalizeReadDataImportFilter
} from './read-data-preview-entries.mjs';
import { renderImportPreviewResultRow } from './read-data-preview-results.mjs';

export const READ_DATA_PREVIEW_FILTER_SPLIT_PASS = 'v194-read-data-preview-filter-split-pass';
export const READ_DATA_PREVIEW_FILTER_RENDERER_SPLIT_PASS = 'v195-read-data-preview-filter-renderer-split-pass';

export function renderReadDataImportFilterPanel(app, box, preview, { renderPreview } = {}) {
  const rerender = typeof renderPreview === 'function' ? renderPreview : () => {};
  const filter = normalizeReadDataImportFilter(preview.filter);
  preview.filter = filter;
  const entries = collectImportPreviewEntries(app, preview);
  preview.__lastImportEntryTotal = entries.length;
  const matched = entries.filter(entry => importEntryMatchesFilter(entry, filter));
  const pageSize = READ_DATA_IMPORT_PAGE_SIZE;
  const totalPages = Math.max(1, Math.ceil(matched.length / pageSize));
  filter.page = Math.min(Math.max(0, Number(filter.page) || 0), totalPages - 1);
  const start = filter.page * pageSize;
  const visible = matched.slice(start, start + pageSize);

  const queryInput = createEl('input', {
    class: 'rdm-preview-filter-input',
    type: 'search',
    placeholder: '작품명, novelId, episodeId, 메모, key 검색'
  });
  queryInput.value = filter.query || '';
  const applyQuery = () => {
    filter.query = queryInput.value.trim();
    filter.page = 0;
    rerender(app);
  };
  queryInput.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') applyQuery();
  });

  const panel = createEl('div', { class: 'rdm-preview-filter-panel' }, [
    createEl('div', { class: 'rdm-preview-filter-head' }, [
      createEl('div', {}, [
        createEl('div', { class: 'rdm-preview-filter-title', text: '가져올 항목 검색/필터' }),
        createEl('div', { class: 'rdm-preview-filter-sub', text: `전체 ${entries.length}개 중 ${matched.length}개 표시 대상 · override ${countImportOverrides(preview)}개` })
      ])
    ]),
    createEl('div', { class: 'rdm-preview-filter-controls' }, [
      queryInput,
      createImportFilterSelect('type', filter.type, READ_DATA_IMPORT_FILTER_TYPES, value => {
        filter.type = value;
        filter.page = 0;
        rerender(app);
      }),
      createImportFilterSelect('status', filter.status, READ_DATA_IMPORT_FILTER_STATUSES, value => {
        filter.status = value;
        filter.page = 0;
        rerender(app);
      }),
      createEl('button', { class: 'rdm-preview-filter-btn', type: 'button', text: '검색', onclick: applyQuery }),
      createEl('button', {
        class: 'rdm-preview-filter-btn ghost',
        type: 'button',
        text: '초기화',
        onclick: () => {
          preview.filter = { type: 'all', status: 'all', query: '', page: 0 };
          rerender(app);
        }
      })
    ]),
    renderImportPreviewBulkToolbar(app, preview, matched, filter, { renderPreview: rerender }),
    createEl('div', { class: 'rdm-preview-result-meta', text: matched.length ? `${start + 1}-${Math.min(start + visible.length, matched.length)} / ${matched.length}` : '조건에 맞는 항목이 없습니다.' })
  ]);

  const list = createEl('div', { class: 'rdm-preview-result-list' });
  visible.forEach(entry => list.append(renderImportPreviewResultRow(app, preview, entry, { renderPreview: rerender })));
  if (!visible.length) list.append(createEl('div', { class: 'rdm-preview-result-empty', text: '검색어나 필터 조건을 조정하세요.' }));
  panel.append(list);

  if (matched.length > pageSize) panel.append(renderImportPreviewPager(app, filter, totalPages, { renderPreview: rerender }));
  box.append(panel);
}

export function createImportFilterSelect(kind, value, options, onChange) {
  const select = createEl('select', { class: 'rdm-preview-filter-select', dataset: { importFilter: kind } });
  options.forEach(optionInfo => {
    const option = createEl('option', { value: optionInfo.id, text: optionInfo.label });
    if (optionInfo.id === value) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', () => onChange(select.value));
  return select;
}

export function renderImportPreviewPager(app, filter, totalPages, { renderPreview } = {}) {
  const rerender = typeof renderPreview === 'function' ? renderPreview : () => {};
  return createEl('div', { class: 'rdm-preview-pager' }, [
    createEl('button', {
      type: 'button',
      text: '이전',
      disabled: filter.page <= 0,
      onclick: () => {
        filter.page = Math.max(0, filter.page - 1);
        rerender(app);
      }
    }),
    createEl('span', { text: `${filter.page + 1} / ${totalPages}` }),
    createEl('button', {
      type: 'button',
      text: '다음',
      disabled: filter.page >= totalPages - 1,
      onclick: () => {
        filter.page = Math.min(totalPages - 1, filter.page + 1);
        rerender(app);
      }
    })
  ]);
}

export {
  collectImportPreviewEntries,
  importEntryMatchesFilter,
  normalizeReadDataImportFilter
} from './read-data-preview-entries.mjs';

export {
  clearFilteredImportOverrides,
  renderImportPreviewBulkToolbar,
  setFilteredImportOverrides
} from './read-data-preview-bulk-toolbar.mjs';
