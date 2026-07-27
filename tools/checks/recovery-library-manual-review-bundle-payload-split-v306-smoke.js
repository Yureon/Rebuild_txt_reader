#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-virtual-manual-review-bundle-payload.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-manual-review-bundle-payload-split-v306-smoke.js'}));
