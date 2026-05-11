#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const layout = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout.mjs'), 'utf8');
const diagnostics = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles/app.css'), 'utf8');
const runner = fs.readFileSync(path.join(root, 'tools/run_smoke_tests.js'), 'utf8');

assert.ok(layout.includes("READER_ROW_MEASURED_MARGIN_HEIGHT_PASS = 'v519-reader-row-measured-margin-height-pass'"), 'v519 row measured margin marker missing');
assert.ok(layout.includes('function measureVirtualRowOuterHeight('), 'outer height measurement helper missing');
assert.ok(layout.includes('getBoundingClientRect?.().height'), 'row rect measurement must remain present');
assert.ok(layout.includes('getComputedStyle?.(el)'), 'row measurement must read computed style');
assert.ok(layout.includes('marginTop = readCssPx(style?.marginTop)'), 'row measurement must include margin-top');
assert.ok(layout.includes('marginBottom = readCssPx(style?.marginBottom)'), 'row measurement must include margin-bottom');
assert.ok(layout.includes('return Math.ceil(rectHeight + marginTop + marginBottom)'), 'measured virtual row height must include vertical margins');
assert.ok(layout.includes('const measured = measureVirtualRowOuterHeight(el)'), 'measure cache must use outer row height helper');
assert.ok(layout.includes('lastRowMeasuredMarginHeight'), 'measurement diagnostic must be recorded');
assert.ok(diagnostics.includes('rowMeasuredMarginHeightPass'), 'virtual diagnostics must expose row measured margin pass');
assert.ok(diagnostics.includes('lastRowMeasuredMarginHeight'), 'virtual diagnostics must expose last row measured margin diagnostic');
assert.ok(css.includes('.reader-vrow-body{padding:0;margin:0 0 .86em;}'), 'reader body row margin contract changed unexpectedly');
assert.ok(runner.includes('reader-row-measured-margin-height-smoke.js'), 'reader smoke runner must include v519 row measured margin smoke');

console.log('v519-reader-row-measured-margin-height-smoke-pass');
