const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_DIAGNOSTICS_ADAPTER_SMOKE_PASS = 'v293-recovery-library-diagnostics-adapter-smoke-pass';

function runRecoveryLibraryDiagnosticsAdapterSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const adapter = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-adapter.mjs'), 'utf8');
  const diagnostics = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics.mjs'), 'utf8');
  [
    'RECOVERY_LIBRARY_DIAGNOSTICS_ADAPTER_PASS',
    'v293-recovery-library-diagnostics-adapter-pass',
    'createRecoveryLibraryDiagnosticsAdapter',
    'resolveRecoveryLibraryPanelDiagnosticsFromAdapter',
    'getWindowDiagnostics',
    'getRenderDiagnostics',
    'getCurrentWindowRows'
  ].forEach(marker => {
    if (!adapter.includes(marker)) throw new Error('recovery diagnostics adapter marker missing: ' + marker);
  });
  [
    "from './library-diagnostics-adapter.mjs'",
    'RECOVERY_LIBRARY_DIAGNOSTICS_ADAPTER_BRIDGE_PASS',
    'v293-recovery-library-diagnostics-adapter-bridge-pass',
    'createRecoveryLibraryDiagnosticsAdapter(app)',
    'resolveRecoveryLibraryPanelDiagnosticsFromAdapter(adapter, snapshot, info)'
  ].forEach(marker => {
    if (!diagnostics.includes(marker)) throw new Error('recovery diagnostics adapter bridge marker missing: ' + marker);
  });
  if (/app\?\.library\?\./.test(diagnostics)) throw new Error('library-diagnostics.mjs still directly reaches app.library optional API');
  return { pass: RECOVERY_LIBRARY_DIAGNOSTICS_ADAPTER_SMOKE_PASS };
}

module.exports = { RECOVERY_LIBRARY_DIAGNOSTICS_ADAPTER_SMOKE_PASS, runRecoveryLibraryDiagnosticsAdapterSmoke };
if (require.main === module) runRecoveryLibraryDiagnosticsAdapterSmoke();
