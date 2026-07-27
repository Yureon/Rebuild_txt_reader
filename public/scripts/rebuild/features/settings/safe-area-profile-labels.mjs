import { escapeHtml } from './control-dom-utils.mjs';

export const SAFE_AREA_PROFILE_LABELS_PASS = 'v219-safe-area-profile-labels-pass';
export const SAFE_AREA_PROFILE_OPTION_LIST_PASS = 'v223-safe-area-profile-option-list-pass';

export function formatSafeProfileOptionHtml(profile = {}) {
  const name = profile.name || '';
  const context = profile.contextLabel || profile.contextKey || '모든 모드';
  return `${escapeHtml(name)} · ${escapeHtml(context)} · 상 ${Number(profile.safeTopInsetExtra) || 0}px / 하 ${Number(profile.safeBottomInsetExtra) || 0}px`;
}

export function formatSafeProfileStatusText({ selected = null, matchingCount = 0, contextKey = '' } = {}) {
  if (selected) return '적용 중: ' + selected.name + ' · 재진입 시 현재 컨텍스트(' + contextKey + ')에서 자동 적용됩니다.';
  if (matchingCount > 0) return '현재 컨텍스트용 프리셋 ' + matchingCount + '개가 있습니다. 하나를 선택하거나 권장 템플릿을 적용하세요.';
  return '현재 컨텍스트용 프리셋이 없습니다. 권장 템플릿을 적용한 뒤 슬라이더로 조정하세요.';
}


export function buildSafeProfileSelectOptionsHtml(profiles = []) {
  const safeProfiles = Array.isArray(profiles) ? profiles : [];
  const options = ['<option value="">프리셋 선택 안 함</option>'];
  safeProfiles.forEach((profile) => {
    options.push(`<option value="${escapeHtml(profile.id || '')}">${formatSafeProfileOptionHtml(profile)}</option>`);
  });
  return options.join('');
}
