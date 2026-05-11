#!/usr/bin/env node
const assert = require('assert');
const http = require('http');
const express = require('express');
const { createFileopsRouter } = require('../../server/routes/fileops-routes');
const { createRecoveryRouter } = require('../../server/routes/recovery-routes');

const OWNER_API_BOUNDARY_PASS = 'v389-owner-api-boundary-smoke-pass';

function createStubFileopsService() {
  const success = () => ({ success: true });
  return {
    renameFolder: success,
    renameNovel: success,
    deleteNovel: success,
    moveNovel: success,
    moveEpisode: success,
    moveFolder: success,
    renameEpisode: success,
    deleteEpisode: success,
    deleteFolder: success,
    sendFsError(res, error) {
      return res.status(500).json({ error: error && error.message ? error.message : 'stub fs error' });
    }
  };
}

function ownerOnly(req, res, next) {
  if (req.get('x-smoke-owner') !== '1') return res.status(403).json({ ok: false, error: 'owner_session_required' });
  req.ownerSession = { kind: 'owner', userId: '__owner__' };
  return next();
}

function request(port, method, path, body, headers = {}) {
  const payload = body == null ? '' : JSON.stringify(body);
  const nextHeaders = Object.assign({ accept: 'application/json' }, headers);
  if (payload) {
    nextHeaders['content-type'] = 'application/json';
    nextHeaders['content-length'] = String(Buffer.byteLength(payload));
  }
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path, method, headers: nextHeaders }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let json = null;
        try { json = text ? JSON.parse(text) : null; } catch {}
        resolve({ status: res.statusCode, text, json });
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function withServer(fn) {
  const app = express();
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', createFileopsRouter({
    fileopsService: createStubFileopsService(),
    requireOwnerSession: ownerOnly,
    requireSameOrigin: (req, res, next) => next(),
    requireCsrf: (req, res, next) => next()
  }));
  app.use('/api', createRecoveryRouter({
    recoveryService: { getRecoveryStatus: () => ({ ok: true, syncData: { exists: true } }) },
    setNoStore: (res) => res.setHeader('Cache-Control', 'no-store'),
    requireOwnerSession: ownerOnly
  }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try { return await fn(server.address().port); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

async function main() {
  await withServer(async (port) => {
    const readerRename = await request(port, 'PATCH', '/api/novels/n1/rename', { title: 'reader-denied' }, { 'x-confirm-action': 'fileops-rename' });
    assert.strictEqual(readerRename.status, 403, 'reader-like request must not reach fileops mutation');
    assert.strictEqual(readerRename.json.error, 'owner_session_required');

    const ownerRename = await request(port, 'PATCH', '/api/novels/n1/rename', { title: 'owner-ok' }, { 'x-smoke-owner': '1', 'x-confirm-action': 'fileops-rename' });
    assert.strictEqual(ownerRename.status, 200, 'owner request reaches fileops mutation');
    assert.strictEqual(ownerRename.json.success, true);

    const readerRecovery = await request(port, 'GET', '/api/recovery-status');
    assert.strictEqual(readerRecovery.status, 403, 'reader-like request must not read recovery status');
    assert.strictEqual(readerRecovery.json.error, 'owner_session_required');

    const ownerRecovery = await request(port, 'GET', '/api/recovery-status', null, { 'x-smoke-owner': '1' });
    assert.strictEqual(ownerRecovery.status, 200, 'owner request reaches recovery status');
    assert.ok(ownerRecovery.json.syncData);
  });
  console.log(JSON.stringify({ pass: OWNER_API_BOUNDARY_PASS }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { OWNER_API_BOUNDARY_PASS };
