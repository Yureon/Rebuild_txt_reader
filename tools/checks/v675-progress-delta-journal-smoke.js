#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const stateNormalizer = require('../../server/services/state-normalizer');
const { createSyncStateService } = require('../../server/services/sync-state-service');
const { createStateWriteService } = require('../../server/services/state-write-service');
const { createSyncPolicyService } = require('../../server/services/sync-policy-service');
const { atomicWriteJson } = require('../../server/repositories/json-file-store');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v675-progress-'));
  const syncPath = path.join(dir, 'state.json');
  const snapshotDir = path.join(dir, 'snapshots');
  let normalizeCalls = 0;
  let fullWrites = 0;
  const normalizer = {
    ...stateNormalizer,
    normalizeUserState(value, options) { normalizeCalls += 1; return stateNormalizer.normalizeUserState(value, options); }
  };
  const service = createSyncStateService({
    syncPath, snapshotDir,
    createEmptyState:normalizer.createEmptyUserState,
    normalizeState:normalizer.normalizeUserState,
    applyProgressJournalEntry:normalizer.applyProgressJournalEntry,
    progressJournalCompactEntries:1000,
    writeJson(file, value, callback) { fullWrites += 1; return atomicWriteJson(file, value, callback); }
  });
  const writer = createStateWriteService({ syncStateService:service, normalizer, syncPolicyService:createSyncPolicyService({ normalizer }) });
  const initialNormalizeCalls = normalizeCalls;
  for (let index = 1; index <= 25; index += 1) {
    const result = await writer.saveProgressDeltaAsync({
      snapshot:{ novelId:'novel-journal', episodeId:'ep-1', chunk:index, totalChunks:100, ratio:index / 100, ts:1700000000000 + index, sourceDeviceId:'device-12345678' },
      updatedAt:1700000000000 + index,
      syncVersion:index
    }, 'novel-journal');
    assert.equal(result.persistence, 'progress-journal');
    assert.equal(result.persisted, true);
  }
  assert.equal(normalizeCalls, initialNormalizeCalls, 'hot progress deltas must not re-normalize the whole user state');
  assert.equal(fullWrites, 0, 'sub-threshold progress deltas must not rewrite the full state JSON');
  const journalPath = `${syncPath}.progress.ndjson`;
  const lines = fs.readFileSync(journalPath, 'utf8').trim().split(/\r?\n/);
  assert.equal(lines.length, 25);
  assert.equal(service.get().shared.progress.byNovel['novel-journal'].chunk, 25);

  await service.close();
  assert(fullWrites >= 1, 'close must compact the journal into the full state');
  assert.equal(fs.readFileSync(journalPath, 'utf8'), '', 'journal must be truncated after compaction');

  // Crash-replay simulation: append a durable delta without closing, then create a fresh service.
  const crashPath = path.join(dir, 'crash-state.json');
  const first = createSyncStateService({ syncPath:crashPath, snapshotDir:path.join(dir, 'crash-snapshots'), createEmptyState:stateNormalizer.createEmptyUserState, normalizeState:stateNormalizer.normalizeUserState, applyProgressJournalEntry:stateNormalizer.applyProgressJournalEntry, progressJournalCompactEntries:1000 });
  const firstWriter = createStateWriteService({ syncStateService:first, normalizer:stateNormalizer, syncPolicyService:createSyncPolicyService({ normalizer:stateNormalizer }) });
  await firstWriter.saveProgressDeltaAsync({ snapshot:{ novelId:'replay-novel', chunk:7, totalChunks:10, ratio:0.7, ts:1700000001000 }, updatedAt:1700000001000, syncVersion:1 }, 'replay-novel');
  const replayed = createSyncStateService({ syncPath:crashPath, snapshotDir:path.join(dir, 'crash-snapshots-2'), createEmptyState:stateNormalizer.createEmptyUserState, normalizeState:stateNormalizer.normalizeUserState, applyProgressJournalEntry:stateNormalizer.applyProgressJournalEntry, progressJournalCompactEntries:1000 });
  assert.equal(replayed.get().shared.progress.byNovel['replay-novel'].chunk, 7, 'journal replay must recover a committed delta');
  await replayed.close();
  await first.close();
  fs.rmSync(dir, { recursive:true, force:true });
  console.log(JSON.stringify({ pass:'v675-progress-delta-journal-smoke-pass', deltas:25, hotNormalizeCalls:normalizeCalls - initialNormalizeCalls, fullWritesBeforeClose:0, replayRecovered:true }));
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
