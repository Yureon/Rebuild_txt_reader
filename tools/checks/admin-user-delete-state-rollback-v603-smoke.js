'use strict';
const assert = require('assert');
const http = require('http');
const express = require('express');
const { createAdminUsersRouter } = require('../../server/routes/admin-users-routes');

function requestJson(server, method, pathname, body) {
  const address = server.address();
  const payload = JSON.stringify(body || {});
  return new Promise((resolve, reject) => {
    const req = http.request({
      host:'127.0.0.1', port:address.port, method, path:pathname,
      headers:{ 'content-type':'application/json', 'content-length':Buffer.byteLength(payload), cookie:'session_token=test' }
    }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {}
        resolve({ status:res.statusCode, body:parsed });
      });
    });
    req.on('error', reject);
    req.end(payload);
  });
}

(async () => {
  const calls = [];
  const app = express();
  app.use(express.json());
  app.use('/api', createAdminUsersRouter({
    sessionStore:{ getSession:() => ({ kind:'owner', userId:'__owner__', role:'owner' }) },
    accountService:{
      findUserById:(id) => ({ id, username:id, enabled:true }),
      listUsers:() => [],
      deleteUser(_id, _options, callback) { calls.push('delete'); callback(Object.assign(new Error('simulated account persistence failure'), { code:'EIO' })); }
    },
    userStateServiceManager:{
      async resetStateForUserId() { calls.push('reset'); return { beforeSnapshot:{ id:'before-delete.json' } }; },
      async restoreSnapshotForUserId(userId, snapshotId, options) { calls.push(['restore', userId, snapshotId, options]); return { ok:true }; }
    },
    setNoStore() {},
    requireSameOrigin(_req, _res, next) { next(); },
    requireCsrf(_req, _res, next) { next(); }
  }));
  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise(resolve => server.once('listening', resolve));
    const response = await requestJson(server, 'DELETE', '/api/admin/users/reader-a', { confirmText:'DELETE:reader-a', stateAction:'reset' });
    assert.strictEqual(response.status, 500);
    assert.deepStrictEqual(calls[0], 'reset');
    assert.deepStrictEqual(calls[1], 'delete');
    assert.deepStrictEqual(calls[2], ['restore', 'reader-a', 'before-delete.json', { skipBeforeSnapshot:true }]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  console.log(JSON.stringify({ pass:'v603-admin-user-delete-state-rollback-pass' }));
})().catch(error => { console.error(error); process.exit(1); });
