#!/usr/bin/env node
const assert = require('assert');
const path = require('path');
const childProcess = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const authRoutes = require(path.join(ROOT, 'server/routes/auth-routes.js'));

const PASS = 'v347-production-password-policy-smoke-pass';

function withNodeEnv(value, fn) {
  const previous = process.env.NODE_ENV;
  if (value == null) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = value;
  try { return fn(); }
  finally {
    if (previous == null) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
}

function runDefaultImportedPasswordPolicy(env) {
  const result = childProcess.spawnSync(process.execPath, ['-e', "const auth=require('./server/routes/auth-routes.js'); process.stdout.write(String(auth.PRODUCTION_PASSWORD_MIN_LENGTH + ':' + auth.isProductionAdminPasswordAllowed()));"], {
    cwd: ROOT,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'default imported password policy child process failed');
  return String(result.stdout || '').trim();
}

function runProductionPasswordPolicySmoke() {
  assert.strictEqual(authRoutes.PRODUCTION_PASSWORD_MIN_LENGTH, 14, 'default production owner password minimum length must be 14 characters after v531');
  assert.strictEqual(withNodeEnv('production', () => authRoutes.isProductionAdminPasswordAllowed('1234567890123')), false, 'production must reject LOGINPW shorter than configured minimum');
  assert.strictEqual(withNodeEnv('production', () => authRoutes.isProductionAdminPasswordAllowed('12345678901234')), true, 'production must accept LOGINPW with configured minimum length');
  assert.strictEqual(withNodeEnv('development', () => authRoutes.isProductionAdminPasswordAllowed('short')), true, 'development/test/local smoke must remain compatible with short passwords');
  assert.ok(String(authRoutes.PRODUCTION_PASSWORD_POLICY_PASS || '').includes('v347-production-password-policy-pass'), 'production password guard marker must be exported');
  assert.ok(String(authRoutes.OWNER_PASSWORD_MIN_LENGTH_ENV_PASS || '').includes('v531-owner-password-min-length-env-pass'), 'owner password env marker must be exported');
  assert.strictEqual(runDefaultImportedPasswordPolicy({ NODE_ENV: 'production', LOGINPW: '1234567890123' }), '14:false', 'default imported production LOGINPW shorter than 14 must be rejected');
  assert.strictEqual(runDefaultImportedPasswordPolicy({ NODE_ENV: 'production', LOGINPW: '12345678901234' }), '14:true', 'default imported production LOGINPW with at least 14 characters must be accepted');
  assert.strictEqual(runDefaultImportedPasswordPolicy({ NODE_ENV: 'production', OWNER_PASSWORD_MIN_LENGTH: '10', LOGINPW: '123456789' }), '10:false', 'env minimum 10 must still reject 9 characters');
  assert.strictEqual(runDefaultImportedPasswordPolicy({ NODE_ENV: 'production', OWNER_PASSWORD_MIN_LENGTH: '10', LOGINPW: '1234567890' }), '10:true', 'env minimum 10 must accept 10 characters');
  return { pass: PASS };
}

if (require.main === module) console.log(JSON.stringify(runProductionPasswordPolicySmoke()));

module.exports = { PASS, runProductionPasswordPolicySmoke };
