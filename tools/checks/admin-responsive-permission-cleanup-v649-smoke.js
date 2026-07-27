#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const html = fs.readFileSync(path.join(root,'public/admin/users.html'),'utf8');
const css = ['public/styles/admin-users.css','public/styles/admin-users-v643.css','public/styles/admin-users-v649.css'].map((file)=>fs.readFileSync(path.join(root,file),'utf8')).join('\n');
const permissions = fs.readFileSync(path.join(root,'public/scripts/admin/permissions.js'),'utf8');
const cleanup = fs.readFileSync(path.join(root,'public/scripts/admin/library-cleanup.js'),'utf8');

assert(html.includes('data-admin-cleanup-responsive-pass="v649-admin-cleanup-responsive-pass"'));
assert.equal((html.match(/data-cleanup-filter-state=/g) || []).length, 4);
assert(permissions.includes("data-folder-permission-row=\"true\""));
assert(permissions.includes("b.checked?'선택':'미선택'"));
assert(cleanup.includes('syncFilterStates'));
assert(cleanup.includes('data-cleanup-candidate-state'));
assert(cleanup.includes("'격리 대상' : '검토 전용'"));
for (const width of ['1180px','900px','620px','360px']) assert(css.includes(width), `missing responsive breakpoint ${width}`);
assert(css.includes('[data-folder-permission-row="true"]>span'));
assert(css.includes('grid-column:auto!important'));
assert(css.includes('.library-cleanup-candidate-head code'));
assert(css.includes('overflow-wrap:anywhere!important'));
assert(css.includes('.library-cleanup-filter-state[data-active="true"]'));
assert(css.includes('.library-cleanup-candidate-actions'));

console.log(JSON.stringify({ pass:'v649-admin-responsive-permission-cleanup-smoke-pass', breakpoints:[360,620,900,1180], filterStates:4 }));
