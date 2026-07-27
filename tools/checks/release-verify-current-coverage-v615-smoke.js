#!/usr/bin/env node
'use strict';
const fs = require('fs');
const assert = require('assert');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const store = fs.readFileSync('server/services/metadata-store-service.js', 'utf8');
const docs = fs.readFileSync('docs/web-metadata.md', 'utf8');
for (const file of ['release-verify-current-coverage-v615-smoke.js','metadata-candidate-dedup-v615-smoke.js']) {
  assert.ok(runner.includes(`tools/checks/${file}`), `smoke runner missing v615 check: ${file}`);
  assert.ok(verifier.includes(`tools/checks/${file}`), `release verifier missing v615 check: ${file}`);
}
for (const token of ['v615-metadata-candidate-dedup-pass','metadataContentFingerprint','compactDuplicateCandidates','candidateIdsByContentKey']) {
  assert.ok(store.includes(token), `metadata store dedupe token missing: ${token}`);
}
assert.ok(docs.includes('v615-metadata-candidate-dedup-pass'), 'metadata dedupe documentation marker missing');
console.log(JSON.stringify({ pass:'v615-release-verify-current-coverage-pass', required:2 }));
