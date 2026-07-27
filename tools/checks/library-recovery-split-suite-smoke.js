#!/usr/bin/env node
const path = require('path');
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const { assertRemovedRecoveryModules } = require('./removed-recovery-contract.js');
const LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS='v613-library-recovery-current-suite-smoke-pass';
async function runLibraryRecoverySplitSuiteSmoke(projectRoot=path.join(__dirname,'..','..')){
  const graph=createLibraryArchitecture(projectRoot);
  graph.assertReachable(
    'features/library-core-operations-bridge.mjs',
    'features/library-runtime-deps-bridge.mjs',
    'features/library-virtual-operations-bridge.mjs'
  );
  const removed=assertRemovedRecoveryModules(projectRoot,[
    'library-diagnostics-adapter.mjs',
    'library-diagnostics-panel.mjs',
    'library-virtual-manual-review-bundle-payload.mjs'
  ]);
  return {pass:LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS,cases:4,removed:removed.removed};
}
module.exports={LIBRARY_RECOVERY_SPLIT_SUITE_SMOKE_PASS,runLibraryRecoverySplitSuiteSmoke};
if(require.main===module)runLibraryRecoverySplitSuiteSmoke().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e.stack||e);process.exit(1)});
