#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const page = read('public/admin/users.html');
const css = read('public/styles/admin-users.css');
const script = read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/sections.js');
assert.ok(page.includes('OWNER CONSOLE · v417 skeleton UI'), 'v411 owner console badge missing');
for (const tab of ['users','signup','audit','ops']) {
  assert.ok(page.includes(`data-admin-tab="${tab}"`), `admin tab ${tab} missing`);
  assert.ok(page.includes(`data-admin-section="${tab}"`), `admin section ${tab} missing`);
}
assert.ok(css.includes('.admin-section[hidden]') && css.includes('.admin-nav'), 'sectioned admin css missing');
assert.ok(script.includes('showAdminSection') && script.includes('bindAdminSections'), 'section switching script missing');
assert.ok(!/\sstyle\s*=/.test(page), 'admin page should not contain style attributes');
assert.ok(!/style=/.test(script), 'admin script should not inject style attributes');
console.log(JSON.stringify({ pass: 'v411-admin-sectioned-ui-smoke-pass' }));
