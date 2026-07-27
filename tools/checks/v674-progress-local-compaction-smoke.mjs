#!/usr/bin/env node
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import {
  compactProgressForLocalStorage,
  chooseLocalProgressPayload,
  primeLocalProgressFallback,
  PROGRESS_BOUNDED_LOCAL_COMPACTION_PASS,
  PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS
} from '../../public/scripts/rebuild/core/progress-storage.mjs';

function positionKeys(snapshot) {
  if (!snapshot?.novelId) return [];
  const episodeId = snapshot.episodeId || 'single';
  const keys = [`pos-${snapshot.novelId}-${episodeId}`];
  if (Number.isFinite(Number(snapshot.chunk))) {
    keys.push(`pos-${snapshot.novelId}-${episodeId}-${Math.max(1, Math.floor(Number(snapshot.chunk)))}`);
  }
  return keys;
}

function legacyNewestEntries(record, limit) {
  return Object.entries(record)
    .sort((left, right) => (Number(right[1]?.ts) || 0) - (Number(left[1]?.ts) || 0))
    .slice(0, limit);
}

function legacySelection(source, limits) {
  const byNovel = legacyNewestEntries(source.byNovel, limits.byNovel);
  const readMeta = legacyNewestEntries(source.readMeta, limits.readMeta);
  const retained = new Set(positionKeys(source.lastRead));
  for (const [, snapshot] of byNovel) positionKeys(snapshot).forEach(key => retained.add(key));
  for (const [, snapshot] of readMeta) positionKeys(snapshot).forEach(key => retained.add(key));
  const positions = Object.entries(source.positions)
    .sort((left, right) => {
      const leftRetained = retained.has(left[0]) ? 1 : 0;
      const rightRetained = retained.has(right[0]) ? 1 : 0;
      if (leftRetained !== rightRetained) return rightRetained - leftRetained;
      return (Number(right[1]?.ts) || 0) - (Number(left[1]?.ts) || 0);
    })
    .slice(0, limits.positions);
  return {
    byNovel:byNovel.map(entry => entry[0]),
    readMeta:readMeta.map(entry => entry[0]),
    positions:positions.map(entry => entry[0])
  };
}

function legacyFullFallback(source, limits = { byNovel:300, readMeta:800, positions:1400 }) {
  const full = JSON.stringify(source);
  if (Buffer.byteLength(full) <= 512 * 1024) return full;
  const byNovel = legacyNewestEntries(source.byNovel, limits.byNovel);
  const readMeta = legacyNewestEntries(source.readMeta, limits.readMeta);
  const retained = new Set(positionKeys(source.lastRead));
  for (const [, snapshot] of byNovel) positionKeys(snapshot).forEach(key => retained.add(key));
  for (const [, snapshot] of readMeta) positionKeys(snapshot).forEach(key => retained.add(key));
  const positions = Object.entries(source.positions)
    .sort((left, right) => {
      const leftRetained = retained.has(left[0]) ? 1 : 0;
      const rightRetained = retained.has(right[0]) ? 1 : 0;
      if (leftRetained !== rightRetained) return rightRetained - leftRetained;
      return (Number(right[1]?.ts) || 0) - (Number(left[1]?.ts) || 0);
    })
    .slice(0, limits.positions);
  return JSON.stringify({
    lastRead:source.lastRead,
    byNovel:Object.fromEntries(byNovel),
    readMeta:Object.fromEntries(readMeta),
    positions:Object.fromEntries(positions)
  });
}

for (let round = 0; round < 20; round += 1) {
  const byNovel = {};
  const readMeta = {};
  const positions = {};
  for (let index = 0; index < 2_000; index += 1) {
    const timestamp = (index * 37 + round * 13) % 211;
    const snapshot = { novelId:`novel-${index}`, episodeId:null, chunk:(index % 11) + 1, ts:timestamp };
    byNovel[snapshot.novelId] = snapshot;
    readMeta[`read-${index}`] = { ...snapshot, novelId:`read-${index}` };
    positions[`pos-novel-${index}-single`] = { ratio:(index % 100) / 100, ts:(index * 19) % 307 };
    positions[`free-${index}`] = { ratio:(index % 80) / 80, ts:(index * 23) % 313 };
  }
  const source = {
    lastRead:{ novelId:'novel-1999', episodeId:null, chunk:4, ts:9_999 },
    byNovel,
    readMeta,
    positions
  };
  const limits = { byNovel:73, readMeta:91, positions:137 };
  const expected = legacySelection(source, limits);
  const actual = compactProgressForLocalStorage(source, limits);
  assert.deepEqual(Object.keys(actual.byNovel), expected.byNovel);
  assert.deepEqual(Object.keys(actual.readMeta), expected.readMeta);
  assert.deepEqual(Object.keys(actual.positions), expected.positions);
  assert.equal(actual.persistence.selectionPass, PROGRESS_BOUNDED_LOCAL_COMPACTION_PASS);
  assert.equal(actual.persistence.selectionAlgorithm, 'bounded-quickselect');
}

const positions = {};
for (let index = 0; index < 80_000; index += 1) {
  positions[`pos-novel-${index}-single`] = { ratio:(index % 100) / 100, ts:index + 1 };
}
const byNovel = {};
const readMeta = {};
for (let index = 0; index < 10_000; index += 1) {
  const snapshot = {
    novelId:`novel-${index}`,
    episodeId:null,
    chunk:1,
    ratio:0.5,
    ts:index + 1
  };
  byNovel[snapshot.novelId] = snapshot;
  readMeta[snapshot.novelId] = snapshot;
}
const fixture = {
  lastRead:{ novelId:'novel-9999', episodeId:null, chunk:1, ts:10_001 },
  byNovel,
  readMeta,
  positions
};
const rssBefore = process.memoryUsage().rss;
const legacySamples = [];
for (let run = 0; run < 4; run += 1) {
  const startedAt = performance.now();
  const serialized = legacyFullFallback(fixture);
  const elapsedMs = performance.now() - startedAt;
  assert(serialized.length > 0);
  if (run > 0) legacySamples.push(elapsedMs);
}

const initialLocal = compactProgressForLocalStorage(fixture);
primeLocalProgressFallback(initialLocal);
let fullCollectionScans = 0;
const scanGuard = record => new Proxy(record, {
  ownKeys(target) {
    fullCollectionScans += 1;
    return Reflect.ownKeys(target);
  }
});
const guardedFixture = {
  ...fixture,
  byNovel:scanGuard(fixture.byNovel),
  readMeta:scanGuard(fixture.readMeta),
  positions:scanGuard(fixture.positions)
};
const samples = [];
let selected = null;
for (let run = 0; run < 21; run += 1) {
  const recentSnapshot = {
    novelId:'novel-9999',
    episodeId:null,
    chunk:1,
    ratio:0.5,
    documentRatio:0.5,
    globalBlockIndex:run,
    ts:20_000 + run
  };
  const startedAt = performance.now();
  selected = chooseLocalProgressPayload(guardedFixture, { recentSnapshot });
  const elapsedMs = performance.now() - startedAt;
  if (run > 0) samples.push(elapsedMs);
}
const summarize = values => {
  const sorted = values.slice().sort((left, right) => left - right);
  return {
    averageMs:sorted.reduce((sum, value) => sum + value, 0) / sorted.length,
    p95Ms:sorted[Math.ceil(sorted.length * 0.95) - 1],
    maxMs:sorted[sorted.length - 1]
  };
};
const before = summarize(legacySamples);
const after = summarize(samples);
assert.equal(selected.compacted, true);
assert(selected.bytes <= 512 * 1024);
assert.equal(selected.pass, PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS);
assert.equal(selected.payload.lastRead.globalBlockIndex, 20);
assert.equal(fullCollectionScans, 0, 'ordinary Reader saves must not enumerate the full resident progress maps');
assert(after.averageMs < before.averageMs, 'incremental local fallback must be faster than the legacy full-sort path');
const otherScope = chooseLocalProgressPayload(guardedFixture, {
  scope:'reader-b',
  recentSnapshot:{ novelId:'reader-b-novel', episodeId:null, chunk:2, ratio:0.25, ts:30_000 }
});
assert.equal(otherScope.payload.lastRead.novelId, 'reader-b-novel');
assert.equal(otherScope.payload.byNovel['novel-9999'], undefined, 'incremental fallback cache must not cross user scopes');

console.log(JSON.stringify({
  pass:'v674-progress-local-compaction-smoke-pass',
  selectionPass:PROGRESS_INCREMENTAL_LOCAL_FALLBACK_PASS,
  initialSelectionPass:PROGRESS_BOUNDED_LOCAL_COMPACTION_PASS,
  fixture:{ positions:80_000, byNovel:10_000, readMeta:10_000 },
  equivalenceRounds:20,
  before:{
    algorithm:'v673-full-sort-local-fallback',
    runs:legacySamples.length,
    warmupRuns:1,
    averageMs:Number(before.averageMs.toFixed(2)),
    p95Ms:Number(before.p95Ms.toFixed(2)),
    maxMs:Number(before.maxMs.toFixed(2))
  },
  after:{
    algorithm:'v674-incremental-bounded-snapshot',
    runs:samples.length,
    warmupRuns:1,
    averageMs:Number(after.averageMs.toFixed(2)),
    p95Ms:Number(after.p95Ms.toFixed(2)),
    maxMs:Number(after.maxMs.toFixed(2))
  },
  improvementRatio:Number((before.averageMs / Math.max(after.averageMs, 0.001)).toFixed(1)),
  fullCollectionScans,
  userScopeIsolation:true,
  outputBytes:selected.bytes,
  rssDeltaBytes:process.memoryUsage().rss - rssBefore,
  synthetic:true,
  externalNetwork:false,
  browserRendering:false
}));
