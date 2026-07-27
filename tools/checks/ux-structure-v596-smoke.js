const fs = require('fs');
const assert = require('assert');
const read = (rel) => fs.readFileSync(rel, 'utf8');

const adminHtml = read('public/admin/users.html');
const workflow = read('public/scripts/admin/form-workflow.js');
const permissions = read('public/scripts/admin/permissions.js');
const adminRuntime = read('public/scripts/admin-users.js');
const adminCss = read('public/styles/admin-users.css');
const metadataHtml = read('public/metadata.html');
const metadataRuntime = read('public/scripts/rebuild/metadata-page.mjs');
const metadataCss = read('public/styles/metadata-page.css');

assert(adminHtml.includes('/scripts/admin/form-workflow.js'), 'owner form workflow script must load');
assert(adminHtml.indexOf('/scripts/admin/form-workflow.js') < adminHtml.indexOf('/scripts/admin-users.js'), 'form workflow must enhance DOM before owner bootstrap');
for (const token of ['v596-admin-user-form-workflow-pass','data-user-form-step','user-form-sticky-actions','user-form-change-summary','ArrowRight','aria-controls']) {
  assert(workflow.includes(token), `owner workflow token missing: ${token}`);
}
for (const token of ["picker.closest('details[data-user-form-step]')","picker.closest('form[data-v596-workflow=\"true\"]')",'lazyPickerPending','step.addEventListener(\'toggle\'']) {
  assert(permissions.includes(token), `lazy folder picker token missing: ${token}`);
}
assert(adminRuntime.includes("AdminUserFormWorkflow.refresh('edit')"), 'editing a user must refresh workflow summary and open pickers');
for (const token of ['rebuild-v644: staged owner user workflow','user-form-step-summary','user-form-sticky-actions','folder-picker[data-lazy-picker-pending="true"]']) {
  assert(adminCss.includes(token), `owner workflow CSS token missing: ${token}`);
}

assert(metadataHtml.includes('id="metadata-detail-mobile-back"'), 'metadata detail must have mobile back control');
assert(metadataHtml.includes('id="metadata-detail-title" tabindex="-1"'), 'metadata detail heading must accept managed focus');
for (const token of [
  "window.matchMedia('(max-width: 760px)')",
  'metadata-mobile-detail-open',
  'closeMobileDetail',
  "event.key === 'Escape'",
  "event.key === 'ArrowDown'",
  "window.addEventListener('popstate'",
  "setAttribute('aria-controls'",
  'restoreFocus:true'
]) assert(metadataRuntime.includes(token), `metadata master-detail token missing: ${token}`);
for (const token of ['rebuild-v644: mobile master-detail workspace','#metadata-page-works.metadata-mobile-detail-open .metadata-work-browser','#metadata-page-works.metadata-mobile-detail-open .metadata-work-detail','.metadata-detail-mobile-back{display:inline-flex','.metadata-detail-empty[hidden]','.metadata-page-header{flex-direction:row']) {
  assert(metadataCss.includes(token), `metadata master-detail CSS token missing: ${token}`);
}

console.log(JSON.stringify({ pass:'v596-ux-structure-smoke-pass' }));
