import { loadLocal, saveLocal } from '../../core/storage.mjs';
import { downloadTextFile, safeJsonParse } from '../../core/utils.mjs';
import {
  appendReaderManualDiagnosticsSnapshot,
  buildReaderManualDiagnosticsRecoverySummary,
  buildReaderManualDiagnosticsTrendBundle,
  normalizeManualDiagnosticsEntry,
  READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS
} from './manual-diagnostics-snapshot.mjs';

export const READER_MANUAL_DIAGNOSTICS_STORAGE_PASS = 'v251-reader-manual-diagnostics-storage-pass';
export const READER_MANUAL_DIAGNOSTICS_IMPORT_EXPORT_PASS = 'v251-reader-manual-diagnostics-import-export-pass';
export const READER_MANUAL_DIAGNOSTICS_IMPORT_SCHEMA_PASS = 'v252-reader-manual-diagnostics-import-schema-pass';
export const READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_PASS = 'v258-reader-manual-diagnostics-browser-export-import-pass';
const STORAGE_KEY = 'reader.manualDiagnosticsHistory.v1';
const IMPORT_LIMIT = 24;

function normalizeReaderManualDiagnosticsHistory(history = [], limit = 8) {
  return (Array.isArray(history) ? history : [])
    .filter(item => item && typeof item === 'object')
    .map(item => normalizeManualDiagnosticsEntry(item))
    .slice(-Math.max(1, Number(limit) || 8));
}

function extractHistoryArrayFromManualDiagnosticsPayload(source = null) {
  const payload = source && typeof source === 'object' ? source : null;
  if (Array.isArray(source)) return { history: source, shape:'array' };
  if (!payload) return { history: [], shape:'empty' };
  const candidates = [
    ['history', payload.history],
    ['readerManualDiagnosticsHistory', payload.readerManualDiagnosticsHistory],
    ['manualDiagnosticsHistory', payload.manualDiagnosticsHistory],
    ['entries', payload.entries],
    ['browserChecks', payload.browserChecks],
    ['snapshots', payload.snapshots],
    ['items', payload.items],
    ['trendBundle.items', payload.trendBundle?.items],
    ['recoverySummary.trendBundle.items', payload.recoverySummary?.trendBundle?.items],
    ['recoverySummary.issueNotes', payload.recoverySummary?.issueNotes]
  ];
  for (const [shape, value] of candidates) {
    if (Array.isArray(value)) return { history: value, shape };
  }
  if (payload.snapshot && typeof payload.snapshot === 'object') return { history:[payload.snapshot], shape:'snapshot' };
  if (payload.manualDiagnostics && typeof payload.manualDiagnostics === 'object') return { history:[payload.manualDiagnostics], shape:'manualDiagnostics' };
  if (payload.readerManualDiagnostics && typeof payload.readerManualDiagnostics === 'object') return { history:[payload.readerManualDiagnostics], shape:'readerManualDiagnostics' };
  if ('pcDragSmooth' in payload || 'mobileScrollSmooth' in payload || 'searchJumpOk' in payload) return { history:[payload], shape:'single-entry' };
  return { history: [], shape:'unknown' };
}

function decorateImportedManualDiagnosticsHistory(history = [], metadata = {}) {
  const importSource = String(metadata.shape || metadata.source || 'browser-export-import');
  return history.map((item) => ({
    ...item,
    source: item?.source || 'manual-browser-export-import',
    importSource: item?.importSource || importSource
  }));
}

export function buildReaderManualDiagnosticsImportPreview(payload = null) {
  const source = typeof payload === 'string' ? safeJsonParse(payload, null) : payload;
  const extracted = extractHistoryArrayFromManualDiagnosticsPayload(source);
  const history = normalizeReaderManualDiagnosticsHistory(decorateImportedManualDiagnosticsHistory(extracted.history, extracted), IMPORT_LIMIT);
  const recoverySummary = buildReaderManualDiagnosticsRecoverySummary(history);
  return {
    pass: READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_PASS,
    schemaPass: READER_MANUAL_DIAGNOSTICS_IMPORT_SCHEMA_PASS,
    realExportTrendPass: READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS,
    shape: extracted.shape,
    count: history.length,
    history,
    trendBundle: buildReaderManualDiagnosticsTrendBundle(history),
    recoverySummary,
    acceptedShapes: ['history','readerManualDiagnosticsHistory','manualDiagnosticsHistory','entries','browserChecks','snapshots','items','snapshot','single-entry']
  };
}

function applyReaderManualDiagnosticsHistory(app = null, history = []) {
  const normalized = normalizeReaderManualDiagnosticsHistory(history, IMPORT_LIMIT);
  if (app?.state) {
    app.state.readerManualDiagnosticsHistory = normalized;
    app.state.readerManualDiagnostics = normalized.at?.(-1) || null;
    app.state.readerManualDiagnosticsRecoveryTrend = buildReaderManualDiagnosticsTrendBundle(normalized);
    app.state.readerManualDiagnosticsRecoverySummary = buildReaderManualDiagnosticsRecoverySummary(normalized);
  }
  saveLocal(STORAGE_KEY, normalized);
  return normalized;
}

export function loadReaderManualDiagnosticsHistory(app = null) {
  if (!app?.state) return [];
  const history = loadLocal(STORAGE_KEY, []);
  return applyReaderManualDiagnosticsHistory(app, history).slice(-8);
}

export function saveReaderManualDiagnosticsHistory(app = null) {
  return applyReaderManualDiagnosticsHistory(app, app?.state?.readerManualDiagnosticsHistory || []).slice(-8);
}

export function appendAndSaveReaderManualDiagnosticsSnapshot(app = null, entry = {}) {
  const saved = appendReaderManualDiagnosticsSnapshot(app, entry, IMPORT_LIMIT);
  saveReaderManualDiagnosticsHistory(app);
  return saved;
}

export function clearReaderManualDiagnosticsHistory(app = null) {
  if (app?.state) {
    app.state.readerManualDiagnosticsHistory = [];
    app.state.readerManualDiagnostics = null;
    app.state.readerManualDiagnosticsRecoveryTrend = buildReaderManualDiagnosticsTrendBundle([]);
    app.state.readerManualDiagnosticsRecoverySummary = buildReaderManualDiagnosticsRecoverySummary([]);
  }
  saveLocal(STORAGE_KEY, []);
  return [];
}

export function buildReaderManualDiagnosticsHistoryPayload(app = null) {
  const history = normalizeReaderManualDiagnosticsHistory(app?.state?.readerManualDiagnosticsHistory || [], IMPORT_LIMIT);
  const recoverySummary = buildReaderManualDiagnosticsRecoverySummary(history);
  return {
    pass: READER_MANUAL_DIAGNOSTICS_IMPORT_EXPORT_PASS,
    schemaPass: READER_MANUAL_DIAGNOSTICS_IMPORT_SCHEMA_PASS,
    browserExportImportPass: READER_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_PASS,
    realExportTrendPass: READER_MANUAL_DIAGNOSTICS_REAL_EXPORT_TREND_PASS,
    exportedAt: Date.now(),
    count: history.length,
    history,
    trendBundle: buildReaderManualDiagnosticsTrendBundle(history),
    recoverySummary
  };
}

export function exportReaderManualDiagnosticsHistory(app = null, filename = '') {
  const payload = buildReaderManualDiagnosticsHistoryPayload(app);
  const name = filename || `txt-reader-manual-diagnostics-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  downloadTextFile(name, JSON.stringify(payload, null, 2), 'application/json');
  return payload;
}

export function importReaderManualDiagnosticsHistory(app = null, payload = null) {
  const preview = buildReaderManualDiagnosticsImportPreview(payload);
  return applyReaderManualDiagnosticsHistory(app, preview.history);
}

export function promptAndAppendReaderManualDiagnosticsSnapshot(app = null, entry = {}, promptFn = null) {
  const ask = typeof promptFn === 'function' ? promptFn : (typeof window !== 'undefined' ? window.prompt?.bind(window) : null);
  const base = { source:'manual-browser-check', ...entry };
  if (ask && entry.pcDragSmooth == null) base.pcDragSmooth = /^y|true|ok|smooth|부드/i.test(String(ask('PC 드래그 스크롤이 부드러웠나요? y/n', 'y') || ''));
  if (ask && entry.mobileScrollSmooth == null) base.mobileScrollSmooth = /^y|true|ok|smooth|부드/i.test(String(ask('모바일 스크롤이 부드러웠나요? y/n', 'y') || ''));
  if (ask && !entry.notes) base.notes = String(ask('수동 검수 메모', '') || '');
  return appendAndSaveReaderManualDiagnosticsSnapshot(app, base);
}
