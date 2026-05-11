const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.join(__dirname,'../..');
function r(p){return fs.readFileSync(path.join(root,p),'utf8')}
const page=r('public/admin/users.html');
const files=['core','sections','ops','users','state','audit','signup','actions','audit-actions','signup-actions','state-actions','permissions'];
for (const rel of files.map(f => '/scripts/admin/'+f+'.js?v=rebuild-v564').concat(['/scripts/admin-users.js?v=rebuild-v564'])) assert.ok(page.includes(rel), rel+' missing');
const markers={users:'v502-admin-users-horizontal-row-list-pass',actions:'v491-admin-user-actions-folder-mutation-picker-pass',signup:'v491-admin-signup-folder-mutation-picker-pass','signup-actions':'v491-admin-signup-actions-folder-mutation-picker-pass',permissions:'v491-admin-folder-mutation-picker-pass','audit-actions':'v416-admin','state-actions':'v417-admin'};
for(const f of files) assert.ok(r('public/scripts/admin/'+f+'.js').includes(markers[f]||'v417-admin'), f+' split marker missing');
const main=r('public/scripts/admin-users.js');
for (const token of ['AdminUsersList','AdminUserActions','AdminAuditActions','AdminSignupActions','AdminStateActions','AdminPermissions']) assert.ok(main.includes(token), 'main must delegate to '+token);
console.log('v417-admin-js-deeper-split-smoke-pass');
