import { createEl, escapeHtml } from '../../core/utils.mjs';
import { persistPrefs } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';

import { SHORTCUT_ACTIONS, defaultShortcuts, normalizeShortcutMap, normalizeShortcutString, normalizeKeyName } from './shortcut-model.mjs';
export { SHORTCUT_ACTIONS, defaultShortcuts, normalizeShortcutMap, normalizeShortcutString } from './shortcut-model.mjs';

export function isShortcut(app, actionId, event) {
  if (!event) return false;
  const map = normalizeShortcutMap(app?.state?.prefs?.shortcuts);
  const configured = normalizeShortcutString(map[actionId]);
  if (!configured) return false;
  return configured === shortcutFromEvent(event);
}

export function shortcutFromEvent(event) {
  if (!event) return '';
  const key = normalizeKeyName(event.key || event.code || '');
  if (!key) return '';
  const parts = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  if (event.metaKey) parts.push('Meta');
  parts.push(key);
  return parts.join('+');
}

export function formatShortcut(value) {
  const normalized = normalizeShortcutString(value);
  return normalized || '미지정';
}

export function bindShortcuts(app, { applyPrefs, on, bindGlobal = true } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  ensureShortcutPrefs(app);
  let recordingActionId = '';
  const rerenderShortcutList = () => renderShortcutList(app, { getRecording: () => recordingActionId, setRecording });
  const setRecording = id => {
    recordingActionId = String(id || '');
    rerenderShortcutList();
  };

  const open = () => {
    ensureShortcutPrefs(app);
    rerenderShortcutList();
    app.openLayer?.('shortcutOverlay', 'shortcutPanel');
  };
  const close = () => {
    recordingActionId = '';
    app.closeLayer?.('shortcutOverlay', 'shortcutPanel');
  };
  const reset = () => {
    app.state.prefs.shortcuts = defaultShortcuts();
    persistPrefs(app.state);
    applyPrefs?.(app);
    rerenderShortcutList();
    toast(app, 'success', '단축키 초기화', '기본 단축키로 복원했습니다.');
  };

  listen(app.els.openShortcutBtn, 'click', open);
  listen(app.els.closeShortcutBtn, 'click', close);
  listen(app.els.resetShortcutBtn, 'click', reset);
  listen(app.els.shortcutOverlay, 'click', ev => { if (ev.target === app.els.shortcutOverlay) close(); });
  listen(app.els.shortcutPanel, 'keydown', ev => {
    if (recordingActionId) {
      ev.preventDefault();
      ev.stopPropagation();
      if (ev.key === 'Escape') {
        recordingActionId = '';
        rerenderShortcutList();
        return;
      }
      if (ev.key === 'Backspace' || ev.key === 'Delete') {
        setShortcut(app, recordingActionId, '');
      } else {
        setShortcut(app, recordingActionId, shortcutFromEvent(ev));
      }
      recordingActionId = '';
      persistPrefs(app.state);
      applyPrefs?.(app);
      rerenderShortcutList();
      return;
    }
    if (ev.key === 'Escape') close();
  });

  if (bindGlobal) listen(window, 'keydown', ev => {
    if (recordingActionId) return;
    if (isShortcut(app, 'settingsOpen', ev) && !isEditableTarget(ev.target)) {
      ev.preventDefault();
      app.openLayer?.('settingsOverlay', 'settingsPanel');
      return;
    }
    if (isShortcut(app, 'bookmarksOpen', ev) && !isEditableTarget(ev.target)) {
      ev.preventDefault();
      app.bookmarks?.render?.();
      app.openLayer?.('bookmarkOverlay');
      return;
    }
    if (isShortcut(app, 'themeToggle', ev) && !isEditableTarget(ev.target)) {
      ev.preventDefault();
      app.state.prefs.themeMode = app.state.prefs.themeMode === 'dark' ? 'light' : 'dark';
      applyPrefs?.(app);
    }
  });
}

function ensureShortcutPrefs(app) {
  app.state.prefs.shortcuts = normalizeShortcutMap(app.state.prefs.shortcuts);
}

function renderShortcutList(app, options = {}) {
  const list = app.els.shortcutList;
  if (!list) return;
  const recording = typeof options.getRecording === 'function' ? options.getRecording() : '';
  list.innerHTML = '';
  const groups = new Map();
  SHORTCUT_ACTIONS.forEach(action => {
    if (!groups.has(action.category)) groups.set(action.category, []);
    groups.get(action.category).push(action);
  });
  groups.forEach((actions, category) => {
    list.append(createEl('div', { class: 'sc-category', text: category }));
    actions.forEach(action => {
      const key = app.state.prefs.shortcuts?.[action.id] || '';
      const button = createEl('button', {
        class: `sc-key-btn ${recording === action.id ? 'recording' : ''}`,
        type: 'button',
        safeHtml: recording === action.id ? '입력 중…' : escapeHtml(formatShortcut(key)),
        dataset: { shortcutAction: action.id }
      });
      button.addEventListener('click', () => {
        options.setRecording?.(action.id);
        window.setTimeout(() => button.focus(), 0);
      });
      list.append(createEl('div', { class: 'sc-row' }, [
        createEl('div', { class: 'sc-meta' }, [
          createEl('div', { class: 'sc-label', text: action.label }),
          createEl('div', { class: 'sc-desc', text: action.desc })
        ]),
        button
      ]));
    });
  });
}

function setShortcut(app, actionId, shortcut) {
  ensureShortcutPrefs(app);
  const normalized = normalizeShortcutString(shortcut);
  Object.keys(app.state.prefs.shortcuts).forEach(key => {
    if (key !== actionId && normalized && app.state.prefs.shortcuts[key] === normalized) app.state.prefs.shortcuts[key] = '';
  });
  app.state.prefs.shortcuts[actionId] = normalized;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}
