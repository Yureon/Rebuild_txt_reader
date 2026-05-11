const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RECOVERY_LIBRARY_MANUAL_REVIEW_BUNDLE_PAYLOAD_SPLIT_V306_SMOKE_PASS = 'v306-recovery-library-manual-review-bundle-payload-split-smoke-pass';

async function runRecoveryLibraryManualReviewBundlePayloadSplitV306Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const recoveryDir = path.join(projectRoot, 'public/scripts/rebuild/features/recovery');
  const payloadPath = path.join(recoveryDir, 'library-virtual-manual-review-bundle-payload.mjs');
  const panelsPath = path.join(recoveryDir, 'library-virtual-manual-review-bundle-panels.mjs');
  const diagnosticsCallbacksPath = path.join(recoveryDir, 'library-diagnostics-callbacks.mjs');
  const diagnosticsExportPayloadPath = path.join(recoveryDir, 'library-diagnostics-export-payload.mjs');
  const diagnosticsVirtualReviewPanelsPath = path.join(recoveryDir, 'library-diagnostics-virtual-review-panels.mjs');
  const diagnosticsPanelCopyButtonsPath = path.join(recoveryDir, 'library-diagnostics-panel-copy-buttons.mjs');

  const payload = fs.readFileSync(payloadPath, 'utf8');
  const panels = fs.readFileSync(panelsPath, 'utf8');
  const diagnosticsCallbacks = fs.readFileSync(diagnosticsCallbacksPath, 'utf8');
  const diagnosticsExportPayload = fs.readFileSync(diagnosticsExportPayloadPath, 'utf8');
  const diagnosticsVirtualReviewPanels = fs.readFileSync(diagnosticsVirtualReviewPanelsPath, 'utf8');
  const diagnosticsPanelCopyButtons = fs.readFileSync(diagnosticsPanelCopyButtonsPath, 'utf8');

  if (!payload.includes('v306-library-virtual-manual-review-bundle-payload-split-pass')) {
    throw new Error('v306 manual review bundle payload split marker missing');
  }
  if (!payload.includes('export function buildLibraryVirtualManualReviewBundlePayload')) {
    throw new Error('payload module must own buildLibraryVirtualManualReviewBundlePayload export');
  }
  if (panels.includes('function buildLibraryVirtualManualReviewBundlePayload(')) {
    throw new Error('manual review bundle panels still own payload builder implementation');
  }
  if (!panels.includes("from './library-virtual-manual-review-bundle-payload.mjs'")) {
    throw new Error('manual review bundle panels must re-export payload builder from payload module');
  }
  for (const [label, source] of [
    ['diagnostics callbacks', diagnosticsCallbacks],
    ['diagnostics export payload', diagnosticsExportPayload],
    ['diagnostics virtual review panels', diagnosticsVirtualReviewPanels],
    ['diagnostics panel copy buttons', diagnosticsPanelCopyButtons]
  ]) {
    if (!source.includes("from './library-virtual-manual-review-bundle-payload.mjs'")) {
      throw new Error(label + ' must import manual review bundle payload from split payload module');
    }
  }
  const panelsLineCount = panels.split(/\r?\n/).length;
  if (panelsLineCount > 170) {
    throw new Error('manual review bundle panels line count regression after v306 split: ' + panelsLineCount);
  }

  const payloadModule = await import(pathToFileURL(payloadPath).href);
  await import(pathToFileURL(panelsPath).href);
  if (typeof payloadModule.buildLibraryVirtualManualReviewBundlePayload !== 'function') {
    throw new Error('buildLibraryVirtualManualReviewBundlePayload export missing from payload module');
  }
  const app = { state: { prefs: {}, libraryVirtualChecklistLastDiff: null } };
  const bundle = payloadModule.buildLibraryVirtualManualReviewBundlePayload(app, {}, null, null, null, null, null, null, null);
  if (!bundle || typeof bundle !== 'object') throw new Error('payload builder did not return a bundle object');
  if (!bundle.policy || bundle.policy.fallbackToFullOnFailure !== true || bundle.policy.settingsToggleExposed !== false) throw new Error('manual review bundle policy marker missing');
  if (!bundle.manualReviewWorkflow || !bundle.riskRegister || !bundle.fullEvidence) {
    throw new Error('manual review bundle payload lost expected evidence/report sections');
  }
  return {
    pass: RECOVERY_LIBRARY_MANUAL_REVIEW_BUNDLE_PAYLOAD_SPLIT_V306_SMOKE_PASS,
    panelsLineCount,
    payloadKeys: Object.keys(bundle).length
  };
}

module.exports = {
  RECOVERY_LIBRARY_MANUAL_REVIEW_BUNDLE_PAYLOAD_SPLIT_V306_SMOKE_PASS,
  runRecoveryLibraryManualReviewBundlePayloadSplitV306Smoke
};

if (require.main === module) {
  runRecoveryLibraryManualReviewBundlePayloadSplitV306Smoke().catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
