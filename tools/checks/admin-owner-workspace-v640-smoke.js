#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('public/admin/users.html');
const css = read('public/styles/admin-users.css');
const metadata = read('public/scripts/admin/metadata.mjs');
const permissions = read('public/scripts/admin/permissions.js');

assert(css.includes('rebuild-v644: unified owner workbench, folder permission picker, metadata cards, and Playwright workspace'));
assert(css.includes('.user-management-layout{display:block!important;width:100%!important'));
assert(css.includes('.picker-grid,.admin-section[data-admin-section="users"] .picker-grid-compact{display:grid!important;grid-template-columns:minmax(0,1fr)!important'));
assert(css.includes('.folder-picker{min-height:184px!important;max-height:248px!important'));
assert(css.includes('.folder-line-copy{grid-column:2!important;display:grid!important'));
assert(css.includes('.folder-line-path{display:block!important'));
assert(css.includes('.folder-line-meta{display:block!important'));
assert(css.includes('.owner-metadata-provider-controls{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.42fr)'));
assert(css.includes('.owner-metadata-provider-actions{display:grid!important;grid-template-columns:repeat(auto-fit,minmax(132px,1fr))'));
assert(css.includes('.owner-metadata-login-workspace{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,340px)'));
assert(css.includes('@media(max-width:760px)'));
assert(css.includes('.owner-metadata-login-workspace{grid-template-columns:1fr;overflow:visible}'));

assert(html.includes('owner-metadata-login-workspace'));
assert(html.includes('owner-metadata-login-browser-pane'));
assert(html.includes('owner-metadata-login-control-pane'));
assert(html.indexOf('owner-metadata-login-browser-pane') < html.indexOf('owner-metadata-login-control-pane'));
assert(html.includes('data-owner-metadata-login-body'));
assert(html.includes('data-owner-metadata-login-footer'));

assert(metadata.includes("class:'owner-metadata-provider-controls'"));
assert(metadata.includes("class:'checkline owner-metadata-control-tile'"));
assert(metadata.includes("class:'actions owner-metadata-provider-actions'"));
assert(permissions.includes('folder-explorer-row'));
assert(permissions.includes('folder-explorer-name'));
assert(permissions.includes('folder-explorer-parent'));
assert(permissions.includes('작품 '));
assert(permissions.includes('· 하위 '));

console.log(JSON.stringify({
  pass:'v640-admin-owner-workspace-pass',
  areas:['single-panel-workbench','folder-permission-picker','metadata-provider-card','playwright-workspace','mobile-stack']
}));
