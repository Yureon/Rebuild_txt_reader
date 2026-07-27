#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const current = read('tools/checks/current-rebuild-version.js');
const page = read('public/scripts/rebuild/metadata-page.mjs');
const metadataHtml = read('public/metadata.html');
const metadataCss = read('public/styles/metadata-page.css');
const adminCss = read('public/styles/admin-users.css');
const appCss = read('public/styles/app.css');
const deferredCss = read('public/styles/deferred-ui.css');
const loginCss = read('public/styles/login.css');
const shell = read('public/fragments/app-shell.html');
const required = [
  'release-verify-current-coverage-v624-smoke.js',
  'responsive-pages-v624-smoke.js',
  'metadata-job-poll-selection-v624-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick smoke runner missing v624 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v624 check: ${file}`);
}
assert(Number(current.match(/CURRENT_REBUILD_VERSION_NUMBER = (\d+)/)?.[1] || 0) >= 624);
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 24);
assert(metadataHtml.includes('metadata-page-header-menu'));
assert(metadataCss.includes('rebuild-v644: keep desktop actions in flex layout'));
assert(adminCss.includes('rebuild-v644: tablet workbench containment'));
assert(appCss.includes('rebuild-v644: tablet touch targets and narrow reader toolbar'));
assert(deferredCss.includes('rebuild-v644: icon-only modal close controls'));
assert(loginCss.includes('rebuild-v644: touch target baseline'));
assert(shell.includes('aria-label="탐색기형 보기"'));
assert(page.includes('jobPollSerial:0, jobPollTimer:0'));
assert(page.includes('const stillCurrent = () => serial === page.jobPollSerial'));
assert(page.includes("window.addEventListener('pagehide',()=>{"));
console.log(JSON.stringify({ pass:'v624-release-verify-current-coverage-pass', required:required.length }));
