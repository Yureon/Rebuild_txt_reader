#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const entrypoint = fs.readFileSync(path.join(root, 'docker-entrypoint.sh'), 'utf8');
const generator = fs.readFileSync(path.join(root, 'tools', 'generate_precompressed_assets.js'), 'utf8');
const hydration = fs.readFileSync(path.join(root, 'public', 'scripts', 'rebuild', 'features', 'sync', 'server-state-hydration.mjs'), 'utf8');

assert.ok(entrypoint.includes('write_check_directory "$DATA_DIR/user-data"'), 'entrypoint must validate the user-data persistence path');
assert.ok(entrypoint.includes('.write-check.$$'), 'entrypoint probe directory must be process-unique');
assert.ok(!entrypoint.includes('rm -rf "$check_root"'), 'entrypoint must not recursively delete a fixed probe directory');
assert.ok(entrypoint.includes('rmdir "$check_root"'), 'entrypoint must clean its own empty probe directory');
for (const ext of ['.mjs', '.js', '.css', '.html', '.json', '.xml', '.svg']) {
  assert.ok(generator.includes(`'${ext}'`), `precompression discovery misses ${ext}`);
}
assert.ok(hydration.includes('app.state.serverStateHydrated = true;'));
assert.ok(/refreshSyncState[\s\S]*return true;[\s\S]*return false;/.test(hydration), 'manual state refresh must report hydration success/failure');

console.log(JSON.stringify({ pass:'v611-deployment-probe-contract-pass' }));
