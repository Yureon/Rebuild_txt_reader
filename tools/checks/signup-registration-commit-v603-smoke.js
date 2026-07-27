'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteJsonSync } = require('../../server/repositories/json-file-store');
const { createSignupCodeService } = require('../../server/services/signup-code-service');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-register-commit-'));
  const signupCodesPath = path.join(dir, 'signup-codes.json');
  let writes = 0;
  let failFinalUsageWrite = false;
  const service = createSignupCodeService({
    signupCodesPath,
    logger:{ error(){} },
    writeJsonSync(filePath, value) {
      writes += 1;
      if (failFinalUsageWrite && writes === 3) throw Object.assign(new Error('simulated final usage metadata failure'), { code:'EIO' });
      atomicWriteJsonSync(filePath, value);
    }
  });
  service.load();
  const createdCode = service.createCode({ signupCode:'COMMIT-TEST-CODE', maxUses:1, expiresAt:new Date(Date.now() + 86400000).toISOString() });
  assert.ok(createdCode && createdCode.signupCode);
  failFinalUsageWrite = true;
  const result = await service.consumeCodeForRegistrationAsync(createdCode.signupCode, async () => ({ id:'registered-user', username:'registered-user' }));
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.usageMetadataPersisted, false);
  assert.strictEqual(result.user.username, 'registered-user');
  assert.strictEqual(service.listCodes()[0].usedCount, 1);

  const rejected = await Promise.allSettled([
    service.consumeCodeForRegistrationAsync(createdCode.signupCode, async () => ({ id:'unexpected-1', username:'unexpected-1' })),
    service.consumeCodeForRegistrationAsync(createdCode.signupCode, async () => ({ id:'unexpected-2', username:'unexpected-2' }))
  ]);
  assert.strictEqual(rejected.filter(item => item.status === 'fulfilled').length, 0);
  assert.strictEqual(rejected.filter(item => item.status === 'rejected').length, 2);

  fs.rmSync(dir, { recursive:true, force:true });
  console.log(JSON.stringify({ pass:'v603-signup-registration-commit-pass', writes }));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
