const fs = require('fs');
const assert = require('assert');

const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const coords = fs.readFileSync('public/scripts/rebuild/features/reader/coordinates.mjs', 'utf8');
const progress = fs.readFileSync('public/scripts/rebuild/features/reader/progress.mjs', 'utf8');

assert.ok(layout.includes("v484-reader-file-char-viewport-progress-pass"), 'file char viewport progress marker missing');
assert.ok(layout.includes('function resolveViewportFileCharProgress'), 'file char viewport progress resolver missing');
assert.ok(coords.includes('export function fileCharToDocumentRatio'), 'fileCharToDocumentRatio helper missing');
assert.ok(layout.includes('fileCharToDocumentRatio(app, fileCharIndex)'), 'viewport progress must convert file char to document ratio');
assert.ok(layout.includes('fileCharProgress?.documentRatio') && layout.includes('fileCharProgress?.chunkRatio'), 'getViewportAddress must prefer file char document/chunk ratios');
assert.ok(layout.includes('fileCharIndex: Number.isFinite(Number(fileCharProgress?.fileCharIndex))'), 'address must expose fileCharIndex');
assert.ok(progress.includes('fileCharIndex: Number.isFinite(Number(displayAddress.fileCharIndex))'), 'snapshot must persist the terminal-synchronized fileCharIndex for diagnostics/resume analysis');
const start = layout.indexOf('export function getViewportAddress');
const end = layout.indexOf('export function getChunkViewportState', start);
const body = layout.slice(start, end);
assert.ok(body.indexOf('resolveViewportFileCharProgress') < body.indexOf('chunkStateToDocumentRatio(app, chunk, stableChunkRatio)'), 'file char progress must be attempted before chunk-state manifest fallback');

console.log('v484-reader-file-char-viewport-progress-smoke-pass');
