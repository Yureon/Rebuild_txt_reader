#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v442-cache-metrics-threshold-diagnostics-smoke-pass';
const THRESHOLD_PASS = 'v442-cache-metrics-threshold-diagnostics-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const serviceSource = read('server/services/admin-diagnostics-service.js');
const opsSource = read('public/scripts/admin/ops.js');
const runSmoke = read('tools/run_smoke_tests.js');
const releaseVerify = read('tools/release_verify.js');
const productionDocs = read('docs/production-diagnostics.md');
const perfDocs = read('docs/performance-cache.md');
assert.ok(serviceSource.includes(THRESHOLD_PASS), 'admin diagnostics service must expose v442 cache threshold marker');
assert.ok(serviceSource.includes('function buildCacheMetricThresholds'), 'cache threshold builder missing');
assert.ok(serviceSource.includes('ioDiagnostics.thresholds = buildCacheMetricThresholds(ioDiagnostics)'), 'io diagnostics thresholds must be attached server-side');
assert.ok(serviceSource.includes('lastFileReadMs') && serviceSource.includes('fileCacheMisses') && serviceSource.includes('manifestCacheMisses'), 'thresholds must cover content and block-manifest metrics');
assert.ok(!serviceSource.includes('passwordHash') && !serviceSource.includes('session_token') && !serviceSource.includes('inviteCodePlain'), 'diagnostics thresholds must not expose sensitive raw fields');
assert.ok(opsSource.includes(THRESHOLD_PASS), 'admin ops UI must expose threshold marker');
assert.ok(opsSource.includes('renderCacheMetricWarnings'), 'admin ops UI threshold table renderer missing');
assert.ok(opsSource.includes('diagnostics-cache-thresholds'), 'admin ops UI threshold table class missing');
assert.ok(runSmoke.includes('cache-metrics-threshold-diagnostics-smoke.js'), 'cache smoke must include v442 threshold smoke');
assert.ok(releaseVerify.includes('cache-metrics-threshold-diagnostics-smoke.js'), 'release verify must include v442 threshold smoke');
assert.ok(productionDocs.includes(THRESHOLD_PASS), 'production diagnostics docs must mention threshold marker');
assert.ok(perfDocs.includes(THRESHOLD_PASS), 'performance cache docs must mention threshold marker');
console.log(JSON.stringify({ pass: PASS }));
