import { buildCustomCssText } from './custom-css-utils.mjs';

const STYLE_ID = 'txt-reader-user-css';
const CUSTOM_CSS_RUNTIME_PASS = 'v594-constructable-user-css-runtime-pass';
let customCssSheet = null;

function cssPrefs(app) {
  if (!app.state.prefs) app.state.prefs = {};
  if (typeof app.state.prefs.customCssShared !== 'string') app.state.prefs.customCssShared = '';
  if (typeof app.state.prefs.customCssDevice !== 'string') app.state.prefs.customCssDevice = '';
  return app.state.prefs;
}

function removeLegacyStyleElement() {
  document.getElementById(STYLE_ID)?.remove?.();
}

function getConstructableSheet() {
  if (customCssSheet) return customCssSheet;
  if (typeof CSSStyleSheet !== 'function' || typeof Document === 'undefined' || !('adoptedStyleSheets' in Document.prototype)) return null;
  customCssSheet = new CSSStyleSheet();
  customCssSheet.__txtReaderUserCss = CUSTOM_CSS_RUNTIME_PASS;
  return customCssSheet;
}

function removeAdoptedCustomSheet() {
  if (!customCssSheet || !Array.isArray(document.adoptedStyleSheets)) return;
  document.adoptedStyleSheets = document.adoptedStyleSheets.filter(sheet => sheet !== customCssSheet);
}

export function applyCustomCssRules(app) {
  const prefs = cssPrefs(app);
  const text = buildCustomCssText({ shared:prefs.customCssShared, device:prefs.customCssDevice }).trim();
  removeLegacyStyleElement();
  if (!text) {
    removeAdoptedCustomSheet();
    return;
  }
  const sheet = getConstructableSheet();
  if (!sheet) {
    console.warn('사용자 CSS는 Constructable Stylesheets를 지원하는 브라우저에서만 적용됩니다.');
    return;
  }
  try {
    sheet.replaceSync(text);
    if (!document.adoptedStyleSheets.includes(sheet)) document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
  } catch (error) {
    console.warn('사용자 CSS 적용 실패', error);
  }
}
