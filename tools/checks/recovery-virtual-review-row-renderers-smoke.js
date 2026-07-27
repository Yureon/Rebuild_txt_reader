const fs = require('fs');
const path = require('path');

const RECOVERY_VIRTUAL_REVIEW_ROW_RENDERERS_SMOKE_PASS = 'v247-recovery-virtual-review-row-renderers-smoke-pass';

function runRecoveryVirtualReviewRowRenderersSmoke(projectRoot) {
  const rel = 'public/scripts/rebuild/features/recovery/library-diagnostics-virtual-review-row-renderers.mjs';
  const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
  ['v247-recovery-library-diagnostics-virtual-review-row-renderers-pass', 'buildRecoveryVirtualReviewPanelRows', 'createRecoveryVirtualReviewPanelSummary', 'Review panel rows'].forEach(marker => {
    if (!source.includes(marker)) throw new Error('recovery review row renderer marker missing: ' + marker);
  });
  const panelSource = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-section-groups.mjs'), 'utf8');
  if (!panelSource.includes('Review panel row summary')) throw new Error('review panel row summary section missing');
  return { pass: RECOVERY_VIRTUAL_REVIEW_ROW_RENDERERS_SMOKE_PASS };
}

module.exports = { RECOVERY_VIRTUAL_REVIEW_ROW_RENDERERS_SMOKE_PASS, runRecoveryVirtualReviewRowRenderersSmoke };
