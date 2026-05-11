const fs = require('fs');
const path = require('path');

const RECOVERY_LIBRARY_MANUAL_REVIEW_CONTEXT_SMOKE_PASS = 'v300-recovery-library-manual-review-context-smoke-pass';

function runRecoveryLibraryManualReviewContextSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const adapterPath = path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-context-resolvers.mjs');
  const targets = [
    'public/scripts/rebuild/features/recovery/library-virtual-manual-review-bundle-panels.mjs',
    'public/scripts/rebuild/features/recovery/library-virtual-manual-review-checklist.mjs',
    'public/scripts/rebuild/features/recovery/library-virtual-readiness-policy-panel.mjs'
  ];
  const adapter = fs.readFileSync(adapterPath, 'utf8');
  [
    'RECOVERY_LIBRARY_MANUAL_REVIEW_CONTEXT_PASS',
    'v300-recovery-library-manual-review-context-pass',
    'resolveRecoveryLibraryManualReviewContext',
    'createRecoveryLibraryDiagnosticsAdapter(app)',
    'sessionOptInDiag',
    'rowHeightDiagnostics',
    'prototypeDiagnostics'
  ].forEach(marker => {
    if (!adapter.includes(marker)) throw new Error('manual review adapter context marker missing: ' + marker);
  });
  for (const rel of targets) {
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes("from './library-diagnostics-context-resolvers.mjs'") && !source.includes("from './library-diagnostics-adapter.mjs'")) throw new Error('manual review module missing diagnostics context import: ' + rel);
    if (!source.includes('resolveRecoveryLibraryManualReviewContext(app,') && !source.includes("from './library-virtual-manual-review-bundle-payload.mjs'")) throw new Error('manual review module missing context resolver call or payload delegation: ' + rel);
    if (/app\.library\?\.get(?:FallbackDiagnostics|VirtualSessionOptInDiagnostics|VirtualTrialDiagnostics|RowHeightDiagnostics|ActionAuditDiagnostics|CurrentWindowRows|PrototypeDiagnostics)/.test(source)) {
      throw new Error('manual review module still calls read-only app.library diagnostics directly: ' + rel);
    }
  }
  return { pass: RECOVERY_LIBRARY_MANUAL_REVIEW_CONTEXT_SMOKE_PASS };
}

module.exports = { RECOVERY_LIBRARY_MANUAL_REVIEW_CONTEXT_SMOKE_PASS, runRecoveryLibraryManualReviewContextSmoke };
if (require.main === module) runRecoveryLibraryManualReviewContextSmoke();
