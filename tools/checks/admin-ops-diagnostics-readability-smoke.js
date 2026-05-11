const assert = require('assert');
const fs = require('fs');
const css = fs.readFileSync('public/styles/admin-users.css','utf8');
const ops = fs.readFileSync('public/scripts/admin/ops.js','utf8');
const html = fs.readFileSync('public/admin/users.html','utf8');
const PASS = 'v530-owner-diagnostics-readability-css-pass';
[
  'diagnostics-output>.diagnostics-cf-tunnel-exposure{grid-column:1/-1}',
  'repeat(auto-fit,minmax(min(100%,420px),1fr))',
  'repeat(auto-fit,minmax(min(100%,190px),1fr))',
  '.diagnostics-finding .diagnostics-table-wrap{max-height:none',
  '.diagnostics-cf-tunnel-exposure table,.diagnostics-checklist table{min-width:760px}',
  'word-break:keep-all'
].forEach(token => assert.ok(css.includes(token), `missing diagnostics readability CSS token: ${token}`));
assert.ok(css.includes(PASS), 'missing v530 readability marker');
assert.ok(ops.includes('renderTunnelExposureDiagnostics'), 'owner ops must keep tunnel exposure diagnostics renderer');
assert.ok(html.includes('/styles/admin-users.css?v=rebuild-v564'), 'admin stylesheet cachebuster must be rebuild-v564');
console.log('v530-owner-diagnostics-readability-smoke-pass');
