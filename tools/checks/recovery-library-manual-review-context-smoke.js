#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-context-resolvers.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-manual-review-context-smoke.js'}));
