#!/usr/bin/env node
const assert = require('assert');
const http = require('http');
const express = require('express');
const { createFileopsRouter, FILEOPS_CONFIRMATION_PASS } = require('../../server/routes/fileops-routes');

function createStubService() {
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

function request(port, method, path, body, headers = {}) {
  const payload = body == null ? '' : JSON.stringify(body);
  const nextHeaders = Object.assign({
    accept: 'application/json'
  }, headers);
  if (payload) {
    nextHeaders['content-type'] = 'application/json';
    nextHeaders['content-length'] = String(Buffer.byteLength(payload));
  }

  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: nextHeaders
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
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
    fileopsService: createStubService(),
    requireSameOrigin: (req, res, next) => next(),
    requireCsrf: (req, res, next) => next()
  }));
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    return await fn(server.address().port);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function main() {
  assert.strictEqual(FILEOPS_CONFIRMATION_PASS, 'v344-fileops-action-confirmation-pass');
  await withServer(async (port) => {
    const missingRename = await request(port, 'PATCH', '/api/novels/n1/rename', { title: 'next' });
    assert.strictEqual(missingRename.status, 428, 'rename without confirmation header must be rejected');
    assert.strictEqual(missingRename.json.expectedConfirmAction, 'fileops-rename');

    const wrongMove = await request(port, 'PATCH', '/api/novels/n1/move', { targetCategoryPath: 'A' }, { 'x-confirm-action': 'fileops-rename' });
    assert.strictEqual(wrongMove.status, 428, 'move with wrong confirmation action must be rejected');
    assert.strictEqual(wrongMove.json.expectedConfirmAction, 'fileops-move');

    const okRename = await request(port, 'PATCH', '/api/novels/n1/rename', { title: 'next' }, { 'x-confirm-action': 'fileops-rename' });
    assert.strictEqual(okRename.status, 200, 'rename with action confirmation must pass');
    assert.strictEqual(okRename.json.success, true);

    const okMove = await request(port, 'PATCH', '/api/novels/n1/move', { targetCategoryPath: 'A' }, { 'x-confirm-action': 'fileops-move' });
    assert.strictEqual(okMove.status, 200, 'move with action confirmation must pass');
    assert.strictEqual(okMove.json.success, true);

    const deleteNoText = await request(port, 'DELETE', '/api/novels/n1', {}, { 'x-confirm-action': 'fileops-delete' });
    assert.strictEqual(deleteNoText.status, 428, 'delete without confirmText must be rejected');
    assert.strictEqual(deleteNoText.json.expectedConfirmText, 'DELETE');

    const deleteWrongText = await request(port, 'DELETE', '/api/novels/n1', { confirmText: 'delete' }, { 'x-confirm-action': 'fileops-delete' });
    assert.strictEqual(deleteWrongText.status, 428, 'delete with wrong confirmText must be rejected');

    const okDelete = await request(port, 'DELETE', '/api/novels/n1', { confirmText: 'DELETE' }, { 'x-confirm-action': 'fileops-delete' });
    assert.strictEqual(okDelete.status, 200, 'delete with action and text confirmation must pass');
    assert.strictEqual(okDelete.json.success, true);

    const okFolderDelete = await request(port, 'DELETE', '/api/folders', { categoryPath: 'A', confirmText: 'DELETE' }, { 'x-confirm-action': 'fileops-delete' });
    assert.strictEqual(okFolderDelete.status, 200, 'folder delete keeps categoryPath while requiring confirmText');
    assert.strictEqual(okFolderDelete.json.success, true);
  });
  console.log(JSON.stringify({ pass: 'v344-fileops-confirmation-smoke-pass' }));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
