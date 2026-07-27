// Library folder hover-open delay is a fixed runtime constant.
import { clamp } from '../../core/utils.mjs';
import { applyFunctionalPrefs, normalizeFunctionalPrefs } from './functional-runtime.mjs';
export { applyFunctionalPrefs, normalizeFunctionalPrefs } from './functional-runtime.mjs';
import { setActive, setChecked, setHidden, setText, setValue, toggleCollapsed } from './control-dom-utils.mjs';
import {
  SAFE_BOTTOM_MAX,
  SAFE_BOTTOM_MIN,
  SAFE_TOP_MAX,
  SAFE_TOP_MIN,
  applySafeTemplate,
  copySafeViewportDebug,
  deleteSafeProfile,
  findSafeProfileById,
  getEffectiveSafeViewportPrefs,
  getSafeViewportContext,
  normalizeSafeViewportProfiles,
  renameSafeProfile,
  renderSafeProfileControls,
  renderSafeViewportDebug,
  saveSafeProfile
} from './safe-area-controls.mjs';
import { formatClockForPrefs } from './clock-format.mjs';
import { formatFunctionalMsValue, formatFunctionalPercentValue, formatFunctionalPxValue } from './functional-labels.mjs';
import {
  copyLibraryVirtualSettingsStatus,
  openLibraryVirtualRecoveryCenter,
  renderLibraryVirtualSettingsStatus
} from './library-virtual-status.mjs';
import { bindReaderManualDiagnosticsSettingsControls, renderReaderManualDiagnosticsSettingsStatus } from './manual-diagnostics-controls.mjs';

export { formatClockForPrefs } from './clock-format.mjs';
export { normalizeSafeViewportProfiles } from './safe-area-controls.mjs';

export function bindFunctionalControls(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const set = patch => {
    Object.assign(app.state.prefs, patch || {});
    applyPrefs?.(app);
  };
  const setNumber = (key, value, min, max) => set({ [key]: clamp(value, min, max) });
  const setSafeViewportPatch = patch => {
    const prefs = app.state.prefs || {};
    const normalizedPatch = { ...patch };
    if ('safeTopInsetExtra' in normalizedPatch) normalizedPatch.safeTopInsetExtra = clamp(normalizedPatch.safeTopInsetExtra, SAFE_TOP_MIN, SAFE_TOP_MAX);
    if ('safeBottomInsetExtra' in normalizedPatch) normalizedPatch.safeBottomInsetExtra = clamp(normalizedPatch.safeBottomInsetExtra, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX);
    const context = getSafeViewportContext(app);
    const profiles = normalizeSafeViewportProfiles(prefs.safeViewportProfiles || []);
    const selectedId = String(prefs.safeViewportProfileId || '');
    const selectedProfile = profiles.find(profile => profile.id === selectedId);
    const activeCandidate = selectedProfile?.contextKey === context.key
      ? selectedId
      : String(app.state.viewportFit?.activeSafeProfileId || app.els.safeViewportProfileSelect?.value || '');
    const activeId = activeCandidate;
    const idx = profiles.findIndex(profile => profile.id === activeId && profile.contextKey === context.key);
    Object.assign(prefs, normalizedPatch);
    if (idx >= 0) {
      profiles[idx] = {
        ...profiles[idx],
        safeViewportAutoFit: 'safeViewportAutoFit' in normalizedPatch ? !!normalizedPatch.safeViewportAutoFit : !!profiles[idx].safeViewportAutoFit,
        safeTopInsetExtra: 'safeTopInsetExtra' in normalizedPatch ? normalizedPatch.safeTopInsetExtra : profiles[idx].safeTopInsetExtra,
        safeBottomInsetExtra: 'safeBottomInsetExtra' in normalizedPatch ? normalizedPatch.safeBottomInsetExtra : profiles[idx].safeBottomInsetExtra,
        updatedAt: Date.now()
      };
      prefs.safeViewportProfiles = normalizeSafeViewportProfiles(profiles);
      prefs.safeViewportProfileId = activeId;
    }
    applyPrefs?.(app);
  };

  listen(app.els.tapNavToggle, 'change', ev => set({ tapNavEnabled: !!ev.target.checked }));
  listen(app.els.tapDirV, 'click', () => set({ tapDirection: 'vertical' }));
  listen(app.els.tapDirH, 'click', () => set({ tapDirection: 'horizontal' }));
  listen(app.els.tapScrollSlider, 'input', ev => setNumber('tapScrollPercent', ev.target.value, 30, 100));
  listen(app.els.tapAnimToggle, 'change', ev => set({ tapAnim: !!ev.target.checked }));
  listen(app.els.tapSpeedSlider, 'input', ev => setNumber('tapSpeed', ev.target.value, 100, 800));
  listen(app.els.swipeNavToggle, 'change', ev => set({ swipeNav: !!ev.target.checked }));
  listen(app.els.swipeThresholdSlider, 'input', ev => setNumber('swipeThreshold', ev.target.value, 24, 100));
  listen(app.els.readerEpisodeBoundaryManualBtn, 'click', () => set({ readerEpisodeBoundaryMode: 'manual' }));
  listen(app.els.readerEpisodeBoundaryAutoBtn, 'click', () => set({ readerEpisodeBoundaryMode: 'scrollBeyond' }));

  listen(app.els.safeClockToggle, 'change', ev => set({ showClock: !!ev.target.checked, safeClockShow: !!ev.target.checked }));
  listen(app.els.safeProgressToggle, 'change', ev => set({ showProgress: !!ev.target.checked, safeProgressShow: !!ev.target.checked }));
  listen(app.els.safeNetworkToggle, 'change', ev => set({ showNetwork: !!ev.target.checked }));
  listen(app.els.safeRemainingToggle, 'change', ev => set({ safeRemainingShow: !!ev.target.checked }));
  listen(app.els.safeClockPos, 'change', ev => set({ safeClockPos: ev.target.value || 'left' }));
  listen(app.els.safeProgressPos, 'change', ev => set({ safeProgressPos: ev.target.value || 'right' }));
  listen(app.els.safeNetworkPos, 'change', ev => set({ safeNetworkPos: ev.target.value || 'auto' }));
  listen(app.els.safeViewportAutoToggle, 'change', ev => setSafeViewportPatch({ safeViewportAutoFit: !!ev.target.checked }));
  listen(app.els.safeTopExtraSlider, 'input', ev => setSafeViewportPatch({ safeTopInsetExtra: ev.target.value }));
  listen(app.els.safeBottomExtraSlider, 'input', ev => setSafeViewportPatch({ safeBottomInsetExtra: ev.target.value }));
  listen(app.els.safeInsetPresetBtns, 'click', ev => {
    const btn = ev.target?.closest?.('[data-safe-preset]');
    if (!btn) return;
    const [top, bottom] = String(btn.dataset.safePreset || '0,0').split(',').map(v => Number(v));
    setSafeViewportPatch({
      safeViewportAutoFit: false,
      safeTopInsetExtra: clamp(top, SAFE_TOP_MIN, SAFE_TOP_MAX),
      safeBottomInsetExtra: clamp(bottom, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX)
    });
  });

  listen(app.els.safeViewportProfileSelect, 'change', ev => {
    const id = ev.target.value || '';
    const profile = findSafeProfileById(app.state.prefs, id);
    if (!profile) {
      set({ safeViewportProfileId: '' });
      return;
    }
    set({
      safeViewportProfileId: profile.id,
      safeViewportAutoFit: !!profile.safeViewportAutoFit,
      safeTopInsetExtra: profile.safeTopInsetExtra,
      safeBottomInsetExtra: profile.safeBottomInsetExtra
    });
  });
  listen(app.els.safeViewportProfileSave, 'click', () => saveSafeProfile(app, { applyPrefs, mode: 'update' }));
  listen(app.els.safeViewportProfileNew, 'click', () => saveSafeProfile(app, { applyPrefs, mode: 'new' }));
  listen(app.els.safeViewportProfileRename, 'click', () => renameSafeProfile(app, { applyPrefs }));
  listen(app.els.safeViewportProfileDelete, 'click', () => deleteSafeProfile(app, { applyPrefs }));
  listen(app.els.safeViewportDebugCopy, 'click', () => copySafeViewportDebug(app));
  listen(app.els.safeViewportTemplateBtns, 'click', ev => {
    const btn = ev.target?.closest?.('[data-safe-template]');
    if (!btn) return;
    applySafeTemplate(app, { applyPrefs, templateKey: btn.dataset.safeTemplate || 'current-balanced' });
  });

  listen(app.els.clockFormatSelect, 'change', ev => set({ clockHour12: ev.target.value === '12' }));
  listen(app.els.clockAmpmToggle, 'change', ev => set({ clockAmPm: !!ev.target.checked }));
  listen(app.els.timezoneSelect, 'change', ev => set({ timezone: ev.target.value || 'Asia/Seoul' }));
  listen(app.els.tzCustomInput, 'input', ev => setNumber('timezoneOffset', ev.target.value, -720, 840));


  const refreshLibraryVirtualStatus = () => renderLibraryVirtualSettingsStatus(app);
  listen(app.els.settingsBtn, 'click', () => window.setTimeout(refreshLibraryVirtualStatus, 80));
  listen(app.els.libraryVirtualSettingsRefresh, 'click', refreshLibraryVirtualStatus);
  listen(app.els.libraryVirtualOpenRecoveryBtn, 'click', () => openLibraryVirtualRecoveryCenter(app));
  listen(app.els.libraryVirtualCopyStatusBtn, 'click', () => copyLibraryVirtualSettingsStatus(app));
  listen(document, 'txt-reader:library-virtual-diagnostics', refreshLibraryVirtualStatus);
  refreshLibraryVirtualStatus();
  bindReaderManualDiagnosticsSettingsControls(app, { on: listen });
}



function normalizeReaderEpisodeBoundaryMode(value) {
  const mode = String(value || 'manual');
  if (mode === 'scrollBeyond' || mode === 'scroll-beyond' || mode === 'scroll') return 'scrollBeyond';
  return 'manual';
}

function formatReaderEpisodeBoundaryMode(mode) {
  const normalized = normalizeReaderEpisodeBoundaryMode(mode);
  if (normalized === 'scrollBeyond') return '현재: 자동 — 현재 화가 실제 100% 바닥에 있을 때 한 번 더 아래로 스크롤하면 다음 화로 이동합니다.';
  return '현재: 수동 — 다음 화는 하단 다음 버튼이나 단축키로만 이동합니다.';
}


function syncReadControlVisibility(app, p) {
  setHidden(app.els.tapNavDetailsSection, p.tapNavEnabled === false);
  setHidden(app.els.tapSpeedSection, p.tapAnim === false);
  setHidden(app.els.swipeThresholdSection, p.swipeNav === false);
}

export function syncFunctionalInputs(app, p) {
  setChecked(app.els.tapNavToggle, p.tapNavEnabled !== false);
  setActive(app.els.tapDirV, p.tapDirection !== 'horizontal');
  setActive(app.els.tapDirH, p.tapDirection === 'horizontal');
  setValue(app.els.tapScrollSlider, p.tapScrollPercent);
  setText(app.els.tapScrollVal, formatFunctionalPercentValue(p.tapScrollPercent));
  setChecked(app.els.tapAnimToggle, p.tapAnim !== false);
  setValue(app.els.tapSpeedSlider, p.tapSpeed);
  setText(app.els.tapSpeedVal, formatFunctionalMsValue(p.tapSpeed));
  setChecked(app.els.swipeNavToggle, p.swipeNav !== false);
  setValue(app.els.swipeThresholdSlider, p.swipeThreshold);
  setText(app.els.swipeThresholdVal, formatFunctionalPxValue(p.swipeThreshold));
  setActive(app.els.readerEpisodeBoundaryManualBtn, p.readerEpisodeBoundaryMode !== 'scrollBeyond');
  setActive(app.els.readerEpisodeBoundaryAutoBtn, p.readerEpisodeBoundaryMode === 'scrollBeyond');
  setText(app.els.readerEpisodeBoundaryModeStatus, formatReaderEpisodeBoundaryMode(p.readerEpisodeBoundaryMode));
  syncReadControlVisibility(app, p);

  setChecked(app.els.safeClockToggle, p.showClock !== false);
  setChecked(app.els.safeProgressToggle, p.showProgress !== false);
  setChecked(app.els.safeNetworkToggle, p.showNetwork !== false);
  setChecked(app.els.safeRemainingToggle, !!p.safeRemainingShow);
  setValue(app.els.safeClockPos, p.safeClockPos);
  setValue(app.els.safeProgressPos, p.safeProgressPos);
  setValue(app.els.safeNetworkPos, p.safeNetworkPos);
  const safeUiPrefs = getEffectiveSafeViewportPrefs(app, p);
  setChecked(app.els.safeViewportAutoToggle, safeUiPrefs.safeViewportAutoFit === true);
  setValue(app.els.safeTopExtraSlider, safeUiPrefs.safeTopInsetExtra);
  setText(app.els.safeTopExtraVal, formatFunctionalPxValue(safeUiPrefs.safeTopInsetExtra));
  setValue(app.els.safeBottomExtraSlider, safeUiPrefs.safeBottomInsetExtra);
  setText(app.els.safeBottomExtraVal, formatFunctionalPxValue(safeUiPrefs.safeBottomInsetExtra));
  renderSafeProfileControls(app, p);
  renderSafeViewportDebug(app);
  setValue(app.els.clockFormatSelect, p.clockHour12 ? '12' : '24');
  setChecked(app.els.clockAmpmToggle, !!p.clockAmPm);
  setValue(app.els.timezoneSelect, p.timezone || 'Asia/Seoul');
  setValue(app.els.tzCustomInput, p.timezoneOffset);
  toggleCollapsed(app.els.safeClockPosWrap, p.showClock === false);
  toggleCollapsed(app.els.safeProgressPosWrap, p.showProgress === false);
  toggleCollapsed(app.els.safeNetworkPosWrap, p.showNetwork === false);
  toggleCollapsed(app.els.clockAmpmWrap, !p.clockHour12);
  toggleCollapsed(app.els.tzCustomWrap, p.timezone !== 'custom');

  renderReaderManualDiagnosticsSettingsStatus(app);
}
