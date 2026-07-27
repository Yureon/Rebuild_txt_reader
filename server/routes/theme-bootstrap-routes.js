'use strict';

const { createAsyncSafeRouter, getPublicApiError } = require('../utils/async-route');

const USER_THEME_BOOTSTRAP_PASS = 'v680-user-theme-bootstrap-route-pass';
const OWNER_THEME_BOOTSTRAP_PASS = 'v680-owner-theme-bootstrap-route-pass';
const THEME_PREF_KEYS = Object.freeze([
  'themeMode',
  'themePresetId',
  'themeColors',
  'readerBg',
  'readerText',
  'uiFontSize',
  'brightness'
]);
const OWNER_THEME_PREFS = Object.freeze({
  themeMode:'dark',
  themePresetId:'owner-console',
  themeColors:Object.freeze({
    bg:'#0d0d0d',
    surface:'#171717',
    text:'#ece7df',
    accent:'#4ade80',
    readerBg:'#111111',
    readerText:'#ece7df'
  }),
  readerBg:'#111111',
  readerText:'#ece7df',
  uiFontSize:15,
  brightness:100
});

function pickThemePrefs(input = {}) {
  const source = input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  const out = {};
  for (const key of THEME_PREF_KEYS) {
    if (!(key in source)) continue;
    if (key === 'themeColors') {
      const colors = source.themeColors;
      if (colors && typeof colors === 'object' && !Array.isArray(colors)) out.themeColors = { ...colors };
      continue;
    }
    out[key] = source[key];
  }
  return out;
}

function createThemeBootstrapRouter(options = {}) {
  const {
    setNoStore = () => {},
    sessionStore,
    getSessionTokenFromReq,
    userStateServiceManager
  } = options;
  if (!sessionStore || typeof getSessionTokenFromReq !== 'function' || !userStateServiceManager) {
    throw new Error('createThemeBootstrapRouter requires sessionStore/getSessionTokenFromReq/userStateServiceManager');
  }
  const router = createAsyncSafeRouter();
  router.get('/theme-bootstrap', async (req, res) => {
    setNoStore(res);
    const token = getSessionTokenFromReq(req);
    const session = sessionStore.getSession ? sessionStore.getSession(token) : null;
    if (!session) return res.status(401).json({ ok:false, error:'login_required' });
    if (session.kind === 'owner') {
      return res.json({
        ok:true,
        sessionKind:'owner',
        userId:'owner',
        prefs:{ ...OWNER_THEME_PREFS, themeColors:{ ...OWNER_THEME_PREFS.themeColors } },
        pass:OWNER_THEME_BOOTSTRAP_PASS
      });
    }
    if (session.kind !== 'user') return res.status(403).json({ ok:false, error:'reader_user_session_required' });
    try {
      const service = userStateServiceManager.getForSession(session);
      const state = service.getUserStateResponse(req);
      const sharedPrefs = state?.shared?.viewerPrefs && typeof state.shared.viewerPrefs === 'object' ? state.shared.viewerPrefs : {};
      const devicePrefs = state?.device?.prefs && typeof state.device.prefs === 'object' ? state.device.prefs : {};
      return res.json({
        ok:true,
        sessionKind:'user',
        userId:String(session.userId || ''),
        prefs:pickThemePrefs({ ...sharedPrefs, ...devicePrefs }),
        sharedVersion:Number(state?.sharedVersion) || 0,
        deviceVersion:Number(state?.deviceVersion) || 0,
        pass:USER_THEME_BOOTSTRAP_PASS
      });
    } catch (error) {
      const publicError = getPublicApiError(error, {
        fallbackCode:'theme_bootstrap_failed',
        fallbackMessage:'theme bootstrap failed'
      });
      if (publicError.status >= 500) console.error(error);
      return res.status(publicError.status).json({ ok:false, error:publicError.error, message:publicError.message });
    }
  });
  return router;
}

module.exports = {
  USER_THEME_BOOTSTRAP_PASS,
  OWNER_THEME_BOOTSTRAP_PASS,
  THEME_PREF_KEYS,
  OWNER_THEME_PREFS,
  pickThemePrefs,
  createThemeBootstrapRouter
};
