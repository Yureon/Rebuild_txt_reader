const fs = require('fs');
const assert = require('assert');

const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const coords = fs.readFileSync('public/scripts/rebuild/features/reader/coordinates.mjs', 'utf8');

assert.ok(coords.includes("v482-reader-manifest-block-char-ranges-pass"), 'client block char range marker missing');
assert.ok(coords.includes('export function chunkCharToFileChar'), 'chunkCharToFileChar helper missing');
assert.ok(coords.includes('export function fileCharToChunkAddress'), 'fileCharToChunkAddress helper missing');
assert.ok(coords.includes('manifestBlockCharRangesPass'), 'rows must carry manifest block char range pass');
assert.ok(layout.includes("v482-reader-append-file-char-anchor-pass"), 'append file char anchor marker missing');
assert.ok(layout.includes('function enrichAppendAnchorWithFileChar'), 'append capture must enrich anchor with file char');
assert.ok(layout.includes('function applyAppendFileCharAnchor'), 'append restore must apply file char anchor');
assert.ok(layout.includes('fileCharToChunkAddress(app, anchor.fileCharIndex)'), 'append restore must resolve file char to chunk address');
const restoreStart = layout.indexOf('function restoreAppendRebuildAnchor');
const restoreEnd = layout.indexOf('function scheduleAppendRebuildAnchorRecheck', restoreStart);
const restoreBody = layout.slice(restoreStart, restoreEnd);
assert.ok(restoreStart >= 0, 'restoreAppendRebuildAnchor missing');
assert.ok(restoreEnd > restoreStart, 'restoreAppendRebuildAnchor boundary missing');
assert.ok(restoreBody.indexOf('applyAppendFileCharAnchor(app, v, reader, anchor') < restoreBody.indexOf('applyVirtualScrollAnchorWithInertiaGuard(app, v, reader, anchor'), 'file char anchor must run before row/prefix fallback inside append restore');

console.log('v482-reader-append-file-char-anchor-smoke-pass');
