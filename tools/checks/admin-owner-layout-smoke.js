#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

function runAdminOwnerLayoutSmoke() {
  const page = read('public/admin/users.html');
  const css = read('public/styles/admin-users.css');
  const users = read('public/scripts/admin/users.js');
  const ops = read('public/scripts/admin/ops.js');
  assert.ok(page.includes('data-admin-user-workbench-pass="v502-admin-user-workbench-tabs-pass"'), 'v502 user workbench tab marker missing');
  assert.ok(page.includes('data-admin-user-layout-pass="v502-admin-user-workbench-single-panel-pass"'), 'v502 user single-panel layout marker missing');
  for (const tab of ['data-user-panel-tab="create"', 'data-user-panel-tab="list"', 'data-user-panel-tab="edit"']) assert.ok(page.includes(tab), tab + ' tab missing');
  assert.ok(page.includes('user-create-card user-panel is-active') && page.includes('data-user-panel="create"'), 'create panel must be the default active workbench panel');
  assert.ok(page.includes('user-list-card user-panel') && page.includes('data-user-panel="list" hidden'), 'list panel must be tab-controlled instead of a visible vertical lane');
  assert.ok(page.includes('user-edit-card user-panel') && page.includes('data-user-panel="edit" hidden'), 'edit panel must be tab-controlled instead of a visible vertical lane');
  assert.ok(page.indexOf('data-user-panel-tab="create"') < page.indexOf('data-user-panel-tab="list"') && page.indexOf('data-user-panel-tab="list"') < page.indexOf('data-user-panel-tab="edit"'), 'user workbench tabs must remain create/list/edit order');
  assert.ok(page.includes('user-form-row user-form-row-compact') && page.includes('user-form-row user-form-row-access'), 'create/edit panels must group basic fields into rows');
  assert.ok(page.includes('field-panel access-picker-panel') && page.includes('picker-grid') && page.includes('user-mutation-row'), 'folder pickers and mutation permissions must be grouped panels');
  assert.ok(page.includes('edit-toolbar') && page.includes('edit-subsections') && page.includes('edit-subcard'), 'edit panel must group toolbar and management subcards');
  assert.ok(page.includes('/styles/admin-users.css?v=rebuild-v564'), 'admin stylesheet cachebuster must match current rebuild');
  for (const rel of ['core','sections','ops','users','state','audit','signup','actions','audit-actions','signup-actions','state-actions','permissions']) {
    assert.ok(page.includes('/scripts/admin/' + rel + '.js?v=rebuild-v564'), rel + ' admin script cachebuster must match current rebuild');
  }
  assert.ok(page.includes('/scripts/admin-users.js?v=rebuild-v564'), 'admin main script cachebuster must match current rebuild');
  assert.ok(css.includes('v502 user management workbench tabs redesign'), 'v502 user workbench CSS marker missing');
  assert.ok(css.includes('.user-workbench-tabs{display:flex'), 'user management must expose horizontal workbench tabs');
  assert.ok(css.includes('.user-management-layout{display:block!important'), 'user management must not use the old three-lane flex/grid layout');
  assert.ok(css.includes('.user-panel[hidden]{display:none!important}'), 'inactive workbench panels must be hidden');
  assert.ok(css.includes('.user-create-card,.admin-section[data-admin-section="users"] .user-list-card,.admin-section[data-admin-section="users"] .user-edit-card{order:0!important;grid-area:auto!important;flex:none!important'), 'user panels must not keep fixed vertical lane flex sizing');
  assert.ok(css.includes('.user-form-row{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))'), 'wide active panels must use horizontal field rows');
  assert.ok(css.includes('.picker-grid{display:grid!important;grid-template-columns:minmax(420px,1.12fr) minmax(260px,.88fr)'), 'folder picker panels must split picker and summary columns in the active panel');
  assert.ok(css.includes('.user-mutation-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))'), 'move/delete permission sections must sit side by side');
  assert.ok(css.includes('.compact-user-list .user-row{display:grid!important;grid-template-columns:minmax(220px,.9fr) minmax(280px,1.2fr) auto!important;grid-template-areas:"identity meta actions"'), 'user list rows must be one horizontal row');
  assert.ok(css.includes('.edit-subsections{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))'), 'edit management subcards must use a horizontal three-column grid');
  assert.ok(users.includes('v502-admin-users-horizontal-row-list-pass'), 'user list renderer marker missing');
  assert.ok(users.includes('admin-user-list-row') && users.includes('user-identity') && users.includes('user-access-pills') && users.includes('user-row-actions'), 'user list renderer must emit horizontal row regions');
  assert.ok(page.includes('ops-control-card') && page.includes('ops-result-card') && page.includes('ops-history-card') && page.includes('ops-status-card'), 'ops cards must have explicit layout classes');
  assert.ok(css.includes('max-height:calc(100vh - 156px)') && css.includes('overflow:auto'), 'tall admin cards must be bounded with internal scroll');
  assert.ok(css.includes('grid-template-areas:"control result" "history result" "status result"'), 'ops grid must use stable named areas');
  assert.ok(css.includes('.diagnostics-output{grid-template-columns:repeat(12,minmax(0,1fr))'), 'diagnostics output must use compact 12-column grid');
  assert.ok(css.includes('.diagnostics-output>.diagnostics-cache-thresholds{grid-column:1/-1}'), 'cache threshold card must span the full diagnostics grid');
  assert.ok(css.includes('.diagnostics-cache-thresholds .diagnostics-table-wrap table{min-width:720px}'), 'cache threshold table must keep readable value columns');
  assert.ok(css.includes('v495 cache threshold diagnostics card layout fix'), 'v495 cache threshold CSS marker missing');
  assert.ok(ops.includes('data-cache-threshold-layout-pass="v495-cache-threshold-card-layout-pass"'), 'cache threshold layout marker must be rendered');
  assert.ok(ops.includes('cache-threshold-config-row') && ops.includes('contentInflightWarn'), 'cache threshold config rows must render current values and criteria');
  return { pass: 'v502-admin-owner-layout-smoke-pass', userLayoutPass: 'v502-admin-user-workbench-tabs-pass', cacheThresholdPass: 'v495-cache-threshold-card-layout-pass' };
}

if (require.main === module) console.log(JSON.stringify(runAdminOwnerLayoutSmoke()));
module.exports = { runAdminOwnerLayoutSmoke };
