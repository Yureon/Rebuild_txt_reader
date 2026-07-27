#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSyncStateService } = require('../../server/services/sync-state-service');

const PASS = 'v591-sync-state-data-path-smoke-pass';
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-sync-path-v591-'));
const dataDir = path.join(root, 'data');
const legacyPath = path.join(root, 'sync_data.json');
const syncPath = path.join(dataDir, 'sync_data.json');
const snapshotDir = path.join(dataDir, 'snapshots');
const legacyState = { schemaVersion: 1, marker: 'legacy-state', bookmarks: [] };
fs.writeFileSync(legacyPath, JSON.stringify(legacyState), 'utf8');

(async () => {
  const service = createSyncStateService({
    syncPath,
    legacySyncPath: legacyPath,
    snapshotDir,
    snapshotPrefix: 'sync-state',
    createEmptyState: () => ({ schemaVersion: 1, marker: 'empty' }),
    normalizeState: value => ({ ...value }),
    logger: { error() {} }
  });
  assert.strictEqual(service.get().marker, 'legacy-state', 'legacy root state must remain readable during migration');
  const before = service.getPersistenceStatus();
  assert.strictEqual(before.loadedFromLegacy, true);
  assert.ok(String(before.loadedFrom).startsWith('legacy-'));
  assert.strictEqual(path.resolve(before.migrationTarget), path.resolve(syncPath));
  const closed = await service.close();
  assert.strictEqual(closed, true, 'migration write must finish during close');
  const migrated = JSON.parse(fs.readFileSync(syncPath, 'utf8'));
  assert.strictEqual(migrated.marker, 'legacy-state');
  assert.ok(fs.existsSync(legacyPath), 'legacy source must not be destructively deleted');

  const pathsSource = fs.readFileSync(path.resolve(__dirname, '../../server/config/paths.js'), 'utf8');
  assert.ok(pathsSource.includes("const SYNC_DATA_PATH = path.join(DATA_DIR, 'sync_data.json')"), 'active sync state must live inside DATA_DIR');
  assert.ok(pathsSource.includes("const LEGACY_SYNC_DATA_PATH = path.join(ROOT_DIR, 'sync_data.json')"), 'legacy root path must remain explicit for migration');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../server/app.js'), 'utf8');
  assert.ok(appSource.includes('legacySyncPath: paths.LEGACY_SYNC_DATA_PATH'));
  console.log(JSON.stringify({ pass: PASS, migratedTo: path.relative(root, syncPath) }));
})().finally(() => {
  fs.rmSync(root, { recursive: true, force: true });
}).catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
