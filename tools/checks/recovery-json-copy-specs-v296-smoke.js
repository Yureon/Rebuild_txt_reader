const fs = require('fs');
const path = require('path');

const RECOVERY_JSON_COPY_SPECS_V296_SMOKE_PASS = 'v296-recovery-json-copy-specs-smoke-pass';

function runRecoveryJsonCopySpecsV296Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const groups = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-copy-groups.mjs'), 'utf8');
  [
    'LIBRARY_DIAGNOSTICS_PANEL_COPY_SPECS',
    'LIBRARY_DIAGNOSTICS_FINAL_AUDIT_COPY_SPECS',
    'copyTrialResultBtn',
    'copyDomSnapshotBtn',
    'copyFinalAuditCompactSummaryBtn'
  ].forEach(marker => {
    if (!groups.includes(marker)) throw new Error('v296 recovery copy spec marker missing: ' + marker);
  });
  const panel = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-panel.mjs'), 'utf8');
  if (!panel.includes('createRecoveryJsonCopyButtonsFromSpecs(app, LIBRARY_DIAGNOSTICS_PANEL_COPY_SPECS')) throw new Error('library diagnostics panel does not use panel copy specs');
  if (panel.includes("from './button-wiring.mjs'")) throw new Error('library diagnostics panel still imports low-level copy button wiring');
  if (panel.includes('createRecoveryJsonCopyButton(app, {')) throw new Error('library diagnostics panel still creates ad-hoc JSON copy buttons');
  const actions = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-copy-actions.mjs'), 'utf8');
  if (!actions.includes('LIBRARY_DIAGNOSTICS_FINAL_AUDIT_COPY_SPECS')) throw new Error('copy actions do not use final audit copy specs');
  if (actions.includes('createRecoveryJsonCopyButton(app, {')) throw new Error('copy actions still create ad-hoc JSON copy buttons');
  return { pass: RECOVERY_JSON_COPY_SPECS_V296_SMOKE_PASS };
}

module.exports = { RECOVERY_JSON_COPY_SPECS_V296_SMOKE_PASS, runRecoveryJsonCopySpecsV296Smoke };
if (require.main === module) runRecoveryJsonCopySpecsV296Smoke();
