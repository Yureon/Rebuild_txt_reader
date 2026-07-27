#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const verifier = fs.readFileSync('tools/release_verify.js', 'utf8');
const status = fs.readFileSync('docs/project-status-roadmap.md', 'utf8');
const smoke = fs.readFileSync('docs/smoke-tests.md', 'utf8');
const webMetadata = fs.readFileSync('docs/web-metadata.md', 'utf8');
const files = [
  'metadata-novelpia-adult-playwright-v617-smoke.js',
  'metadata-novelpia-adult-collection-v617-smoke.js',
  'release-verify-current-coverage-v617-smoke.js'
];
for (const file of files) {
  assert(runner.includes(`tools/checks/${file}`), `smoke runner missing v617 check: ${file}`);
  assert(verifier.includes(`tools/checks/${file}`), `release verifier missing v617 check: ${file}`);
}
for (const token of ['v617-metadata-novelpia-adult-playwright-pass','v617-metadata-novelpia-adult-collection-pass']) {
  assert(status.includes(token) || smoke.includes(token), `v617 documentation marker missing: ${token}`);
}
assert(webMetadata.includes('age_verification_required'));
assert(webMetadata.includes('novelpia-json'));
console.log(JSON.stringify({ pass:'v617-release-verify-current-coverage-pass', required:files.length }));
