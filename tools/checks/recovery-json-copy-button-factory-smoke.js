#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['json-copy-button-factory.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-json-copy-button-factory-smoke.js'}));
