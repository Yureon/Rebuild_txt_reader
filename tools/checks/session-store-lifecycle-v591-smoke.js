#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createSessionStore,
  SESSION_STORE_LIFECYCLE_PASS
} = require('../../server/services/session-store.js');

const PASS = 'v591-session-store-lifecycle-smoke-pass';
assert.strictEqual(SESSION_STORE_LIFECYCLE_PASS, 'v591-session-store-lifecycle-pass');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-session-store-lifecycle-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const storePath = path.join(tmp, 'sessions.json');
const secret = 'v591-session-store-test-secret';
const logger = { warn() {}, error(...args) { throw new Error(args.join(' ')); } };

(async () => {
  const first = createSessionStore({
    storePath,
    sessionStoreSecret: secret,
    cleanupIntervalMs: 60_000,
    logger
  });
  first.startCleanup();
  const token = first.createSession({ kind: 'user', userId: 'u1', username: 'reader' });
  first.issueCsrfToken(token);
  const closeResult = await first.close();
  assert.strictEqual(closeResult.ok, true, 'close must await a successful final write');
  assert.strictEqual(closeResult.closed, true);
  assert.strictEqual(closeResult.timersCleared, true, 'close must clear save and cleanup timers');
  const status = first.getLifecycleStatus();
  assert.strictEqual(status.pass, SESSION_STORE_LIFECYCLE_PASS);
  assert.strictEqual(status.closed, true);
  assert.strictEqual(status.writing, false);
  assert.strictEqual(status.dirty, false);
  assert.strictEqual(status.saveTimerActive, false);
  assert.strictEqual(status.cleanupTimerActive, false);
  assert.strictEqual(await first.close(), closeResult, 'close must be idempotent');

  const stored = JSON.parse(fs.readFileSync(storePath, 'utf8'));
  assert.strictEqual(stored.lifecyclePass, SESSION_STORE_LIFECYCLE_PASS);
  assert.strictEqual(Object.keys(stored.sessions).length, 1, 'final close must persist the pending session');

  const second = createSessionStore({
    storePath,
    sessionStoreSecret: secret,
    cleanupIntervalMs: 60_000,
    logger
  });
  second.load();
  assert.strictEqual(second.validateSession(token), true, 'persisted session must survive immediate shutdown');
  await second.close();
  console.log(JSON.stringify({ pass: PASS, marker: SESSION_STORE_LIFECYCLE_PASS }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
