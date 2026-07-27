'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { atomicWriteJson } = require('../../server/repositories/json-file-store');
const { createSessionStore } = require('../../server/services/session-store');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v603-session-retry-'));
  let writes = 0;
  const store = createSessionStore({
    storePath:path.join(dir, 'sessions.json'),
    retryDelayMs:50,
    logger:{ error(){}, warn(){} },
    writeJson(filePath, value, callback) {
      writes += 1;
      if (writes === 1) return callback(Object.assign(new Error('simulated session write failure'), { code:'EIO' }));
      return atomicWriteJson(filePath, value, callback);
    }
  });
  store.createSession({ kind:'user', userId:'reader-a', sessionVersion:1 });
  await sleep(280);
  const status = store.getLifecycleStatus();
  assert.ok(writes >= 2, 'failed session save must be retried');
  assert.strictEqual(status.lastWriteError, '');
  assert.strictEqual(status.writeFailures, 0);
  assert.strictEqual((await store.close()).ok, true);

  const failing = createSessionStore({
    storePath:path.join(dir, 'sessions-fail.json'),
    logger:{ error(){}, warn(){} },
    writeJson(_filePath, _value, callback) { callback(Object.assign(new Error('persistent session failure'), { code:'EIO' })); }
  });
  failing.createSession({ kind:'user', userId:'reader-b', sessionVersion:1 });
  const closeResult = await failing.close();
  assert.strictEqual(closeResult.ok, false, 'shutdown must surface session persistence failure');
  assert.match(closeResult.error, /persistent session failure/);

  fs.rmSync(dir, { recursive:true, force:true });
  console.log(JSON.stringify({ pass:'v603-session-store-retry-shutdown-pass', writes }));
})().catch(error => { console.error(error); process.exit(1); });
