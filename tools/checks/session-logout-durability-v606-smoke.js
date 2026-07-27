'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createSessionStore } = require('../../server/services/session-store');

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v606-logout-'));
  try {
    const storePath = path.join(dir, 'sessions.json');
    const store = createSessionStore({ storePath, sessionStoreSecret:'0123456789abcdef0123456789abcdef', logger:{ error(){}, warn(){} } });
    const token = store.createSession({ kind:'owner', userId:'__owner__' });
    store.issueCsrfToken(token);
    assert.strictEqual((await store.flush()).ok, true);
    assert.strictEqual(store.validateSession(token), true);
    const deleted = await store.deleteSessionDurably(token);
    assert.strictEqual(deleted.ok, true);
    assert.strictEqual(deleted.deleted, true);
    assert.strictEqual(store.validateSession(token), false);
    await store.close();

    const restarted = createSessionStore({ storePath, sessionStoreSecret:'0123456789abcdef0123456789abcdef', logger:{ error(){}, warn(){} } });
    restarted.load();
    assert.strictEqual(restarted.validateSession(token), false, 'logout must survive immediate process restart');
    await restarted.close();

    let writes = 0;
    const failing = createSessionStore({
      storePath:path.join(dir, 'failing.json'),
      sessionStoreSecret:'0123456789abcdef0123456789abcdef',
      logger:{ error(){}, warn(){} },
      writeJson(_file, _value, callback) { writes += 1; callback(Object.assign(new Error('simulated logout persistence failure'), { code:'EIO' })); }
    });
    const failingToken = failing.createSession({ kind:'owner', userId:'__owner__' });
    const failingCsrf = failing.issueCsrfToken(failingToken);
    await assert.rejects(() => failing.deleteSessionDurably(failingToken), error => error && error.code === 'SESSION_STORE_DELETE_PERSIST_FAILED');
    assert.ok(writes >= 1);
    assert.strictEqual(failing.validateSession(failingToken), true, 'failed durable logout must restore the in-memory session');
    assert.strictEqual(failing.validateCsrfToken(failingToken, failingCsrf), true, 'failed durable logout must restore CSRF state');

    const authSource = fs.readFileSync(path.join(__dirname, '../../server/routes/auth-routes.js'), 'utf8');
    assert.ok(authSource.includes("await sessionStore.deleteSessionDurably(token)"), 'logout route must await durable session deletion');
    assert.ok(!authSource.includes('sessionStore.deleteSession(token); sessionStore.deleteCsrfToken(token);'), 'logout must not schedule two non-durable writes');
    console.log(JSON.stringify({ pass:'v606-session-logout-durability-pass', writes }));
  } finally {
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
