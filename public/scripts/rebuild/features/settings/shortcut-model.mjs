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

const DEFAULT_SHORTCUTS = Object.freeze(SHORTCUT_ACTIONS.reduce((acc, action) => {
  acc[action.id] = action.defaultKey;
  return acc;
}, {}));

export function normalizeKeyName(value) {
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

export function defaultShortcuts() {
  return { ...DEFAULT_SHORTCUTS };
}

export function normalizeShortcutMap(value) {
  const input = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const out = defaultShortcuts();
  SHORTCUT_ACTIONS.forEach(action => {
    if (!Object.prototype.hasOwnProperty.call(input, action.id)) return;
    out[action.id] = normalizeShortcutString(input[action.id]);
  });
  return out;
}
