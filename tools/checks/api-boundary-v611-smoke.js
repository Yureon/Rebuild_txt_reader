#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const {
  createAsyncSafeRouter,
  createApiErrorMiddleware,
  getPublicApiError,
  normalizeApiErrorStatus
} = require('../../server/utils/async-route');

const root = path.resolve(__dirname, '..', '..');

async function main() {
  assert.strictEqual(normalizeApiErrorStatus({ status:399 }), 500);
  assert.strictEqual(normalizeApiErrorStatus({ statusCode:600 }), 500);
  assert.strictEqual(normalizeApiErrorStatus({ statusCode:418 }), 418);
  assert.deepStrictEqual(
    getPublicApiError(Object.assign(new Error('secret-path=C:/private'), { statusCode:503, code:'EIO_PRIVATE' })),
    { status:503, error:'internal_server_error', message:'Internal server error.' }
  );

  const app = express();
  const router = createAsyncSafeRouter();
  router.get('/array', [async () => { throw new Error('array secret'); }]);
  router.use('/use', async () => { throw new Error('use secret'); });
  router.route('/route').get(async () => { throw new Error('route secret'); });
  router.param('id', async () => { throw new Error('param secret'); });
  router.get('/param/:id', (_req, res) => res.json({ ok:true }));
  app.use('/api', router);
  app.use('/api', createApiErrorMiddleware({ logger:{ error() {} } }));

  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const endpoint of ['array', 'use', 'route', 'param/probe']) {
      const response = await fetch(`${base}/api/${endpoint}`);
      const body = await response.json();
      assert.strictEqual(response.status, 500, `${endpoint} rejection status`);
      assert.strictEqual(body.error, 'internal_server_error', `${endpoint} error code`);
      assert.strictEqual(body.message, 'Internal server error.', `${endpoint} public message`);
      assert.ok(!JSON.stringify(body).includes('secret'), `${endpoint} leaked its exception`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }

  const routeDir = path.join(root, 'server', 'routes');
  for (const name of fs.readdirSync(routeDir).filter(name => name.endsWith('-routes.js'))) {
    const source = fs.readFileSync(path.join(routeDir, name), 'utf8');
    for (const line of source.split(/\r?\n/)) {
      if (/status\((?:500|503)\)/.test(line)) {
        assert.ok(!/message\s*:[^}\n]*(?:err|error)(?:\?\.|\s*&&\s*(?:err|error)\.)?message/.test(line), `${name} exposes a raw 5xx exception message`);
      }
    }
  }

  console.log(JSON.stringify({ pass:'v611-api-error-boundary-pass', endpoints:4 }));
}

main().catch(error => { console.error(error); process.exit(1); });
