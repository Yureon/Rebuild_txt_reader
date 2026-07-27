const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const SETTINGS_FUNCTIONAL_CONTROLS_SMOKE_PASS = 'v230-settings-functional-controls-smoke-pass';
const SETTINGS_SAFE_VIEWPORT_PATCH_SMOKE_PASS = 'v228-safe-viewport-patch-handler-smoke-pass';
const SETTINGS_READ_CONTROL_VISIBILITY_SMOKE_PASS = 'v230-read-control-dependent-visibility-smoke-pass';

async function runSettingsFunctionalControlsSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runSettingsFunctionalControlsSmoke requires projectRoot');
  const script = String.raw`
    Object.defineProperty(globalThis, 'navigator', { value:{ userAgent:'Chrome SafeViewportSmoke' }, configurable:true });
    globalThis.window = { setTimeout: () => 0, matchMedia: () => ({ matches:false }) };
    globalThis.document = { body:{ classList:{ toggle(){} } }, addEventListener(){} };
    const { bindFunctionalControls, syncFunctionalInputs, normalizeFunctionalPrefs } = await import('./public/scripts/rebuild/features/settings/controls.mjs');
    const makeTarget = name => ({ name, value:'', checked:false, disabled:false, hidden:false, style:{ display:'' }, attributes:{}, setAttribute(key, value){ this.attributes[key] = String(value); }, classList:{ add(){}, remove(){}, toggle(){} }, dataset:{}, addEventListener(){} });
    const safeViewportAutoToggle = makeTarget('safeViewportAutoToggle');
    const safeTopExtraSlider = makeTarget('safeTopExtraSlider');
    const safeBottomExtraSlider = makeTarget('safeBottomExtraSlider');
    const safeViewportProfileSelect = makeTarget('safeViewportProfileSelect');
    const app = {
      state: {
        prefs: {
          safeViewportProfiles: [{ id:'smoke-profile', name:'Smoke', contextKey:'Chrome|browser|mobile', safeViewportAutoFit:false, safeTopInsetExtra:0, safeBottomInsetExtra:0 }],
          safeViewportProfileId:'smoke-profile'
        },
        viewportFit: { activeSafeProfileId:'smoke-profile', isMobile:true, displayMode:'browser', isBrowserFullscreen:false, isStandalone:false }
      },
      els: {
        safeViewportAutoToggle,
        safeTopExtraSlider,
        safeBottomExtraSlider,
        safeViewportProfileSelect,
        libraryVirtualOpenRecoveryBtn: makeTarget('libraryVirtualOpenRecoveryBtn')
      },
      viewportFit: { refresh(){}, measure(){ return { isMobile:true, displayMode:'browser', isBrowserFullscreen:false, isStandalone:false }; } },
      library: { getRenderDiagnostics(){ return null; }, getFallbackDiagnostics(){ return null; } }
    };
    let applyCount = 0;
    const handlers = new Map();
    const on = (target, type, handler) => {
      if (!target) return;
      if (!handlers.has(target)) handlers.set(target, {});
      handlers.get(target)[type] = handler;
    };
    bindFunctionalControls(app, { applyPrefs(){ applyCount += 1; }, on });
    handlers.get(safeViewportAutoToggle).change({ target:{ checked:true } });
    handlers.get(safeTopExtraSlider).input({ target:{ value: 12 } });
    handlers.get(safeBottomExtraSlider).input({ target:{ value: 9 } });
    if (applyCount < 3) throw new Error('safe viewport patch handlers did not apply prefs');
    if (app.state.prefs.safeViewportAutoFit !== true) throw new Error('safe viewport auto-fit patch was not applied');
    if (Number(app.state.prefs.safeTopInsetExtra) !== 12) throw new Error('safe top inset patch was not applied');
    if (Number(app.state.prefs.safeBottomInsetExtra) !== 9) throw new Error('safe bottom inset patch was not applied');
    const visibilityEls = {
      tapNavToggle: makeTarget('tapNavToggle'),
      tapNavDetailsSection: makeTarget('tapNavDetailsSection'),
      tapDirV: makeTarget('tapDirV'),
      tapDirH: makeTarget('tapDirH'),
      tapScrollSlider: makeTarget('tapScrollSlider'),
      tapScrollVal: makeTarget('tapScrollVal'),
      tapAnimToggle: makeTarget('tapAnimToggle'),
      tapSpeedSection: makeTarget('tapSpeedSection'),
      tapSpeedSlider: makeTarget('tapSpeedSlider'),
      tapSpeedVal: makeTarget('tapSpeedVal'),
      swipeNavToggle: makeTarget('swipeNavToggle'),
      swipeThresholdSection: makeTarget('swipeThresholdSection'),
      swipeThresholdSlider: makeTarget('swipeThresholdSlider'),
      swipeThresholdVal: makeTarget('swipeThresholdVal'),
      libraryDndHoverDelaySlider: makeTarget('libraryDndHoverDelaySlider'),
      libraryDndHoverDelayVal: makeTarget('libraryDndHoverDelayVal'),
      safeClockToggle: makeTarget('safeClockToggle'),
      safeProgressToggle: makeTarget('safeProgressToggle'),
      safeNetworkToggle: makeTarget('safeNetworkToggle'),
      safeRemainingToggle: makeTarget('safeRemainingToggle'),
      safeClockPos: makeTarget('safeClockPos'),
      safeProgressPos: makeTarget('safeProgressPos'),
      safeNetworkPos: makeTarget('safeNetworkPos'),
      safeViewportAutoToggle: makeTarget('safeViewportAutoToggle'),
      safeTopExtraSlider: makeTarget('safeTopExtraSlider'),
      safeTopExtraVal: makeTarget('safeTopExtraVal'),
      safeBottomExtraSlider: makeTarget('safeBottomExtraSlider'),
      safeBottomExtraVal: makeTarget('safeBottomExtraVal'),
      safeViewportProfileSelect: makeTarget('safeViewportProfileSelect'),
      safeViewportProfileStatus: makeTarget('safeViewportProfileStatus'),
      safeViewportDebug: makeTarget('safeViewportDebug'),
      clockFormatSelect: makeTarget('clockFormatSelect'),
      clockAmpmToggle: makeTarget('clockAmpmToggle'),
      timezoneSelect: makeTarget('timezoneSelect'),
      tzCustomInput: makeTarget('tzCustomInput'),
      safeClockPosWrap: makeTarget('safeClockPosWrap'),
      safeProgressPosWrap: makeTarget('safeProgressPosWrap'),
      safeNetworkPosWrap: makeTarget('safeNetworkPosWrap'),
      clockAmpmWrap: makeTarget('clockAmpmWrap'),
      tzCustomWrap: makeTarget('tzCustomWrap'),
      serverCommNotifyToggle: makeTarget('serverCommNotifyToggle'),
      serverCommNotifyInterval: makeTarget('serverCommNotifyInterval'),
      serverCommNotifyIntervalValue: makeTarget('serverCommNotifyIntervalValue')
    };
    const appForSync = {
      state: { viewportFit:{ isMobile:false, displayMode:'browser' } },
      els: visibilityEls,
      viewportFit: { measure(){ return { isMobile:false, displayMode:'browser', isBrowserFullscreen:false, isStandalone:false }; } }
    };
    const prefs = { tapNavEnabled:false, tapDirection:'vertical', tapScrollPercent:90, tapAnim:false, tapSpeed:400, swipeNav:false, swipeThreshold:50, libraryDndHoverOpenDelay:650, showClock:true, showProgress:true, showNetwork:true, safeRemainingShow:false, safeClockPos:'left', safeProgressPos:'right', safeNetworkPos:'auto', safeViewportAutoFit:false, safeTopInsetExtra:0, safeBottomInsetExtra:0, safeViewportProfiles:[], safeViewportProfileId:'', clockHour12:false, clockAmPm:false, timezone:'Asia/Seoul', timezoneOffset:540, serverCommNotify:true, serverCommNotifyInterval:6 };
    normalizeFunctionalPrefs(prefs);
    syncFunctionalInputs(appForSync, prefs);
    if (visibilityEls.tapNavDetailsSection.hidden !== true || visibilityEls.tapNavDetailsSection.style.display !== 'none') throw new Error('tap navigation detail section must hide when tap navigation is off');
    if (visibilityEls.tapSpeedSection.hidden !== true || visibilityEls.tapSpeedSection.style.display !== 'none') throw new Error('tap animation speed slider must hide when animation is off');
    if (visibilityEls.swipeThresholdSection.hidden !== true || visibilityEls.swipeThresholdSection.style.display !== 'none') throw new Error('swipe threshold slider must hide when swipe navigation is off');
    prefs.tapNavEnabled = true; prefs.tapAnim = true; prefs.swipeNav = true;
    syncFunctionalInputs(appForSync, prefs);
    if (visibilityEls.tapNavDetailsSection.hidden || visibilityEls.tapSpeedSection.hidden || visibilityEls.swipeThresholdSection.hidden) throw new Error('read control dependent sections did not reappear when toggles are on');
    if (visibilityEls.tapNavDetailsSection.style.display || visibilityEls.tapSpeedSection.style.display || visibilityEls.swipeThresholdSection.style.display) throw new Error('read control dependent sections kept inline display override after toggles are on');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'settings functional controls smoke', timeoutMs: 8000 })
  return { pass: SETTINGS_FUNCTIONAL_CONTROLS_SMOKE_PASS, safeViewportPass: SETTINGS_SAFE_VIEWPORT_PATCH_SMOKE_PASS, visibilityPass: SETTINGS_READ_CONTROL_VISIBILITY_SMOKE_PASS };
}

module.exports = {
  SETTINGS_FUNCTIONAL_CONTROLS_SMOKE_PASS,
  SETTINGS_SAFE_VIEWPORT_PATCH_SMOKE_PASS,
  SETTINGS_READ_CONTROL_VISIBILITY_SMOKE_PASS,
  runSettingsFunctionalControlsSmoke
};
