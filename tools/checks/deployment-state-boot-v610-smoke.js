#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { normalizeViewerPrefs } = require('../../server/services/state-normalizer-theme');

const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const entrypoint = read('docker-entrypoint.sh');
assert.ok(entrypoint.includes('DATA_DIR="${TXT_READER_DATA_DIR:-${DATA_DIR:-/app/data}}"'), 'entrypoint data-dir precedence changed');
assert.ok(entrypoint.includes('export TXT_READER_DATA_DIR="$DATA_DIR"'), 'entrypoint must pass its checked path to Node');
assert.ok(read('Dockerfile').includes('TXT_READER_DATA_DIR=/app/data'), 'image data-dir default missing');
assert.ok(read('docker-compose.yml').includes('TXT_READER_DATA_DIR=${TXT_READER_DATA_DIR:-/app/data}'), 'compose data-dir wiring missing');

const normalized = normalizeViewerPrefs({ readerEpisodeBoundaryMode:'scrollBeyond', unknownRuntimeKey:true });
assert.strictEqual(normalized.readerEpisodeBoundaryMode, 'scrollBeyond');
assert.strictEqual(normalized.unknownRuntimeKey, undefined);
const syncSource = read('public/scripts/rebuild/features/sync/periodic-device-sync.mjs');
const statePushSource = read('public/scripts/rebuild/features/sync/periodic-state-push.mjs');
assert.ok(statePushSource.includes('putDevicePatch(app, envelope.device)'));
assert.ok(statePushSource.includes('putSharedPatch(app, envelope.shared)'));
assert.ok(statePushSource.includes('viewerPrefs:sharedPrefs'));
assert.ok(statePushSource.includes('prefs:devicePrefs'));
assert.ok(syncSource.includes("import('./periodic-state-push.mjs')"));
assert.ok(syncSource.includes("reason:'server-state-not-hydrated'"));
assert.ok(read('public/scripts/rebuild/features/sync/server-state-hydration.mjs').includes('app.state.serverStateHydrated = true;'));

const stateSource = read('public/scripts/rebuild/state/app-state.mjs');
assert.strictEqual((stateSource.match(/readerEpisodeBoundaryOpening:\s*false/g) || []).length, 1, 'runtime opening lock must not also live in persisted prefs');
assert.strictEqual((stateSource.match(/readerEpisodeBoundaryCooldownUntil:\s*0/g) || []).length, 1, 'runtime cooldown must not also live in persisted prefs');
assert.ok(stateSource.includes('delete next.readerEpisodeBoundaryOpening;'));

const mainSource = read('public/scripts/rebuild/main.mjs');
assert.ok(mainSource.includes('if (activeBootPromise) return activeBootPromise;'));
assert.ok(mainSource.includes("window.__TXT_READER_REBUILD_BOOT_STARTED__ = false;"));
assert.ok(mainSource.includes('cleanupFailedBoot(window.TxtReaderRebuild);'));
const recoverySource = read('public/scripts/rebuild/core/boot-recovery.mjs');
assert.ok(recoverySource.includes("'libraryCleanup'"));
assert.ok(recoverySource.includes("'uiCleanup'"));

console.log(JSON.stringify({ pass:'v610-deployment-state-boot-contract-pass' }));
