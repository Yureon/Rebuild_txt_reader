#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  applyProgressImport,
  normalizeProgressMerge,
  setProgressSnapshot
} from '../../public/scripts/rebuild/features/bookmarks/read-data-import-progress-merge.mjs';

function parsed(text) {
  return JSON.parse(text);
}

function assertCleanRecord(value, label) {
  assert.equal(Object.getPrototypeOf(value), Object.prototype, `${label} prototype must remain Object.prototype`);
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    assert.equal(Object.prototype.hasOwnProperty.call(value, key), false, `${label} must reject ${key}`);
  }
}

const malicious = parsed(`{
  "byNovel": {
    "__proto__": {"novelId":"__proto__","chunk":1},
    "prototype": {"novelId":"prototype","chunk":1},
    "constructor": {"novelId":"constructor","chunk":1},
    "novel-safe": {"novelId":"novel-safe","chunk":2,"updatedAt":2}
  },
  "positions": {
    "__proto__": {"polluted":true},
    "prototype": {"polluted":true},
    "constructor": {"polluted":true},
    "novel-safe": {"fileChar":42}
  },
  "readMeta": {
    "__proto__": {"polluted":true},
    "prototype": {"polluted":true},
    "constructor": {"polluted":true},
    "novel-safe-single": {"novelId":"novel-safe","chunk":2,"updatedAt":2}
  }
}`);

const normalized = normalizeProgressMerge({}, malicious);
assert.deepEqual(Object.keys(normalized.byNovel), ['novel-safe']);
assert.deepEqual(Object.keys(normalized.positions), ['novel-safe']);
assert.deepEqual(Object.keys(normalized.readMeta), ['novel-safe-single']);
assertCleanRecord(normalized.byNovel, 'progress.byNovel');
assertCleanRecord(normalized.positions, 'progress.positions');
assertCleanRecord(normalized.readMeta, 'progress.readMeta');

const imported = applyProgressImport({}, malicious, 'merge');
assert.equal(imported.byNovel['novel-safe']?.chunk, 2);
assert.equal(imported.positions['novel-safe']?.fileChar, 42);
assertCleanRecord(imported.byNovel, 'imported.byNovel');
assertCleanRecord(imported.positions, 'imported.positions');
assertCleanRecord(imported.readMeta, 'imported.readMeta');

const target = { byNovel: {}, positions: {}, readMeta: {} };
setProgressSnapshot(target, '__proto__::single', { novelId: '__proto__', chunk: 9 });
setProgressSnapshot(target, 'constructor::single', { novelId: 'constructor', chunk: 9 });
assert.deepEqual(target.byNovel, {});
assert.deepEqual(target.readMeta, {});
assert.equal(({}).polluted, undefined);

console.log(JSON.stringify({ pass: 'v601-read-data-record-key-smoke-pass' }));
