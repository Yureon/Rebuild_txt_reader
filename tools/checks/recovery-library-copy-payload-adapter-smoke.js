#!/usr/bin/env node
const { assertRemovedRecoveryModules }=require('./removed-recovery-contract.js');
const result=assertRemovedRecoveryModules(process.cwd(),['library-diagnostics-context-resolvers.mjs', 'library-diagnostics-panel-copy-buttons.mjs']);
console.log(JSON.stringify({...result,legacyCheck:'recovery-library-copy-payload-adapter-smoke.js'}));
