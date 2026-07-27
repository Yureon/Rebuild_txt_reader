#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { isPublicAuthPath, createAuthGate } = require('../../server/middleware/auth');

const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root, 'public/login.html'), 'utf8');
const refs = Array.from(html.matchAll(/\b(?:src|href)=["'](\/[^"'#?]+)(?:\?[^"']*)?["']/g), match => match[1]);
const preAuthRootRoutes = new Set(['/service-worker-register.js']);
const protectedRefs = refs.filter(ref => !isPublicAuthPath(ref) && !preAuthRootRoutes.has(ref));
assert.deepEqual(protectedRefs, [], `login page has auth-protected local assets: ${protectedRefs.join(', ')}`);

for (const ref of refs) {
  if (preAuthRootRoutes.has(ref)) continue;
  const local = path.join(root, 'public', ref.replace(/^\//, ''));
  assert(fs.existsSync(local), `login page local asset is missing: ${ref}`);
}

const nextCalls = [];
const gate = createAuthGate({
  sessionStore:{ validateSession(){ return false; }, getSession(){ return null; }, deleteSession(){} }
});
for (const reqPath of ['/scripts/scroll-to-top.js','/styles/scroll-to-top.css']) {
  const req = { path:reqPath, headers:{}, get(){ return ''; } };
  const res = { status(){ throw new Error('public asset must not be rejected'); }, redirect(){ throw new Error('public asset must not redirect'); } };
  gate(req, res, () => nextCalls.push(reqPath));
}
assert.deepEqual(nextCalls, ['/scripts/scroll-to-top.js','/styles/scroll-to-top.css']);
console.log(JSON.stringify({ pass:'v639-login-public-assets-pass', refs:refs.length, publicScrollAssets:nextCalls.length }));
