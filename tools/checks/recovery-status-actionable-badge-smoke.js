#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const runtime = read('public/scripts/rebuild/features/recovery/runtime.mjs');
const summary = read('public/scripts/rebuild/features/recovery/summary-panel.mjs');
const removed = JSON.parse(read('tools/fixtures/removed-recovery-files-v421.json')).removed || [];
assert.ok(runtime.includes('v422-recovery-status-non-actionable-pass'), 'runtime must mark non-actionable recovery status failures');
assert.ok(runtime.includes('v422-recovery-badge-actionable-only-pass'), 'runtime must expose actionable-only badge marker');
assert.ok(summary.includes('v422-recovery-badge-actionable-only-pass'), 'summary badge must carry actionable-only marker');
assert.ok(summary.includes('v422-recovery-server-status-scoped-unavailable-pass'), 'summary must render scoped server status as non-actionable');
assert.ok(runtime.includes('status === 401 || status === 403'), 'owner-only recovery-status should be scoped out');
assert.ok(runtime.includes('isActionableRecoveryFailure'), 'actionable recovery failure filter missing');
assert.ok(runtime.includes('recovery-status|recovery-lazy-render|recovery-render'), 'recovery UI diagnostic errors must not trigger bad badge');
assert.ok(!runtime.includes('/recovery|fetch|api/i'), 'broad recovery/fetch/api regex should not drive 조치 필요');
assert.ok(!summary.includes('Manual review bundle'), 'summary should not mention removed manual review bundle');
for (const name of removed) {
  const ref = './' + name;
  assert.ok(!runtime.includes(ref), 'runtime must not import removed recovery file: ' + ref);
  assert.ok(!summary.includes(ref), 'summary must not reference removed recovery file: ' + ref);
}
console.log('v422-recovery-status-actionable-badge-smoke-pass');
