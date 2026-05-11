const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const RECOVERY_FINAL_SUMMARY_PAYLOAD_SMOKE_PASS = 'v236-recovery-final-summary-payload-smoke-pass';

async function runRecoveryFinalSummaryPayloadSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runRecoveryFinalSummaryPayloadSmoke requires projectRoot');
  const script = String.raw`
    const {
      buildLibraryVirtualFinalStabilizationClassifications,
      buildLibraryVirtualFinalStabilizationSummaryParts
    } = await import('./public/scripts/rebuild/features/recovery/library-virtual-final-summary-payload.mjs');
    const blocked = buildLibraryVirtualFinalStabilizationSummaryParts({ decision:null, regression:null, staticPolicy:null });
    if (blocked.status !== 'final-stabilization-blocked') throw new Error('missing evidence must block final stabilization');
    if (blocked.releaseBlocking.length !== 3) throw new Error('blocked final summary must classify missing decision/regression/static policy');
    if (blocked.policy?.defaultEnabled !== false || blocked.policy?.autoEnableAllowed !== false) throw new Error('final summary policy must stay default OFF / no auto enable');
    const ready = buildLibraryVirtualFinalStabilizationSummaryParts({
      decision:{ decision:{}, deferredEvidence:[] },
      regression:{ checklist:[], knownIssues:[], counts:{ manualRequired:0 } },
      staticPolicy:{ status:'pass' }
    });
    if (ready.status !== 'diagnostic-release-ready') throw new Error('complete clean evidence must be diagnostic-release-ready');
    if (ready.releaseScope?.productionEnableIncluded !== false) throw new Error('release scope must not include production enable');
    const deferred = buildLibraryVirtualFinalStabilizationSummaryParts({
      decision:{ decision:{}, deferredEvidence:[{ id:'deferred-1', title:'Deferred check', requiredAction:'manual smoke' }] },
      regression:{ checklist:[{ id:'manual-1', status:'manual-required', title:'Manual item' }], knownIssues:[{ id:'known-1', status:'known' }], counts:{ manualRequired:1 } },
      staticPolicy:{ status:'pass' }
    });
    if (deferred.status !== 'diagnostic-release-ready-with-deferred-checks') throw new Error('deferred evidence must keep deferred-ready status');
    if (deferred.counts.deferredChecks !== 2 || deferred.counts.knownIssues !== 1) throw new Error('deferred/known issue counts were not preserved');
    const classifications = buildLibraryVirtualFinalStabilizationClassifications({ releaseBlocking:[], deferredChecks:[{}], knownIssues:[] });
    if (classifications.deferredClassification !== 'deferred-live-device-and-review-checks-remain') throw new Error('classification helper lost deferred marker');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'recovery final summary payload smoke', timeoutMs: 8000 })
  return { pass: RECOVERY_FINAL_SUMMARY_PAYLOAD_SMOKE_PASS };
}

module.exports = {
  RECOVERY_FINAL_SUMMARY_PAYLOAD_SMOKE_PASS,
  runRecoveryFinalSummaryPayloadSmoke
};
