import { READ_DATA_IMPORT_FILTER_STATUSES, READ_DATA_IMPORT_FILTER_TYPES, READ_DATA_IMPORT_TYPES } from './read-data-import-constants.mjs';
import { emptyImportDetail, itemTimestamp } from './read-data-import-merge.mjs';
import { statusLabel } from './read-data-preview-results.mjs';

export const READ_DATA_PREVIEW_ENTRIES_SPLIT_PASS = 'v195-read-data-preview-entries-split-pass';

export function collectImportPreviewEntries(app, preview) {
  const out = [];
  READ_DATA_IMPORT_TYPES.forEach(type => {
    const detail = preview.details?.[type.id] || emptyImportDetail();
    const staleKeys = new Set((detail.stale || []).map(entry => entry.key));
    (detail.conflicts || []).forEach(entry => out.push(normalizeImportPreviewEntry(app, type, entry, 'conflict', staleKeys)));
    (detail.added || []).forEach(entry => out.push(normalizeImportPreviewEntry(app, type, entry, 'added', staleKeys)));
  });
  out.sort((a, b) => {
    const typeDiff = READ_DATA_IMPORT_TYPES.findIndex(type => type.id === a.typeId) - READ_DATA_IMPORT_TYPES.findIndex(type => type.id === b.typeId);
    if (typeDiff) return typeDiff;
    return itemTimestamp(b.incoming || b.current || {}) - itemTimestamp(a.incoming || a.current || {});
  });
  return out;
}

export function normalizeImportPreviewEntry(app, type, entry, status, staleKeys) {
  const normalized = {
    ...entry,
    typeId: type.id,
    typeLabel: type.label,
    status,
    isStale: staleKeys.has(entry.key)
  };
  normalized.searchText = importEntrySearchText(app, normalized);
  return normalized;
}

export function importEntryMatchesFilter(entry, filter) {
  if (filter.type !== 'all' && entry.typeId !== filter.type) return false;
  if (filter.status === 'stale' && !entry.isStale) return false;
  if (filter.status === 'conflict' && entry.status !== 'conflict') return false;
  if (filter.status === 'added' && entry.status !== 'added') return false;
  const query = String(filter.query || '').trim().toLowerCase();
  if (!query) return true;
  return entry.searchText.includes(query);
}

export function normalizeReadDataImportFilter(filter = {}) {
  const type = READ_DATA_IMPORT_FILTER_TYPES.some(item => item.id === filter.type) ? filter.type : 'all';
  const status = READ_DATA_IMPORT_FILTER_STATUSES.some(item => item.id === filter.status) ? filter.status : 'all';
  return {
    type,
    status,
    query: String(filter.query || '').trim().slice(0, 120),
    page: Math.max(0, Number(filter.page) || 0)
  };
}

export function importEntrySearchText(app, entry) {
  const item = entry.incoming || entry.current || {};
  const current = entry.current || {};
  const incoming = entry.incoming || {};
  const novelId = item.novelId || current.novelId || incoming.novelId || '';
  const novel = novelId ? app.state.novelById?.get?.(novelId) : null;
  return [
    entry.typeLabel,
    statusLabel(entry),
    entry.key,
    entry.label,
    novelId,
    item.episodeId,
    current.title,
    incoming.title,
    current.label,
    incoming.label,
    novel?.title,
    current.note,
    incoming.note,
    current.memo,
    incoming.memo,
    current.tag,
    incoming.tag,
    ...(Array.isArray(current.novelIds) ? current.novelIds : []),
    ...(Array.isArray(incoming.novelIds) ? incoming.novelIds : [])
  ].filter(Boolean).join(' ').toLowerCase();
}
