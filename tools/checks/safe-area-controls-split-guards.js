const { requireMarker, requireNoFunctionOwner } = require('./read-data-guard-utils.js');

const FRONTEND_CHECK_SAFE_AREA_CONTROLS_SPLIT_GUARDS_PASS = 'v195-safe-area-controls-split-guards-pass';
const SAFE_VIEWPORT_CONTEXT_CONTROLS_IMPORT_GUARD_PASS = 'v228-safe-viewport-context-controls-import-guard-pass';

function runSafeAreaControlsSplitGuardChecks(ctx) {
  const {
    settingsControlsSource,
    settingsSafeAreaControlsSource,
    settingsSafeAreaProfilesSource,
    settingsSafeAreaProfileActionsSource,
    settingsSafeAreaTemplateFactorySource,
    settingsSafeAreaContextSource,
    settingsSafeAreaDebugSource,
    settingsSafeAreaDebugFormattersSource,
    settingsSafeAreaSlotLayoutSource,
    safeAreaControlsCombinedSource,
    stateSource
  } = ctx;

  ['safe-area-profiles.mjs','safe-area-profile-actions.mjs','safe-area-template-factory.mjs','safe-area-context.mjs','safe-area-debug.mjs','safe-area-debug-formatters.mjs','safe-area-slot-layout.mjs'].forEach((marker) => {
    requireMarker(settingsSafeAreaControlsSource, marker, 'safe-area controls aggregator');
  });
  ['SAFE_AREA_PROFILES_AGGREGATOR_SPLIT_PASS','safe-area-profile-actions.mjs','safe-area-template-factory.mjs','safe-area-context.mjs'].forEach((marker) => {
    requireMarker(settingsSafeAreaProfilesSource, marker, 'safe-area profile aggregator');
  });
  ['renderSafeProfileControls','applySafeTemplate','saveSafeProfile','renameSafeProfile','deleteSafeProfile','SAFE_AREA_PROFILE_ACTIONS_SPLIT_PASS'].forEach((marker) => {
    requireMarker(settingsSafeAreaProfileActionsSource, marker, 'safe-area profile actions');
  });
  ['getSafeTemplate','getBrowserTemplateBase','makeSafeTemplateId','SAFE_AREA_TEMPLATE_FACTORY_SPLIT_PASS'].forEach((marker) => {
    requireMarker(settingsSafeAreaTemplateFactorySource, marker, 'safe-area template factory');
  });
  ['normalizeSafeViewportProfiles','getEffectiveSafeViewportPrefs','getSafeViewportContext','getBrowserKey','findSafeProfileById','SAFE_AREA_CONTEXT_SPLIT_PASS'].forEach((marker) => {
    requireMarker(settingsSafeAreaContextSource, marker, 'safe-area context/effective prefs');
  });
  ['normalizeSafeViewportProfiles','saveSafeProfile','getEffectiveSafeViewportPrefs','getSafeViewportContext'].forEach((marker) => {
    requireMarker(safeAreaControlsCombinedSource, marker, 'combined safe-area profile compatibility surface');
  });
  ['normalizeSafeViewportProfiles','saveSafeProfile','getEffectiveSafeViewportPrefs','getSafeViewportContext','getSafeTemplate','makeSafeTemplateId'].forEach((name) => {
    requireNoFunctionOwner(settingsSafeAreaProfilesSource, name, 'safe-area-profiles.mjs aggregator');
  });
  ['formatSafeViewportDebug','copySafeViewportDebug','renderSafeViewportDebug'].forEach((marker) => {
    requireMarker(settingsSafeAreaDebugSource, marker, 'safe-area debug formatter');
  });
  ['SAFE_AREA_DEBUG_FORMATTERS_PASS','v224-safe-area-debug-formatters-pass','SAFE_AREA_DEBUG_ROW_FORMATTER_PASS','v225-safe-area-debug-row-formatter-pass','SAFE_AREA_DEBUG_TEXT_FORMATTER_PASS','v226-safe-area-debug-text-formatter-pass','buildSafeViewportDebugRows','formatSafeViewportDebugRows','formatSafeViewportDebugRow','formatSafeViewportDebugProfile','buildSafeViewportDebugText'].forEach((marker) => {
    requireMarker(settingsSafeAreaDebugFormattersSource, marker, 'safe-area debug row formatter');
  });
  requireMarker(settingsSafeAreaDebugSource, './safe-area-debug-formatters.mjs', 'safe-area debug formatter import');
  requireMarker(settingsSafeAreaDebugSource, 'buildSafeViewportDebugText', 'safe-area debug text helper usage');
  if (/\['innerWidth',\s*window\.innerWidth\]/m.test(settingsSafeAreaDebugSource)) throw new Error('safe-area-debug.mjs still owns debug row assembly after v224 split');
  ['resolveSafeAreaSlotLayout','applySafeAreaSlotState','applySafeElement','formatSafeSlotLabel'].forEach((marker) => {
    requireMarker(settingsSafeAreaSlotLayoutSource, marker, 'safe-area slot layout');
  });
  if (!/getSafeViewportContext,\s*normalizeSafeViewportProfiles/s.test(settingsControlsSource)) {
    throw new Error('settings controls must import getSafeViewportContext for safe viewport patch handlers');
  }
  requireMarker(settingsControlsSource, 'const context = getSafeViewportContext(app);', 'safe viewport patch handler context lookup');
  ['safeVisible','safePosition','safeCollisionGuard','Viewport 디버그 값 복사'].forEach((marker) => {
    requireMarker(safeAreaControlsCombinedSource, marker, 'combined safe-area controls');
  });
  ['safeAreaControlsSplitPass','readDataPreviewSafeProfileSplitPass'].forEach((marker) => {
    requireMarker(stateSource, marker, 'safe-area app-state marker');
  });
}

module.exports = {
  FRONTEND_CHECK_SAFE_AREA_CONTROLS_SPLIT_GUARDS_PASS,
  SAFE_VIEWPORT_CONTEXT_CONTROLS_IMPORT_GUARD_PASS,
  runSafeAreaControlsSplitGuardChecks
};
