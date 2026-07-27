#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-adapter.mjs', 'library-diagnostics-adapter-methods.mjs', 'library-diagnostics-context-resolvers.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-full-split-v307-smoke.js'}));
