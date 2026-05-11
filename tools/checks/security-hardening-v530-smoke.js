#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
assert.ok(fs.existsSync(path.join(root, 'package-lock.json')), 'package-lock.json must be included after v530');
const compose = read('docker-compose.yml');
const tunnelCompose = read('docker-compose.cloudflare-tunnel.example.yml');
for (const source of [compose, tunnelCompose]) {
  assert.ok(source.includes('build: .'), 'compose must use Dockerfile build path');
  assert.ok(!source.includes('npm install'), 'compose must not run npm install at container start');
  assert.ok(source.includes('read_only: true'), 'compose hardening read_only missing');
  assert.ok(source.includes('cap_drop:'), 'compose cap_drop missing');
  assert.ok(source.includes('no-new-privileges:true'), 'compose no-new-privileges missing');
}
const sessionStore = read('server/services/session-store.js');
assert.ok(sessionStore.includes('v530-session-store-hmac-token-pass'), 'session HMAC marker missing');
assert.ok(sessionStore.includes('tokenStorage: \'hmac\''), 'session store must persist hmac marker');
assert.ok(sessionStore.includes('validateCsrfToken'), 'CSRF validation should use hashed storage');
const middleware = read('server/middleware/auth.js');
assert.ok(middleware.includes('validateCsrfToken(sessionToken, sent)'), 'middleware must validate CSRF via session store');
const login = read('public/scripts/login.js');
assert.ok(!login.includes("localStorage.setItem('csrf_token'"), 'login page must not store csrf_token in localStorage');
const limiter = read('server/services/rate-limit.js');
assert.ok(limiter.includes('normalizeLoginName'), 'login limiter identity normalizer missing');
assert.ok(limiter.includes("normalizeLoginName(identity)"), 'login limiter must key by identity');
const authRoutes = read('server/routes/auth-routes.js');
assert.ok(authRoutes.includes('loginLimiter.check(ip, id)'), 'login route must rate limit by ip+id');
const content = read('server/services/content-service.js');
assert.ok(content.includes('v530-max-text-file-bytes-pass'), 'max text file marker missing');
assert.ok(content.includes('assertTextFileSizeAllowed'), 'content service must check text file size before read');
const env = read('.env.example');
assert.ok(env.includes('SESSION_STORE_SECRET'), '.env.example session secret missing');
assert.ok(env.includes('MAX_TEXT_FILE_BYTES'), '.env.example max text file size missing');
console.log(JSON.stringify({ pass: 'v530-security-hardening-smoke-pass' }));
