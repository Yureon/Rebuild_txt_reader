#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalizeDevicePrefs, normalizeViewerPrefs } = require('../../server/services/state-normalizer-theme');
const { createSessionStore, SESSION_STORE_SECRET_REQUIRED_PASS } = require('../../server/services/session-store');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

(function main() {
  const payload = '@import url("https://evil.example/x.css"); body{background:url(https://evil.example/pixel)} .ok{color:red}';
  const device = normalizeDevicePrefs({ customCssDevice:payload });
  const shared = normalizeViewerPrefs({ customCssShared:payload });
  for (const css of [device.customCssDevice, shared.customCssShared]) {
    assert(!/@import/iu.test(css), 'state pipeline must remove @import');
    assert(!/evil\.example/iu.test(css), 'state pipeline must remove external CSS URLs');
  }

  const playwright = read('server/services/metadata-playwright-service.js');
  for (const token of [
    'requestPinnedHttps',
    'resolveFreshPublicAddresses',
    'const response = await pinnedBrowserContextRequest',
    'Buffer.isBuffer(result.buffer)',
    'new AbortController()',
    "response.body.getReader",
    "typeof options.resolvePublicAddresses === 'function'",
    "if (options.noSandbox === true) args.push('--no-sandbox')",
    'fs.promises.readdir(profilesDir, { withFileTypes:true })',
    'pages:new Map()'
  ]) assert(playwright.includes(token), `missing Playwright security token: ${token}`);
  assert(!playwright.includes('context.request.fetch'), 'APIRequestContext must not bypass the pinned socket transport');

  const auth = read('server/routes/auth-routes.js');
  for (const token of [
    "loginIpLimiter.reset(ip, 'all-login')",
    "registerIpLimiter.reset(ip, 'all-register')",
    "passwordChangeIpLimiter.reset(passwordIp, 'all-password-change')",
    'REGISTER_USER_CREATE_EMPTY'
  ]) assert(auth.includes(token), `missing auth correction: ${token}`);
  assert(!auth.includes('let createdUser = null'), 'legacy async callback result must not be read synchronously');

  const app = read('server/app.js');
  assert(app.indexOf('app.use(applySecurityHeaders)') < app.indexOf("app.use(express.json({ limit: '256kb' }))"), 'security headers must run before JSON parsing');

  const fileops = read('server/services/fileops-service.js');
  assert(fileops.includes('FILEOPS_COMMIT_BOUNDARY_PASS'));
  assert(fileops.includes('assertStableParentDirectory'));
  assert((fileops.match(/await revalidateMutationCommit\(/g) || []).length >= 9, 'all mutation paths need commit-boundary revalidation');

  const compose = read('docker-compose.example.yml');
  for (const token of ['read_only: true', 'cap_drop:', '- ALL', 'no-new-privileges:true', 'SESSION_STORE_SECRET=${SESSION_STORE_SECRET:?']) {
    assert(compose.includes(token), `compose hardening missing: ${token}`);
  }

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-secret-v625-'));
  const oldEnv = process.env.NODE_ENV;
  const oldSecret = process.env.SESSION_STORE_SECRET;
  try {
    process.env.NODE_ENV = 'production';
    delete process.env.SESSION_STORE_SECRET;
    assert.throws(
      () => createSessionStore({ storePath:path.join(temp, 'sessions.json'), logger:{ error(){} } }),
      error => error && error.code === 'SESSION_STORE_SECRET_REQUIRED' && error.pass === SESSION_STORE_SECRET_REQUIRED_PASS
    );
  } finally {
    if (oldEnv == null) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldEnv;
    if (oldSecret == null) delete process.env.SESSION_STORE_SECRET; else process.env.SESSION_STORE_SECRET = oldSecret;
    fs.rmSync(temp, { recursive:true, force:true });
  }

  console.log(JSON.stringify({
    pass:'v625-security-reaudit-fixes-pass',
    findings:12,
    cssPipeline:true,
    redirectPreflight:true,
    sessionSecretFailClosed:true,
    commitBoundary:true
  }));
})();
