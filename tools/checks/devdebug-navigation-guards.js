const FRONTEND_CHECK_DEVDEBUG_NAVIGATION_GUARDS_PASS = 'v190-frontend-check-devdebug-navigation-guards-pass';

function runDevdebugNavigationGuardChecks(ctx) {
  const {
    shellSource,
    elementsSource,
    appCssSource,
    devtoolsNavigationCombinedSource
  } = ctx;

  ['data-devdbg-nav-pass="v140"','id="devdbg-recovery-cache-btn"','id="devdbg-recovery-search-btn"','data-recovery-nav-pass="v140"','data-recovery-jump="cache-management"','백업 · 위험 작업'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error('Missing v140 DevDebug/Recovery navigation shell marker: ' + marker);
  });
  ['v115 Developer Debug / Recovery Center navigation polish','recovery-center-nav[data-recovery-nav-pass]','recovery-action-cluster[data-recovery-action-compact]','recovery-action-summary','recovery-section[data-recovery-section]'].forEach((marker) => {
    if (!appCssSource.includes(marker)) throw new Error('Missing v140 DevDebug/Recovery navigation CSS marker: ' + marker);
  });
  ['createRecoveryActionDetails','recoveryActionCompact:\'v140\'','recoverySection:\'cache-management\'','data-recovery-jump','focusRecoveryTarget(app, { focus: target.dataset.recoveryJump'].forEach((marker) => {
    if (!devtoolsNavigationCombinedSource.includes(marker)) throw new Error('Missing v140 DevDebug/Recovery navigation runtime marker: ' + marker);
  });
  ['devdbg-recovery-cache-btn','devdbg-recovery-search-btn'].forEach((marker) => {
    if (!elementsSource.includes(marker)) throw new Error('Missing v140 DevDebug/Recovery element marker: ' + marker);
  });
}

module.exports = {
  FRONTEND_CHECK_DEVDEBUG_NAVIGATION_GUARDS_PASS,
  runDevdebugNavigationGuardChecks
};
