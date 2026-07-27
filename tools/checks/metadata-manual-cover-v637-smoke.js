#!/usr/bin/env node
'use strict';
const assert = require('assert');
const Module = require('module');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');

function fakeExpress() {
  return {
    raw:() => (_req,_res,next) => next(),
    Router() {
      const router = { routes:[] };
      for (const method of ['all','get','post','put','delete','patch','head','options']) {
        router[method] = (routePath, ...handlers) => { router.routes.push({ method, path:routePath, handlers }); return router; };
      }
      router.use = (..._args) => router;
      router.param = (..._args) => router;
      return router;
    }
  };
}
async function invoke(handlers, req, res) {
  let index = -1;
  async function next(error) {
    if (error) throw error;
    const handler = handlers[++index];
    if (!handler) return;
    const result = handler(req, res, next);
    if (result && typeof result.then === 'function') await result;
  }
  await next();
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}
function makeResponse() {
  return {
    statusCode:200, body:null, headers:{},
    status(code){ this.statusCode = code; return this; },
    json(body){ this.body = body; return this; },
    setHeader(name,value){ this.headers[String(name).toLowerCase()] = value; },
    getHeader(name){ return this.headers[String(name).toLowerCase()]; },
    end(){ return this; }, get(){ return ''; }
  };
}

(async () => {
  const original = Module._load;
  Module._load = function(request, parent, isMain) {
    if (request === 'express') return fakeExpress();
    return original.call(this, request, parent, isMain);
  };
  let createMetadataRouter;
  try { ({ createMetadataRouter } = require('../../server/routes/metadata-routes')); }
  finally { Module._load = original; }

  const novel = { id:'novel-a', title:'테스트 작품', author:'작가', progressAliases:[] };
  const validId = 'a'.repeat(64);
  const canonical = `/api/metadata/covers/${validId}`;
  let persisted = null;
  let saveCalls = 0;
  let releaseCalls = 0;
  let verifyCalls = 0;
  const metadataService = {
    enabled:true, listProviders:() => [], queueStatus:() => ({}),
    async saveManualMetadata(_novel, input) { saveCalls += 1; persisted = { id:'wm', providerId:'manual', data:{ title:input.title || null } }; return persisted; },
    getAppliedRecord(){ return persisted; }, hasCoverAsset:() => false, canAccessCover:() => false,
    createCoverAccessScope:() => ({ aliases:new Set(), workKeys:new Set() })
  };
  const coverService = {
    getStatus:() => ({ manualUploadMaxBytes:5 * 1024 * 1024 }),
    async verifyAssetAsync(assetId){ verifyCalls += 1; return assetId === validId ? { assetId, ext:'png', mime:'image/png', url:canonical } : null; },
    canonicalAssetUrl:assetId => `/api/metadata/covers/${assetId}`,
    async releaseAssetLeaseDurably(){ releaseCalls += 1; },
    findAsset:() => null
  };
  const router = createMetadataRouter({
    metadataService, coverService,
    libraryService:{ getLibraryCached:() => [novel] },
    sessionStore:{ getSession:() => ({ kind:'owner', id:'owner' }) },
    accountService:{ getUserLibraryAccess:() => ({ mode:'all', folders:[] }), getUserAppPermissions:() => ({ metadataAccess:true }) },
    playwrightService:{}, requireSameOrigin:(_q,_s,n)=>n(), requireCsrf:(_q,_s,n)=>n(), checkApiWriteLimit:()=>true
  });
  const route = router.routes.find(item => item.method === 'put' && item.path === '/novels/:novelId/metadata/manual');
  assert(route, 'manual metadata route missing');
  async function call(body) {
    const req = { params:{ novelId:novel.id }, body, headers:{ cookie:'session_token=x' }, get:()=>'' };
    const res = makeResponse();
    await invoke(route.handlers, req, res);
    return res;
  }

  let res = await call({ title:'제목', coverAssetId:'not-a-real-asset' });
  assert.equal(res.statusCode, 400, 'non-SHA asset IDs must be rejected');
  assert.equal(saveCalls, 0); assert.equal(releaseCalls, 0);

  res = await call({ title:'제목', coverAssetId:'b'.repeat(64) });
  assert.equal(res.statusCode, 400, 'missing assets must be rejected');
  assert.equal(saveCalls, 0); assert.equal(releaseCalls, 0);

  res = await call({ title:'제목', coverAssetId:validId, coverUrl:'https://tracker.invalid/pixel.gif' });
  assert.equal(res.statusCode, 400, 'external cover URLs must be rejected');
  assert.equal(saveCalls, 0); assert.equal(releaseCalls, 0);

  res = await call({ title:'제목', coverAssetId:validId, coverUrlLocal:'' });
  assert.equal(res.statusCode, 400, 'client-owned local URL fields must be rejected even when empty');
  assert.equal(saveCalls, 0); assert.equal(releaseCalls, 0);

  persisted = null;
  metadataService.saveManualMetadata = async (_novel, input) => {
    saveCalls += 1;
    persisted = { id:'wm', providerId:'manual', data:{ title:input.title || null, coverAssetId:null, coverUrl:null } };
    return persisted;
  };
  res = await call({ title:'제목', coverAssetId:validId, fields:['title'] });
  assert.equal(res.statusCode, 200);
  assert.equal(releaseCalls, 0, 'unapplied requested cover must retain its lease');

  metadataService.saveManualMetadata = async (_novel, input) => {
    saveCalls += 1;
    assert.equal(input.coverUrlLocal, canonical, 'server must inject the canonical internal URL');
    persisted = { id:'wm', providerId:'manual', data:{ title:input.title || null, coverAssetId:validId, coverUrl:canonical } };
    return persisted;
  };
  res = await call({ title:'제목', coverAssetId:validId });
  assert.equal(res.statusCode, 200);
  assert.equal(releaseCalls, 1, 'lease must release only after durable readback references the exact asset');
  assert.equal(res.body.applied.data.coverUrl, canonical);
  assert(verifyCalls >= 3);

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v637-cover-integrity-'));
  const coverDir = path.join(temp, 'covers');
  const actualCoverService = createMetadataCoverService({
    coverDir,
    transport:{ fetchProvider:async () => { throw new Error('not used'); } },
    minOrphanAgeMs:0,
    pruneIntervalMs:60 * 60 * 1000,
    pendingAssetLeaseMs:60 * 1000,
    logger:{ warn(){}, error(){} }
  });
  try {
    const png = Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), Buffer.alloc(1024, 0x35)]);
    const uploaded = await actualCoverService.cacheUploadedCover(png, { contentType:'image/png' });
    assert(await actualCoverService.verifyAssetAsync(uploaded.assetId), 'valid content-addressed cover must verify');

    const mismatchId = 'b'.repeat(64);
    fs.writeFileSync(path.join(coverDir, `${mismatchId}.png`), png);
    assert.equal(await actualCoverService.verifyAssetAsync(mismatchId), null, 'filename hash mismatch must be rejected');

    const symlinkId = 'c'.repeat(64);
    let symlinkChecked = false;
    try {
      fs.symlinkSync(path.join(coverDir, `${uploaded.assetId}.png`), path.join(coverDir, `${symlinkId}.png`));
      assert.equal(await actualCoverService.verifyAssetAsync(symlinkId), null, 'symlink cover asset must be rejected');
      symlinkChecked = true;
    } catch (error) {
      if (!error || !['EPERM','EACCES','ENOTSUP'].includes(error.code)) throw error;
    }

    const leasePath = path.join(coverDir, '.pending-cover-leases.json');
    const originalRm = fs.promises.rm;
    fs.promises.rm = async function(target, options) {
      if (path.resolve(String(target)) === path.resolve(leasePath)) throw Object.assign(new Error('forced lease release persistence failure'), { code:'EIO' });
      return originalRm.call(this, target, options);
    };
    let durableReleaseFailed = false;
    try { await actualCoverService.releaseAssetLeaseDurably(uploaded.assetId); }
    catch (error) { durableReleaseFailed = error && error.code === 'EIO'; }
    finally { fs.promises.rm = originalRm; }
    assert.equal(durableReleaseFailed, true, 'forced durable lease release must fail');
    assert.equal(actualCoverService.isAssetLeased(uploaded.assetId), true, 'failed durable release must restore the in-process lease');

    console.log(JSON.stringify({
      pass:'v637-metadata-manual-cover-smoke-pass',
      invalidRejected:true,
      externalUrlRejected:true,
      unappliedLeaseRetained:true,
      durableExactRelease:true,
      contentHashVerified:true,
      symlinkChecked,
      failedDurableReleaseRestored:true
    }));
  } finally {
    await actualCoverService.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
  return;

})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
