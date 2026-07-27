const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const RECOVERY_POST_STABILIZATION_REVIEW_PAYLOAD_SMOKE_PASS = 'v237-recovery-post-stabilization-review-payload-smoke-pass';

async function runRecoveryPostStabilizationReviewPayloadSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runRecoveryPostStabilizationReviewPayloadSmoke requires projectRoot');
  const script = String.raw`
    const {
      LIBRARY_VIRTUAL_POST_STABILIZATION_REVIEW_PAYLOAD_PASS,
      buildLibraryVirtualPostStabilizationSmokeReviewPayload
    } = await import('./public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-payload.mjs');
    const {
      LIBRARY_VIRTUAL_POST_STABILIZATION_REVIEW_FORMATTERS_PASS,
      createLibraryVirtualPostStabilizationReviewScope,
      createLibraryVirtualPostStabilizationReviewNextActions
    } = await import('./public/scripts/rebuild/features/recovery/library-virtual-post-stabilization-review-formatters.mjs');
    if (LIBRARY_VIRTUAL_POST_STABILIZATION_REVIEW_PAYLOAD_PASS !== 'v237-library-virtual-post-stabilization-review-payload-pass') throw new Error('stale post stabilization review payload marker');
    if (LIBRARY_VIRTUAL_POST_STABILIZATION_REVIEW_FORMATTERS_PASS !== 'v241-library-virtual-post-stabilization-review-formatters-pass') throw new Error('stale post stabilization review formatter marker');
    const blocked = buildLibraryVirtualPostStabilizationSmokeReviewPayload({ finalSummary:null, regression:null, copyTargets:[] });
    if (blocked.status !== 'post-stabilization-smoke-blocked') throw new Error('missing final summary must block post stabilization smoke review');
    if (blocked.counts.releaseBlocking < 1) throw new Error('blocked payload did not preserve releaseBlocking count');
    if (blocked.policy?.defaultEnabled !== false || blocked.policy?.autoEnableAllowed !== false) throw new Error('post stabilization review policy must keep default OFF / no auto enable');
    const ready = buildLibraryVirtualPostStabilizationSmokeReviewPayload({
      finalSummary:{ deferredChecks:[], releaseBlocking:[] },
      regression:{ knownIssues:[] },
      copyTargets:[
        { id:'manual-review-bundle', label:'Manual review bundle', ok:true },
        { id:'final-stabilization-summary', label:'Final stabilization summary', ok:true },
        { id:'post-stabilization-smoke-review', label:'Post-stabilization smoke review', ok:true }
      ]
    });
    if (ready.counts.smokeItems <= 0 || ready.counts.staticPassRequired <= 0) throw new Error('ready payload lost smoke checklist counts');
    if (ready.scope?.productionEnableIncluded !== false) throw new Error('post stabilization scope must not include production enable');
    if (!Array.isArray(createLibraryVirtualPostStabilizationReviewNextActions()) || createLibraryVirtualPostStabilizationReviewNextActions().length !== 4) throw new Error('next action helper shape changed');
    if (createLibraryVirtualPostStabilizationReviewScope().virtualRendererDefault !== 'full renderer / virtual renderer default OFF') throw new Error('scope helper lost default OFF marker');
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'recovery post-stabilization review payload smoke', timeoutMs: 8000 })
  return { pass: RECOVERY_POST_STABILIZATION_REVIEW_PAYLOAD_SMOKE_PASS };
}

module.exports = {
  RECOVERY_POST_STABILIZATION_REVIEW_PAYLOAD_SMOKE_PASS,
  runRecoveryPostStabilizationReviewPayloadSmoke
};
