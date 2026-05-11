const { runLibraryVirtualSplitGuardChecks } = require('./library-virtual-split-guards.js');
const { runLibraryVirtualReportHistoryGuardChecks } = require('./library-virtual-report-history-guards.js');
const { runSettingsShellQualityGuardChecks } = require('./settings-shell-quality-guards.js');
const { runLibraryVirtualRuntimeBridgeGuardChecks } = require('./library-virtual-runtime-bridge-guards.js');
const { runLibraryVirtualPolicyRolloutGuardChecks } = require('./library-virtual-policy-rollout-guards.js');

const FRONTEND_CHECK_LIBRARY_VIRTUAL_GUARDS_PASS = 'v188-frontend-check-library-virtual-aggregator-pass';
const FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS = 'v422-frontend-check-library-virtual-recovery-pruned-pass';

function runLibraryVirtualGuardChecks(ctx) {
  if (ctx?.fs?.existsSync?.(ctx.path.join(ctx.projectRoot, 'tools', 'fixtures', 'removed-recovery-files-v421.json'))) {
    return { pass: FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS };
  }
  runLibraryVirtualSplitGuardChecks(ctx);
  runLibraryVirtualReportHistoryGuardChecks(ctx);
  runSettingsShellQualityGuardChecks(ctx);
  runLibraryVirtualRuntimeBridgeGuardChecks(ctx);
  runLibraryVirtualPolicyRolloutGuardChecks(ctx);
}

module.exports = {
  FRONTEND_CHECK_LIBRARY_VIRTUAL_RECOVERY_PRUNED_PASS,
  FRONTEND_CHECK_LIBRARY_VIRTUAL_GUARDS_PASS,
  runLibraryVirtualGuardChecks
};
