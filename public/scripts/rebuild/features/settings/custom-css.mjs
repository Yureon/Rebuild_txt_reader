import { persistPrefs } from '../../state/app-state.mjs';
import { status, toast } from '../ui.mjs';
import { CUSTOM_CSS_SCOPE_LABELS, buildCustomCssEditorState, normalizeCustomCss, sanitizeCustomCss } from './custom-css-utils.mjs';

import { putSharedPatch } from '../sync/shared-state-write.mjs';
const CUSTOM_CSS_QUALITY_PASS = 'v594-constructable-user-css-pass';

function cssPrefs(app) {
  if (!app.state.prefs) app.state.prefs = {};
  if (typeof app.state.prefs.customCssShared !== 'string') app.state.prefs.customCssShared = '';
  if (typeof app.state.prefs.customCssDevice !== 'string') app.state.prefs.customCssDevice = '';
  return app.state.prefs;
}

export { applyCustomCssRules } from './custom-css-runtime.mjs';
import { applyCustomCssRules } from './custom-css-runtime.mjs';

export function bindCustomCss(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const scopeButtons = {
    shared: app.els.cssThemeSharedTab,
    device: app.els.cssThemeDeviceTab,
    all: app.els.cssThemeAllTab
  };

  const open = () => {
    app.state.customCssScope = app.state.customCssScope || 'shared';
    renderEditor(app);
    showCustomCssPanel(app, true);
    window.setTimeout(() => app.els.customCssEditor?.focus?.(), 0);
  };
  const close = () => showCustomCssPanel(app, false);
  const apply = () => saveCurrentCss(app, { applyPrefs });
  const reset = () => resetCurrentCss(app, { applyPrefs });

  listen(app.els.openCustomCssBtn, 'click', open);
  listen(app.els.openCustomCssAdvancedBtn, 'click', open);
  listen(app.els.closeCustomCssBtn, 'click', close);
  listen(app.els.customCssOverlay, 'click', ev => { if (ev.target === app.els.customCssOverlay) close(); });
  listen(app.els.applyCustomCssBtn, 'click', apply);
  listen(app.els.resetCustomCssBtn, 'click', reset);
  Object.entries(scopeButtons).forEach(([scope, button]) => {
    listen(button, 'click', () => {
      app.state.customCssScope = scope;
      renderEditor(app);
    });
  });
  listen(app.els.cssViewEditorBtn, 'click', () => setMobileCssView(app, 'editor'));
  listen(app.els.cssViewGuideBtn, 'click', () => setMobileCssView(app, 'guide'));
  listen(app.els.customCssEditor, 'keydown', ev => {
    if ((ev.ctrlKey || ev.metaKey) && String(ev.key).toLowerCase() === 's') {
      ev.preventDefault();
      apply();
      return;
    }
    if (ev.key === 'Escape') {
      ev.preventDefault();
      close();
      return;
    }
    if (ev.key === 'Tab') {
      ev.preventDefault();
      insertTextAtCursor(ev.currentTarget, '  ');
    }
  });
  applyCustomCssRules(app);
}

function showCustomCssPanel(app, visible) {
  if (app.els.customCssPanel) app.els.customCssPanel.dataset.customCssQualityPass = CUSTOM_CSS_QUALITY_PASS;
  if (visible) {
    if (typeof app.openLayer === 'function') app.openLayer('customCssOverlay', 'customCssPanel');
    else {
      app.els.customCssOverlay?.classList.add('open');
      app.els.customCssPanel?.classList.add('open');
    }
    return;
  }
  if (typeof app.closeLayer === 'function') app.closeLayer('customCssOverlay', 'customCssPanel');
  else {
    app.els.customCssOverlay?.classList.remove('open');
    app.els.customCssPanel?.classList.remove('open');
  }
}

function renderEditor(app) {
  const prefs = cssPrefs(app);
  const scope = app.state.customCssScope || 'shared';
  const editor = app.els.customCssEditor;
  const applyBtn = app.els.applyCustomCssBtn;
  const view = buildCustomCssEditorState({
    scope,
    shared: prefs.customCssShared,
    device: prefs.customCssDevice
  });
  if (editor) {
    editor.value = view.value;
    editor.readOnly = view.readOnly;
    editor.placeholder = view.placeholder;
  }
  if (applyBtn) {
    applyBtn.disabled = view.applyDisabled;
    applyBtn.textContent = view.applyText;
    applyBtn.classList.toggle('is-disabled', view.applyDisabled);
  }
  syncCustomCssScopeUi(app, scope);
}

function syncCustomCssScopeUi(app, scope) {
  if (app.els.customCssPanel) app.els.customCssPanel.dataset.customCssScope = scope;
  if (app.els.customCssScopeStatus) app.els.customCssScopeStatus.textContent = CUSTOM_CSS_SCOPE_LABELS[scope] || CUSTOM_CSS_SCOPE_LABELS.shared;
  Object.entries({ shared: app.els.cssThemeSharedTab, device: app.els.cssThemeDeviceTab, all: app.els.cssThemeAllTab }).forEach(([key, button]) => {
    if (!button) return;
    const active = key === scope;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });
}

async function saveCurrentCss(app, { applyPrefs } = {}) {
  const scope = app.state.customCssScope || 'shared';
  if (scope === 'all') {
    toast(app, 'info', '사용자 CSS', '전체 탭은 합산 미리보기입니다. 공유 또는 기기 탭에서 편집하세요.');
    return;
  }
  const rawCss = app.els.customCssEditor?.value || '';
  const sanitized = sanitizeCustomCss(rawCss);
  const css = sanitized.css;
  const prefs = cssPrefs(app);
  if (scope === 'shared') prefs.customCssShared = css;
  else prefs.customCssDevice = css;
  if (sanitized.changed) {
    toast(app, 'info', 'CSS 보안 정리', '위험한 HTML/스크립트/외부 리소스 구문을 제거한 뒤 적용했습니다.');
    if (app.els.customCssEditor && app.els.customCssEditor.value !== css) app.els.customCssEditor.value = css;
  }
  persistPrefs(app.state);
  if (typeof applyPrefs === 'function') applyPrefs(app);
  else applyCustomCssRules(app);

  try {
    if (scope === 'shared') await syncSharedCustomCss(app, css);
    else await app.deviceSync?.push?.();
    status(app, 'sync', scope === 'shared' ? '공유 CSS 저장 완료' : '기기 CSS 저장 완료');
  } catch (e) {
    toast(app, 'info', 'CSS 로컬 적용', '서버 동기화는 보류되었습니다.');
  }
}

async function resetCurrentCss(app, { applyPrefs } = {}) {
  const scope = app.state.customCssScope || 'shared';
  if (scope === 'all') {
    toast(app, 'info', '사용자 CSS', '전체 탭은 미리보기입니다. 공유 또는 기기 탭에서 초기화하세요.');
    return;
  }
  if (!confirm(scope === 'shared' ? '공유 사용자 CSS를 초기화할까요?' : '이 기기 사용자 CSS를 초기화할까요?')) return;
  const prefs = cssPrefs(app);
  if (scope === 'shared') prefs.customCssShared = '';
  else prefs.customCssDevice = '';
  persistPrefs(app.state);
  if (typeof applyPrefs === 'function') applyPrefs(app);
  else applyCustomCssRules(app);
  renderEditor(app);
  try {
    if (scope === 'shared') await syncSharedCustomCss(app, '');
    else await app.deviceSync?.push?.();
    status(app, 'sync', scope === 'shared' ? '공유 CSS 초기화 완료' : '기기 CSS 초기화 완료');
  } catch {
    toast(app, 'info', 'CSS 로컬 초기화', '서버 동기화는 보류되었습니다.');
  }
}

async function syncSharedCustomCss(app, css) {
  await putSharedPatch(app, { viewerPrefs:{ customCssShared:normalizeCustomCss(css) } });
}

function setMobileCssView(app, mode) {
  const editorActive = mode !== 'guide';
  if (app.els.customCssPanel) app.els.customCssPanel.dataset.customCssView = editorActive ? 'editor' : 'guide';
  if (app.els.cssEditorPane) app.els.cssEditorPane.classList.toggle('is-hidden-mobile-view', !editorActive);
  if (app.els.cssGuidePane) app.els.cssGuidePane.classList.toggle('is-hidden-mobile-view', editorActive);
  if (app.els.cssViewEditorBtn) {
    app.els.cssViewEditorBtn.classList.toggle('is-active', editorActive);
    app.els.cssViewEditorBtn.setAttribute('aria-selected', editorActive ? 'true' : 'false');
  }
  if (app.els.cssViewGuideBtn) {
    app.els.cssViewGuideBtn.classList.toggle('is-active', !editorActive);
    app.els.cssViewGuideBtn.setAttribute('aria-selected', editorActive ? 'false' : 'true');
  }
}

function insertTextAtCursor(textarea, text) {
  if (!textarea) return;
  const start = Number(textarea.selectionStart) || 0;
  const end = Number(textarea.selectionEnd) || start;
  const value = String(textarea.value || '');
  textarea.value = value.slice(0, start) + text + value.slice(end);
  const next = start + text.length;
  textarea.setSelectionRange(next, next);
}
