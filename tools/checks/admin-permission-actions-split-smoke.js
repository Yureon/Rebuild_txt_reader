const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function r(p){ return fs.readFileSync(path.join(root, p), 'utf8'); }
const page = r('public/admin/users.html');
const main = r('public/scripts/admin-users.js');
const permissions = r('public/scripts/admin/permissions.js');
assert.ok(page.includes('/scripts/admin/permissions.js?v=rebuild-v564'), 'permission action module must be loaded');
assert.ok(permissions.includes('v491-admin-folder-mutation-picker-pass'), 'permission marker missing');
for (const token of ['attachPicker', 'syncChecks', 'accessPayload', 'mutationAccessPayload', 'previewUser', 'compareSelectedAccess', 'bindPermissionActions']) assert.ok(permissions.includes(token), token + ' must live in permissions module');
assert.ok(permissions.includes('/library-preview') && permissions.includes('/library-preview/compare'), 'preview/compare API wiring must live in permissions module');
assert.ok(main.includes('AdminPermissions') && main.includes('bindPermissionActions'), 'main must delegate permission wiring');
assert.ok(!main.includes('/library-preview/compare') && !main.includes('function compareSelectedAccess') && !main.includes('function attachPicker'), 'main must not own permission picker/compare logic');
console.log('v417-admin-permission-actions-split-smoke-pass');
