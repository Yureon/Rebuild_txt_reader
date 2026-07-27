const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const ops = r('public/scripts/admin/ops.js');
const css = r('public/styles/admin-users.css');
const page = r('public/admin/users.html');
assert.ok(ops.includes('v417-admin-ops-card-details-pass'), 'ops card marker missing');
assert.ok(ops.includes('diagnostics-detail') && ops.includes('renderDetailBlock'), 'diagnostics details renderer missing');
assert.ok(css.includes('diagnostics-detail') && css.includes('ops-mini-card small'), 'ops card/detail CSS missing');
assert.ok(page.includes('data-admin-ops-card-pass="v417-admin-ops-card-details-pass"'), 'ops card marker not exposed in owner page');
console.log('v417-admin-ops-card-details-smoke-pass');
