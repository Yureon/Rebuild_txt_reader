import { setStorageScope, loadLocal, saveLocal } from '../rebuild/core/storage.mjs';
import {
  normalizeSiteLanguage,
  applySiteLanguage,
  installSiteLanguageRuntime,
  loadSiteLanguagePacks,
  syncSiteLanguageInput
} from '../rebuild/features/settings/site-language-runtime.mjs';

export const OWNER_SITE_LANGUAGE_RUNTIME_PASS = 'v643-owner-site-language-runtime-pass';

setStorageScope('__owner__');
const select = document.getElementById('owner-site-language-select');
const stored = loadLocal('prefs', {});
const prefs = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
prefs.siteLanguage = normalizeSiteLanguage(prefs.siteLanguage || 'auto');

const app = {
  state:{ prefs, siteLanguages:[], siteLanguagesLoaded:false },
  els:{ siteLanguageSelect:select }
};

function announceLanguageChange() {
  document.dispatchEvent(new CustomEvent('txt-reader-site-language-changed', {
    detail:{
      preference:app.state.prefs.siteLanguage,
      resolved:document.documentElement.dataset.siteLanguage || 'ko',
      pass:OWNER_SITE_LANGUAGE_RUNTIME_PASS
    }
  }));
}

if (select) {
  select.addEventListener('change', () => {
    app.state.prefs.siteLanguage = normalizeSiteLanguage(select.value || 'auto');
    saveLocal('prefs', app.state.prefs);
    applySiteLanguage(app);
    announceLanguageChange();
  });
}

applySiteLanguage(app);
installSiteLanguageRuntime(app);
void loadSiteLanguagePacks(app, { applyAfterLoad:true }).then(() => {
  syncSiteLanguageInput(app);
  announceLanguageChange();
});

globalThis.__txtReaderOwnerSiteLanguageApp = app;
