export const BOOT_RECOVERY_CLEANUP_PASS = 'v610-boot-recovery-cleanup-pass';

export function cleanupFailedBoot(app) {
  if (!app || typeof app !== 'object') return;
  try { app.deviceSync?.stop?.(); } catch {}
  ['devtoolsCleanup','themeSettingsCleanup','readDataCleanup','bookmarksCleanup','searchCleanup','readerCleanup','libraryCleanup','lazyFeatureCleanup','uiCleanup'].forEach((key) => {
    try { app[key]?.(); } catch {}
  });
}
