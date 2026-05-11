const fs = require('fs');
const path = require('path');

const RECOVERY_JSON_COPY_BUTTON_FACTORY_SMOKE_PASS = 'v295-recovery-json-copy-button-factory-smoke-pass';

function runRecoveryJsonCopyButtonFactorySmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const mod = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/json-copy-button-factory.mjs'), 'utf8');
  [
    'v295-recovery-json-copy-button-factory-pass',
    'createRecoveryJsonCopyButtonFromSpec',
    'createRecoveryJsonCopyButtonsFromSpecs',
    'createRecoveryJsonCopyButton'
  ].forEach(marker => {
    if (!mod.includes(marker)) throw new Error('recovery json copy button factory marker missing: ' + marker);
  });
  const copyActions = fs.readFileSync(path.join(projectRoot, 'public/scripts/rebuild/features/recovery/library-diagnostics-copy-actions.mjs'), 'utf8');
  if (!copyActions.includes("from './json-copy-button-factory.mjs'")) throw new Error('copy actions do not use JSON copy button factory');
  if (copyActions.includes('function createCopyButtonsFromSpecs')) throw new Error('stale local copy button factory remains in copy actions module');
  return { pass: RECOVERY_JSON_COPY_BUTTON_FACTORY_SMOKE_PASS };
}

module.exports = { RECOVERY_JSON_COPY_BUTTON_FACTORY_SMOKE_PASS, runRecoveryJsonCopyButtonFactorySmoke };
if (require.main === module) runRecoveryJsonCopyButtonFactorySmoke();
