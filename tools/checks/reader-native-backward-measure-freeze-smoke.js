const fs = require('fs');
const assert = require('assert');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
assert.ok(layout.includes("v485-reader-native-backward-measure-freeze-pass"), 'native backward measure freeze marker missing');
assert.ok(layout.includes('function resolveNativeBackwardMeasureCommitFreeze'), 'backward measure freeze helper missing');
assert.ok(layout.includes('resolveRecentBackwardScrollBufferPrepend'), 'recent backward prepend detector missing');
assert.ok(layout.includes('nativeBackwardMeasureFreeze.freeze'), 'measure commit must use backward freeze gate');
assert.ok(layout.includes('READER_NATIVE_BACKWARD_MEASURE_FREEZE_PASS'), 'backward freeze pass must be recorded');
console.log('v485-reader-native-backward-measure-freeze-smoke-pass');
