const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const { readProjectSourceManifest, buildProjectSourceManifestSummary } = require('./source-loader-manifest.js');

const THEME_SETTINGS_RUNTIME_SMOKE_PASS = 'v232-theme-settings-runtime-smoke-pass';
const THEME_SETTINGS_RUNTIME_EXPLICIT_EXIT_PASS = 'v233-theme-settings-runtime-smoke-explicit-exit-pass';
const THEME_SETTINGS_RUNTIME_SOURCE_MANIFEST_PASS = 'v255-theme-settings-runtime-source-manifest-pass';

async function runThemeSettingsRuntimeSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runThemeSettingsRuntimeSmoke requires projectRoot');
  const sources = readProjectSourceManifest(projectRoot, {
    themeSettings: 'rebuild/features/theme-settings.mjs',
    state: 'rebuild/state/app-state.mjs',
    controls: 'rebuild/features/settings/controls.mjs',
    appearance: 'rebuild/features/settings/appearance.mjs'
  });
  const sourceSummary = buildProjectSourceManifestSummary(sources);
  [
    'installThemeAndSettings',
    'themeSettingsCleanup',
    'applyPrefs'
  ].forEach(marker => {
    if (!sources.themeSettings.includes(marker)) throw new Error('theme settings runtime marker missing: ' + marker);
  });
  if (!sources.appearance.includes('document.body.dataset.theme')) throw new Error('theme settings appearance bridge missing body dataset marker');
  if (!sources.state.includes(`version: '${CURRENT_REBUILD_VERSION}'`)) throw new Error('theme smoke loaded stale state version marker');
  ['normalizeFunctionalPrefs', 'syncFunctionalInputs'].forEach(marker => {
    if (!sources.controls.includes(marker)) throw new Error('theme settings controls bridge missing: ' + marker);
  });
  return {
    pass: THEME_SETTINGS_RUNTIME_SMOKE_PASS,
    explicitExitPass: THEME_SETTINGS_RUNTIME_EXPLICIT_EXIT_PASS,
    sourceManifestPass: THEME_SETTINGS_RUNTIME_SOURCE_MANIFEST_PASS,
    projectSourceManifestPass: sourceSummary.pass
  };
}

module.exports = {
  THEME_SETTINGS_RUNTIME_SMOKE_PASS,
  THEME_SETTINGS_RUNTIME_EXPLICIT_EXIT_PASS,
  THEME_SETTINGS_RUNTIME_SOURCE_MANIFEST_PASS,
  runThemeSettingsRuntimeSmoke
};
