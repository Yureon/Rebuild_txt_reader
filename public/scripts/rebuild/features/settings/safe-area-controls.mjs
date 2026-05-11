// v194 split boundary: safe-area-profile-actions.mjs, safe-area-template-factory.mjs, safe-area-context.mjs are re-exported through safe-area-profiles.mjs.
export {
  SAFE_BOTTOM_MAX,
  SAFE_BOTTOM_MIN,
  SAFE_POSITION_LABELS,
  SAFE_POSITION_STYLES,
  SAFE_PROFILE_LIMIT,
  SAFE_SLOT_LABELS,
  SAFE_TOP_MAX,
  SAFE_TOP_MIN
} from './safe-area-constants.mjs';
export {
  applySafeTemplate,
  deleteSafeProfile,
  findSafeProfileById,
  getBrowserKey,
  getBrowserTemplateBase,
  getEffectiveSafeViewportPrefs,
  getSafeTemplate,
  getSafeViewportContext,
  makeSafeTemplateId,
  normalizeSafeViewportProfiles,
  renameSafeProfile,
  renderSafeProfileControls,
  saveSafeProfile
} from './safe-area-profiles.mjs';
export {
  copySafeViewportDebug,
  formatSafeViewportDebug,
  renderSafeViewportDebug
} from './safe-area-debug.mjs';
export {
  applySafeAreaSlotState,
  applySafeElement,
  resolveSafeAreaSlotLayout
} from './safe-area-slot-layout.mjs';
export {
  formatSafePositionOptionLabel,
  formatSafeSlotLabel
} from './safe-area-labels.mjs';
export {
  formatSafeProfileOptionHtml,
  formatSafeProfileStatusText
} from './safe-area-profile-labels.mjs';
export {
  buildSafeViewportDebugRows,
  formatSafeViewportDebugRows,
  formatSafeViewportDebugProfile
} from './safe-area-debug-formatters.mjs';
