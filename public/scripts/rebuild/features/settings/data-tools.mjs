import { downloadTextFile } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { splitPreferencesForSync } from '../sync/periodic-state-push.mjs';
import { putSharedPatch } from '../sync/shared-state-write.mjs';
import { putDevicePatch } from '../sync/device-state-write.mjs';

export function bindDataTools(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  listen(app.els.settingsExportBtn, 'click', () => {
    downloadTextFile(`txt-reader-rebuild-settings-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify({ prefs: app.state.prefs, bookmarks: app.state.bookmarks, progress: app.state.progress, recents: app.state.recents }, null, 2));
  });
  listen(app.els.settingsImportBtn, 'click', () => app.els.settingsImportFile?.click());
  listen(app.els.settingsImportFile, 'change', ev => {
    const file = ev.target.files && ev.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result || '{}');
        if (data.prefs) app.state.prefs = { ...app.state.prefs, ...data.prefs };
        if (Array.isArray(data.bookmarks)) app.state.bookmarks = data.bookmarks;
        if (data.progress) app.state.progress = data.progress;
        if (Array.isArray(data.recents)) app.state.recents = data.recents;
        applyPrefs(app);
        app.bookmarks.persist();
        app.reader.persistProgress();
        toast(app, 'success', '가져오기 완료', file.name);
      } catch (e) { toast(app, 'error', '가져오기 실패', e.message || String(e)); }
    };
    reader.readAsText(file);
    ev.target.value = '';
  });


  const passwordOverlay = document.getElementById('account-password-overlay');
  const passwordModal = document.getElementById('account-password-modal');
  const closePasswordModal = () => {
    if (typeof app.closeLayer === 'function') app.closeLayer('accountPasswordOverlay', 'accountPasswordModal');
    else {
      passwordOverlay?.classList.remove('open');
      passwordModal?.classList.remove('open');
      passwordOverlay?.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('settings-submodal-open');
    }
  };
  const openPasswordModal = () => {
    if (typeof app.openLayer === 'function') app.openLayer('accountPasswordOverlay', 'accountPasswordModal');
    else {
      passwordOverlay?.classList.add('open');
      passwordModal?.classList.add('open');
      passwordOverlay?.setAttribute('aria-hidden', 'false');
      document.body.classList.add('settings-submodal-open');
    }
  };

  listen(document.getElementById('open-account-password-modal-btn'), 'click', openPasswordModal);
  listen(document.getElementById('account-password-modal-close'), 'click', closePasswordModal);
  listen(passwordOverlay, 'click', closePasswordModal);

  listen(app.els.accountPasswordChangeBtn, 'click', async () => {
    const current = app.els.accountCurrentPassword?.value || '';
    const next = app.els.accountNewPassword?.value || '';
    const confirmNext = app.els.accountNewPasswordConfirm?.value || '';
    const status = app.els.accountPasswordStatus;
    if (!current || !next || !confirmNext) {
      if (status) status.textContent = '현재 비밀번호, 새 비밀번호, 확인 값을 모두 입력하세요.';
      toast(app, 'warn', '비밀번호 변경', '입력값을 확인하세요.');
      return;
    }
    if (next !== confirmNext) {
      if (status) status.textContent = '새 비밀번호 확인이 일치하지 않습니다.';
      toast(app, 'error', '비밀번호 변경 실패', '확인 값이 일치하지 않습니다.');
      return;
    }
    try {
      if (status) status.textContent = '비밀번호를 변경하는 중입니다.';
      const result = await app.api.changeAccountPassword(current, next, confirmNext);
      if (app.els.accountCurrentPassword) app.els.accountCurrentPassword.value = '';
      if (app.els.accountNewPassword) app.els.accountNewPassword.value = '';
      if (app.els.accountNewPasswordConfirm) app.els.accountNewPasswordConfirm.value = '';
      if (status) status.textContent = result?.sessionPolicy?.otherSessionsRevoked ? '비밀번호가 변경되었습니다. 현재 세션은 유지되고 다른 기존 세션은 만료됩니다.' : '비밀번호가 변경되었습니다.';
      toast(app, 'success', '비밀번호 변경 완료', '현재 세션은 유지됩니다.');
      closePasswordModal();
    } catch (err) {
      const message = err?.data?.message || err?.message || '비밀번호 변경에 실패했습니다.';
      if (status) status.textContent = message;
      toast(app, 'error', '비밀번호 변경 실패', message);
    }
  });



  listen(app.els.settingsLogoutBtn, 'click', async () => {
    const status = app.els.settingsLogoutStatus;
    try {
      if (status) status.textContent = '로그아웃하는 중입니다.';
      await app.api.logout();
      try { localStorage.removeItem('csrf_token'); } catch (e) {}
      location.href = '/login.html';
    } catch (err) {
      const message = err?.data?.message || err?.message || '로그아웃에 실패했습니다.';
      if (status) status.textContent = message;
      toast(app, 'error', '로그아웃 실패', message);
    }
  });

  listen(app.els.settingsResetAppearanceBtn, 'click', () => { app.state.prefs = { ...app.state.defaults, preprocess:{...app.state.prefs.preprocess} }; applyPrefs(app); });
  listen(app.els.settingsResetControlsBtn, 'click', () => {
    ['tapNavEnabled','tapDirection','tapScrollPercent','tapAnim','tapSpeed','swipeNav','swipeThreshold','showClock','showProgress','showNetwork','safeClockPos','safeProgressPos','safeNetworkPos','safeRemainingShow','safeViewportAutoFit','safeTopInsetExtra','safeBottomInsetExtra','clockHour12','clockAmPm','timezone','timezoneOffset'].forEach(key => { app.state.prefs[key] = cloneSettingValue(app.state.defaults[key]); });
    applyPrefs(app);
    toast(app, 'success', '조작/표시 설정 초기화', '기본값으로 되돌렸습니다.');
  });
  listen(app.els.settingsResetSharedBtn, 'click', () => resetSyncedSettings(app, { scope:'shared', applyPrefs }));
  listen(app.els.settingsResetDeviceBtn, 'click', () => resetSyncedSettings(app, { scope:'device', applyPrefs }));
  listen(app.els.settingsResetSyncBtn, 'click', () => resetSyncedSettings(app, { scope:'all', applyPrefs }));
  listen(app.els.settingsResetPreprocessBtn, 'click', () => { app.state.prefs.preprocess = { ...app.state.defaults.preprocess }; app.state.prefs.preprocessPresetId = app.state.defaults.preprocessPresetId; app.state.prefs.preprocessPresetApplyKeys = { ...(app.state.defaults.preprocessPresetApplyKeys || {}) }; app.state.prefs.preprocessPresets = JSON.parse(JSON.stringify(app.state.defaults.preprocessPresets || [])); applyPrefs(app); });
  listen(app.els.settingsResetAllBtn, 'click', () => { if (confirm('로컬 설정을 초기화할까요?')) { app.state.prefs = { ...app.state.defaults, preprocess:{...app.state.defaults.preprocess}, preprocessPresetApplyKeys:{...(app.state.defaults.preprocessPresetApplyKeys || {})}, preprocessPresets:JSON.parse(JSON.stringify(app.state.defaults.preprocessPresets || [])) }; applyPrefs(app); } });
}


async function resetSyncedSettings(app, { scope = 'all', applyPrefs } = {}) {
  const buttons = [app?.els?.settingsResetSyncBtn, app?.els?.settingsResetSharedBtn, app?.els?.settingsResetDeviceBtn].filter(Boolean);
  const status = app?.els?.settingsResetSyncStatus;
  const includeShared = scope === 'all' || scope === 'shared';
  const includeDevice = scope === 'all' || scope === 'device';
  const labels = { all:'기기 · 동기화', shared:'공유 설정', device:'이 기기 설정' };
  const label = labels[scope] || labels.all;
  if (!confirm(`${label}을 기본값으로 초기화할까요?`)) return;
  buttons.forEach(button => { button.disabled = true; });
  if (status) status.textContent = `${label}을 초기화하고 서버에 반영하는 중입니다.`;
  try {
    const current = splitPreferencesForSync(app.state.prefs || {});
    const defaults = splitPreferencesForSync(app.state.defaults || {});
    if (includeShared) replacePreferenceScope(app.state.prefs, current.sharedPrefs, defaults.sharedPrefs);
    if (includeDevice) replacePreferenceScope(app.state.prefs, current.devicePrefs, defaults.devicePrefs);
    applyPrefs(app);

    const requests = [];
    if (includeShared) requests.push(['공유 설정', putSharedPatch(app, { viewerPrefs:cloneSettingValue(defaults.sharedPrefs) })]);
    if (includeDevice) requests.push(['이 기기 설정', putDevicePatch(app, {
      deviceId:app.state.deviceId,
      deviceName:app.state.deviceName,
      prefs:cloneSettingValue(defaults.devicePrefs)
    })]);
    const settled = await Promise.all(requests.map(async ([name, request]) => [name, await request]));
    const failed = settled.filter(([, result]) => result?.synced !== true).map(([name, result]) => `${name}: ${result?.reason || '동기화 실패'}`);
    if (failed.length) {
      const message = `로컬 기본값은 적용했지만 서버 반영에 실패했습니다. ${failed.join(' · ')}`;
      if (status) status.textContent = message;
      toast(app, 'warn', `${label} 초기화 일부 완료`, message);
      return;
    }
    if (status) status.textContent = `${label}을 기본값으로 초기화하고 서버에 반영했습니다.`;
    toast(app, 'success', `${label} 초기화 완료`, '로컬과 서버 설정에 기본값을 적용했습니다.');
  } catch (error) {
    const message = error?.message || String(error);
    if (status) status.textContent = `${label} 초기화 중 오류가 발생했습니다: ${message}`;
    toast(app, 'error', `${label} 초기화 실패`, message);
  } finally {
    buttons.forEach(button => { button.disabled = false; });
  }
}

function replacePreferenceScope(target, currentScope = {}, defaultScope = {}) {
  for (const key of Object.keys(currentScope || {})) delete target[key];
  for (const [key, value] of Object.entries(defaultScope || {})) target[key] = cloneSettingValue(value);
}

function cloneSettingValue(value) {
  if (value == null || typeof value !== 'object') return value;
  try { return structuredClone(value); } catch {}
  return JSON.parse(JSON.stringify(value));
}
