#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const current=require('./current-rebuild-version');
const currentRegressions=[
  'release-verify-current-coverage-v679-smoke.js',
  'v679-active-check-registration-smoke.js',
  'v679-metadata-folder-disclosure-smoke.js'
];
const runner=read('tools/run_smoke_tests.js');
const verifier=read('tools/release_verify.js');
for(const file of currentRegressions){
  assert(fs.existsSync(path.join(root,'tools/checks',file)),`missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`),`runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`),`release verifier missing ${file}`);
}
assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER,679);
assert.equal(current.CURRENT_REBUILD_VERSION,'rebuild-v679');
assert.equal(current.CURRENT_REBUILD_PACKAGE,'txt_reader_v679.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST,'package-manifest-v679.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES,'txt_reader_v679_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF,'package-manifest-diff-v679.md');
assert.equal(JSON.parse(read('package.json')).version,'6.79.0');
assert.equal(JSON.parse(read('public/version.json')).buildId,'rebuild-v679');
assert.equal(JSON.parse(read('extensions/metadata-login-helper/manifest.json')).version,'6.79.0');
assert(read('tools/sync_version_contract.js').includes('v679-central-version-contract-pass'));
assert(read('public/metadata.html').includes('/styles/metadata-page.css?v=rebuild-v679'));
assert(read('public/sw.js').includes("const BUILD = 'rebuild-v679';"));
assert(read('extensions/metadata-login-helper/popup.css').includes('--popup-width: 380px'));
assert(read('public/styles/metadata-page.css').includes('#metadata-work-folder-query{'));
console.log(JSON.stringify({pass:'v679-release-verify-current-coverage-pass',currentRegressions:currentRegressions.length,build:'rebuild-v679'}));
