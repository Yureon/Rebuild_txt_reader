import { applyPrefs, bindAppearanceControls, syncSettingInputs } from './settings/appearance.mjs';
import { bindDataTools } from './settings/data-tools.mjs';
import { bindCustomCss } from './settings/custom-css.mjs';
import { bindFunctionalControls } from './settings/controls.mjs';
import { bindShortcuts } from './settings/shortcuts.mjs';
import { bindFonts } from './settings/fonts.mjs';
import { bindPreprocess } from './settings/preprocess.mjs';
import { bindThemeEditor, renderThemePresets } from './settings/theme-editor.mjs';
import { bindSiteLanguageControl, installSiteLanguageRuntime } from './settings/site-language.mjs';

export { applyPrefs };

export function installThemeAndSettings(app) {
  app.themeSettingsCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  installSiteLanguageRuntime(app);
  renderThemePresets(app);
  applyPrefs(app);
  bindAppearanceControls(app, { on });
  bindSiteLanguageControl(app, { applyPrefs, on });
  bindThemeEditor(app, { applyPrefs, on });
  bindPreprocess(app, { applyPrefs, syncSettingInputs, on });
  bindFonts(app, { applyPrefs, on });
  bindDataTools(app, { applyPrefs, on });
  bindCustomCss(app, { applyPrefs, on });
  bindFunctionalControls(app, { applyPrefs, on });
  bindShortcuts(app, { applyPrefs, on });

  app.themeSettingsCleanup = () => {
    app.state.preprocessPreviewAbort?.abort?.();
    disposers.splice(0).forEach(dispose => {
      try { dispose(); } catch {}
    });
  };
}
