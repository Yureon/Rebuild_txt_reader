#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runSignupCodeAtomicSmoke() {
  const auth = read('server/routes/auth-routes.js');
  const serviceSource = read('server/services/signup-code-service.js');
  assert.ok(auth.includes('createRegisterLimitKey'), 'register limiter must use composite key');
  assert.ok(auth.includes('consumeCodeForRegistration'), 'register route must use atomic consume path');
  assert.ok(!auth.includes('previewSignupCode(signupCode);\n      let created'), 'register route must not use preview-create-markUsed split flow');
  assert.ok(serviceSource.includes('restoreRecordUsage'), 'signup code consume rollback helper missing');
  assert.ok(serviceSource.includes('Persist the reservation before account creation'), 'signup code reservation comment missing');

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-signup-atomic-'));
  try {
    const { createSignupCodeService } = require(path.join(root, 'server/services/signup-code-service'));
    const svc = createSignupCodeService({ signupCodesPath: path.join(tmp, 'signup-codes.json'), logger: { error() {} } });
    svc.load();
    let createErr = null;
    let createOut = null;
    svc.createCode({ signupCode: 'ABCD-EFGH-IJKL-MNPQ', maxUses: 1, libraryAccess: { mode: 'all', folders: [] } }, (err, out) => { createErr = err; createOut = out; });
    assert.ifError(createErr);
    assert.ok(createOut.signupCode, 'raw code should be returned once');

    let rollbackErr = null;
    const rollback = svc.consumeCodeForRegistration(createOut.signupCode, () => {
      const err = new Error('simulated account create failure');
      err.statusCode = 409;
      err.code = 'USER_EXISTS';
      throw err;
    }, (err) => { rollbackErr = err; });
    assert.strictEqual(rollback, null, 'failed account create should not return consume result');
    assert.ok(rollbackErr && rollbackErr.code === 'USER_EXISTS', 'rollback failure should expose account error');
    let afterRollback = svc.previewSignupCode(createOut.signupCode);
    assert.strictEqual(afterRollback.usedCount, 0, 'failed account create must rollback usedCount');
    assert.strictEqual(afterRollback.remainingUses, 1, 'failed account create must preserve remaining use');

    let consumedErr = null;
    const consumed = svc.consumeCodeForRegistration(createOut.signupCode, (code) => ({ id: 'reader-a', username: 'reader-a', libraryAccess: code.libraryAccess }), (err) => { consumedErr = err; });
    assert.ifError(consumedErr);
    assert.ok(consumed && consumed.user && consumed.user.id === 'reader-a', 'successful consume should return user');
    assert.strictEqual(consumed.code.usedCount, 1, 'successful consume should increment used count');
    assert.throws(() => svc.previewSignupCode(createOut.signupCode), /가입코드가 유효하지 않습니다/, 'one-time code must be exhausted after consume');
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  return { pass: 'v404-signup-code-atomic-smoke-pass' };
}

if (require.main === module) console.log(JSON.stringify(runSignupCodeAtomicSmoke()));
module.exports = { runSignupCodeAtomicSmoke };
