#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const pages = ['public/admin/users.html','public/index.html','public/library.html','public/login.html','public/metadata.html','public/mobile.html','public/site.html'];
for (const rel of pages) {
  const html = read(rel);
  const styleAt = html.indexOf('data-update-banner-critical="v651"');
  const fullStyleAt = html.indexOf('data-update-banner-full="v651"');
  const swAt = html.indexOf('service-worker-register.js');
  assert(styleAt >= 0, `${rel}: critical update stylesheet missing`);
  assert(swAt >= 0, `${rel}: service worker registration missing`);
  assert(fullStyleAt >= 0, `${rel}: full update stylesheet missing`);
  assert(styleAt < swAt, `${rel}: critical update stylesheet preload must start before service-worker registration`);
  assert(fullStyleAt > swAt, `${rel}: applied update stylesheet must not delay the stale-worker coordinator`);
  const preloadTag = html.slice(html.lastIndexOf('<link', styleAt), html.indexOf('>', styleAt) + 1);
  assert(preloadTag.includes('rel="preload"') && preloadTag.includes('as="style"'), `${rel}: critical marker must be a CSP-safe stylesheet preload`);
}
const css = read('public/styles/update-banner.css');
for (const token of [
  '.txt-reader-update-banner{',
  'box-sizing:border-box',
  'html[data-service-worker-ui="silent"] .txt-reader-update-banner',
  '@media(max-width:640px)',
  'env(safe-area-inset-bottom)'
]) assert(css.includes(token), `critical update CSS missing ${token}`);
const auth = read('server/middleware/auth.js');
assert(auth.includes("'/styles/update-banner.css'"), 'critical update stylesheet must be public before login');
const sw = read('public/sw.js');
assert(sw.includes('`/styles/update-banner.css?v=${BUILD}`'), 'critical update stylesheet must be precached');
for (const rel of ['public/index.html','public/library.html','public/metadata.html','public/mobile.html','public/site.html']) {
  const html = read(rel);
  assert(html.indexOf('service-worker-register.js') < html.indexOf('/scripts/theme-boot.js'), `${rel}: stale-worker coordinator must precede theme boot`);
  assert(html.indexOf('/scripts/theme-boot.js') < html.indexOf('data-update-banner-full="v651"'), `${rel}: theme boot must precede linked stylesheets`);
}
const login = read('public/login.html');
assert(login.includes('data-update-ui="silent"'), 'login page update UI must stay silent');
assert(!login.includes('/scripts/theme-boot.js'), 'login must not inherit a previous authenticated user theme');
assert(login.includes('data-login-palette="owner-console"'), 'login owner palette marker missing');
console.log(JSON.stringify({ pass:'v651-update-banner-critical-smoke-pass', pages:pages.length, publicBeforeLogin:true }));
