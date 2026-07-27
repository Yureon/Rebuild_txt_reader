#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const current=require('./current-rebuild-version');
const currentRegressions=[
  'release-verify-current-coverage-v681-smoke.js',
  'v681-active-check-registration-smoke.js',
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
assert.equal(current.CURRENT_REBUILD_VERSION_NUMBER,681);
assert.equal(current.CURRENT_REBUILD_VERSION,'rebuild-v681');
assert.equal(current.CURRENT_REBUILD_PACKAGE,'txt_reader_v681.zip');
assert.equal(current.CURRENT_REBUILD_MANIFEST,'package-manifest-v681.json');
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES,'txt_reader_v681_change_report.md');
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF,'package-manifest-diff-v681.md');
assert.equal(JSON.parse(read('package.json')).version,'6.81.0');
assert.equal(JSON.parse(read('public/version.json')).buildId,'rebuild-v681');
assert.equal(JSON.parse(read('extensions/metadata-login-helper/manifest.json')).version,'6.81.0');
assert(read('tools/sync_version_contract.js').includes('v681-central-version-contract-pass'));
assert(read('public/scripts/rebuild/metadata-page.mjs').includes('v681-metadata-manual-provider-filter-pass'));
assert(read('public/metadata.html').includes('<option value="manual">수동 입력 (직접 추가)</option>'));
assert(read('server/services/metadata-filter-service.js').includes('v681-metadata-manual-provider-filter-pass'));
assert(read('public/sw.js').includes("const BUILD = 'rebuild-v681';"));
console.log(JSON.stringify({pass:'v681-release-verify-current-coverage-pass',currentRegressions:currentRegressions.length,build:'rebuild-v681'}));
