import { clamp } from '../../core/utils.mjs';
import { setText } from './control-dom-utils.mjs';
import {
  SAFE_BOTTOM_MAX,
  SAFE_BOTTOM_MIN,
  SAFE_TOP_MAX,
  SAFE_TOP_MIN
} from './safe-area-constants.mjs';
import {
  getEffectiveSafeViewportPrefs,
  getSafeViewportContext,
  normalizeSafeViewportProfiles
} from './safe-area-context.mjs';
import {
  getSafeTemplate,
  makeSafeTemplateId
} from './safe-area-template-factory.mjs';
import { buildSafeProfileSelectOptionsHtml, formatSafeProfileStatusText } from './safe-area-profile-labels.mjs';
import { confirmSafeProfileDelete, makeSafeProfileId, promptSafeProfileName } from './safe-area-profile-prompt.mjs';

export const SAFE_AREA_PROFILE_ACTIONS_SPLIT_PASS = 'v194-safe-area-profile-actions-split-pass';

export function renderSafeProfileControls(app, p) {
  const select = app.els.safeViewportProfileSelect;
  if (!select) return;
  const profiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []);
  const currentContext = getSafeViewportContext(app);
  const contextText = `현재: ${currentContext.label}`;
  setText(app.els.safeViewportContext, contextText);
  const selectedId = String(p.safeViewportProfileId || '');
  const activeId = String(app.state?.viewportFit?.activeSafeProfileId || '');
  const effectiveSelectedId = profiles.some(profile => profile.id === selectedId)
    ? selectedId
    : (profiles.some(profile => profile.id === activeId && profile.contextKey === currentContext.key) ? activeId : '');
  const html = buildSafeProfileSelectOptionsHtml(profiles);
  if (select.innerHTML !== html) select.innerHTML = html;
  select.value = effectiveSelectedId;
  const hasSelected = !!select.value;
  if (app.els.safeViewportProfileRename) app.els.safeViewportProfileRename.disabled = !hasSelected;
  if (app.els.safeViewportProfileDelete) app.els.safeViewportProfileDelete.disabled = !hasSelected;
  const selected = profiles.find(profile => profile.id === effectiveSelectedId);
  const matchingCount = profiles.filter(profile => profile.contextKey === currentContext.key).length;
  const status = formatSafeProfileStatusText({ selected, matchingCount, contextKey: currentContext.key });
  setText(app.els.safeViewportProfileStatus, status);
}

export function applySafeTemplate(app, { applyPrefs, templateKey = 'current-balanced' } = {}) {
  const p = app.state.prefs || {};
  const context = getSafeViewportContext(app);
  const tpl = getSafeTemplate(context, templateKey);
  const id = makeSafeTemplateId(context, tpl.key);
  const profile = {
    id,
    name: tpl.name,
    contextKey: context.key,
    contextLabel: context.label,
    uaKey: context.uaKey,
    displayMode: context.displayMode,
    isBrowserFullscreen: !!context.isBrowserFullscreen,
    isStandalone: !!context.isStandalone,
    safeViewportAutoFit: false,
    safeTopInsetExtra: clamp(tpl.top, SAFE_TOP_MIN, SAFE_TOP_MAX),
    safeBottomInsetExtra: clamp(tpl.bottom, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX),
    updatedAt: Date.now()
  };
  const profiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []).filter(item => item.id !== id);
  profiles.unshift(profile);
  Object.assign(p, {
    safeViewportAutoFit: false,
    safeTopInsetExtra: profile.safeTopInsetExtra,
    safeBottomInsetExtra: profile.safeBottomInsetExtra,
    safeViewportProfileId: id,
    safeViewportProfiles: normalizeSafeViewportProfiles(profiles)
  });
  applyPrefs?.(app);
}

export function saveSafeProfile(app, { applyPrefs, mode = 'update' } = {}) {
  const p = app.state.prefs || {};
  const profiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []);
  const context = getSafeViewportContext(app);
  const effective = getEffectiveSafeViewportPrefs(app, p);
  let id = mode === 'new' ? '' : String(p.safeViewportProfileId || '');
  let existing = id ? profiles.find(profile => profile.id === id) : null;
  let name = existing?.name || context.defaultName;
  if (mode === 'new' || !existing) {
    const promptedName = promptSafeProfileName({ message:'저장할 보정 프리셋 이름을 입력하세요.', currentName:name, fallbackName:context.defaultName });
    if (promptedName == null) return;
    name = promptedName;
    id = makeSafeProfileId();
  }
  const profile = {
    id,
    name,
    contextKey: context.key,
    contextLabel: context.label,
    uaKey: context.uaKey,
    displayMode: context.displayMode,
    isBrowserFullscreen: !!context.isBrowserFullscreen,
    isStandalone: !!context.isStandalone,
    safeViewportAutoFit: effective.safeViewportAutoFit === true,
    safeTopInsetExtra: clamp(effective.safeTopInsetExtra, SAFE_TOP_MIN, SAFE_TOP_MAX),
    safeBottomInsetExtra: clamp(effective.safeBottomInsetExtra, SAFE_BOTTOM_MIN, SAFE_BOTTOM_MAX),
    updatedAt: Date.now()
  };
  const next = profiles.filter(item => item.id !== id);
  next.unshift(profile);
  Object.assign(p, { safeViewportProfileId: id, safeViewportProfiles: normalizeSafeViewportProfiles(next) });
  applyPrefs?.(app);
}

export function renameSafeProfile(app, { applyPrefs } = {}) {
  const p = app.state.prefs || {};
  const id = String(p.safeViewportProfileId || '');
  const profiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []);
  const profile = profiles.find(item => item.id === id);
  if (!profile) return;
  const promptedName = promptSafeProfileName({ message:'프리셋 이름을 입력하세요.', currentName:profile.name, fallbackName:profile.name });
  if (promptedName == null) return;
  profile.name = promptedName;
  profile.updatedAt = Date.now();
  p.safeViewportProfiles = normalizeSafeViewportProfiles(profiles);
  applyPrefs?.(app);
}

export function deleteSafeProfile(app, { applyPrefs } = {}) {
  const p = app.state.prefs || {};
  const id = String(p.safeViewportProfileId || '');
  const profiles = normalizeSafeViewportProfiles(p.safeViewportProfiles || []);
  const profile = profiles.find(item => item.id === id);
  if (!profile) return;
  if (!confirmSafeProfileDelete(profile)) return;
  p.safeViewportProfiles = profiles.filter(item => item.id !== id);
  p.safeViewportProfileId = '';
  applyPrefs?.(app);
}
