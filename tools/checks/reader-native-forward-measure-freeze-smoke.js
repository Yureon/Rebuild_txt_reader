const fs = require('fs');
const assert = require('assert');

const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(
  layout.includes("v483-reader-native-forward-measure-freeze-pass"),
  'native forward measure freeze marker missing'
);
assert.ok(
  layout.includes('function resolveNativeForwardMeasureCommitFreeze'),
  'native forward measure freeze resolver missing'
);
assert.ok(
  layout.includes('resolveNativeForwardMeasureCommitFreeze(app, v') &&
  layout.includes('nativeForwardMeasureFreeze.freeze'),
  'measure commit must consult native forward freeze gate'
);
assert.ok(
  layout.includes('freezePass: nativeForwardMeasureFreeze.freeze ? READER_NATIVE_FORWARD_MEASURE_FREEZE_PASS'),
  'measure commit suppression must record native forward freeze pass'
);
const commitStart = layout.indexOf('function commitVirtualMeasureUpdates');
const commitEnd = layout.indexOf('export function clearPendingSliderMeasureTarget', commitStart);
const commit = layout.slice(commitStart, commitEnd);
assert.ok(
  commit.indexOf('const nativeForwardMeasureFreeze') < commit.indexOf('const episodeBottomAnchor'),
  'native forward freeze must be known before episode bottom anchor capture'
);

console.log('v483-reader-native-forward-measure-freeze-smoke-pass');
