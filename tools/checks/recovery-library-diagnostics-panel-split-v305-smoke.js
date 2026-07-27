#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-panel.mjs', 'library-diagnostics-panel-context.mjs', 'library-diagnostics-panel-copy-buttons.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-diagnostics-panel-split-v305-smoke.js'}));
