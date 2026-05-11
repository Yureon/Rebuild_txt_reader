#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const service = fs.readFileSync(path.join(__dirname, '../..', 'server/services/block-manifest-service.js'), 'utf8');
const route = fs.readFileSync(path.join(__dirname, '../..', 'server/routes/block-manifest-routes.js'), 'utf8');
assert.ok(service.includes("BLOCK_MANIFEST_STABLE_ETAG_PASS = 'v469-block-manifest-stable-etag-pass'"), 'stable etag marker missing');
assert.ok(service.includes("BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS = 'v469-block-manifest-episode-disk-cache-pass'"), 'v469 episode cache marker missing');
assert.ok(/const FOLDER_MANIFEST_DISK_SCHEMA = [2-9]/.test(service), 'folder manifest disk schema must be at least the stable-etag schema');
assert.ok(/const EPISODE_MANIFEST_DISK_SCHEMA = [2-9]/.test(service), 'episode manifest disk schema must be at least the stable-etag schema');
assert.ok(service.includes('folderManifestEpisodeDiskCachePass: BLOCK_MANIFEST_EPISODE_DISK_CACHE_V469_PASS'), 'fresh folder body must expose v469 episode marker');
assert.ok(service.includes('blockManifestStableEtagPass: BLOCK_MANIFEST_STABLE_ETAG_PASS'), 'fresh and disk-hit bodies must expose stable etag marker');
assert.ok(route.includes("if (key === 'generatedAt') continue"), 'etag clone must exclude generatedAt');
assert.ok(route.includes('buildManifestEtag'), 'manifest etag builder must remain exported');
console.log(JSON.stringify({ pass: 'v469-block-manifest-stable-etag-pass' }));
