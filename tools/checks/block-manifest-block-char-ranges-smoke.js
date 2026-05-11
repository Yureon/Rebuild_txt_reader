const fs = require('fs');
const assert = require('assert');

const service = fs.readFileSync('server/services/block-manifest-service.js', 'utf8');

assert.ok(service.includes("v482-block-manifest-block-char-ranges-pass"), 'server block char range marker missing');
assert.ok(service.includes('const EPISODE_MANIFEST_DISK_SCHEMA = 3'), 'episode manifest disk schema must bump for block ranges');
assert.ok(service.includes('const FOLDER_MANIFEST_DISK_SCHEMA = 3'), 'folder manifest disk schema must bump for block ranges');
assert.ok(service.includes('localCharStart') && service.includes('localCharEnd'), 'manifest chunks must include local block char ranges');
assert.ok(service.includes('charStart: chunkCharStart +') && service.includes('charEnd: chunkCharStart +'), 'manifest block ranges must include file char ranges');
assert.ok(service.includes('folderCharStart') && service.includes('folderCharEnd'), 'folder manifest must preserve folder char ranges for episode chunks');

console.log('v482-block-manifest-block-char-ranges-smoke-pass');
