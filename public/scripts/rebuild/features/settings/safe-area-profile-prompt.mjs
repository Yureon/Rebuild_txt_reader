export const SAFE_AREA_PROFILE_PROMPT_HELPER_PASS = 'v220-safe-area-profile-prompt-helper-pass';

export function normalizeSafeProfileName(value, fallback = '') {
  return String(value || '').trim().slice(0, 40) || String(fallback || '').trim().slice(0, 40) || 'Safe area profile';
}

export function makeSafeProfileId(now = Date.now(), randomValue = Math.random()) {
  return `safe-${Number(now || Date.now()).toString(36)}-${String(Number(randomValue || 0).toString(36)).slice(2, 7)}`;
}

export function promptSafeProfileName({ message, currentName, fallbackName, promptFn } = {}) {
  const ask = typeof promptFn === 'function' ? promptFn : window.prompt.bind(window);
  const answer = ask(message || '프리셋 이름을 입력하세요.', currentName || fallbackName || '');
  if (answer == null) return null;
  return normalizeSafeProfileName(answer, fallbackName || currentName || '');
}

export function confirmSafeProfileDelete(profile, confirmFn) {
  const ask = typeof confirmFn === 'function' ? confirmFn : window.confirm.bind(window);
  return ask(`'${profile?.name || ''}' 보정 프리셋을 삭제할까요?`);
}
