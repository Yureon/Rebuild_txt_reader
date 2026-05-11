#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const layout = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout.mjs', 'utf8');
const diag = fs.readFileSync('public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs', 'utf8');
assert.ok(layout.includes('v481-reader-manifest-block-fallback-progress-pass'), 'manifest block fallback progress marker missing');
assert.ok(layout.includes('chunkStateToDocumentRatio(app, chunk, stableChunkRatio)'), 'manifest progress must use chunkStateToDocumentRatio for block-only manifests');
assert.ok(diag.includes('lastManifestBlockFallbackProgress'), 'diagnostics must expose manifest block fallback progress');
console.log('v481-reader-manifest-block-fallback-progress-smoke-pass');
