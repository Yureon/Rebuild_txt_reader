import { formatBytes, setButtonBusy } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import {
  BUILTIN_FONT_CHOICES,
  displayFontName,
  ensureFontStylesheetForFamily,
  isDeviceFontOverrideActive,
  makeCustomFontFamilyValue,
  normalizeFontFamilyValue,
  resolveActiveFontFamily,
  resolveDeviceFontFamily,
  resolveSharedFontFamily
} from './font-resources.mjs';
import { createFontChoiceCard } from './font-choice-card.mjs';

const DEFAULT_FONT = 'var(--font-rd)';
export const SETTINGS_ACCOUNT_FONT_SCOPE_UI_PASS = 'v427-settings-account-font-scope-ui-pass';

export function bindFonts(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  listen(app.els.fontModalBtn, 'click', async () => {
    app.openLayer('fontModalOverlay', 'fontModal');
    await renderFontModal(app, applyPrefs);
  });
  listen(app.els.fontModalClose, 'click', () => app.closeLayer('fontModalOverlay', 'fontModal'));
  listen(app.els.addSharedFontBtn, 'click', () => app.els.sharedFontFile?.click());
  listen(app.els.clearDeviceFontBtn, 'click', async () => {
    app.state.prefs.fontFamilyDevice = '';
    if (typeof applyPrefs === 'function') applyPrefs(app);
    renderBuiltinFonts(app, applyPrefs);
    await renderSharedFonts(app, applyPrefs);
    try { await app.deviceSync?.push?.(); }
    catch { toast(app, 'info', '기기 글꼴 해제', '서버 동기화는 보류되었습니다.'); }
  });
  listen(app.els.sharedFontFile, 'change', async ev => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    for (const file of files) await uploadFont(app, file);
    ev.target.value = '';
    await renderSharedFonts(app, applyPrefs);
  });

  if (/^['"]/.test(resolveActiveFontFamily(app.state.prefs || {}))) {
    renderSharedFonts(app, applyPrefs)
      .then(() => { if (typeof applyPrefs === 'function') applyPrefs(app); })
      .catch(() => {});
  }
}

async function renderFontModal(app, applyPrefs) {
  renderFontSummary(app);
  renderBuiltinFonts(app, applyPrefs);
  await renderSharedFonts(app, applyPrefs);
}

function renderFontSummary(app) {
  const prefs = app.state.prefs || {};
  const active = resolveActiveFontFamily(prefs);
  if (app.els.fontActiveName) app.els.fontActiveName.textContent = displayFontName(active);
  if (app.els.fontActiveScope) app.els.fontActiveScope.textContent = isDeviceFontOverrideActive(prefs) ? '이 기기 전용' : '내 계정 기본';
  if (app.els.clearDeviceFontBtn) app.els.clearDeviceFontBtn.disabled = !isDeviceFontOverrideActive(prefs);
}

function renderBuiltinFonts(app, applyPrefs) {
  const box = app.els.fontModalBuiltin;
  if (!box) return;
  box.innerHTML = '';
  BUILTIN_FONT_CHOICES.forEach(([name, value]) => {
    box.append(createFontChoiceCard(app, {
      name,
      value,
      meta: '시스템 글꼴',
      sample: '가나다라마바사 The quick brown fox',
      onApplyShared: () => applyFontChoice(app, value, 'shared', applyPrefs),
      onApplyDevice: () => applyFontChoice(app, value, 'device', applyPrefs)
    }));
  });
}

async function renderSharedFonts(app, applyPrefs) {
  const box = app.els.sharedFontBtns;
  if (!box) return;
  box.innerHTML = '';
  if (app.els.sharedFontEmpty) app.els.sharedFontEmpty.hidden = true;
  try {
    const data = await app.api.fonts();
    const items = Array.isArray(data.items) ? data.items : [];
    const scope = data.scope || {};
    const scopeLabel = scope.userScoped ? '내 계정 전용' : 'owner 전용';
    if (box) box.dataset.fontAccountScope = scope.userScoped ? 'user' : 'owner';
    registerCustomFontFaces(items);
    items.forEach(item => {
      const family = String(item.family || item.name || 'Custom Font').trim() || 'Custom Font';
      const value = makeCustomFontFamilyValue(family);
      box.append(createFontChoiceCard(app, {
        name: family,
        value,
        meta: `${scopeLabel} · ${item.filename || 'custom'} · ${formatBytes(item.size || 0)}`,
        sample: '사용자 글꼴 미리보기입니다. The quick brown fox.',
        custom: true,
        onApplyShared: () => applyFontChoice(app, value, 'shared', applyPrefs),
        onApplyDevice: () => applyFontChoice(app, value, 'device', applyPrefs),
        onDelete: () => deleteFont(app, item, value, applyPrefs)
      }));
    });
    if (app.els.sharedFontEmpty) app.els.sharedFontEmpty.hidden = items.length > 0;
    if (app.els.sharedFontStatus) {
      const usage = data.usage || {};
      const limits = data.limits || {};
      const maxFiles = Number(limits.maxFiles) || 0;
      const totalBytes = Number(usage.totalBytes) || 0;
      const maxBytes = Number(limits.maxTotalBytes) || 0;
      app.els.sharedFontStatus.textContent = maxFiles
        ? `${scopeLabel} · ${items.length}/${maxFiles}개 · ${formatBytes(totalBytes)} / ${formatBytes(maxBytes)}`
        : `${scopeLabel} · ${items.length}개 · ${formatBytes(totalBytes)}`;
    }
  } catch (e) {
    if (app.els.sharedFontStatus) app.els.sharedFontStatus.textContent = e.message || '폰트 목록 실패';
    if (app.els.sharedFontEmpty) {
      app.els.sharedFontEmpty.hidden = false;
      app.els.sharedFontEmpty.textContent = '사용자 글꼴 목록을 불러오지 못했습니다.';
    }
  }
  renderFontSummary(app);
}

function registerCustomFontFaces(items) {
  const liveStyleIds = new Set();
  items.forEach(item => {
    const family = String(item.family || item.name || 'Custom Font').trim() || 'Custom Font';
    const filename = String(item.filename || family).replace(/[^a-z0-9_-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'custom';
    const styleId = `custom-font-face-${filename}`;
    liveStyleIds.add(styleId);
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      style.dataset.customFontFace = '1';
      document.head.append(style);
    }
    const safeUrl = String(item.url || '').replace(/"/g, '%22');
    style.textContent = `@font-face{font-family:${JSON.stringify(family)};src:url("${safeUrl}");font-display:swap;}`;
  });
  document.querySelectorAll('style[data-custom-font-face="1"]').forEach(style => {
    if (!liveStyleIds.has(style.id)) style.remove();
  });
}

async function applyFontChoice(app, rawValue, scope, applyPrefs) {
  const value = normalizeFontFamilyValue(rawValue, DEFAULT_FONT);
  ensureFontStylesheetForFamily(value);
  if (scope === 'device') {
    app.state.prefs.fontFamilyDevice = value;
  } else {
    app.state.prefs.fontFamily = value;
    app.state.prefs.fontFamilyShared = value;
  }
  if (typeof applyPrefs === 'function') applyPrefs(app);
  renderFontSummary(app);
  renderBuiltinFonts(app, applyPrefs);
  await renderSharedFonts(app, applyPrefs);
  try {
    if (scope === 'device') await app.deviceSync?.push?.();
    else await syncSharedFontPrefs(app, value);
    toast(app, 'success', scope === 'device' ? '기기 글꼴 적용' : '내 계정 글꼴 적용', displayFontName(value));
  } catch {
    toast(app, 'info', '글꼴 로컬 적용', '서버 동기화는 보류되었습니다.');
  }
}

async function syncSharedFontPrefs(app, value) {
  if (!app.api?.putShared) return null;
  const current = app.state.shared || {};
  const shared = {
    ...current,
    viewerPrefs: {
      ...(current.viewerPrefs || {}),
      fontFamily: value,
      fontFamilyShared: value
    },
    updatedAt: Date.now(),
    syncVersion: app.state.sharedVersion || current.syncVersion || 0
  };
  const res = await app.api.putShared(shared);
  if (res && res.shared) app.state.shared = res.shared;
  if (res && res.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
  if (Number(res && res.sharedVersion)) app.state.sharedVersion = Number(res.sharedVersion);
  return res;
}

async function deleteFont(app, item, value, applyPrefs) {
  const filename = String(item && item.filename || '');
  const family = String(item && (item.family || item.name) || filename || '사용자 글꼴');
  if (!filename) return;
  if (!confirm(`사용자 글꼴 '${family}'을(를) 삭제할까요?`)) return;
  try {
    await app.api.deleteFont(filename);
    let needsSharedSync = false;
    let needsDeviceSync = false;
    if (resolveSharedFontFamily(app.state.prefs) === value) {
      app.state.prefs.fontFamily = DEFAULT_FONT;
      app.state.prefs.fontFamilyShared = DEFAULT_FONT;
      needsSharedSync = true;
    }
    if (resolveDeviceFontFamily(app.state.prefs) === value) {
      app.state.prefs.fontFamilyDevice = '';
      needsDeviceSync = true;
    }
    if (typeof applyPrefs === 'function') applyPrefs(app);
    await renderSharedFonts(app, applyPrefs);
    renderBuiltinFonts(app, applyPrefs);
    if (needsSharedSync) await syncSharedFontPrefs(app, DEFAULT_FONT);
    if (needsDeviceSync) await app.deviceSync?.push?.();
    toast(app, 'success', '폰트 삭제', family);
  } catch (e) {
    toast(app, 'error', '폰트 삭제 실패', e.message || String(e));
  }
}

async function uploadFont(app, file) {
  const btn = app.els.addSharedFontBtn;
  try {
    setButtonBusy(btn, true, '업로드 중…');
    const defaultName = file.name.replace(/\.[^.]+$/, '');
    const family = prompt('표시할 글꼴 이름', defaultName) || defaultName;
    await app.api.uploadFont(file, family);
    toast(app, 'success', '내 계정 글꼴 업로드', file.name);
  } catch (e) {
    toast(app, 'error', '폰트 업로드 실패', e.message || String(e));
  } finally {
    setButtonBusy(btn, false);
  }
}
