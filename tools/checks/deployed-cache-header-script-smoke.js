#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '../..');
const PASS = 'v442-deployed-cache-header-script-smoke-pass';
const SCRIPT_PASS = 'v442-deployed-cache-header-check-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
const scriptPath = path.join(root, 'tools/check_deployed_cache_headers.js');
assert.ok(fs.existsSync(scriptPath), 'deployed cache header check script missing');
const source = read('tools/check_deployed_cache_headers.js');
assert.ok(source.includes(SCRIPT_PASS), 'deployed script marker missing');
assert.ok(source.includes('/login.html') && source.includes('/site.html') && source.includes('/mobile.html') && source.includes('/admin/users.html'), 'deployed script must check HTML entry routes');
assert.ok(source.includes('/scripts/rebuild/main.mjs?v=') && source.includes('/scripts/rebuild/main.mjs'), 'deployed script must check versioned and queryless rebuild modules');
assert.ok(source.includes('/api/time') && source.includes('/api/novels'), 'deployed script must check API cache boundaries');
assert.ok(source.includes('Cache-Control') && source.includes('immutable') && source.includes('must-revalidate'), 'deployed script must assert cache-control contracts');
assert.ok(source.includes('cookie') && source.includes('--cookie'), 'deployed script must support authenticated checks without storing secrets');
const help = spawnSync(process.execPath, [scriptPath, '--help'], { cwd: root, encoding: 'utf8' });
assert.strictEqual(help.status, 0, '--help must exit 0');
assert.ok(help.stdout.includes(SCRIPT_PASS), '--help must print marker');
assert.ok(read('docs/deployment-guide.md').includes(SCRIPT_PASS), 'deployment guide must mention deployed header script marker');
assert.ok(read('docs/smoke-tests.md').includes('check_deployed_cache_headers.js'), 'smoke docs must mention deployed header script');
assert.ok(read('tools/run_smoke_tests.js').includes('deployed-cache-header-script-smoke.js'), 'cache smoke must include deployed script smoke');
assert.ok(read('tools/release_verify.js').includes('deployed-cache-header-script-smoke.js'), 'release verify must include deployed script smoke');
console.log(JSON.stringify({ pass: PASS }));
