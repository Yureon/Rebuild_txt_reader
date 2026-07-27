#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { createAsyncSafeRouter, createApiErrorMiddleware } = require('../../server/utils/async-route');

const root = path.resolve(__dirname, '..', '..');

async function main() {
  const routeDir = path.join(root, 'server', 'routes');
  const routeFiles = fs.readdirSync(routeDir).filter(name => name.endsWith('-routes.js'));
  for (const name of routeFiles) {
    const source = fs.readFileSync(path.join(routeDir, name), 'utf8');
    assert.ok(source.includes('createAsyncSafeRouter()'), `${name} bypasses the async-safe router contract`);
    assert.ok(!source.includes('express.Router()'), `${name} still constructs a raw Express 4 router`);
  }

  const app = express();
  const router = createAsyncSafeRouter();
  router.get('/reject', async () => {
    const error = new Error('safe client detail');
    error.statusCode = 418;
    error.code = 'async_route_probe';
    throw error;
  });
  router.get('/explode', async () => { throw new Error('secret server detail'); });
  app.use('/api', router);
  app.use('/api', createApiErrorMiddleware({ logger:{ error() {} } }));
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const clientResponse = await fetch(`${base}/api/reject`);
    const clientBody = await clientResponse.json();
    assert.strictEqual(clientResponse.status, 418);
    assert.strictEqual(clientBody.error, 'async_route_probe');
    assert.strictEqual(clientBody.message, 'safe client detail');

    const serverResponse = await fetch(`${base}/api/explode`);
    const serverBody = await serverResponse.json();
    assert.strictEqual(serverResponse.status, 500);
    assert.strictEqual(serverBody.error, 'internal_server_error');
    assert.strictEqual(serverBody.message, 'Internal server error.');
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
  console.log(JSON.stringify({ pass:'v610-async-route-error-pass', routes:routeFiles.length }));
}

main().catch(error => { console.error(error); process.exit(1); });
