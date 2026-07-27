#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const runner = fs.readFileSync('tools/run_smoke_tests.js', 'utf8');
const docs = fs.readFileSync('docs/reader-anchoring-stability-contract.md', 'utf8');
const report = fs.readFileSync('public/scripts/rebuild/features/devtools/report.mjs', 'utf8');
const readerGroup = runner.slice(runner.indexOf('reader: Object.freeze(['), runner.indexOf('search: Object.freeze([', runner.indexOf('reader: Object.freeze([')));
const docsGroup = runner.slice(runner.indexOf('docs: Object.freeze(['), runner.indexOf('cache: Object.freeze([', runner.indexOf('docs: Object.freeze([')));
assert.ok(readerGroup.includes('reader-anchoring-stability-contract-smoke.js'), 'reader smoke group must include stability contract smoke');
assert.ok(docsGroup.includes('reader-anchoring-stability-contract-smoke.js'), 'docs smoke group must include stability contract smoke');
assert.ok(report.includes('v489-reader-stability-baseline-devtools-pass'), 'devtools report must expose v489 reader stability baseline marker');
assert.ok(report.includes('readerStabilityBaseline'), 'devtools reader section must surface stability baseline row');
assert.ok(docs.includes('v489-reader-stability-standard-smoke-link-pass'), 'stability contract must document v489 smoke runner link');
console.log('v489-reader-stability-protection-runner-smoke-pass');
