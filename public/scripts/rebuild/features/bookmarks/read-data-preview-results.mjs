import { createEl, formatPercent } from '../../core/utils.mjs';
import {
  formatDetailTimestamp,
  itemTimestamp
} from './read-data-import-merge.mjs';

export const READ_DATA_PREVIEW_RESULTS_SPLIT_PASS = 'v194-read-data-preview-results-split-pass';

export function renderImportPreviewResultRow(app, preview, entry, { renderPreview } = {}) {
  const row = createEl('div', { class: `rdm-preview-result-row status-${entry.status}${entry.isStale ? ' is-stale' : ''}` });
  const info = createEl('div', { class: 'rdm-preview-result-info' }, [
    createEl('div', { class: 'rdm-preview-result-title', text: entry.label }),
    createEl('div', { class: 'rdm-preview-result-meta-line', text: formatImportEntryMeta(entry) }),
    createEl('div', { class: 'rdm-preview-result-key', text: entry.key })
  ]);
  const facts = renderImportEntryFacts(entry);
  if (facts) info.append(facts);
  const note = importEntryNote(entry);
  if (note) info.append(createEl('div', { class: 'rdm-detail-note', text: note }));
  row.append(
    createEl('div', { class: 'rdm-preview-result-tags' }, [
      createEl('span', { class: 'rdm-preview-chip', text: entry.typeLabel }),
      createEl('span', { class: `rdm-preview-chip ${entry.status}`, text: statusLabel(entry) }),
      entry.isStale ? createEl('span', { class: 'rdm-preview-chip stale', text: '목록 없음' }) : null
    ]),
    info,
    createImportOverrideSelect(preview, entry.typeId, entry, () => {
      if (typeof renderPreview === 'function') renderPreview(app);
    })
  );
  return row;
}

export function createImportOverrideSelect(preview, typeId, entry, onChange = null) {
  const currentExists = !!entry.current;
  const select = createEl('select', { class: 'rdm-detail-choice', dataset: { rdmOverrideKey: entry.key }, title: '항목별 적용 선택' });
  const options = currentExists
    ? [
      ['policy', '기본 정책 따름'],
      ['current', '현재값 유지'],
      ['incoming', '가져올 값 사용'],
      ['newer', '최신값 사용']
    ]
    : [
      ['policy', '기본 정책 따름'],
      ['incoming', '가져오기'],
      ['current', '가져오지 않음']
    ];
  options.forEach(([value, label]) => {
    const option = createEl('option', { value, text: label });
    if ((preview.overrides?.[typeId]?.[entry.key] || 'policy') === value) option.selected = true;
    select.append(option);
  });
  select.addEventListener('change', () => {
    preview.overrides[typeId] = preview.overrides[typeId] || {};
    if (select.value === 'policy') delete preview.overrides[typeId][entry.key];
    else preview.overrides[typeId][entry.key] = select.value;
    if (typeof onChange === 'function') onChange();
  });
  return select;
}

export function statusLabel(entry) {
  if (entry.status === 'conflict') return '충돌';
  if (entry.status === 'stale') return '목록 없음';
  return '신규';
}

export function formatImportEntryMeta(entry) {
  if (entry.status === 'conflict') return `현재 ${formatDetailTimestamp(entry.current)} · 가져오기 ${formatDetailTimestamp(entry.incoming)}`;
  return formatDetailTimestamp(entry.incoming || entry.current || entry);
}

export function renderImportEntryFacts(entry) {
  const facts = buildImportEntryFacts(entry);
  if (!facts.length) return null;
  return createEl('div', { class: 'rdm-detail-facts' }, facts.map(text => createEl('span', { text })));
}

export function buildImportEntryFacts(entry) {
  const item = entry.incoming || entry.current || {};
  const facts = [];
  if (item.novelId) facts.push(`novel ${item.novelId}`);
  if (item.episodeId) facts.push(`episode ${item.episodeId}`);
  if (Number.isFinite(Number(item.chunk))) facts.push(`chunk ${Number(item.chunk)}`);
  if (Number.isFinite(Number(item.globalBlockIndex))) facts.push(`블럭 ${Number(item.globalBlockIndex) + 1}`);
  else if (Number.isFinite(Number(item.blockIndex))) facts.push(`블럭 ${Number(item.blockIndex) + 1}`);
  if (Number.isFinite(Number(item.documentRatio))) facts.push(formatPercent(Number(item.documentRatio), 1));
  else if (Number.isFinite(Number(item.ratio))) facts.push(formatPercent(Number(item.ratio), 1));
  if (entry.status === 'conflict') {
    const currentTs = itemTimestamp(entry.current || {});
    const incomingTs = itemTimestamp(entry.incoming || {});
    if (currentTs && incomingTs) facts.push(incomingTs >= currentTs ? '가져오기 최신' : '현재값 최신');
  }
  return facts.slice(0, 8);
}

export function importEntryNote(entry) {
  const item = entry.incoming || entry.current || {};
  const text = item.note || item.memo || item.excerpt || '';
  return String(text || '').trim().slice(0, 300);
}
