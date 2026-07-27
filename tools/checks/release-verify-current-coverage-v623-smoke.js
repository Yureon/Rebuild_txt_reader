#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const runner = read('tools/run_smoke_tests.js');
const verifier = read('tools/release_verify.js');
const api = read('public/scripts/rebuild/core/api.mjs');
const page = read('public/scripts/rebuild/metadata-page.mjs');
const html = read('public/metadata.html');
const routes = read('server/routes/novels-routes.js');
const docs = read('docs/web-metadata.md');
const required = [
  'release-verify-current-coverage-v623-smoke.js',
  'metadata-work-filters-v623-smoke.js'
];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick smoke runner missing v623 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v623 check: ${file}`);
}
assert(api.includes("appendMany('metadataStatus', filters.metadataStatuses)"));
assert(api.includes("appendMany('metadataProvider', filters.metadataProviderIds)"));
assert(routes.includes('metadataStatuses:normalizeQueryList'));
assert(routes.includes('metadataProviderIds:normalizeQueryList'));
assert(routes.includes("query.metadataStatuses[0] === 'applied'"));
assert(routes.includes("query.metadataStatuses[0] === 'missing'"));
assert(routes.includes('query.metadataProviderIds.includes(providerId)'));
assert(html.includes('metadata-work-status-filter'));
assert(html.includes('metadata-work-provider-filter'));
assert(page.includes('currentWorkFilters()'));
assert(page.includes('consecutiveErrors >= 8'));
assert(page.includes('clearSelectedWork();'));
assert(docs.includes('v623-metadata-work-filter-contract-pass'));
assert(Number(JSON.parse(read('package.json')).version.split('.')[1]) >= 23, 'package version must retain v623 or newer contract');
assert(Number(read('tools/checks/current-rebuild-version.js').match(/CURRENT_REBUILD_VERSION_NUMBER = (\d+)/)?.[1] || 0) >= 623, 'current rebuild version must be v623 or newer');
console.log(JSON.stringify({ pass:'v623-release-verify-current-coverage-pass', required:required.length }));
