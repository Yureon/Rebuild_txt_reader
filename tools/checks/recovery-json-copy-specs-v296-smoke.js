#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-copy-groups.mjs', 'library-diagnostics-panel.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-json-copy-specs-v296-smoke.js'}));
