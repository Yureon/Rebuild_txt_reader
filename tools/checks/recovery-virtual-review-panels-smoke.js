const fs = require('fs');
const path = require('path');

const RECOVERY_VIRTUAL_REVIEW_PANELS_SMOKE_PASS = 'v246-recovery-virtual-review-panels-smoke-pass';

function runRecoveryVirtualReviewPanelsSmoke(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-panels.mjs'), 'utf8');
  const panel = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-virtual-panels.mjs'), 'utf8');
  ['v246-recovery-library-diagnostics-virtual-review-panels-pass', 'buildRecoveryLibraryVirtualReviewPanelSet', 'manualReviewBundle', 'finalOptInAuditPanel'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('recovery virtual review panel marker missing: ' + marker);
  });
  if (!panel.includes('buildRecoveryLibraryVirtualReviewPanelSet')) throw new Error('virtual panel bridge missing review builder');
  return { pass: RECOVERY_VIRTUAL_REVIEW_PANELS_SMOKE_PASS };
}

module.exports = { RECOVERY_VIRTUAL_REVIEW_PANELS_SMOKE_PASS, runRecoveryVirtualReviewPanelsSmoke };
