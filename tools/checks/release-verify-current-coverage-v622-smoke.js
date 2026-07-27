#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const adapters = read('server/services/metadata-site-adapters.js');
const registry = read('server/services/metadata-provider-registry.js');
const service = read('server/services/metadata-service.js');
const playwright = read('server/services/metadata-playwright-service.js');
const transport = read('server/services/metadata-transport-service.js');
const docs = read('docs/web-metadata.md');
const required = [
  'release-verify-current-coverage-v622-smoke.js',
  'metadata-provider-mobile-v622-smoke.js',
  'metadata-mobile-fallback-service-v622-smoke.js',
  'metadata-munpia-current-v622-smoke.js',
  'full-audit-fixes-v622-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick smoke runner missing v622 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v622 check: ${file}`);
}
for (const revision of ['revision: 4','revision: 12','revision: 11','revision: 5']) assert(adapters.includes(revision));
assert(adapters.includes('https://m.series.naver.com/search/web/search.series?q='));
assert(adapters.includes("requestProfile:'kakaopage-json'"));
assert(adapters.includes("requestProfile:'novelpia-json'"));
assert(adapters.includes("variant:'mobile-responsive'"));
assert(adapters.includes('shouldFetchDetailFallbackFor'));
assert(registry.includes("'m.series.naver.com'"));
assert(service.includes('throwIfContextAborted'));
assert(service.includes("reason:'primary_variant_succeeded'"));
assert(service.includes('shouldFetchDetailFallback'));
assert(playwright.includes("['novelpia-json','kakaopage-json'].includes(profile)"));
assert(playwright.includes('MOBILE_VIEWPORT') && playwright.includes('page.setViewportSize'));
assert(transport.includes('MOBILE_USER_AGENT') && transport.includes("deviceProfile === 'mobile'"));
assert(docs.includes('v622-metadata-provider-mobile-contract-pass'));
console.log(JSON.stringify({ pass:'v622-release-verify-current-coverage-pass', required:required.length }));
