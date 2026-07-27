const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const ops = r('public/scripts/admin/ops.js');
const css = r('public/styles/admin-users.css');
const page = r('public/admin/users.html');
assert.ok(ops.includes('v416-admin-ops-detail-table-pass'), 'detail table marker missing');
assert.ok(ops.includes('renderSummaryTable') && ops.includes('renderChecklistTable') && ops.includes('renderFindingTable'), 'diagnostics table renderers missing');
assert.ok(ops.includes('diagnostics-summary-table') && ops.includes('diagnostics-table-wrap'), 'diagnostics table DOM classes missing');
assert.ok(ops.includes('renderDetailBlock') && ops.includes('진단 원본 JSON'), 'raw JSON details must remain');
assert.ok(css.includes('diagnostics-table-wrap') && css.includes('diagnostics-summary-table'), 'diagnostics table CSS missing');
assert.ok(page.includes('data-admin-ops-detail-table-pass="v416-admin-ops-detail-table-pass"'), 'detail table marker not exposed in owner page');
console.log('v416-admin-ops-detail-table-smoke-pass');
