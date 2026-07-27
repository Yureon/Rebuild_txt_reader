#!/usr/bin/env node
const fs=require('fs'); const assert=require('assert'); const current=require('./current-rebuild-version.js');
const metadata=fs.readFileSync('public/metadata.html','utf8');
const admin=fs.readFileSync('public/admin/users.html','utf8');
const deferred=fs.readFileSync('public/fragments/deferred-ui.html','utf8');
assert.ok(new RegExp(`class=\"metadata-build-badge\"[^>]*>v${current.CURRENT_REBUILD_VERSION_NUMBER}<\\/span>`).test(metadata),'metadata visible build badge must match current version');
for(const id of ['audit-event-type','audit-user-filter','audit-query','audit-limit','owner-metadata-login-text','owner-metadata-login-password']){
  assert.ok(admin.includes(`for="${id}"`) || new RegExp(`id="${id}"[^>]*aria-label=`).test(admin),`admin field lacks accessible name: ${id}`);
}
for(const id of ['account-current-password','account-new-password','account-new-password-confirm','nsearch-input']){
  assert.ok(deferred.includes(`for="${id}"`) || new RegExp(`id="${id}"[^>]*aria-label=`).test(deferred),`deferred field lacks accessible name: ${id}`);
}
console.log(JSON.stringify({pass:'v613-ui-version-accessibility-smoke-pass'}));
