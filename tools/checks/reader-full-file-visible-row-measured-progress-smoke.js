const fs = require('fs');
const assert = require('assert');

const virtual = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');

assert.ok(virtual.includes('v476-reader-full-file-visible-row-measured-progress-pass'), 'visible row measured progress marker missing');
assert.ok(virtual.includes('function resolveRenderedBodyRowInfoAtAnchor'), 'rendered row progress helper missing');
assert.ok(virtual.includes("content.querySelectorAll?.('.reader-vrow-body[data-virtual-id]')"), 'progress helper must inspect rendered body row DOM nodes');

const viewportStart = virtual.indexOf('export function getViewportAddress');
const viewportEnd = virtual.indexOf('export function getChunkViewportState', viewportStart);
const viewportBody = virtual.slice(viewportStart, viewportEnd);
assert.ok(viewportBody.includes('resolveRenderedBodyRowInfoAtAnchor(app, coarseProgressRowInfo, v)'), 'getViewportAddress must use measured rendered row bounds before manifest char progress');

const stateStart = virtual.indexOf('export function getChunkViewportState');
const stateEnd = virtual.indexOf('function resolveVisibleBodyRowInfo', stateStart);
const stateBody = virtual.slice(stateStart, stateEnd);
assert.ok(stateBody.includes('resolveRenderedBodyRowInfoAtAnchor(app, coarseProgressRowInfo, v)'), 'getChunkViewportState must use measured rendered row bounds before chunk ratio progress');

console.log('v476-reader-full-file-visible-row-measured-progress-smoke-pass');
