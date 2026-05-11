#!/usr/bin/env node
const assert = require('assert');
const { RELEASE_ARCHIVE_BACKUP_PASS, FORBIDDEN, buildTarExcludeArgs } = require('../package_release_archive_backup');
assert.strictEqual(RELEASE_ARCHIVE_BACKUP_PASS, 'v411-release-archive-backup-pass');
for (const item of ['node_modules', 'data', 'sync_data.json', 'sync_data.json.bak', 'test_novels', '.npm-cache']) {
  assert.ok(FORBIDDEN.includes(item), `forbidden entry missing: ${item}`);
}
const args = buildTarExcludeArgs();
assert.ok(args.includes('--exclude=node_modules') && args.includes('--exclude=*/node_modules'), 'tar exclude args incomplete');
console.log('v411-release-archive-backup-smoke-pass');
