const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const page = r('public/admin/users.html');
const ops = r('public/scripts/admin/ops.js');
assert.ok(page.includes('admin-diagnostics-problem-only'), 'warn/error filter checkbox missing');
assert.ok(page.includes('v417-admin-diagnostics-filter-pass'), 'diagnostics filter marker missing in page');
assert.ok(ops.includes('v417-admin-diagnostics-filter-pass'), 'diagnostics filter marker missing in ops');
assert.ok(ops.includes('problemOnlyEnabled') && ops.includes('maybeFilter') && ops.includes('isProblem'), 'diagnostics filter helpers missing');
assert.ok(ops.includes('skipHistory:true') && ops.includes('options.skipHistory'), 'filter rerender must skip diagnostics history writes');
assert.ok(ops.includes('bindDiagnosticsFilter'), 'diagnostics filter binding missing');
console.log('v417-admin-diagnostics-filter-smoke-pass');
