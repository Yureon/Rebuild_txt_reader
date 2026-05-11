const fs = require('fs');
const path = require('path');

const RECOVERY_DIAGNOSTICS_ROW_FACTORY_SMOKE_PASS = 'v249-recovery-diagnostics-row-factory-smoke-pass';

function runRecoveryDiagnosticsRowFactorySmoke(projectRoot) {
  const factory = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-row-factory.mjs'), 'utf8');
  const samples = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-samples.mjs'), 'utf8');
  const status = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-status-rows.mjs'), 'utf8');
  ['RECOVERY_LIBRARY_DIAGNOSTICS_ROW_FACTORY_PASS','makeLibraryDiagnosticsStatusRow','createLibraryDiagnosticsSampleRows','createDatasetMeta'].forEach(marker => {
    if (!factory.includes(marker)) throw new Error('row factory missing marker: ' + marker);
  });
  if (!samples.includes('library-diagnostics-row-factory.mjs')) throw new Error('samples must import row factory');
  if (!status.includes('makeLibraryDiagnosticsStatusRow')) throw new Error('status rows must use row factory');
  return { pass: RECOVERY_DIAGNOSTICS_ROW_FACTORY_SMOKE_PASS };
}

module.exports = { RECOVERY_DIAGNOSTICS_ROW_FACTORY_SMOKE_PASS, runRecoveryDiagnosticsRowFactorySmoke };
