#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../..', 'server/services/content-service.js'), 'utf8');
assert.ok(source.includes("CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS = 'v468-content-large-file-chunk-cache-hardening-pass'"), 'hardening marker missing');
assert.ok(source.includes('const CHUNK_PAYLOAD_CACHE_SCHEMA = 2'), 'chunk payload schema must be bumped');
assert.ok(source.includes('canonicalFilePath(filePath)'), 'chunk payload cache must use canonical file path');
assert.ok(source.includes('Number(st.dev)'), 'stat signature must include device id fallback');
assert.ok(source.includes('raw.hardeningPass !== CONTENT_LARGE_FILE_CHUNK_CACHE_HARDENING_PASS'), 'read path must validate hardening pass');
assert.ok(source.includes('Number(raw.chunkSize) !== CHUNK_SIZE'), 'read path must validate chunk size');
assert.ok(source.includes('Number(raw.chunkBoundaryLookahead) !== CHUNK_BOUNDARY_LOOKAHEAD'), 'read path must validate lookahead');
assert.ok(source.includes('raw.boundaryPass !== CONTENT_LARGE_TEXT_CHUNK_BOUNDARY_PASS'), 'read path must validate boundary schema marker');
console.log(JSON.stringify({ pass: 'v468-content-large-file-chunk-cache-hardening-pass' }));
