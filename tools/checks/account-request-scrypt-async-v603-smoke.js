'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAccountService, verifyPasswordAsync } = require('../../server/services/account-service');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-account-async-'));
  const accountsPath = path.join(dir, 'accounts.json');
  const service = createAccountService({ accountsPath, logger:{ error(){} } });
  service.load();

  const originalScryptSync = crypto.scryptSync;
  crypto.scryptSync = () => { throw new Error('request path used scryptSync'); };
  try {
    const user = await service.createUserAsync({ username:'async-user', password:'correct-password-123', libraryAccess:{ mode:'none', folders:[] } });
    assert.strictEqual(user.username, 'async-user');
    assert.strictEqual(await verifyPasswordAsync('correct-password-123', service.findUserById('async-user').passwordHash), true);

    const changed = await service.changePasswordAsync('async-user', 'correct-password-123', 'different-password-456');
    assert.ok(changed.sessionVersion >= 2);
    assert.strictEqual(await verifyPasswordAsync('different-password-456', service.findUserById('async-user').passwordHash), true);

    const reset = await service.resetPasswordAsync('async-user', 'reset-password-789');
    assert.ok(reset.sessionVersion > changed.sessionVersion);
    assert.strictEqual(await verifyPasswordAsync('reset-password-789', service.findUserById('async-user').passwordHash), true);
  } finally {
    crypto.scryptSync = originalScryptSync;
    fs.rmSync(dir, { recursive:true, force:true });
  }
  console.log(JSON.stringify({ pass:'v603-account-request-scrypt-async-pass' }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
