#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const css = fs.readFileSync(path.join(root, 'public/styles/deferred-ui.css'), 'utf8');
for (const token of [
  'rebuild-v644: mobile settings modal reset',
  'top:0 !important;left:0 !important;right:0 !important;bottom:0 !important',
  'transform:none !important;border:0 !important;border-radius:0 !important',
  'grid-template-columns:repeat(2,minmax(0,1fr)) !important',
  'min-height:44px',
  'padding:12px 12px calc(22px + env(safe-area-inset-bottom))',
  '.settings-panel .settings-bottom-actions{grid-template-columns:1fr'
]) assert(css.includes(token), `mobile settings guard missing: ${token}`);
console.log(JSON.stringify({ pass:'v585-mobile-settings-layout-smoke-pass' }));
