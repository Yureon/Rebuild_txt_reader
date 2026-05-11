const fs = require('fs');
const path = require('path');

const RECOVERY_VIRTUAL_REVIEW_ROW_STATE_SMOKE_PASS = 'v248-recovery-virtual-review-row-state-smoke-pass';

function runRecoveryVirtualReviewRowStateSmoke(projectRoot) {
  const source = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-state.mjs'), 'utf8');
  ['v248-recovery-library-diagnostics-virtual-review-row-state-pass', 'describeRecoveryVirtualReviewPanelState', 'summarizeRecoveryVirtualReviewPanelRows'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('recovery row state marker missing: ' + marker);
  });
  const renderer = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-renderers.mjs'), 'utf8');
  if (!renderer.includes('summarizeRecoveryVirtualReviewPanelRows')) throw new Error('row renderer did not adopt row state helper');
  return { pass: RECOVERY_VIRTUAL_REVIEW_ROW_STATE_SMOKE_PASS };
}

module.exports = { RECOVERY_VIRTUAL_REVIEW_ROW_STATE_SMOKE_PASS, runRecoveryVirtualReviewRowStateSmoke };
