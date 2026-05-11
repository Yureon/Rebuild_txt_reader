const fs = require('fs');
const assert = require('assert');

const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

const forwardStart = virtual.indexOf('function resolveNativeForwardMeasureCommitFreeze');
const forwardEnd = virtual.indexOf('function recordNativeBackwardMeasureFreeze', forwardStart);
const forwardBody = virtual.slice(forwardStart, forwardEnd);
const backwardStart = virtual.indexOf('function resolveNativeBackwardMeasureCommitFreeze');
const backwardEnd = virtual.indexOf('function recordNativeBackwardMeasureFreeze', backwardStart + 1);
const backwardBody = virtual.slice(backwardStart, backwardEnd > backwardStart ? backwardEnd : virtual.indexOf('function', backwardStart + 20));

assert.ok(forwardBody.includes('const multiFile = isMultiFileReader(app)'), 'forward measure freeze must compute multi-file mode');
assert.ok(forwardBody.includes('multiFile &&'), 'forward measure freeze must require multi-file mode');
assert.ok(forwardBody.includes('single-file reader keeps existing measure anchor behavior'), 'forward measure freeze must explain single-file bypass');
assert.ok(backwardBody.includes('const multiFile = isMultiFileReader(app)'), 'backward measure freeze must compute multi-file mode');
assert.ok(backwardBody.includes('multiFile &&'), 'backward measure freeze must require multi-file mode');
assert.ok(backwardBody.includes('single-file reader keeps existing measure anchor behavior'), 'backward measure freeze must explain single-file bypass');

console.log('v487-reader-single-file-guard-scope-smoke-pass');
