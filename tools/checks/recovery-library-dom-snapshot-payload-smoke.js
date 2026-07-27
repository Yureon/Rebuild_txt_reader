#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-dom-snapshot-payload.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-dom-snapshot-payload-smoke.js'}));
