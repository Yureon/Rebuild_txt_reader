import { loadLocal, saveLocal } from '../../core/storage.mjs';
import { toast } from '../ui.mjs';
import { getVirtualLayoutDiagnostics } from '../reader/virtual-layout.mjs';
import { copyRecoveryTextWithFallback } from '../recovery/export-utils.mjs';
import { buildRecoverySnapshot } from '../recovery/snapshot-export.mjs';
import { DEVTOOLS_DEFAULT_OPTIONS, DEVTOOLS_REPORT_PASS, DEVTOOLS_SECTIONS, applyDevtoolsOptionsToInputs, collectDevtoolsOptionsFromInputs, formatDevtoolsReport, normalizeDevtoolsOptions, summarizeDevtoolsOptions } from './report.mjs';

export const DEVTOOLS_REPORT_CONTROLS_REFACTOR_PASS = 'v178-devtools-report-controls-pass';
export const DEVTOOLS_OPTIONS_STORAGE_KEY = 'devtoolsReportOptions';

export function setupDevtoolsReportControls(app, on) {
  syncDevtoolsReportControlState(app);
  const rerender = () => {
    const options = collectDevtoolsOptionsFromInputs(app, getSavedDevtoolsReportOptions());
    saveLocal(DEVTOOLS_OPTIONS_STORAGE_KEY, options);
    renderDevtools(app);
  };
  const controls = [
    app.els.devdbgEnable,
    ...DEVTOOLS_SECTIONS.map(item => app.els[`devdbg${item.id.slice(0, 1).toUpperCase()}${item.id.slice(1)}`])
  ].filter(Boolean);
  controls.forEach(input => on(input, 'change', rerender));
}

export function getSavedDevtoolsReportOptions() {
  return normalizeDevtoolsOptions(loadLocal(DEVTOOLS_OPTIONS_STORAGE_KEY, DEVTOOLS_DEFAULT_OPTIONS));
}

export function syncDevtoolsReportControlState(app) {
  applyDevtoolsOptionsToInputs(app, getSavedDevtoolsReportOptions());
}

export function renderDevtools(app) {
  const options = collectDevtoolsOptionsFromInputs(app, getSavedDevtoolsReportOptions());
  const snapshot = options.enabled ? buildRecoverySnapshot(app) : { version: app.state.version };
  if (app.els.devdbgModal) app.els.devdbgModal.dataset.devdbgQualityPass = DEVTOOLS_REPORT_PASS;
  if (app.els.devdbgStatTheme) app.els.devdbgStatTheme.textContent = app.state.prefs.themeMode;
  if (app.els.devdbgStatNovel) app.els.devdbgStatNovel.textContent = app.state.current?.title || '-';
  if (app.els.devdbgStatResults) app.els.devdbgStatResults.textContent = String(app.state.search.results.length);
  if (app.els.devdbgStatChunks) app.els.devdbgStatChunks.textContent = String(app.state.loadedChunks.size);
  if (app.els.devdbgStatErrors) app.els.devdbgStatErrors.textContent = String(app.state.errors.length);
  if (app.els.devdbgStatUpdated) app.els.devdbgStatUpdated.textContent = new Date().toLocaleTimeString();
  if (app.els.devdbgStatOffline) app.els.devdbgStatOffline.textContent = 'HTTP cache';
  if (app.els.devdbgStatQueue) app.els.devdbgStatQueue.textContent = '0';
  if (app.els.devdbgStatCache) app.els.devdbgStatCache.textContent = `${app.state.chunkTextCache.size} memory · ${getVirtualLayoutDiagnostics(app).measureCacheSize || 0} measure`;
  if (app.els.devdbgStatusline) app.els.devdbgStatusline.textContent = `${summarizeDevtoolsOptions(options)} · ${DEVTOOLS_REPORT_PASS}`;
  if (app.els.devdbgOutput) app.els.devdbgOutput.textContent = formatDevtoolsReport(app, snapshot, options);
}

export async function copyDevtoolsReport(app) {
  const text = app.els.devdbgOutput?.textContent || '';
  await copyRecoveryTextWithFallback(app, text, { label:'debug-text', mime:'text/plain' });
  toast(app, 'success', '복사 완료', '디버그 스냅샷을 복사했습니다.');
}
