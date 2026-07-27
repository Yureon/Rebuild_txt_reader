#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteJsonSync } = require('../../server/repositories/json-file-store');
const { createAccountService } = require('../../server/services/account-service');
const { createSignupCodeService } = require('../../server/services/signup-code-service');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-account-rollback-'));
try {
  let accountFailure = false;
  const accountsPath = path.join(root, 'accounts.json');
  const accounts = createAccountService({
    accountsPath,
    logger:{ error() {} },
    writeJsonSync(filePath, value) {
      if (accountFailure) throw new Error('simulated account persistence failure');
      atomicWriteJsonSync(filePath, value);
    }
  });
  accounts.load();
  accountFailure = true;
  let createError = null;
  const failedCreate = accounts.createUser({ username:'rollback-user', password:'temporary-password-123' }, error => { createError = error; });
  assert.strictEqual(failedCreate, null);
  assert(createError);
  assert.strictEqual(accounts.listUsers().length, 0, 'failed account create must roll memory back');

  accountFailure = false;
  const created = accounts.createUser({ username:'stable-user', password:'temporary-password-123' });
  assert(created);
  const beforeEnabled = accounts.findUserById('stable-user').enabled;
  accountFailure = true;
  let updateError = null;
  const failedUpdate = accounts.updateUser('stable-user', { enabled:false }, error => { updateError = error; });
  assert.strictEqual(failedUpdate, null);
  assert(updateError);
  assert.strictEqual(accounts.findUserById('stable-user').enabled, beforeEnabled, 'failed account update must roll memory back');

  let signupFailure = false;
  const signupCodesPath = path.join(root, 'signup-codes.json');
  const signup = createSignupCodeService({
    signupCodesPath,
    logger:{ error() {} },
    writeJsonSync(filePath, value) {
      if (signupFailure) throw new Error('simulated signup persistence failure');
      atomicWriteJsonSync(filePath, value);
    }
  });
  signup.load();
  signupFailure = true;
  let signupCreateError = null;
  const failedCode = signup.createCode({ signupCode:'ABCD-EFGH-JKLM-NPQR' }, error => { signupCreateError = error; });
  assert.strictEqual(failedCode, null);
  assert(signupCreateError);
  assert.strictEqual(signup.listCodes().length, 0, 'failed signup-code create must roll memory back');

  signupFailure = false;
  const code = signup.createCode({ signupCode:'WXYZ-2345-6789-BCDF', label:'stable' });
  assert(code && code.code);
  const codeId = code.code.id;
  signupFailure = true;
  let signupUpdateError = null;
  const failedCodeUpdate = signup.updateCode(codeId, { label:'should-not-stick' }, error => { signupUpdateError = error; });
  assert.strictEqual(failedCodeUpdate, null);
  assert(signupUpdateError);
  assert.strictEqual(signup.listCodes()[0].label, 'stable', 'failed signup-code update must roll memory back');

  console.log(JSON.stringify({ pass:'v603-account-signup-persistence-rollback-smoke-pass' }));
} finally {
  fs.rmSync(root, { recursive:true, force:true });
}
