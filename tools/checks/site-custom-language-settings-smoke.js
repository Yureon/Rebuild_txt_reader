const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runSiteCustomLanguageSettingsSmoke() {
  const shell = read('public/fragments/app-shell.html');
  const lang = read('public/scripts/rebuild/features/settings/site-language.mjs');
  const state = read('public/scripts/rebuild/state/app-state.mjs');
  const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
  const css = read('public/styles/app.css');

  assert(shell.includes('open-site-custom-language-modal-btn'), 'custom language modal open button missing');
  assert(shell.includes('site-language-editor-overlay'), 'custom language modal overlay missing');
  assert(shell.includes('site-language-editor-modal'), 'custom language modal panel missing');
  assert(shell.includes('site-custom-language-name'), 'custom language name input missing');
  assert(shell.includes('site-custom-language-code'), 'custom language code input missing');
  assert(shell.includes('site-custom-language-map'), 'custom language map textarea missing');
  assert(shell.includes('템플릿 채우기'), 'custom language template button missing');
  assert(lang.includes('CUSTOM_SITE_LANGUAGE_PREFIX'), 'custom site language prefix missing');
  assert(lang.includes('normalizeSiteCustomLanguages'), 'custom language normalizer missing');
  assert(lang.includes('parseCustomLanguageMap'), 'custom language parser missing');
  assert(lang.includes('saveCustomLanguageFromEditor'), 'custom language save handler missing');
  assert(lang.includes('renderSiteLanguageOptions'), 'language select custom option renderer missing');
  assert(lang.includes('openSiteLanguageEditor'), 'custom language modal open handler missing');
  assert(lang.includes('closeSiteLanguageEditor'), 'custom language modal close handler missing');
  assert(state.includes('siteCustomLanguages: []'), 'default custom language prefs missing');
  assert(state.includes('normalizeSiteCustomLanguages'), 'prefs merge must normalize custom languages');
  assert(elements.includes('open-site-custom-language-modal-btn'), 'element collector missing custom language modal open button');
  assert(elements.includes('site-custom-language-map'), 'element collector missing custom language textarea');
  assert(css.includes('.site-language-actions'), 'site language action row CSS missing');
  assert(css.includes('.site-custom-language-panel'), 'custom language panel CSS missing');
  assert(css.includes('#site-language-editor-modal') && css.includes('#account-password-modal'), 'settings submodal z-index override missing');
  return { pass: 'v564-site-custom-language-settings-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runSiteCustomLanguageSettingsSmoke()));
module.exports = { runSiteCustomLanguageSettingsSmoke };
