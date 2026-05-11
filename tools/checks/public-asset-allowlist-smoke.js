#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const { isPublicAuthPath } = require('../../server/middleware/auth');

const allowed = [
  '/api/login',
  '/login.html',
  '/scripts/login.js',
  '/styles/login.css',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/icon/apple-icon-180x180.png',
  '/icon/favicon-16x16.png',
  '/icon/favicon-32x32.png',
  '/icon/favicon.ico',
  '/icon/icon-192.png',
  '/icon/icon-512.png',
  '/icon/maskable-192.png',
  '/icon/maskable-512.png'
];
for (const path of allowed) {
  assert.strictEqual(isPublicAuthPath(path), true, `${path} must be public before login`);
}

const blocked = [
  '/icon/unlisted.png',
  '/random.png',
  '/random.ico',
  '/styles/app.css',
  '/styles/admin-users.css',
  '/styles/entry-router.css',
  '/scripts/rebuild/site.mjs',
  '/scripts/admin-users.js',
  '/scripts/entry-router.js',
  '/fragments/app-shell.html',
  '/site.html',
  '/mobile.html'
];
for (const path of blocked) {
  assert.strictEqual(isPublicAuthPath(path), false, `${path} must not be public before login`);
}

const source = fs.readFileSync('server/middleware/auth.js', 'utf8');
assert.ok(!source.includes("endsWith('.png')"), 'broad png allowlist must not remain');
assert.ok(!source.includes("endsWith('.ico')"), 'broad ico allowlist must not remain');
assert.ok(!source.includes("startsWith('/icon-')"), 'legacy icon-prefix allowlist must not remain');
assert.ok(!source.includes("startsWith('/maskable-')"), 'legacy maskable-prefix allowlist must not remain');

const loginHtml = fs.readFileSync('public/login.html', 'utf8');
assert.ok(loginHtml.includes('rel="manifest" href="/manifest.json?v=rebuild-v564"'), 'login page must advertise manifest before login');
assert.ok(loginHtml.includes('rel="apple-touch-icon" sizes="180x180" href="/icon/apple-icon-180x180.png"'), 'login page must advertise apple touch icon before login');
assert.ok(loginHtml.includes('rel="icon" type="image/png" sizes="32x32" href="/icon/favicon-32x32.png"'), 'login page must advertise 32px favicon before login');
assert.ok(loginHtml.includes('rel="icon" type="image/png" sizes="16x16" href="/icon/favicon-16x16.png"'), 'login page must advertise 16px favicon before login');

console.log(JSON.stringify({ pass: 'v524-public-asset-allowlist-smoke-pass', publicIconAliasPass: 'v524-public-icon-alias-before-auth-pass' }));
