#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const html = read('public/admin/users.html');
const css = read('public/styles/admin-users.css');
const script = read('public/scripts/admin/metadata.mjs');

const bodyStart = html.indexOf('data-owner-metadata-login-body');
const footerStart = html.indexOf('data-owner-metadata-login-footer');
const finishStart = html.indexOf('data-owner-metadata-control="finish"');
assert(bodyStart >= 0, 'scrollable login body wrapper missing');
assert(footerStart > bodyStart, 'fixed login footer must follow the scrollable body');
assert(finishStart > footerStart, 'finish action must live in the fixed footer');
assert(html.slice(bodyStart, footerStart).includes('owner-metadata-login-help'), 'login controls/help must remain in scrollable body');
assert(!html.slice(bodyStart, footerStart).includes('data-owner-metadata-control="finish"'), 'finish action must not be inside scrollable body');

for (const token of [
  'rebuild-v644: owner metadata provider settings and Playwright login relay',
  'grid-template-rows:auto minmax(0,1fr) auto',
  '.owner-metadata-login-body{display:grid',
  'min-height:0;overflow-x:hidden;overflow-y:auto',
  '.owner-metadata-login-footer{position:relative;z-index:2',
  'height:100dvh;max-height:100dvh',
  'env(safe-area-inset-bottom)',
  '@media(max-height:620px) and (max-width:900px)',
  'grid-template-columns:minmax(92px,.72fr) minmax(0,1.55fr)'
]) assert(css.includes(token), `mobile login modal layout contract missing: ${token}`);

assert(!css.includes('grid-template-rows:auto auto minmax(180px,1fr) auto auto auto auto'), 'old clipped mobile grid remains');
assert(script.includes("body:document.querySelector('[data-owner-metadata-login-body]')"), 'login body lookup missing');
assert(script.includes('if (elements.body) elements.body.scrollTop = 0;'), 'login body must reset to top on open');
assert(html.includes('로그인 완료 및 프로필 저장'), 'finish button label missing');

console.log(JSON.stringify({
  pass:'v587-owner-metadata-login-modal-smoke-pass',
  layout:['scrollable-body','fixed-footer','safe-area','short-viewport']
}));
