const path = require('path');

const { runLibraryVirtualRuntimeSplitSmoke } = require('./library-virtual-runtime-split-smoke.js');
const { runRecoveryLibraryCopyPayloadAdapterSmoke } = require('./recovery-library-copy-payload-adapter-smoke.js');
const { runRecoveryLibraryVirtualPayloadContextSmoke } = require('./recovery-library-virtual-payload-context-smoke.js');
const { runRecoveryLibraryManualReviewContextSmoke } = require('./recovery-library-manual-review-context-smoke.js');
const { runLibraryBridgeSplitV301Smoke } = require('./library-bridge-split-v301-smoke.js');
const { runLibraryRuntimeBridgeSplitV304Smoke } = require('./library-runtime-bridge-split-v304-smoke.js');
const { runRecoveryLibraryDiagnosticsPanelSplitV305Smoke } = require('./recovery-library-diagnostics-panel-split-v305-smoke.js');
const { runRecoveryLibraryManualReviewBundlePayloadSplitV306Smoke } = require('./recovery-library-manual-review-bundle-payload-split-v306-smoke.js');
const { runRecoveryLibraryFullSplitV307Smoke } = require('./recovery-library-full-split-v307-smoke.js');

const LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS = 'v309-library-recovery-split-suite-smoke-pass';
const LIBRARY_RECOVERY_SPLIT_SUITE_DETAIL_PASS = 'v309-library-recovery-split-suite-detail-pass';

const LIBRARY_RECOVERY_SPLIT_SMOKE_CASES = Object.freeze([
  ['library virtual runtime split smoke', runLibraryVirtualRuntimeSplitSmoke],
  ['recovery library copy payload adapter smoke', runRecoveryLibraryCopyPayloadAdapterSmoke],
  ['recovery library virtual payload context smoke', runRecoveryLibraryVirtualPayloadContextSmoke],
  ['recovery library manual review context smoke', runRecoveryLibraryManualReviewContextSmoke],
  ['library bridge split v301 smoke', runLibraryBridgeSplitV301Smoke],
  ['library runtime bridge split v304 smoke', runLibraryRuntimeBridgeSplitV304Smoke],
  ['recovery library diagnostics panel split v305 smoke', runRecoveryLibraryDiagnosticsPanelSplitV305Smoke],
  ['recovery library manual review bundle payload split v306 smoke', runRecoveryLibraryManualReviewBundlePayloadSplitV306Smoke],
  ['recovery library full split v307 smoke', runRecoveryLibraryFullSplitV307Smoke]
]);

function formatLibraryRecoverySplitSuiteError(label, index, total, error) {
  const message = (error && error.message) || String(error || 'unknown smoke failure');
  return `library/recovery split suite case ${index}/${total} failed (${label}): ${message}`;
}

async function runLibraryRecoverySplitSuiteSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const results = [];
  const total = LIBRARY_RECOVERY_SPLIT_SMOKE_CASES.length;
  for (let index = 0; index < total; index += 1) {
    const [label, runSmoke] = LIBRARY_RECOVERY_SPLIT_SMOKE_CASES[index];
    try {
      if (typeof runSmoke !== 'function') throw new Error('suite case runner is not a function');
      const result = await runSmoke(projectRoot);
      results.push({
        index: index + 1,
        label,
        pass: result && result.pass || true
      });
    } catch (error) {
      const wrapped = new Error(formatLibraryRecoverySplitSuiteError(label, index + 1, total, error));
      wrapped.cause = error;
      throw wrapped;
    }
  }
  return {
    pass: LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS,
    detailPass: LIBRARY_RECOVERY_SPLIT_SUITE_DETAIL_PASS,
    cases: results.length,
    results
  };
}

module.exports = {
  LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS,
  LIBRARY_RECOVERY_SPLIT_SUITE_DETAIL_PASS,
  LIBRARY_RECOVERY_SPLIT_SMOKE_CASES,
  formatLibraryRecoverySplitSuiteError,
  runLibraryRecoverySplitSuiteSmoke
};

if (require.main === module) {
  runLibraryRecoverySplitSuiteSmoke().then(result => {
    console.log(`${result.pass} (${result.cases} cases)`);
  }).catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
