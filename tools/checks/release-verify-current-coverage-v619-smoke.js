#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const verifier = fs.readFileSync(path.join(root, 'tools/release_verify.js'), 'utf8');
const metadataPage = fs.readFileSync(path.join(root, 'public/metadata.html'), 'utf8');
const api = fs.readFileSync(path.join(root, 'public/scripts/rebuild/core/api.mjs'), 'utf8');
const service = fs.readFileSync(path.join(root, 'server/services/metadata-service.js'), 'utf8');
const route = fs.readFileSync(path.join(root, 'server/routes/metadata-routes.js'), 'utf8');
const docs = fs.readFileSync(path.join(root, 'docs/web-metadata.md'), 'utf8');
const required = ['metadata-score-priority-bulk-apply-v619-smoke.js','release-verify-current-coverage-v619-smoke.js'];
for (const file of required) {
  assert(runner.includes(`tools/checks/${file}`), `quick smoke runner missing v619 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v619 check: ${file}`);
}
assert(metadataPage.includes('metadata-apply-pending-btn'));
assert(api.includes("applyPendingMetadata(options) { return this.post('/api/metadata/apply-pending'"));
assert(route.includes("router.post('/metadata/apply-pending'"));
assert(service.includes("const APPLY_PENDING_JOB_TYPE = 'apply-pending-bulk';"));
assert(service.includes("const METADATA_AUTO_APPLY_POLICY_PASS = 'v619-metadata-auto-apply-score-priority-pass';"));
assert(service.includes('return Number(right.matchScore) - Number(left.matchScore)'));
assert(service.includes('|| leftPriority - rightPriority'));
assert(docs.includes('v619-metadata-score-priority-bulk-apply-contract-pass'));
console.log(JSON.stringify({ pass:'v619-release-verify-current-coverage-pass', required:required.length }));
