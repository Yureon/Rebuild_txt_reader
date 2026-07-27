#!/usr/bin/env node
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const search = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search.mjs'), 'utf8');
const matcher = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/search/matcher.mjs'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');
const smokeDocs = fs.readFileSync(path.join(root, 'docs/smoke-tests.md'), 'utf8');
const release = fs.readFileSync(path.join(root, 'docs/release-history.md'), 'utf8');
const PASS = 'v534-search-coverage-preview-schedule-smoke-pass';

assert.ok(search.includes("SEARCH_COVERAGE_PREVIEW_SCHEDULE_PASS = 'v534-search-coverage-preview-schedule-pass'"), 'coverage preview schedule marker missing');
assert.ok(search.includes('function scheduleSearchCoveragePreview(app, options = {})'), 'scheduled coverage preview helper missing');
assert.ok(search.includes('function cancelScheduledSearchCoveragePreview(app)'), 'scheduled preview cleanup helper missing');
assert.ok(search.includes('coveragePreviewPromise'), 'coverage preview promise coalescing state missing');
assert.ok(search.includes('coveragePreviewCoalesced'), 'coverage preview coalescing diagnostics missing');
assert.ok(search.includes("scheduleSearchCoveragePreview(app, { reason:'search-open', delayMs: 80 })"), 'openSearch must defer coverage preview work');
assert.ok(search.includes("scheduleSearchCoveragePreview(app, { reason:'search-complete', silent:true, delayMs: 40 })"), 'runSearch must defer post-search coverage preview');
assert.ok(!search.includes('await refreshSearchCoveragePreview(app, { silent:true });'), 'runSearch must not await the post-search coverage preview');
assert.ok(matcher.includes(`SEARCH_WORKER_SCRIPT_URL = '/scripts/rebuild/features/search/search-worker.js?v=${CURRENT_REBUILD_VERSION}'`), 'search worker cachebuster must match v534');
assert.ok(runner.includes("nodeCmd('tools/checks/search-coverage-preview-schedule-smoke.js')"), 'runner must include v534 search preview smoke');
assert.ok(smokeDocs.includes('search-coverage-preview-schedule-smoke.js'), 'smoke docs must mention v534 search preview smoke');
assert.ok(release.includes(PASS), 'release history must record v534 search preview smoke marker');

console.log(JSON.stringify({ pass: PASS }));
