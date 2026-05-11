#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PASS = 'v447-reader-buffer-append-current-chunk-retain-smoke-pass';
const MARKER = 'v447-reader-buffer-append-current-chunk-retain-pass';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const sourcePath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs');
const diagPath = path.resolve(__dirname, '../../public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs');
const source = fs.readFileSync(sourcePath, 'utf8');
const diag = fs.readFileSync(diagPath, 'utf8');

assert(source.includes(MARKER), 'buffer append current chunk retain marker missing');
assert(source.includes("mode === 'replace' || mode === 'jump'"), 'current chunk should only move for replace/jump commits');
assert(source.includes('!app.state.loadedChunks?.size'), 'initial empty load may still set current chunk');
assert(source.includes('else current.chunk = previousChunk'), 'append/prepend buffer commits must retain previous current chunk');
assert(source.includes('recordBufferAppendCurrentChunkRetain'), 'buffer append retain diagnostics recorder missing');
assert(diag.includes('bufferAppendCurrentChunkRetainPass'), 'virtual diagnostics must expose buffer append retain marker');

console.log(JSON.stringify({ pass: PASS, marker: MARKER }));
