#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { performance } = require('perf_hooks');
const {
  DISK_CACHE_BOUNDED_CANDIDATE_PASS,
  comparePruneCandidates,
  createBoundedCandidateHeap
} = require('../../server/services/disk-cache-janitor-service');

const PASS = 'v673-disk-cache-bounded-candidate-smoke-pass';
const fixtureFiles = 100000;
const limit = 5000;
const fixture = [];
for (let index = 0; index < fixtureFiles; index += 1) {
  fixture.push({
    path:`/cache/${String(index).padStart(6,'0')}${index % 997 === 0 ? '.tmp' : '.bin'}`,
    mtimeMs:(index * 2654435761) % 100000000,
    size:1024 + (index % 8192),
    tmp:index % 997 === 0
  });
}
const expected = fixture.slice().sort(comparePruneCandidates).slice(0, limit).map(item => item.path);
const heap = createBoundedCandidateHeap(limit);
const startedAt = performance.now();
for (const candidate of fixture) heap.add(candidate);
const selected = heap.values();
const elapsedMs = performance.now() - startedAt;
assert.strictEqual(DISK_CACHE_BOUNDED_CANDIDATE_PASS, 'v673-disk-cache-bounded-candidate-pass');
assert.strictEqual(selected.length, limit);
assert.strictEqual(selected.eligibleCount, fixtureFiles);
assert.deepStrictEqual(selected.map(item => item.path), expected, 'bounded heap must retain the same deletion order as a full sort');
assert(selected.slice(0, Math.ceil(fixtureFiles / 997)).every(item => item.tmp), 'temporary files must remain first in prune priority');
console.log(JSON.stringify({
  pass:PASS,
  fixtureFiles,
  retainedCandidates:selected.length,
  retentionRatio:Number((selected.length / fixtureFiles).toFixed(4)),
  referenceReductionRatio:Number((fixtureFiles / selected.length).toFixed(1)),
  elapsedMs:Number(elapsedMs.toFixed(2))
}));
