const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_VIRTUAL_PAYLOAD_CONTEXT_SMOKE_PASS = 'v297-recovery-library-virtual-payload-context-smoke-pass';

function runRecoveryLibraryVirtualPayloadContextSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const adapter = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-context-resolvers.mjs'), 'utf8');
  const payloads = [
    'library-virtual-fallback-sample-payload.mjs',
    'library-virtual-trial-result-payload.mjs',
    'library-row-height-diagnostics-payload.mjs'
  ].map(name => fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery', name), 'utf8')).join('\n');
  [
    'RECOVERY_LIBRARY_VIRTUAL_PAYLOAD_CONTEXT_PASS',
    'v297-recovery-library-virtual-payload-context-pass',
    'resolveRecoveryLibraryVirtualPayloadContext',
    'createRecoveryLibraryDiagnosticsAdapter(app)'
  ].forEach(marker => {
    if (!adapter.includes(marker)) throw new Error('recovery library virtual payload context marker missing: ' + marker);
  });
  if (!payloads.includes("from './library-diagnostics-context-resolvers.mjs'")) throw new Error('payload builders do not import diagnostics context resolver');
  if (!payloads.includes('const payloadContext = resolveRecoveryLibraryVirtualPayloadContext(app,')) throw new Error('payload builders do not resolve adapter context');
  const directCalls = (payloads.match(/app\.library\?\./g) || []).length;
  if (directCalls !== 0) throw new Error('payload builders still directly call app.library: ' + directCalls);
  return { pass: RECOVERY_LIBRARY_VIRTUAL_PAYLOAD_CONTEXT_SMOKE_PASS };
}

module.exports = { RECOVERY_LIBRARY_VIRTUAL_PAYLOAD_CONTEXT_SMOKE_PASS, runRecoveryLibraryVirtualPayloadContextSmoke };
if (require.main === module) runRecoveryLibraryVirtualPayloadContextSmoke();
