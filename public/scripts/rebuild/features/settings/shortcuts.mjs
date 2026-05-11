import { createEl, escapeHtml } from '../../core/utils.mjs';
import { persistPrefs } from '../../state/app-state.mjs';
import { toast } from '../ui.mjs';

export const SHORTCUT_ACTIONS = [
  { id: 'searchOpen', category: '검색', label: '검색 열기', desc: '현재 작품의 본문 검색창을 엽니다.', defaultKey: '/' },
  { id: 'searchNext', category: '검색', label: '다음 검색 결과', desc: '검색 결과가 있을 때 다음 결과로 이동합니다.', defaultKey: 'F3' },
  { id: 'searchPrev', category: '검색', label: '이전 검색 결과', desc: '검색 결과가 있을 때 이전 결과로 이동합니다.', defaultKey: 'Shift+F3' },
  { id: 'readerNext', category: '리더', label: '다음 위치', desc: '다음 chunk/에피소드로 이동합니다.', defaultKey: 'ArrowRight' },
  { id: 'readerPrev', category: '리더', label: '이전 위치', desc: '이전 chunk/에피소드로 이동합니다.', defaultKey: 'ArrowLeft' },
  { id: 'readerPageNext', category: '리더', label: '다음 위치 보조', desc: 'PageDown으로 다음 위치로 이동합니다.', defaultKey: 'PageDown' },
  { id: 'readerPagePrev', category: '리더', label: '이전 위치 보조', desc: 'PageUp으로 이전 위치로 이동합니다.', defaultKey: 'PageUp' },
  { id: 'fullscreen', category: '리더', label: '전체화면 전환', desc: '전체화면을 켜거나 끕니다.', defaultKey: 'F' },
  { id: 'bookmarksOpen', category: '도구', label: '북마크 열기', desc: '북마크 패널을 엽니다.', defaultKey: 'B' },
  { id: 'settingsOpen', category: '도구', label: '설정 열기', desc: '설정 패널을 엽니다.', defaultKey: ',' },
  { id: 'themeToggle', category: '도구', label: '다크/라이트 전환', desc: '현재 테마 모드를 전환합니다.', defaultKey: 'T' }
];

const DEFAULT_SHORTCUTS = SHORTCUT_ACTIONS.reduce((acc, action) => {
  acc[action.id] = action.defaultKey;
  return acc;
}, {});

export function defaultShortcuts() {
  return { ...DEFAULT_SHORTCUTS };
}

export function normalizeShortcutMap(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = defaultShortcuts();
  SHORTCUT_ACTIONS.forEach(action => {
    if (!Object.prototype.hasOwnProperty.call(input, action.id)) return;
    const key = normalizeShortcutString(input[action.id]);
    out[action.id] = key;
  });
  return out;
}

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

export function normalizeShortcutString(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split('+').map(part => part.trim()).filter(Boolean);
  if (!parts.length) return '';
  const key = normalizeKeyName(parts.pop());
  if (!key) return '';
  const mods = new Set();
  parts.forEach(part => {
    const lower = part.toLowerCase();
    if (lower === 'ctrl' || lower === 'control') mods.add('Ctrl');
    else if (lower === 'alt' || lower === 'option') mods.add('Alt');
    else if (lower === 'shift') mods.add('Shift');
    else if (lower === 'meta' || lower === 'cmd' || lower === 'command') mods.add('Meta');
  });
  return ['Ctrl','Alt','Shift','Meta'].filter(mod => mods.has(mod)).concat(key).join('+');
}

export function formatShortcut(value) {
  const normalized = normalizeShortcutString(value);
  return normalized || '미지정';
}

export function bindShortcuts(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  ensureShortcutPrefs(app);
  let recordingActionId = '';

  const open = () => {
    ensureShortcutPrefs(app);
    renderShortcutList(app, {
      getRecording: () => recordingActionId,
      setRecording: id => { recordingActionId = id; renderShortcutList(app, { getRecording: () => recordingActionId, setRecording }); }
    });
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
    renderShortcutList(app, { getRecording: () => recordingActionId, setRecording: id => { recordingActionId = id; renderShortcutList(app, { getRecording: () => recordingActionId, setRecording }); } });
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
        renderShortcutList(app, { getRecording: () => recordingActionId, setRecording: id => { recordingActionId = id; renderShortcutList(app, { getRecording: () => recordingActionId, setRecording }); } });
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
      renderShortcutList(app, { getRecording: () => recordingActionId, setRecording: id => { recordingActionId = id; renderShortcutList(app, { getRecording: () => recordingActionId, setRecording }); } });
      return;
    }
    if (ev.key === 'Escape') close();
  });

  listen(window, 'keydown', ev => {
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

function normalizeKeyName(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const aliases = {
    ' ': 'Space', Spacebar: 'Space', Esc: 'Escape', Del: 'Delete', Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown'
  };
  const aliased = aliases[raw] || raw;
  if (aliased.length === 1) return aliased.toUpperCase();
  if (/^f\d{1,2}$/i.test(aliased)) return aliased.toUpperCase();
  return aliased;
}

function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}
