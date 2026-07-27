#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const current = require('./current-rebuild-version.js');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const required = [
  'release-verify-current-coverage-v640-smoke.js',
  'metadata-ssn-provider-v640-smoke.js',
  'metadata-ssn-collection-v640-smoke.js',
  'admin-owner-workspace-v640-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick runner missing v640 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v640 check: ${file}`);
}
assert(current.CURRENT_REBUILD_VERSION_NUMBER >= 640);
assert.equal(current.CURRENT_REBUILD_VERSION, `rebuild-v${current.CURRENT_REBUILD_VERSION_NUMBER}`);
assert.equal(current.CURRENT_REBUILD_PACKAGE, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}.zip`);
assert.equal(current.CURRENT_REBUILD_MANIFEST, `package-manifest-v${current.CURRENT_REBUILD_VERSION_NUMBER}.json`);
assert.equal(current.CURRENT_REBUILD_RELEASE_NOTES, `txt_reader_v${current.CURRENT_REBUILD_VERSION_NUMBER}_change_report.md`);
assert.equal(current.CURRENT_REBUILD_MANIFEST_DIFF, `package-manifest-diff-v${current.CURRENT_REBUILD_VERSION_NUMBER}.md`);
assert.equal(JSON.parse(read('package.json')).version, '6.75.0');
const registry = read('server/services/metadata-provider-registry.js');
const adapters = read('server/services/metadata-site-adapters.js');
assert(registry.includes("id:'builtin-ssn'") && registry.includes("priority:5"));
assert(adapters.includes("key:'ssn-series-v1'") && adapters.includes('https://ssn.so/series/?keyword='));
const ownerHtml = read('public/admin/users.html');
const ownerCss = read('public/styles/admin-users.css');
assert(ownerHtml.includes('기본 메타데이터 공급자') && ownerHtml.includes('고급 메타데이터 공급자 관리') && ownerHtml.includes('메타데이터 정리'));
assert(registry.includes("id:'builtin-naver-series'"), 'Naver Series builtin provider must remain registered');
assert(ownerHtml.includes('owner-metadata-login-workspace'));
assert(ownerCss.includes('rebuild-v644: unified owner workbench, folder permission picker, metadata cards, and Playwright workspace'));
assert(read('docs/web-metadata.md').includes('builtin-ssn'));
console.log(JSON.stringify({ pass:'v640-release-verify-current-coverage-pass', required:required.length }));
