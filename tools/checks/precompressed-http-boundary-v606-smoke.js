'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { Writable, PassThrough } = require('stream');
const middlewareModule = require('../../server/middleware/precompressed-static');

(async () => {
  assert.strictEqual(middlewareModule.isIdentityEncodingAccepted('identity;q=0'), false);
  assert.strictEqual(middlewareModule.isIdentityEncodingAccepted('br;q=0, *;q=0'), false);
  assert.strictEqual(middlewareModule.isIdentityEncodingAccepted('gzip;q=1, identity;q=0'), false);
  assert.strictEqual(middlewareModule.isIdentityEncodingAccepted('gzip;q=1'), true);
  assert.deepStrictEqual(middlewareModule.acceptedEncodingCandidates('br;q=2, gzip;q=0.5').map(item => item.header), ['gzip'], 'invalid qvalue must not outrank a valid encoding');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v606-static-'));
  const originalCreateReadStream = fs.createReadStream;
  try {
    fs.writeFileSync(path.join(dir, 'asset.js'), 'source', 'utf8');
    fs.writeFileSync(path.join(dir, 'asset.js.br'), 'encoded', 'utf8');
    let openedStream = null;
    fs.createReadStream = () => {
      openedStream = new PassThrough();
      return openedStream;
    };
    const middleware = middlewareModule.createPrecompressedStaticMiddleware(dir, { metadataCacheOptions:{ ttlMs:0 } });
    const req = { method:'GET', path:'/asset.js', url:'/asset.js', headers:{ 'accept-encoding':'br' } };
    const headers = new Map();
    const res = new Writable({ write(_chunk, _encoding, callback){ callback(); } });
    res.statusCode = 200;
    res.setHeader = (key,value) => headers.set(String(key).toLowerCase(), value);
    res.getHeader = key => headers.get(String(key).toLowerCase());
    res.type = value => { res.setHeader('Content-Type', value); return res; };
    const nativeEnd = res.end.bind(res);
    res.end = (...args) => nativeEnd(...args);
    let nextError = null;
    middleware(req, res, error => { nextError = error || null; });
    for (let i = 0; i < 30 && !openedStream; i += 1) await new Promise(resolve => setTimeout(resolve, 5));
    assert.ok(openedStream, 'precompressed stream must be opened');
    res.emit('close');
    await new Promise(resolve => setImmediate(resolve));
    assert.strictEqual(openedStream.destroyed, true, 'client close must destroy the encoded file stream');
    assert.strictEqual(nextError, null);

    openedStream = null;
    const closedRes = new Writable({ write(_chunk, _encoding, callback){ callback(); } });
    closedRes.destroyed = true;
    let closedHeaderWrites = 0;
    let closedNextCalls = 0;
    closedRes.setHeader = () => { closedHeaderWrites += 1; };
    closedRes.getHeader = () => undefined;
    closedRes.type = () => closedRes;
    closedRes.end = () => closedRes;
    middleware(req, closedRes, error => { closedNextCalls += 1; if (error) throw error; });
    await new Promise(resolve => setTimeout(resolve, 30));
    assert.strictEqual(openedStream, null, 'a response closed during async stat must not open the encoded file stream');
    assert.strictEqual(closedHeaderWrites, 0, 'a closed response must not receive late headers');
    assert.strictEqual(closedNextCalls, 0, 'a closed response must not re-enter the downstream middleware chain');
    console.log(JSON.stringify({ pass:'v606-precompressed-http-boundary-pass' }));
  } finally {
    fs.createReadStream = originalCreateReadStream;
    fs.rmSync(dir, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exit(1); });
