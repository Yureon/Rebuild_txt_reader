#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const {
  PRECOMPRESSED_STATIC_ASYNC_IO_PASS,
  createPrecompressedStaticMiddleware,
  createStaticMetadataCache,
  getFileStatCachedAsync
} = require('../../server/middleware/precompressed-static');

const PASS = 'v591-precompressed-static-async-io-smoke-pass';
const MARKER = 'v591-precompressed-static-async-io-pass';
assert.strictEqual(PRECOMPRESSED_STATIC_ASYNC_IO_PASS, MARKER);

function request(server, pathname) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request({ host:'127.0.0.1', port:address.port, path:pathname, headers:{ 'accept-encoding':'br, gzip' } }, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status:res.statusCode, headers:res.headers, body:Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.end();
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'precompressed-async-v591-'));
  const originalStatSync = fs.statSync;
  const originalPromisesStat = fs.promises.stat;
  let server;
  try {
    const sourcePath = path.join(root, 'main.mjs');
    fs.writeFileSync(sourcePath, 'export const answer = 42;\n');
    fs.writeFileSync(sourcePath + '.br', Buffer.from('brotli-sidecar'));
    fs.writeFileSync(sourcePath + '.gz', Buffer.from('gzip-sidecar'));

    const cache = createStaticMetadataCache({ ttlMs:60000, maxEntries:32 });
    let asyncStatCalls = 0;
    fs.promises.stat = async function patchedAsyncStat(filePath) {
      if (String(filePath).startsWith(root)) asyncStatCalls += 1;
      await new Promise(resolve => setTimeout(resolve, 10));
      return originalPromisesStat.call(this, filePath);
    };
    const samePathCache = createStaticMetadataCache({ ttlMs:60000, maxEntries:32 });
    const results = await Promise.all([
      getFileStatCachedAsync(sourcePath, samePathCache),
      getFileStatCachedAsync(sourcePath, samePathCache),
      getFileStatCachedAsync(sourcePath, samePathCache)
    ]);
    assert(results.every(Boolean), 'concurrent async stat did not resolve');
    assert.strictEqual(asyncStatCalls, 1, 'concurrent cache misses must share one async stat');
    assert.strictEqual(samePathCache.status().metrics.asyncInflightJoins, 2, 'in-flight joins were not recorded');

    const app = express();
    app.use(createPrecompressedStaticMiddleware(root, { metadataCache:cache }));
    app.use(express.static(root));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });

    fs.statSync = function blockedSyncStat(filePath, ...args) {
      if (String(filePath).startsWith(root)) throw new Error('request hot path used statSync');
      return originalStatSync.call(this, filePath, ...args);
    };
    const response = await request(server, '/main.mjs');
    assert.strictEqual(response.status, 200);
    assert.strictEqual(response.headers['content-encoding'], 'br');
    assert.strictEqual(response.headers['x-precompressed-static-async-io'], MARKER);
    assert.strictEqual(response.body.toString(), 'brotli-sidecar');
    assert(cache.status().metrics.asyncStatCalls >= 2, 'async stat metrics missing');

    console.log(JSON.stringify({ pass:PASS, marker:MARKER, asyncStatCalls:cache.status().metrics.asyncStatCalls }));
  } finally {
    fs.statSync = originalStatSync;
    fs.promises.stat = originalPromisesStat;
    if (server) await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
