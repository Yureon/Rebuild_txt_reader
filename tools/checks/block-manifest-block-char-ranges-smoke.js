const fs = require('fs');
const assert = require('assert');

const service = fs.readFileSync('server/services/block-manifest-service.js', 'utf8');

assert.ok(service.includes("v482-block-manifest-block-char-ranges-pass"), 'server block char range marker missing');
const episodeSchema = Number(service.match(/const EPISODE_MANIFEST_DISK_SCHEMA = (\d+)/)?.[1]);
const folderSchema = Number(service.match(/const FOLDER_MANIFEST_DISK_SCHEMA = (\d+)/)?.[1]);
assert.ok(episodeSchema >= 3, 'episode manifest disk schema must include the block-range migration');
assert.ok(folderSchema >= 3, 'folder manifest disk schema must include the block-range migration');
assert.ok(service.includes('localCharStart') && service.includes('localCharEnd'), 'manifest chunks must include local block char ranges');
assert.ok(service.includes('charStart: chunkCharStart +') && service.includes('charEnd: chunkCharStart +'), 'manifest block ranges must include file char ranges');
assert.ok(service.includes('folderCharStart') && service.includes('folderCharEnd'), 'folder manifest must preserve folder char ranges for episode chunks');

console.log('v482-block-manifest-block-char-ranges-smoke-pass');
