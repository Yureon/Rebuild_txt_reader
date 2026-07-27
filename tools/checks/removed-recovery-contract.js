const fs = require('fs');
const path = require('path');
const assert = require('assert');

function assertRemovedRecoveryModules(projectRoot = process.cwd(), expected = []) {
  const fixturePath = path.join(projectRoot, 'tools/fixtures/removed-recovery-files-v421.json');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const removed = new Set(fixture.removed || fixture.removedFiles || fixture.files || []);
  const recoveryDir = path.join(projectRoot, 'public/scripts/rebuild/features/recovery');
  for (const name of expected) {
    assert.ok(removed.has(name), `removed recovery fixture missing ${name}`);
    assert.ok(!fs.existsSync(path.join(recoveryDir, name)), `retired recovery module unexpectedly restored: ${name}`);
  }
  const runtime = fs.readFileSync(path.join(recoveryDir, 'runtime.mjs'), 'utf8');
  const orchestration = fs.readFileSync(path.join(recoveryDir, 'orchestration.mjs'), 'utf8');
  assert.ok(runtime.includes('recovery') || orchestration.includes('recovery'), 'current recovery runtime missing');
  return { removed:expected.length, pass:'v613-removed-recovery-contract-pass' };
}
module.exports = { assertRemovedRecoveryModules };
