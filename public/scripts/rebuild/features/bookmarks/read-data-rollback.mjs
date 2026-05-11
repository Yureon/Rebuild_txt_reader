import { createEl, downloadTextFile } from '../../core/utils.mjs';
import { persistBookData } from '../../state/app-state.mjs';
import { loadLocal, removeLocal, saveLocal } from '../../core/storage.mjs';
import { toast } from '../ui.mjs';
import { formatDate } from './read-data-model.mjs';
import {
  createReadDataSnapshot,
  normalizeProgressMerge,
  progressSnapshotMap
} from './read-data-import-merge.mjs';
import { READ_DATA_ROLLBACK_HISTORY_LIMIT } from './read-data-import-constants.mjs';

let renderReadDataImportPreviewCallback = null;
let renderReadDataCallback = null;

export function setReadDataRollbackCallbacks({ renderPreview, renderReadData } = {}) {
  renderReadDataImportPreviewCallback = typeof renderPreview === 'function' ? renderPreview : null;
  renderReadDataCallback = typeof renderReadData === 'function' ? renderReadData : null;
}

function rerenderReadDataImportPreview(app) {
  if (renderReadDataImportPreviewCallback) renderReadDataImportPreviewCallback(app);
}

function rerenderReadData(app) {
  if (renderReadDataCallback) renderReadDataCallback(app);
}

export function exportReadDataRollbackPreview(app) {
  const preview = app.state.readDataImportPreview;
  const snapshot = preview?.rollback || createReadDataSnapshot(app);
  const payload = {
    schema: 'txt-reader-read-data-rollback-v1',
    createdAt: new Date().toISOString(),
    sourceFileName: preview?.fileName || '',
    progress: snapshot.progress,
    bookmarks: snapshot.bookmarks,
    recents: snapshot.recents,
    favorites: snapshot.favorites
  };
  downloadTextFile(`txt-reader-read-data-rollback-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(payload, null, 2));
}

export function renderReadDataRollbackPanel(app, box, rollback) {
  const history = loadReadDataRollbackHistory();
  const latest = rollback || history[0];
  const counts = latest ? rollbackCounts(latest) : { progress: 0, bookmarks: 0, recents: 0, favorites: 0 };
  box.append(
    createEl('div', { class: 'rdm-preview-head' }, [
      createEl('div', { class: 'rdm-preview-title', text: history.length > 1 ? `Rollback history ${history.length}개 보관 중` : 'Rollback snapshot 보관 중' }),
      createEl('div', { class: 'rdm-preview-file', text: latest?.createdAt ? formatDate(Date.parse(latest.createdAt)) : '저장됨' })
    ]),
    createEl('div', { class: 'rdm-preview-help', text: `가져오기 적용 직전 데이터입니다. 읽기 위치 ${counts.progress} · 북마크 ${counts.bookmarks} · 최근 ${counts.recents} · 즐겨찾기 ${counts.favorites}` }),
    createEl('div', { class: 'rdm-preview-actions' }, [
      createEl('button', { class: 'rdm-preview-apply', type: 'button', text: '최신 Rollback 복원', disabled: !latest, onclick: () => restoreReadDataRollback(app, 0) }),
      createEl('button', { class: 'rdm-preview-rollback', type: 'button', text: '최신 JSON 내보내기', disabled: !latest, onclick: () => exportStoredReadDataRollback(app, 0) }),
      createEl('button', { class: 'rdm-preview-cancel', type: 'button', text: history.length > 1 ? 'Rollback 전체 삭제' : 'Rollback 삭제', disabled: !history.length, onclick: () => clearReadDataRollback(app) })
    ])
  );
  if (history.length > 1) renderReadDataRollbackHistory(app, box, history);
}

function renderReadDataRollbackHistory(app, box, history) {
  const list = createEl('div', { class: 'rdm-rollback-history' }, [
    createEl('div', { class: 'rdm-rollback-history-title', text: `최근 rollback snapshot ${history.length}개` })
  ]);
  history.forEach((snapshot, index) => {
    const counts = rollbackCounts(snapshot);
    list.append(createEl('div', { class: 'rdm-rollback-row' }, [
      createEl('div', { class: 'rdm-rollback-info' }, [
        createEl('div', { class: 'rdm-rollback-name', text: `${index + 1}. ${snapshot.sourceFileName || 'import.json'} · ${snapshot.createdAt ? formatDate(Date.parse(snapshot.createdAt)) : '저장됨'}` }),
        createEl('div', { class: 'rdm-rollback-meta', text: `위치 ${counts.progress} · 북마크 ${counts.bookmarks} · 최근 ${counts.recents} · 즐겨찾기 ${counts.favorites}` })
      ]),
      createEl('div', { class: 'rdm-rollback-actions' }, [
        createEl('button', { type: 'button', text: '복원', onclick: () => restoreReadDataRollback(app, index) }),
        createEl('button', { type: 'button', text: '내보내기', onclick: () => exportStoredReadDataRollback(app, index) }),
        createEl('button', { type: 'button', text: '삭제', onclick: () => deleteReadDataRollbackHistoryItem(app, index) })
      ])
    ]));
  });
  box.append(list);
}

export function rollbackCounts(snapshot = {}) {
  return {
    progress: progressSnapshotMap(snapshot.progress || {}).size,
    bookmarks: Array.isArray(snapshot.bookmarks) ? snapshot.bookmarks.length : 0,
    recents: Array.isArray(snapshot.recents) ? snapshot.recents.length : 0,
    favorites: Array.isArray(snapshot.favorites) ? snapshot.favorites.length : 0
  };
}

export function loadReadDataRollbackSnapshot() {
  const history = loadReadDataRollbackHistory();
  return history[0] || null;
}

export function loadReadDataRollbackHistory() {
  const historyRaw = loadLocal('readDataRollbackHistory', []);
  const latestRaw = loadLocal('readDataRollbackSnapshot', null);
  const out = [];
  const seen = new Set();
  const add = item => {
    if (!item || typeof item !== 'object') return;
    if (item.schema !== 'txt-reader-read-data-rollback-v1') return;
    const normalized = normalizeRollbackSnapshot(item);
    const counts = rollbackCounts(normalized);
    const signature = [normalized.createdAt, normalized.sourceFileName, counts.progress, counts.bookmarks, counts.recents, counts.favorites].join('|');
    if (seen.has(signature)) return;
    seen.add(signature);
    out.push(normalized);
  };
  add(latestRaw);
  (Array.isArray(historyRaw) ? historyRaw : []).forEach(add);
  out.sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  return out.slice(0, READ_DATA_ROLLBACK_HISTORY_LIMIT);
}

export function saveReadDataRollbackSnapshot(snapshot) {
  const normalized = normalizeRollbackSnapshot(snapshot);
  const history = [normalized, ...loadReadDataRollbackHistory()]
    .sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0));
  const deduped = [];
  const seen = new Set();
  history.forEach(item => {
    const counts = rollbackCounts(item);
    const signature = [item.createdAt, item.sourceFileName, counts.progress, counts.bookmarks, counts.recents, counts.favorites].join('|');
    if (seen.has(signature)) return;
    seen.add(signature);
    deduped.push(item);
  });
  const trimmed = deduped.slice(0, READ_DATA_ROLLBACK_HISTORY_LIMIT);
  saveLocal('readDataRollbackSnapshot', trimmed[0] || normalized);
  saveLocal('readDataRollbackHistory', trimmed);
}

export function normalizeRollbackSnapshot(data = {}) {
  return {
    schema: 'txt-reader-read-data-rollback-v1',
    createdAt: data.createdAt || new Date().toISOString(),
    sourceFileName: data.sourceFileName || '',
    progress: data.progress && typeof data.progress === 'object' ? normalizeProgressMerge({}, data.progress) : { lastRead: null, byNovel: {}, positions: {}, readMeta: {} },
    bookmarks: Array.isArray(data.bookmarks) ? data.bookmarks.filter(item => item && typeof item === 'object') : [],
    recents: Array.isArray(data.recents) ? data.recents.filter(item => item && typeof item === 'object') : [],
    favorites: Array.isArray(data.favorites) ? data.favorites.map(String).filter(Boolean) : []
  };
}

export function restoreReadDataRollback(app, index = 0) {
  const snapshot = loadReadDataRollbackHistory()[index] || loadReadDataRollbackSnapshot();
  if (!snapshot) return toast(app, 'error', 'Rollback 복원 실패', '보관된 rollback snapshot이 없습니다.');
  if (!confirm('선택한 rollback snapshot으로 복원할까요? 현재 독서 데이터는 rollback 내용으로 교체됩니다.')) return;
  applyReadDataSnapshot(app, snapshot);
  toast(app, 'success', 'Rollback 복원', '선택한 가져오기 적용 전 데이터로 복원했습니다.');
}

export function exportStoredReadDataRollback(app, index = 0) {
  const snapshot = loadReadDataRollbackHistory()[index] || loadReadDataRollbackSnapshot();
  if (!snapshot) return toast(app, 'error', 'Rollback 내보내기 실패', '보관된 rollback snapshot이 없습니다.');
  downloadTextFile(`txt-reader-read-data-rollback-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(snapshot, null, 2));
}

export function deleteReadDataRollbackHistoryItem(app, index) {
  const history = loadReadDataRollbackHistory();
  if (!history[index]) return;
  if (!confirm('선택한 rollback snapshot을 삭제할까요?')) return;
  history.splice(index, 1);
  if (history[0]) saveLocal('readDataRollbackSnapshot', history[0]);
  else removeLocal('readDataRollbackSnapshot');
  if (history.length) saveLocal('readDataRollbackHistory', history);
  else removeLocal('readDataRollbackHistory');
  rerenderReadDataImportPreview(app);
  toast(app, 'info', 'Rollback 삭제', '선택한 rollback snapshot을 삭제했습니다.');
}

export function clearReadDataRollback(app) {
  const history = loadReadDataRollbackHistory();
  if (!history.length) return;
  if (!confirm(history.length > 1 ? '보관된 rollback history를 모두 삭제할까요?' : '보관된 rollback snapshot을 삭제할까요?')) return;
  removeLocal('readDataRollbackSnapshot');
  removeLocal('readDataRollbackHistory');
  rerenderReadDataImportPreview(app);
  toast(app, 'info', 'Rollback 삭제', '보관된 rollback snapshot을 삭제했습니다.');
}

export function applyReadDataSnapshot(app, snapshot) {
  const normalized = normalizeRollbackSnapshot(snapshot);
  app.state.progress = normalized.progress;
  app.state.bookmarks = normalized.bookmarks;
  app.state.recents = normalized.recents;
  app.state.favorites = new Set(normalized.favorites);
  persistReadDataState(app);
  app.state.readDataImportPreview = null;
  rerenderReadData(app);
}

export function persistReadDataState(app) {
  app.reader?.persistProgress?.();
  persistBookData(app.state);
  app.bookmarks?.persist?.();
  app.bookmarks?.render?.();
  app.library?.render?.();
}

