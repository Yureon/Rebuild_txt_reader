#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '../..');
const PASS = 'v421-unused-recovery-files-pruned-smoke-pass';
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'tools/fixtures/removed-recovery-files-v421.json'), 'utf8'));
const removed = Array.isArray(fixture.removed) ? fixture.removed : [];
assert.ok(removed.length >= 80, 'expected substantial recovery dead-file prune list');
for (const name of removed) for (const suffix of ['', '.br', '.gz']) assert.ok(!fs.existsSync(path.join(root, 'public/scripts/rebuild/features/recovery', name + suffix)), 'removed recovery file still present: ' + name + suffix);
const scanRoots = ['public/scripts/rebuild/features/recovery', 'public/scripts/rebuild/features/sync-devtools.mjs', 'public/fragments/app-shell.html', 'public/fragments/deferred-ui.html'];
const scanned = [];
function walk(target) { const full = path.join(root, target); const stat = fs.statSync(full); if (stat.isDirectory()) for (const ent of fs.readdirSync(full)) walk(path.join(target, ent)); else if (/\.(mjs|js|html|css)$/.test(target)) scanned.push({ rel:target.replace(/\\/g, '/'), body:fs.readFileSync(full, 'utf8') }); }
scanRoots.forEach(walk);
for (const name of removed) { const moduleRef = './' + name; const offenders = scanned.filter(item => item.body.includes(moduleRef)); assert.strictEqual(offenders.length, 0, `removed recovery module still referenced: ${moduleRef} in ${offenders.map(o => o.rel).join(', ')}`); }
const shell = fs.readFileSync(path.join(root, 'public/fragments/app-shell.html'), 'utf8') + '\n' + fs.readFileSync(path.join(root, 'public/fragments/deferred-ui.html'), 'utf8');
assert.ok(shell.includes('v421-recovery-center-general-dev-nav-pass'), 'general/dev nav marker missing');
assert.ok(shell.includes('개발자 진단'), 'developer diagnostics nav missing');
assert.ok(!shell.includes('data-recovery-jump="library-virtual"'), 'library-virtual nav must be removed');
assert.ok(!shell.includes('>목록 점검</button>'), 'list diagnostics nav label must be removed');
console.log(PASS);
module.exports = { PASS };
