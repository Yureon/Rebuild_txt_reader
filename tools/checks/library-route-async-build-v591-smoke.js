#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter } = require('../../server/routes/novels-routes');

const PASS = 'v591-library-route-async-build-smoke-pass';
let asyncReads = 0;
let syncReads = 0;
const library = [{
  id: 'n1', title: '비동기 서재', isMultiFile: false, singlePath: 'n1.txt',
  category: [], categoryPath: '', episodes: []
}];
const app = express();
app.use(createNovelsRouter({
  libraryPath: '/virtual',
  libraryService: {
    async getLibraryCachedAsync() { asyncReads += 1; return library; },
    getLibraryCached() { syncReads += 1; throw new Error('synchronous cold catalog path used'); },
    setLibraryMetaHeaders(res) { res.setHeader('X-Library-Signature', 'async'); }
  },
  contentService: {},
  setNoStore: res => res.setHeader('Cache-Control', 'no-store')
}));

(async () => {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/novels/shelf`);
    assert.strictEqual(response.status, 200);
    const body = await response.json();
    assert.strictEqual(body.total, 1);
    assert.ok(asyncReads >= 1, 'novels route must use the async library getter');
    assert.strictEqual(syncReads, 0, 'novels route must not fall back when async getter exists');
  } finally {
    await new Promise(resolve => server.close(resolve));
  }

  const root = path.resolve(__dirname, '..', '..');
  for (const rel of [
    'server/routes/block-manifest-routes.js',
    'server/routes/metadata-routes.js',
    'server/routes/user-access-routes.js',
    'server/routes/admin-users-routes.js'
  ]) {
    const source = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.ok(source.includes('getLibraryCachedAsync'), `${rel} must route cold catalog reads through the async getter`);
  }
  const stateRoutesSource = fs.readFileSync(path.join(root, 'server/routes/state-routes.js'), 'utf8');
  assert.ok(stateRoutesSource.includes('await filterFor'), 'state routes must await the asynchronous library access filter');
  const appSource = fs.readFileSync(path.join(root, 'server/app.js'), 'utf8');
  assert.ok(appSource.includes('getLibraryCachedAsync'), 'state filtering must use the async library getter');
  assert.ok(appSource.includes('warmLibraryCache'), 'server startup must proactively warm the async library snapshot');
  console.log(JSON.stringify({ pass: PASS, asyncReads }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
