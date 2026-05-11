import { createEl } from '../../core/utils.mjs';

export const RECOVERY_IMPORT_SCOPE_RENDERER_REFACTOR_PASS = 'v167-recovery-import-scope-renderer-pass';

export const RECOVERY_IMPORT_DEFAULT_SCOPES = {
  prefs: true,
  progress: true,
  library: true,
  sharedState: false,
  deviceState: false,
  syncPolicy: false
};

export const RECOVERY_IMPORT_LABELS = {
  prefs: '설정',
  progress: '읽기 위치',
  library: '북마크/최근/즐겨찾기/폴더',
  sharedState: '서버 shared 원본',
  deviceState: '현재 기기 device 원본',
  syncPolicy: '동기화 정책'
};

export function getRecoveryImportScopes(app) {
  const current = app?.state?.recoveryImportScopes && typeof app.state.recoveryImportScopes === 'object' ? app.state.recoveryImportScopes : {};
  const scopes = { ...RECOVERY_IMPORT_DEFAULT_SCOPES, ...current };
  if (app?.state) app.state.recoveryImportScopes = scopes;
  return scopes;
}

export function describeRecoveryPayload(payload, scopes = RECOVERY_IMPORT_DEFAULT_SCOPES) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const shared = source.shared && typeof source.shared === 'object' ? source.shared : null;
  const device = source.device && typeof source.device === 'object' ? source.device : null;
  const lines = [];
  lines.push('선택 범위: ' + Object.entries(scopes).filter(([, value]) => value).map(([key]) => RECOVERY_IMPORT_LABELS[key] || key).join(', '));
  lines.push('설정: ' + (source.prefs || shared?.viewerPrefs || device?.prefs ? '있음' : '없음'));
  lines.push('읽기 위치: ' + (source.progress || shared?.progress ? '있음' : '없음'));
  lines.push('북마크/최근/즐겨찾기: ' + [countItems(source.bookmarks ?? shared?.bookmarks), countItems(source.recents ?? shared?.recents), countItems(source.favorites ?? shared?.favorites)].join(' / '));
  lines.push('shared 원본: ' + (shared ? '있음' : '없음') + ' · device 원본: ' + (device ? '있음' : '없음'));
  return lines.join('\n');
}

export function renderRecoveryImportScopePanel(app) {
  const scopes = getRecoveryImportScopes(app);
  const options = Object.keys(RECOVERY_IMPORT_DEFAULT_SCOPES).map((key) => {
    const input = createEl('input', { type: 'checkbox' });
    input.checked = !!scopes[key];
    input.addEventListener('change', () => {
      const next = getRecoveryImportScopes(app);
      next[key] = !!input.checked;
      if (app?.state) app.state.recoveryImportScopes = next;
    });
    return createEl('label', { class: 'recovery-scope-option' }, [
      input,
      createEl('span', { text: RECOVERY_IMPORT_LABELS[key] || key })
    ]);
  });
  return createEl('section', { class: 'recovery-section', dataset: { recoverySection: 'import-scope' } }, [
    createEl('div', { class: 'recovery-section-title', text: '가져오기 적용 범위' }),
    createEl('div', { class: 'recovery-section-desc', text: 'JSON 복구 시 로컬 표시 상태, 읽기 위치, 서버 원본 반영 범위를 분리합니다. shared/device 원본은 기본적으로 꺼져 있습니다.' }),
    createEl('div', { class: 'recovery-scope-grid' }, options)
  ]);
}

function countItems(value) {
  return Array.isArray(value) ? String(value.length) : '0';
}
