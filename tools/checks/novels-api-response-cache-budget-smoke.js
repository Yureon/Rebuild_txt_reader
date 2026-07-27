#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const express = require('express');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

function request(port, pathname) {
  return new Promise((resolve, reject) => {
    const req = http.request({ port, path: pathname, method: 'GET' }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server));
    server.on('error', reject);
  });
}

async function withServer(options, fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'novels-cache-budget-'));
  const app = express();
  let metrics = null;
  const libraryService = {
    getLibraryCached() {
      return [
        { id: 'one', title: '첫번째', singlePath: 'one.txt', categoryPath: '', category: [], isMultiFile: false, episodes: [] },
        { id: 'two', title: '두번째', singlePath: 'two.txt', categoryPath: 'cat', category: ['cat'], isMultiFile: false, episodes: [] }
      ];
    },
    setLibraryMetaHeaders(res) {
      res.setHeader('X-Library-Signature', 'sig-1');
      res.setHeader('X-Library-Build-Count', '1');
    },
    recordNovelsApiPayloadMetrics(next) { metrics = next; }
  };
  const contentService = {
    parsePreprocessOptionsFromQuery() { return {}; },
    serializePreprocessOptions() { return ''; }
  };
  app.use('/api', createNovelsRouter({
    libraryPath: tmp,
    libraryService,
    contentService,
    ...options
  }));
  const server = await listen(app);
  try {
    await fn(server.address().port, () => metrics);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

(async () => {
  await withServer({}, async (port, getMetrics) => {
    const first = await request(port, '/api/novels');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.headers['x-novels-api-performance'], 'v453-library-catalog-performance-pass');
    assert.strictEqual(first.headers['x-novels-api-payload-budget'], 'v453-novels-api-payload-budget-pass');
    assert.strictEqual(first.headers['x-novels-api-response-cache-budget'], 'v453-novels-api-response-cache-budget-pass');
    assert.strictEqual(first.headers['x-novels-api-response-cache'], 'miss');
    assert(Number(first.headers['x-novels-api-response-cache-bytes']) > 0, 'response cache bytes should be positive after first miss');
    assert(!first.headers['x-novels-api-response-cache-skip'], 'normal payload should not skip response cache');
    const second = await request(port, '/api/novels');
    assert.strictEqual(second.status, 200);
    assert.strictEqual(second.headers['x-novels-api-response-cache'], 'hit');
    assert(Number(second.headers['x-novels-api-response-cache-bytes']) > 0, 'hit should preserve response cache byte diagnostics');
    assert.strictEqual(getMetrics().cacheHit, true);
    assert(Number(getMetrics().responseCacheBytes) > 0, 'metrics should expose response cache bytes');
  });

  await withServer({ novelsResponseCacheEntryMaxBytes: 32 }, async (port, getMetrics) => {
    const first = await request(port, '/api/novels');
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.headers['x-novels-api-response-cache'], 'miss');
    assert.strictEqual(first.headers['x-novels-api-response-cache-skip'], 'entry-too-large');
    assert.strictEqual(first.headers['x-novels-api-response-cache-bytes'], '0');
    assert.strictEqual(getMetrics().cacheSkipped, true);
    assert.strictEqual(getMetrics().cacheSkipReason, 'entry-too-large');
    const second = await request(port, '/api/novels');
    assert.strictEqual(second.headers['x-novels-api-response-cache'], 'miss');
    assert.strictEqual(second.headers['x-novels-api-response-cache-skip'], 'entry-too-large');
  });
  console.log('v453-novels-api-response-cache-budget-smoke-pass');
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
