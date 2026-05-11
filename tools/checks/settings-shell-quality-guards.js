const { runSettingsModalSafeareaGuardChecks } = require('./settings-modal-safearea-guards.js');
const { runDevdebugNavigationGuardChecks } = require('./devdebug-navigation-guards.js');
const { runReaderOverlayQualityGuardChecks } = require('./reader-overlay-quality-guards.js');

const FRONTEND_CHECK_SETTINGS_SHELL_QUALITY_GUARDS_PASS = 'v190-frontend-check-settings-shell-quality-aggregator-pass';

function runSettingsShellQualityGuardChecks(ctx) {
  runSettingsModalSafeareaGuardChecks(ctx);
  runDevdebugNavigationGuardChecks(ctx);
  runReaderOverlayQualityGuardChecks(ctx);
}

module.exports = {
  FRONTEND_CHECK_SETTINGS_SHELL_QUALITY_GUARDS_PASS,
  runSettingsShellQualityGuardChecks
};
