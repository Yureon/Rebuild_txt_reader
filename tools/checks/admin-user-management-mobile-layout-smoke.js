const fs = require('fs');
const css = fs.readFileSync('public/styles/admin-users.css', 'utf8');
const html = fs.readFileSync('public/admin/users.html', 'utf8');
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
assert(html.includes('/styles/admin-users.css?v=rebuild-v564'), 'admin users stylesheet cachebuster must be rebuild-v564');
assert(css.includes('v557 mobile user management width containment'), 'v557 mobile containment marker missing');
assert(css.includes('@media(max-width:980px)'), 'v557 mobile media query missing');
assert(css.includes('.admin-section[data-admin-section="users"] .user-panel.is-active{width:100%!important;min-width:0!important;max-width:100%!important'), 'active user panel must not keep fixed mobile width');
assert(css.includes('.admin-section[data-admin-section="users"] .user-workbench-tabs{min-width:0!important;width:100%!important;max-width:100%!important;flex-wrap:wrap!important'), 'user workbench tabs must wrap inside mobile viewport');
assert(css.includes('.admin-section[data-admin-section="users"] .user-form-row,.admin-section[data-admin-section="users"] .user-form-row-compact,.admin-section[data-admin-section="users"] .user-form-row-access,.admin-section[data-admin-section="users"] .picker-grid,.admin-section[data-admin-section="users"] .picker-grid-compact,.admin-section[data-admin-section="users"] .user-mutation-row,.admin-section[data-admin-section="users"] .edit-subsections{display:grid!important;grid-template-columns:1fr!important'), 'mobile subcards and picker grids must stack to one column');
assert(css.includes('.admin-section[data-admin-section="users"] .compact-user-list .user-row{grid-template-columns:1fr!important;grid-template-areas:"identity" "meta" "actions"!important'), 'mobile user rows must stack identity/meta/actions');
console.log(JSON.stringify({ pass: 'v557-admin-user-management-mobile-layout-smoke-pass' }));
