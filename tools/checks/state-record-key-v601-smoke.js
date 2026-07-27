#!/usr/bin/env node
const assert = require('assert');
const { sanitizeNovelUserTags } = require('../../server/services/state-normalizer-lists');
const { normalizeProgressStateInput } = require('../../server/services/state-normalizer-progress');
const { normalizeSyncMetaInput } = require('../../server/services/state-normalizer-sync-meta');
const { normalizeUserState, mergeSharedState, mergeDeviceState } = require('../../server/services/state-normalizer');
const { normalizeViewerPrefs, sanitizeThemeBucket } = require('../../server/services/state-normalizer-theme');

function parsed(text) { return JSON.parse(text); }
function assertCleanRecord(value, label) {
  assert.strictEqual(Object.getPrototypeOf(value), Object.prototype, `${label} prototype must remain Object.prototype`);
  for (const key of ['__proto__', 'prototype', 'constructor']) {
    assert.strictEqual(Object.prototype.hasOwnProperty.call(value, key), false, `${label} must reject ${key}`);
  }
}

const novelTags = sanitizeNovelUserTags(parsed('{"__proto__":["x"],"prototype":["x"],"constructor":["x"],"novel-ok":["x"]}'), ['x']);
assert.deepStrictEqual(Object.keys(novelTags), ['novel-ok']);
assertCleanRecord(novelTags, 'novelUserTags');

const progress = normalizeProgressStateInput({
  byNovel: parsed('{"__proto__":{"novelId":"__proto__","chunk":1},"novel-ok":{"novelId":"novel-ok","chunk":2}}'),
  readMeta: parsed('{"constructor":{"novelId":"constructor","chunk":1},"novel-ok-single":{"novelId":"novel-ok","chunk":2}}')
});
assert.deepStrictEqual(Object.keys(progress.byNovel), ['novel-ok']);
assert.deepStrictEqual(Object.keys(progress.readMeta).sort(), ['constructor-single', 'novel-ok-ok-single']);
assertCleanRecord(progress.byNovel, 'progress.byNovel');
assertCleanRecord(progress.readMeta, 'progress.readMeta');

const syncMeta = normalizeSyncMetaInput({
  deviceUpdatedAt: parsed('{"__proto__":1,"constructor":2,"device-ok":3}'),
  deviceVersions: parsed('{"prototype":1,"device-ok":4}')
});
assert.deepStrictEqual(syncMeta.deviceUpdatedAt, { 'device-ok': 3 });
assert.deepStrictEqual(syncMeta.deviceVersions, { 'device-ok': 4 });
assertCleanRecord(syncMeta.deviceUpdatedAt, 'syncMeta.deviceUpdatedAt');
assertCleanRecord(syncMeta.deviceVersions, 'syncMeta.deviceVersions');

const normalized = normalizeUserState(parsed('{"legacy":{"__proto__":{"polluted":true},"constructor":1,"ok":2},"deviceProfiles":{"__proto__":{"prefs":{}},"device-ok":{"prefs":{}}},"shared":{"userTags":["x"],"novelUserTags":{"__proto__":["x"],"novel-ok":["x"]}}}'));
assert.deepStrictEqual(normalized.legacy, { ok: 2 });
assert.deepStrictEqual(Object.keys(normalized.deviceProfiles), ['device-ok']);
assert.deepStrictEqual(normalized.shared.novelUserTags, { 'novel-ok': ['x'] });
assertCleanRecord(normalized.legacy, 'legacy');
assertCleanRecord(normalized.deviceProfiles, 'deviceProfiles');

const mergedShared = mergeSharedState({}, parsed('{"__proto__":{"polluted":true},"favorites":[]}'));
const mergedDevice = mergeDeviceState({}, parsed('{"__proto__":{"polluted":true},"prefs":{}}'));
assertCleanRecord(mergedShared, 'merged shared');
assertCleanRecord(mergedDevice, 'merged device');

const viewerPrefs = normalizeViewerPrefs({ siteCustomLanguages:[{ id:'x', map:parsed('{"__proto__":"bad","constructor":"bad","hello":"안녕"}') }] });
assert.deepStrictEqual(viewerPrefs.siteCustomLanguages[0].map, { hello:'안녕' });
const theme = sanitizeThemeBucket({ activeThemeId:'default', themes:parsed('{"__proto__":{"--x":"bad"},"constructor":{"--x":"bad"},"safe":{"--x":"ok"}}') });
assert.deepStrictEqual(Object.keys(theme.themes), ['safe']);
assert.strictEqual(({}).polluted, undefined);

console.log(JSON.stringify({ pass:'v601-state-record-key-smoke-pass' }));
