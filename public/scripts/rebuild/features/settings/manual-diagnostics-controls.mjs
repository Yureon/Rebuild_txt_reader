import { toast } from '../ui.mjs';

export const SETTINGS_MANUAL_DIAGNOSTICS_CONTROLS_PASS = 'v251-settings-manual-diagnostics-controls-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_INLINE_FORM_PASS = 'v251-settings-manual-diagnostics-inline-form-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_CLEAR_PASS = 'v251-settings-manual-diagnostics-clear-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_IMPORT_EXPORT_PASS = 'v251-settings-manual-diagnostics-import-export-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS = 'v252-settings-manual-diagnostics-browser-verification-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_RECOVERY_SUMMARY_PASS = 'v253-settings-manual-diagnostics-recovery-summary-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_PASS = 'v258-settings-manual-diagnostics-browser-export-import-pass';
export const SETTINGS_MANUAL_DIAGNOSTICS_RECOVERY_RELOCATION_PASS = 'v260-reader-manual-diagnostics-recovery-relocation-pass';

function latestManualDiagnostics(app = null) {
  const history = Array.isArray(app?.state?.readerManualDiagnosticsHistory) ? app.state.readerManualDiagnosticsHistory : [];
  return history.at?.(-1) || app?.state?.readerManualDiagnostics || null;
}

function formatManualDiagnosticsTimestamp(value) {
  const time = Number(value);
  if (!Number.isFinite(time) || time <= 0) return '';
  try { return new Date(time).toLocaleString(); } catch (_) { return ''; }
}

export function readReaderManualDiagnosticsInlineForm(app = null) {
  const notes = String(app?.els?.readerManualDiagnosticsNotes?.value || '').trim().slice(0, 160);
  return {
    pass: SETTINGS_MANUAL_DIAGNOSTICS_INLINE_FORM_PASS,
    source:'recovery-center-inline-form',
    pcDragSmooth: !!app?.els?.readerManualDiagnosticsPcSmooth?.checked,
    mobileScrollSmooth: !!app?.els?.readerManualDiagnosticsMobileSmooth?.checked,
    notes
  };
}

export function renderReaderManualDiagnosticsSettingsStatus(app = null) {
  const el = app?.els?.readerManualDiagnosticsStatus;
  if (!el) return '';
  const history = Array.isArray(app?.state?.readerManualDiagnosticsHistory) ? app.state.readerManualDiagnosticsHistory : [];
  const latest = latestManualDiagnostics(app);
  const timestamp = formatManualDiagnosticsTimestamp(latest?.at || latest?.recordedAt);
  const issueCount = history.filter(item => item?.pcDragSmooth === false || item?.mobileScrollSmooth === false || item?.searchJumpOk === false).length;
  const searchOkCount = history.filter(item => item?.searchJumpOk === true).length;
  const liveDomEvidenceCount = history.filter(item => item?.liveRowAvailable === true || item?.highlightedMatch === true).length;
  const importedCount = history.filter(item => /import|export/i.test(String(item?.source || '') + ' ' + String(item?.importSource || ''))).length;
  const label = latest
    ? '최근 기록 ' + history.length + '개 · PC ' + (latest.pcDragSmooth ? '부드러움' : '미확인/문제') + ' · 모바일 ' + (latest.mobileScrollSmooth ? '부드러움' : '미확인/문제') + ' · 검색 ' + (latest.searchJumpOk === true ? '정상' : latest.searchJumpOk === false ? '문제' : '미확인') + ' · 이슈 ' + issueCount + ' · LiveDOM ' + liveDomEvidenceCount + (importedCount ? ' · 가져오기 ' + importedCount : '') + (timestamp ? ' · ' + timestamp : '')
    : '최근 수동 스크롤 진단 기록 없음';
  el.textContent = label;
  el.dataset.readerManualDiagnosticsControlsPass = SETTINGS_MANUAL_DIAGNOSTICS_CONTROLS_PASS;
  el.dataset.readerManualDiagnosticsLastAt = latest?.at ? String(latest.at) : '';
  el.dataset.readerManualDiagnosticsHistoryCount = String(history.length || 0);
  el.dataset.readerManualDiagnosticsIssueCount = String(issueCount || 0);
  el.dataset.readerManualDiagnosticsSearchOkCount = String(searchOkCount || 0);
  el.dataset.readerManualDiagnosticsBrowserVerificationPass = SETTINGS_MANUAL_DIAGNOSTICS_BROWSER_VERIFICATION_PASS;
  el.dataset.readerManualDiagnosticsRecoverySummaryPass = SETTINGS_MANUAL_DIAGNOSTICS_RECOVERY_SUMMARY_PASS;
  el.dataset.readerManualDiagnosticsBrowserExportImportPass = SETTINGS_MANUAL_DIAGNOSTICS_BROWSER_EXPORT_IMPORT_PASS;
  el.dataset.readerManualDiagnosticsRecoveryRelocationPass = SETTINGS_MANUAL_DIAGNOSTICS_RECOVERY_RELOCATION_PASS;
  el.dataset.readerManualDiagnosticsImportedCount = String(importedCount || 0);
  el.dataset.readerManualDiagnosticsLiveDomEvidenceCount = String(liveDomEvidenceCount || 0);
  return label;
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('file read failed'));
    reader.readAsText(file);
  });
}

export function bindReaderManualDiagnosticsSettingsControls(app = null, { on } = {}) {
  const listen = typeof on === 'function' ? on : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const refresh = () => renderReaderManualDiagnosticsSettingsStatus(app);
  listen(app?.els?.readerManualDiagnosticsRecordBtn, 'click', () => {
    const entry = readReaderManualDiagnosticsInlineForm(app);
    const saved = app?.reader?.recordManualDiagnostics?.(entry, () => null);
    refresh();
    toast(app, 'info', '수동 스크롤 진단 저장', saved?.notes ? saved.notes : 'Reader diagnostics history에 기록했습니다.');
  });
  listen(app?.els?.readerManualDiagnosticsClearBtn, 'click', () => {
    app?.reader?.clearManualDiagnostics?.();
    refresh();
    toast(app, 'info', '수동 스크롤 진단 삭제', 'Reader diagnostics history를 비웠습니다.');
  });
  listen(app?.els?.readerManualDiagnosticsExportBtn, 'click', () => {
    const payload = app?.reader?.exportManualDiagnostics?.();
    refresh();
    toast(app, 'success', '수동 진단 내보내기', `수동 스크롤 진단 ${payload?.count || 0}개를 JSON으로 저장했습니다.`);
  });
  listen(app?.els?.readerManualDiagnosticsImportBtn, 'click', () => app?.els?.readerManualDiagnosticsImportFile?.click?.());
  listen(app?.els?.readerManualDiagnosticsImportFile, 'change', async () => {
    const file = app?.els?.readerManualDiagnosticsImportFile?.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const history = app?.reader?.importManualDiagnostics?.(text) || [];
      refresh();
      toast(app, 'success', '수동 진단 가져오기', `수동 스크롤 진단 ${history.length || 0}개를 가져왔습니다.`);
    } catch (error) {
      toast(app, 'error', '수동 진단 가져오기 실패', error?.message || String(error));
    } finally {
      if (app?.els?.readerManualDiagnosticsImportFile) app.els.readerManualDiagnosticsImportFile.value = '';
    }
  });
  listen(app?.els?.readerManualDiagnosticsPcSmooth, 'change', refresh);
  listen(app?.els?.readerManualDiagnosticsMobileSmooth, 'change', refresh);
  listen(app?.els?.readerManualDiagnosticsNotes, 'input', refresh);
  refresh();
}
