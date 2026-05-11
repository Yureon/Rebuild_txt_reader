#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildContentSecurityPolicy } = require('../../server/middleware/security');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
function inlineScriptCount(html){
  const matches = html.match(/<script\b(?![^>]*\bsrc=)[^>]*>/gi) || [];
  return matches.length;
}
for (const rel of ['public/index.html', 'public/login.html', 'public/admin/users.html']) {
  const html = read(rel);
  assert.strictEqual(inlineScriptCount(html), 0, `${rel} must not contain inline script tags`);
  assert.ok(!/\son[a-z]+\s*=/.test(html), `${rel} must not contain inline event handler attributes`);
}
assert.ok(read('public/index.html').includes('/scripts/entry-router.js?v=rebuild-v564'), 'index external router script is required');
assert.ok(read('public/login.html').includes('/scripts/login.js?v=rebuild-v564'), 'login external script is required');
assert.ok(read('public/admin/users.html').includes('/scripts/admin-users.js?v=rebuild-v564'), 'admin external script is required');
assert.ok(read('public/index.html').includes('/styles/entry-router.css?v=rebuild-v564'), 'index external css is required');
assert.ok(read('public/login.html').includes('/styles/login.css?v=rebuild-v564'), 'login external css is required');
assert.ok(read('public/admin/users.html').includes('/styles/admin-users.css?v=rebuild-v564'), 'admin external css is required');
for (const rel of ['public/scripts/entry-router.js', 'public/scripts/login.js', 'public/scripts/admin-users.js']) {
  assert.ok(fs.existsSync(path.join(root, rel)), `${rel} must exist`);
}
const csp = buildContentSecurityPolicy();
assert.ok(csp.includes("script-src 'self'"), 'script-src must allow self');
assert.ok(csp.includes("script-src-elem 'self'"), 'script-src-elem must allow self');
assert.ok(csp.includes("worker-src 'self'"), 'worker-src must default to self');
assert.ok(csp.includes("connect-src 'self'"), 'connect-src must default to self');
assert.ok(!csp.includes('cloudflareinsights.com') && !csp.includes('static.cloudflareinsights.com'), 'Cloudflare insights must be opt-in');
assert.ok(!/worker-src[^;]*blob:/.test(csp), 'blob workers must be opt-in');
const optInCsp = buildContentSecurityPolicy({ allowCloudflareInsights:true, allowBlobWorker:true });
assert.ok(optInCsp.includes("script-src 'self' https://static.cloudflareinsights.com"), 'Cloudflare opt-in script-src missing');
assert.ok(optInCsp.includes('https://cloudflareinsights.com'), 'Cloudflare opt-in connect-src missing');
assert.ok(/worker-src[^;]*blob:/.test(optInCsp), 'blob worker opt-in missing');
assert.ok(!/script-src[^;]*'unsafe-inline'/.test(csp), 'script-src must not allow unsafe-inline');
assert.ok(!/script-src-elem[^;]*'unsafe-inline'/.test(csp), 'script-src-elem must not allow unsafe-inline');
console.log(JSON.stringify({ pass: 'v408-csp-inline-script-smoke-pass' }));
