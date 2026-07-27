import { toast } from '../ui.mjs';
import {
  READ_DATA_IMPORT_TYPES
} from './read-data-import-constants.mjs';
import {
  applyArrayImport,
  applyFavoriteImport,
  applyProgressImport,
  applyUserTagImport,
  bookmarkImportKey,
  buildArrayImportDetail,
  buildFavoriteImportDetail,
  buildProgressImportDetail,
  buildUserTagImportDetail,
  createReadDataSnapshot,
  detailToSummary,
  normalizeReadDataPayload,
  recentImportKey,
  userTagRecordsToState
} from './read-data-import-merge.mjs';
import {
  renderReadDataImportPreview,
  openReadDataImportDetail,
  setReadDataPreviewActions
} from './read-data-preview.mjs';
import {
  persistReadDataState,
  saveReadDataRollbackSnapshot,
  setReadDataRollbackCallbacks,
  loadReadDataRollbackSnapshot,
  restoreReadDataRollback
} from './read-data-rollback.mjs';

export {
  READ_DATA_IMPORT_FILTER_STATUSES,
  READ_DATA_IMPORT_FILTER_TYPES,
  READ_DATA_IMPORT_PAGE_SIZE,
  READ_DATA_IMPORT_POLICIES,
  READ_DATA_IMPORT_RESULT_LIMIT,
  READ_DATA_IMPORT_TYPES,
  READ_DATA_ROLLBACK_HISTORY_LIMIT
} from './read-data-import-constants.mjs';
export { resolveImportChoice } from './read-data-import-merge.mjs';
export { renderReadDataImportPreview, openReadDataImportDetail } from './read-data-preview.mjs';
export { loadReadDataRollbackSnapshot, restoreReadDataRollback } from './read-data-rollback.mjs';

let renderReadDataCallback = null;

export function setReadDataImportRenderCallback(callback) {
  renderReadDataCallback = typeof callback === 'function' ? callback : null;
  setReadDataRollbackCallbacks({ renderPreview: renderReadDataImportPreview, renderReadData: renderReadDataCallback });
}

function rerenderReadData(app) {
  if (renderReadDataCallback) renderReadDataCallback(app);
}

export function importReadDataFile(app, ev) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result || '{}');
      if (!data || typeof data !== 'object') throw new Error('JSON 형식이 올바르지 않습니다.');
      app.state.readDataImportPreview = buildReadDataImportPreview(app, data, file.name || 'import.json');
      renderReadDataImportPreview(app);
      toast(app, 'info', '가져오기 미리보기', '적용 전 충돌과 정책을 확인하세요.');
    } catch (error) {
      app.state.readDataImportPreview = null;
      renderReadDataImportPreview(app);
      toast(app, 'error', '가져오기 실패', error?.message || String(error));
    }
  };
  reader.readAsText(file);
  ev.target.value = '';
}

export function buildReadDataImportPreview(app, data, fileName = '') {
  const normalized = normalizeReadDataPayload(data);
  const current = createReadDataSnapshot(app);
  const details = {
    progress: buildProgressImportDetail(app, current.progress, normalized.progress),
    bookmarks: buildArrayImportDetail(app, current.bookmarks, normalized.bookmarks, bookmarkImportKey),
    recents: buildArrayImportDetail(app, current.recents, normalized.recents, recentImportKey),
    favorites: buildFavoriteImportDetail(app, current.favorites, normalized.favorites),
    userTags: buildUserTagImportDetail(app, current.userTagRecords, normalized.userTagRecords)
  };
  const summary = {
    progress: detailToSummary(details.progress),
    bookmarks: detailToSummary(details.bookmarks),
    recents: detailToSummary(details.recents),
    favorites: detailToSummary(details.favorites),
    userTags: detailToSummary(details.userTags)
  };
  return {
    fileName,
    data: normalized,
    rollback: current,
    summary,
    details,
    overrides: { progress: {}, bookmarks: {}, recents: {}, favorites: {}, userTags: {} },
    policies: { progress: 'merge', bookmarks: 'merge', recents: 'merge', favorites: 'merge', userTags: 'merge' },
    filter: { type: 'all', status: 'all', query: '', page: 0 },
    createdAt: Date.now()
  };
}

export function applyReadDataImportPreview(app) {
  const preview = app.state.readDataImportPreview;
  if (!preview) return;
  const policies = preview.policies || {};
  const rollbackPayload = {
    schema: 'txt-reader-read-data-rollback-v1',
    createdAt: new Date().toISOString(),
    sourceFileName: preview.fileName || '',
    progress: preview.rollback.progress,
    bookmarks: preview.rollback.bookmarks,
    recents: preview.rollback.recents,
    favorites: preview.rollback.favorites,
    userTags: preview.rollback.userTags,
    novelUserTags: preview.rollback.novelUserTags,
    userTagRecords: preview.rollback.userTagRecords
  };
  saveReadDataRollbackSnapshot(rollbackPayload);

  if (policies.progress !== 'skip') app.state.progress = applyProgressImport(preview.rollback.progress, preview.data.progress, policies.progress, preview.overrides?.progress);
  if (policies.bookmarks !== 'skip') app.state.bookmarks = applyArrayImport(preview.rollback.bookmarks, preview.data.bookmarks, bookmarkImportKey, policies.bookmarks, 1000, preview.overrides?.bookmarks);
  if (policies.recents !== 'skip') app.state.recents = applyArrayImport(preview.rollback.recents, preview.data.recents, recentImportKey, policies.recents, 200, preview.overrides?.recents);
  if (policies.favorites !== 'skip') app.state.favorites = applyFavoriteImport(preview.rollback.favorites, preview.data.favorites, policies.favorites, preview.overrides?.favorites);
  if (policies.userTags !== 'skip') {
    const mergedUserTags = applyUserTagImport(preview.rollback.userTagRecords, preview.data.userTagRecords, policies.userTags, preview.overrides?.userTags);
    const nextUserTagState = userTagRecordsToState(mergedUserTags);
    app.state.userTags = nextUserTagState.userTags;
    app.state.novelUserTags = nextUserTagState.novelUserTags;
  }

  persistReadDataState(app);
  app.state.readDataImportPreview = null;
  rerenderReadData(app);
  toast(app, 'success', '독서 데이터 가져오기', '선택한 정책으로 적용했습니다. Rollback snapshot은 로컬에 보관됩니다.');
}

setReadDataPreviewActions({ applyPreview: applyReadDataImportPreview });
