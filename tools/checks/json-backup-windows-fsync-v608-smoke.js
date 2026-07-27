'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  atomicWriteJsonSync,
  atomicWriteJsonAsync
} = require('../../server/repositories/json-file-store');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v608-json-fsync-'));
  try {
    const syncPath = path.join(dir, 'sync.json');
    atomicWriteJsonSync(syncPath, { generation: 1 });
    atomicWriteJsonSync(syncPath, { generation: 2 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(syncPath, 'utf8')), { generation: 2 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(`${syncPath}.bak`, 'utf8')), { generation: 1 });

    const asyncPath = path.join(dir, 'async.json');
    await atomicWriteJsonAsync(asyncPath, { generation: 1 });
    await atomicWriteJsonAsync(asyncPath, { generation: 2 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(asyncPath, 'utf8')), { generation: 2 });
    assert.deepStrictEqual(JSON.parse(fs.readFileSync(`${asyncPath}.bak`, 'utf8')), { generation: 1 });

    console.log('json-backup-windows-fsync-v608-pass');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
