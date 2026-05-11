const { requireModalLayerCoverage, requireNoDuplicateHtmlIds } = require('./ui-layering.js');

const FRONTEND_CHECK_SETTINGS_MODAL_SAFEAREA_GUARDS_PASS = 'v190-frontend-check-settings-modal-safearea-guards-pass';

function runSettingsModalSafeareaGuardChecks(ctx) {
  const {
    shellSource,
    uiSource,
    elementsSource,
    devtoolsSource,
    appCssSource,
    customCssSource,
    settingsCustomCssUtilsSource,
    themeEditorSource,
    settingsThemeColorUtilsSource,
    settingsThemeFileUtilsSource,
    stateSource,
    controlsSource,
    preprocessSource,
    preprocessSummarySource,
    settingsControlsSource,
    settingsFunctionalLabelsSource,
    settingsSafeAreaLabelsSource,
    settingsSafeAreaTemplateLabelsSource,
    settingsSafeAreaProfileLabelsSource,
    settingsSafeAreaProfilePromptSource,
    settingsSafeAreaContextLabelsSource,
    settingsSafeAreaContextSource,
    settingsSafeAreaTemplateFactorySource,
    settingsSafeAreaControlsSource,
    settingsSafeAreaProfileActionsSource,
    settingsFontsSource,
    settingsFontChoiceCardSource
  } = ctx;

  ['devdbg-library-virtual-btn','open-device-management-btn','device-management-modal','settings-submodal-overlay','shortcut-settings-card'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v103 Settings shell marker: ${marker}`);
  });
  requireNoDuplicateHtmlIds(shellSource, 'public/fragments/app-shell.html');
  requireModalLayerCoverage({ shellSource, elementsSource, uiSource });
  ['deviceManagementOverlay','deviceManagementModal','openDeviceManagementBtn','deviceManagementClose'].forEach((marker) => {
    if (!uiSource.includes(marker) && !elementsSource.includes(marker)) throw new Error(`Missing v103 device management modal wiring marker: ${marker}`);
  });
  if (!devtoolsSource.includes("openRecoveryCenter?.({ focus: 'library-virtual' })")) throw new Error('Missing v103 developer debug library virtual focus entry');
  if (!shellSource.includes('id="safe-area-bar" class="toolbar-safe" data-safe-area-zone="top"') || !shellSource.includes('id="toolbar-network-mode" data-safe-slot="network"')) {
    throw new Error('Missing v109 safe-area network indicator placement markers');
  }
  ['preprocess-editor-modal','theme-editor-modal','devdbg-modal'].forEach((id) => {
    if (!elementsSource.includes("'" + id + "'")) throw new Error(`Missing v105 submodal element collection id: ${id}`);
  });
  ['themeEditorModal','preprocessEditorModal','devdbgModal','defaultPanels'].forEach((marker) => {
    if (!uiSource.includes(marker)) throw new Error(`Missing v105 modal layer default panel marker: ${marker}`);
  });
  ['settings-submodal-open','modal-layer-open','activeModalLayer','closeSettingsChildLayers','dataset.layerVisible'].forEach((marker) => {
    if (!uiSource.includes(marker)) throw new Error(`Missing v109 modal quality guard marker: ${marker}`);
  });
  ['v106 settings tab body containment polish','#settings-panel .sp-tab-body','#viewer-panel > .sp-tab-body .viewer-section-grid'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v229 Settings sp-body CSS marker: ${marker}`);
  });
  ['v109 Settings/modal/safe-area quality pass','--z-settings-child-overlay','body.settings-submodal-open #settings-panel','#safe-area-bar [data-safe-slot="network"]'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v109 Settings/modal/safe-area CSS marker: ${marker}`);
  });
  ['data-settings-quality-pass="v140"','data-preprocess-quality-pass="v140"','data-devdbg-quality-pass="v140"','data-safe-layout-guard="v140"'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v110 quality shell marker: ${marker}`);
  });
  ['v110 Settings visual polish, preprocess UX, and safe-area collision guard','[data-settings-quality-pass]','[data-preprocess-quality-pass]','[data-safe-layout-guard]','--safe-network-max'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v110 quality CSS marker: ${marker}`);
  });

  ['id="settings-panel-body" class="sp-body" data-settings-main-body="tabs" data-settings-tab-panels-owner="general viewer func"','data-settings-panel-level="sp-body-child"','data-settings-tab-body="general"','settings-inline-stepper ui-font-stepper','setting-action-btn--flex','setting-action-btn--full','data-adv-actions--stack','vsp-panel--flush-top','자동 배치 (시계/진행률 겹침 회피)'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v111 Settings tab cleanup shell marker: ${marker}`);
  });
  ['v111 Settings tab structure cleanup and action style consolidation','[data-settings-quality-pass]','setting-action-btn--flex','settings-inline-stepper','data-adv-actions--stack','vsp-panel--flush-top'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v111 Settings tab cleanup CSS marker: ${marker}`);
  });
  ['data-preprocess-quality-pass="v140"','data-preprocess-ux-marker="partial-apply-help"','data-preprocess-ux-marker="fine-settings-zone"','data-preprocess-ux-marker="preview-zone"','preprocess-editor-desc','미리보기 새로고침','체크된 항목만 덮어쓰기'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v112 preprocess UX shell marker: ${marker}`);
  });
  ['data-safe-quality-pass="v140"','data-safe-area-ux-marker="slot-guide"','safe-area-layout-note','상단 safe-area 표시','자동 배치 (시계/진행률 겹침 회피)','가운데 보조 슬롯'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v113 safe-area display shell marker: ${marker}`);
  });
  ['v112 Preprocess settings UX polish','.pem-head-sub','.pem-section-head','.pem-preset-help','.pem-preset-partial-title small'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v112 preprocess UX CSS marker: ${marker}`);
  });
  ['v113 Safe-area display quality pass','[data-safe-quality-pass]','safe-area-layout-note','--safe-inner-offset','data-safe-network-placement="center"'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v113 safe-area display CSS marker: ${marker}`);
  });

  ['data-modal-a11y-pass="v140"','bookmark-modal-title','settings-panel-desc','custom-css-title','shortcut-desc','recovery-center-title','devdbg-desc'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v140 modal accessibility shell marker: ${marker}`);
  });
  ['v114 Settings modal accessibility pass','.sr-only','modal-layer-scroll-locked','[data-modal-a11y-pass]','#custom-css-panel.open'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v140 modal accessibility CSS marker: ${marker}`);
  });
  ['modalFocusStack','focusModalInitialElement','trapFocusWithinPanel','modal-layer-scroll-locked','modalA11yPass','customCssOverlay'].forEach((marker) => {
    if (!uiSource.includes(marker)) throw new Error(`Missing v140 modal accessibility runtime marker: ${marker}`);
  });

  ['data-settings-density-pass="v140"','data-settings-copy-pass="v140"','settings-select-caret','settings-inline-slider-row--reader','settings-field-row','func-inline-range--spaced','settings-file-input-hidden'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v140 Settings density/copy shell marker: ${marker}`);
  });
  ['v230 functional dependent control visibility guard','#func-panel .func-dependent-control[hidden]'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v230 Settings functional dependent CSS marker: ${marker}`);
  });
  ['v116 Settings card density and copy polish','[data-settings-density-pass]','settings-range-value--compact','settings-field-label','func-inline-range--spaced'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v140 Settings density/copy CSS marker: ${marker}`);
  });
  ['bookmark-modal','read-data-modal','custom-css-panel'].forEach((marker) => {
    if (!elementsSource.includes(marker)) throw new Error(`Missing v140 modal element collection marker: ${marker}`);
  });

  ['data-custom-css-quality-pass="v140"','custom-css-scope-status','data-custom-css-ux-marker="scope-tabs"','data-custom-css-ux-marker="editor-guide-layout"','data-theme-quality-pass="v140"','data-theme-ux-marker="preset-custom-section"','data-theme-ux-marker="preview-section"'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v140 Theme/custom CSS shell marker: ${marker}`);
  });
  ['v117 Theme / custom CSS modal quality pass','custom-css-panel.custom-css-panel[data-custom-css-quality-pass]','custom-css-scope-status','custom-css-var-grid','#theme-editor-modal[data-theme-quality-pass]','tem-head-sub'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v140 Theme/custom CSS CSS marker: ${marker}`);
  });
  ['CUSTOM_CSS_QUALITY_PASS','CUSTOM_CSS_SCOPE_LABELS','syncCustomCssScopeUi','dataset.customCssScope','is-hidden-mobile-view'].forEach((marker) => {
    if (!customCssSource.includes(marker)) throw new Error(`Missing v140 custom CSS runtime marker: ${marker}`);
  });
  ['THEME_EDITOR_QUALITY_PASS','dataset.themeQualityPass','dataset.themeSelectionSource'].forEach((marker) => {
    if (!themeEditorSource.includes(marker)) throw new Error(`Missing v140 theme editor runtime marker: ${marker}`);
  });
  ['data-device-quality-pass="v140"','data-device-ux-marker="scope-note"','data-device-ux-marker="overview-cards"','sync-device-scope-summary','sync-device-remote-summary','우선 기기 저장','상태 새로고침'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v140 Device management shell marker: ${marker}`);
  });
  ['v118 Device management modal polish','device-management-note','device-management-overview-card','#settings-sync-live-panel[data-device-quality-pass]','settings-sync-device-badge'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error(`Missing v140 Device management CSS marker: ${marker}`);
  });
  ['DEVICE_MANAGEMENT_QUALITY_PASS','DEVICE_MANAGEMENT_STATUS_LABELS','markDeviceManagementQuality','formatDeviceScopeSummary','formatRemoteResumeSummary','dataset.deviceSyncPolicy'].forEach((marker) => {
    if (!devtoolsSource.includes(marker)) throw new Error(`Missing v140 Device management runtime marker: ${marker}`);
  });
  ['sync-device-scope-summary','sync-device-remote-summary'].forEach((marker) => {
    if (!elementsSource.includes(marker)) throw new Error(`Missing v140 Device management element marker: ${marker}`);
  });

  ['setPreviewText','부분 적용 ${applyCount}/${PREPROCESS_KEYS.length}개','미리보기를 불러오지 못했습니다.'].forEach((marker) => {
    if (!preprocessSource.includes(marker)) throw new Error(`Missing v112 preprocess UX runtime marker: ${marker}`);
  });
  ['PREPROCESS_SUMMARY_HELPER_PASS','v211-preprocess-summary-helper-pass','formatPreprocessPreviewStats','summarizePreprocessOptions','활성 옵션 ${active.length}개'].forEach((marker) => {
    if (!preprocessSummarySource.includes(marker)) throw new Error(`Missing v211 preprocess summary helper marker: ${marker}`);
  });
  ['SETTINGS_FONT_CHOICE_CARD_HELPER_PASS','v212-settings-font-choice-card-helper-pass','createFontChoiceCard'].forEach((marker) => {
    if (!settingsFontChoiceCardSource.includes(marker)) throw new Error(`Missing v212 settings font helper marker: ${marker}`);
  });
  if (!settingsFontsSource.includes('./font-choice-card.mjs')) throw new Error('fonts.mjs must import v212 font choice card helper');
  if (/function\s+createFontChoiceCard/m.test(settingsFontsSource)) throw new Error('fonts.mjs still owns font choice card after v212 split');

  ['SETTINGS_THEME_COLOR_UTILS_PASS','v213-settings-theme-color-utils-pass','normalizeThemeColors','normalizeCustomThemes','safeThemeColor','colorsEqual'].forEach((marker) => {
    if (!settingsThemeColorUtilsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v213 settings theme color utility marker: ${marker}`);
  });
  if (!themeEditorSource.includes('./theme-color-utils.mjs')) throw new Error('theme-editor.mjs must import v213 theme color utility helper');
  if (/function\s+normalizeThemeColors/m.test(themeEditorSource) || /function\s+safeColor/m.test(themeEditorSource)) throw new Error('theme-editor.mjs still owns theme color normalization after v213 split');

  ['SETTINGS_THEME_FILE_UTILS_PASS','v214-settings-theme-file-utils-pass','buildThemeExportPayload','buildThemeExportFilename','buildImportedThemeRecord'].forEach((marker) => {
    if (!settingsThemeFileUtilsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v214 settings theme file utility marker: ${marker}`);
  });
  if (!themeEditorSource.includes('./theme-file-utils.mjs')) throw new Error('theme-editor.mjs must import v214 theme file utility helper');
  if (/version:\s*1,\s*\n\s*version:\s*1/m.test(themeEditorSource)) throw new Error('theme-editor.mjs still contains duplicate export payload version key after v214 split');
  if (/replace\(\/\[\^a-zA-Z0-9가-힣_-\]/m.test(themeEditorSource)) throw new Error('theme-editor.mjs still owns theme export filename sanitizer after v214 split');

  ['SETTINGS_CUSTOM_CSS_UTILS_PASS','v215-settings-custom-css-utils-pass','buildCustomCssText','buildCustomCssEditorState','normalizeCustomCss'].forEach((marker) => {
    if (!settingsCustomCssUtilsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v215 custom CSS utility marker: ${marker}`);
  });
  if (!customCssSource.includes('./custom-css-utils.mjs')) throw new Error('custom-css.mjs must import v215 custom CSS utility helper');
  if (/function\s+normalizeCss/m.test(customCssSource)) throw new Error('custom-css.mjs still owns custom CSS normalization after v215 split');


  ['SETTINGS_FUNCTIONAL_LABELS_PASS','v216-settings-functional-labels-pass','formatFunctionalPercentValue','formatFunctionalMsValue','formatFunctionalPxValue','formatServerCommIntervalLabel'].forEach((marker) => {
    if (!settingsFunctionalLabelsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v216 functional labels marker: ${marker}`);
  });
  if (!settingsControlsSource.includes('./functional-labels.mjs')) throw new Error('controls.mjs must import v216 functional label helper');
  if (/\$\{p\.tapSpeed\}ms|\$\{p\.swipeThreshold\}px|초마다 한 번 표시/m.test(settingsControlsSource)) throw new Error('controls.mjs still owns functional value label templates after v216 split');

  ['SAFE_AREA_LABELS_PASS','v217-safe-area-labels-pass','formatSafeSlotLabel','formatSafePositionOptionLabel'].forEach((marker) => {
    if (!settingsSafeAreaLabelsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v217 safe-area label helper marker: ${marker}`);
  });
  if (!settingsSafeAreaControlsSource?.includes?.('./safe-area-labels.mjs')) throw new Error('safe-area controls must re-export v217 safe-area label helper');
  if (/SAFE_SLOT_LABELS[\s\S]*SAFE_POSITION_LABELS[\s\S]*return `\$\{slotLabel\} · safe-area/m.test(controlsSource)) throw new Error('safe-area slot layout still owns safe-area label formatting after v217 split');


  ['SAFE_AREA_PROFILE_LABELS_PASS','v219-safe-area-profile-labels-pass','formatSafeProfileOptionHtml','formatSafeProfileStatusText'].forEach((marker) => {
    if (!settingsSafeAreaProfileLabelsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v219 safe-area profile label helper marker: ${marker}`);
  });
  if (!settingsSafeAreaProfileActionsSource?.includes?.('./safe-area-profile-labels.mjs') && !controlsSource.includes('./safe-area-profile-labels.mjs')) throw new Error('safe-area profile actions must import v219 profile label helper');
  if (/현재 컨텍스트용 프리셋 '\s*\+ matchingCount|재진입 시 현재 컨텍스트\('/m.test(settingsSafeAreaProfileActionsSource || controlsSource)) throw new Error('safe-area profile actions still owns profile status copy after v219 split');

  ['SAFE_AREA_PROFILE_OPTION_LIST_PASS','v223-safe-area-profile-option-list-pass','buildSafeProfileSelectOptionsHtml'].forEach((marker) => {
    if (!settingsSafeAreaProfileLabelsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v223 safe-area profile option list helper marker: ${marker}`);
  });
  if (/프리셋 선택 안 함[\s\S]*profiles\.map\(profile/m.test(settingsSafeAreaProfileActionsSource || controlsSource)) throw new Error('safe-area profile actions still owns select option list assembly after v223 split');

  ['SAFE_AREA_PROFILE_PROMPT_HELPER_PASS','v220-safe-area-profile-prompt-helper-pass','normalizeSafeProfileName','makeSafeProfileId','promptSafeProfileName','confirmSafeProfileDelete'].forEach((marker) => {
    if (!settingsSafeAreaProfilePromptSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v220 safe-area profile prompt helper marker: ${marker}`);
  });
  if (!settingsSafeAreaProfileActionsSource?.includes?.('./safe-area-profile-prompt.mjs')) throw new Error('safe-area profile actions must import v220 profile prompt helper');
  if (/window\.prompt|window\.confirm|Date\.now\(\)\.toString\(36\).*Math\.random/m.test(settingsSafeAreaProfileActionsSource)) throw new Error('safe-area profile actions still owns prompt/confirm/id generation after v220 split');


  ['SAFE_AREA_CONTEXT_LABELS_PASS','v221-safe-area-context-labels-pass','formatSafeDisplayModeLabel','buildSafeViewportContextLabels'].forEach((marker) => {
    if (!settingsSafeAreaContextLabelsSource?.includes(marker) && !stateSource?.includes?.(marker)) throw new Error(`Missing v221 safe-area context label helper marker: ${marker}`);
  });
  if (!settingsSafeAreaContextSource?.includes?.('./safe-area-context-labels.mjs')) throw new Error('safe-area context must import v221 context label helper');
  if (/const\s+modeLabel\s*=\s*displayMode\s*===/m.test(settingsSafeAreaContextSource)) throw new Error('safe-area context still owns display mode label branching after v221 split');


  ['safeVisible','safePosition','aria-hidden'].forEach((marker) => {
    if (!controlsSource.includes(marker)) throw new Error(`Missing v109 safe-area slot state marker: ${marker}`);
  });
  ['resolveSafeAreaSlotLayout','applySafeAreaSlotState','safeLayoutGuard','safeCollisionGuard','safeSlotResolved'].forEach((marker) => {
    if (!controlsSource.includes(marker)) throw new Error(`Missing v110 safe-area collision guard marker: ${marker}`);
  });
  ['SAFE_SLOT_LABELS','formatSafeSlotLabel','safeQualityPass','safeSlotSummary','safeNetworkPlacement','safeSlotLabel'].forEach((marker) => {
    if (!controlsSource.includes(marker)) throw new Error(`Missing v113 safe-area runtime guard marker: ${marker}`);
  });
  if (!elementsSource.includes("'safe-area-bar'")) throw new Error('Missing v110 safe-area bar element collection marker');
  ['formatLibraryVirtualSettingsChecklistDiff','libraryVirtualSettingsDiff','checklistDiffFilter'].forEach((marker) => {
    if (!controlsSource.includes(marker)) throw new Error(`Missing v94 Settings checklist diff marker: ${marker}`);
  });
}

module.exports = {
  FRONTEND_CHECK_SETTINGS_MODAL_SAFEAREA_GUARDS_PASS,
  runSettingsModalSafeareaGuardChecks
};
