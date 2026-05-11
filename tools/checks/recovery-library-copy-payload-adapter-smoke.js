const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_COPY_PAYLOAD_ADAPTER_SMOKE_PASS = 'v294-recovery-library-copy-payload-adapter-smoke-pass';

function runRecoveryLibraryCopyPayloadAdapterSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const adapter = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-context-resolvers.mjs'), 'utf8');
  const panel = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-panel-copy-buttons.mjs'), 'utf8');
  const exportPayload = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-export-payload.mjs'), 'utf8');
  [
    'RECOVERY_LIBRARY_COPY_PAYLOAD_ADAPTER_PASS',
    'v294-recovery-library-copy-payload-adapter-pass',
    'resolveRecoveryLibraryCopyPayloadContext',
    'currentWindowRows',
    'sessionOptInDiagnostics'
  ].forEach(marker => {
    if (!adapter.includes(marker)) throw new Error('recovery copy payload adapter marker missing: ' + marker);
  });
  if (!panel.includes('resolveCopyPayloadContext().currentWindowRows')) throw new Error('library diagnostics panel still bypasses copy payload adapter for window rows');
  if (!panel.includes('resolveCopyPayloadContext().actionAudit')) throw new Error('library diagnostics panel still bypasses copy payload adapter for action audit');
  if (!panel.includes('resolveCopyPayloadContext().sessionOptInDiagnostics')) throw new Error('library diagnostics panel still bypasses copy payload adapter for session diagnostics');
  if (!exportPayload.includes('copyPayloadAdapterPass')) throw new Error('export payload does not expose copy payload adapter pass');
  if (exportPayload.includes('app.library?.getCurrentWindowRows') || exportPayload.includes('app.library?.getActionAuditDiagnostics')) throw new Error('export payload still directly reads app.library diagnostics');
  return { pass: RECOVERY_LIBRARY_COPY_PAYLOAD_ADAPTER_SMOKE_PASS };
}

module.exports = { RECOVERY_LIBRARY_COPY_PAYLOAD_ADAPTER_SMOKE_PASS, runRecoveryLibraryCopyPayloadAdapterSmoke };
if (require.main === module) runRecoveryLibraryCopyPayloadAdapterSmoke();
