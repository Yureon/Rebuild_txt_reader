const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8');
const state = fs.readFileSync(path.join(root, 'public/scripts/rebuild/state/app-state.mjs'), 'utf8');
const appearance = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/settings/appearance.mjs'), 'utf8');
const theme = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/theme-settings.mjs'), 'utf8');
const elements = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui/elements.mjs'), 'utf8');
const i18n = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/settings/site-language.mjs'), 'utf8');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(shell.includes('id="site-language-select"'), 'settings shell must include site-language-select');
assert(shell.includes('value="auto"') && shell.includes('value="ko"') && shell.includes('value="en"'), 'settings shell must include auto/ko/en options');
assert(state.includes("siteLanguage: 'auto'"), 'default prefs must include siteLanguage');
assert(state.includes('normalizeSiteLanguage'), 'state must normalize siteLanguage');
assert(elements.includes("'site-language-select'") && elements.includes("'site-language-status'"), 'element collector must include site language controls');
assert(appearance.includes('applySiteLanguage(app)'), 'applyPrefs must apply site language');
assert(theme.includes('bindSiteLanguageControl') && theme.includes('installSiteLanguageRuntime'), 'theme settings must install/bind site language runtime');
assert(i18n.includes('const EN =') && i18n.includes("'설정': 'Settings'"), 'i18n dictionary must include English translations');
console.log('site-language-settings smoke OK');
