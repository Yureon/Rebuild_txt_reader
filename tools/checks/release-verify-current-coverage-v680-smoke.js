#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const current=require('./current-rebuild-version');
const currentRegressions=[
  'release-verify-current-coverage-v680-smoke.js',
  'v680-active-check-registration-smoke.js',
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
assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER,680);
assert.equal(current.CURRENT_REBUILD_VERSION,'rebuild-v680');
assert.equal(current.CURRENT_REBUILD_PACKAGE,'txt_reader_v680.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST,'package-manifest-v680.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES,'txt_reader_v680_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF,'package-manifest-diff-v680.md');
assert.equal(JSON.parse(read('package.json')).version,'6.80.0');
assert.equal(JSON.parse(read('public/version.json')).buildId,'rebuild-v680');
assert.equal(JSON.parse(read('extensions/metadata-login-helper/manifest.json')).version,'6.80.0');
assert(read('tools/sync_version_contract.js').includes('v680-central-version-contract-pass'));
assert(read('public/login.html').includes('data-login-palette="owner-console"'));
assert(!read('public/login.html').includes('/scripts/theme-boot.js'));
assert(read('public/scripts/theme-boot.js').includes('v680-user-scoped-theme-first-paint-pass'));
assert(read('public/scripts/login.js').includes('v680-login-user-theme-prime-pass'));
assert(read('server/routes/theme-bootstrap-routes.js').includes('v680-user-theme-bootstrap-route-pass'));
assert(read('public/scripts/rebuild/metadata-page.mjs').includes('v680-metadata-user-theme-bootstrap-pass'));
assert(read('public/sw.js').includes("const BUILD = 'rebuild-v680';"));
console.log(JSON.stringify({pass:'v680-release-verify-current-coverage-pass',currentRegressions:currentRegressions.length,build:'rebuild-v680'}));
