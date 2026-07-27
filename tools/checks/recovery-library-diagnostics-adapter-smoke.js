#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-adapter.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-diagnostics-adapter-smoke.js'}));
