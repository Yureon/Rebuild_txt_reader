const fs=require('fs'),path=require('path'),assert=require('assert');
function r(x){return fs.readFileSync(path.join(__dirname,'../..',x),'utf8')}
function runAdminUserStateManagementSmoke(){
  const route=r('server/routes/admin-users-routes.js'),service=r('server/services/user-state-service.js'),app=r('server/app.js'),page=r('public/admin/users.html')+'\n'+r('public/scripts/admin-users.js')+'\n'+r('public/scripts/admin/state-actions.js'),doc=r('docs/multi-user-access-control.md');
  assert.ok(route.includes('/admin/users/:userId/state/export'), 'export endpoint missing');
  assert.ok(route.includes('/admin/users/:userId/state/reset'), 'reset endpoint missing');
  assert.ok(route.includes("confirmText !== 'RESET'"), 'reset confirm guard missing');
  assert.ok(route.includes('ownerOnly, requireSameOrigin, requireCsrf'), 'reset must require owner+origin+csrf');
  assert.ok(service.includes('exportStateForUserId') && service.includes('resetStateForUserId'), 'manager functions missing');
  assert.ok(service.includes('v392-txt-reader-multi-user-state-admin-management-pass'), 'service marker missing');
  assert.ok(app.includes('userStateServiceManager'), 'app must wire user state manager to admin router');
  assert.ok(page.includes('export-user-state-btn') && page.includes('reset-user-state-btn'), 'admin UI buttons missing');
  assert.ok(page.includes('downloadUserState') && page.includes('resetUserState'), 'admin UI handlers missing');
  assert.ok(doc.includes('v392-admin-user-state-management-smoke-pass'), 'doc marker missing');
  return {pass:'v392-admin-user-state-management-smoke-pass'};
}
if(require.main===module)console.log(JSON.stringify(runAdminUserStateManagementSmoke()));
module.exports={runAdminUserStateManagementSmoke};
