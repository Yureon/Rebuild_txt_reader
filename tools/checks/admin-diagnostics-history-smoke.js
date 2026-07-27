const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../..');
const ops=fs.readFileSync(path.join(root,'public/scripts/admin/ops.js'),'utf8');
const page=fs.readFileSync(path.join(root,'public/admin/users.html'),'utf8');
assert.ok(ops.includes('v417-admin-diagnostics-history-pass')&&ops.includes('localStorage')&&ops.includes('renderHistory'),'diagnostics history runtime missing');
assert.ok(page.includes('admin-diagnostics-history'),'diagnostics history panel missing');
console.log('v417-admin-diagnostics-history-smoke-pass');
