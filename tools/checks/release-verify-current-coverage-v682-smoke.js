#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const current=require('./current-rebuild-version');
const currentRegressions=[
  'release-verify-current-coverage-v682-smoke.js',
  'v682-active-check-registration-smoke.js',
  'v682-library-organization-powershell51-compat-smoke.js',
  'v681-metadata-manual-provider-filter-smoke.js',
  'v680-login-owner-palette-smoke.js',
  'v680-user-theme-bootstrap-smoke.js',
  'v680-theme-runtime-contract-smoke.js'
];
const runner=read('tools/run_smoke_tests.js');
const verifier=read('tools/release_verify.js');
for(const file of currentRegressions){
  assert(fs.existsSync(path.join(root,'tools/checks',file)),`missing ${file}`);
  assert(runner.includes(`tools/checks/${file}`),`runner missing ${file}`);
  assert(verifier.includes(`tools/checks/${file}`),`release verifier missing ${file}`);
}
assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER,682);
assert.equal(current.CURRENT_REBUILD_VERSION,'rebuild-v682');
assert.equal(current.CURRENT_REBUILD_PACKAGE,'txt_reader_v682.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST,'package-manifest-v682.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES,'txt_reader_v682_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF,'package-manifest-diff-v682.md');
assert.equal(JSON.parse(read('package.json')).version,'6.82.0');
assert.equal(JSON.parse(read('public/version.json')).buildId,'rebuild-v682');
assert.equal(JSON.parse(read('extensions/metadata-login-helper/manifest.json')).version,'6.82.0');
assert(read('tools/sync_version_contract.js').includes('v682-central-version-contract-pass'));
const organization=read('server/services/library-organization-service.js');
assert(organization.includes('function Get-RelativePathCompat'));
assert(!organization.includes('[System.IO.Path]::GetRelativePath('));
assert(read('public/sw.js').includes("const BUILD = 'rebuild-v682';"));
console.log(JSON.stringify({pass:'v682-release-verify-current-coverage-pass',currentRegressions:currentRegressions.length,build:'rebuild-v682'}));
