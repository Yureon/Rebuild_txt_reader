#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('public/login.html');
const css=read('public/styles/login.css');
assert(html.includes('data-login-palette="owner-console"'),'login owner palette marker missing');
assert(!html.includes('/scripts/theme-boot.js'),'login must not inherit the previous authenticated user theme');
assert(html.includes('<meta name="theme-color" content="#0d0d0d">'),'login theme-color mismatch');
for(const token of ['--bg:#0d0d0d','--surface:#171717','--border:#2d2d2d','--text:#ece7df','--accent:#4ade80']){
  assert(css.includes(token),`owner palette token missing: ${token}`);
}
assert(css.includes('linear-gradient(135deg,var(--accent2),var(--accent))'),'owner-style primary action missing');
assert(css.includes('input:-webkit-autofill'),'login autofill theme guard missing');
console.log(JSON.stringify({pass:'v680-login-owner-palette-pass'}));
