#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildContentSecurityPolicy } = require('../../server/middleware/security');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
for (const rel of ['public/index.html', 'public/login.html', 'public/admin/users.html', 'public/fragments/app-shell.html']) {
  const html = read(rel);
  assert.strictEqual((html.match(/<style\b/gi) || []).length, 0, `${rel} must not contain inline style tags`);
  assert.ok(!/\sstyle\s*=/.test(html), `${rel} must not contain style attributes`);
}
for (const rel of ['public/styles/entry-router.css', 'public/styles/login.css', 'public/styles/admin-users.css']) {
  assert.ok(fs.existsSync(path.join(root, rel)), `${rel} must exist`);
  assert.ok(fs.existsSync(path.join(root, rel + '.br')), `${rel}.br must exist`);
  assert.ok(fs.existsSync(path.join(root, rel + '.gz')), `${rel}.gz must exist`);
}
const csp = buildContentSecurityPolicy();
assert.ok(!/style-src[^;]*'unsafe-inline'/.test(csp), 'style-src must not allow unsafe-inline');
assert.ok(csp.includes("style-src-attr 'none'"), 'style-src-attr must be none');
const adminScript = read('public/scripts/admin-users.js');
assert.ok(!/style=/.test(adminScript), 'admin-users dynamic markup must not inject style attributes');
console.log(JSON.stringify({ pass: 'v408-csp-inline-style-smoke-pass' }));
