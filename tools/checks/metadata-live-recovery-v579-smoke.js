#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataBrowserCaptureService } = require('../../server/services/metadata-browser-capture-service');
const { resolveMetadataSiteDirectTarget } = require('../../server/services/metadata-site-adapters');
const { classifyProviderFailure, looksLikeJavascriptShell, createMetadataService } = require('../../server/services/metadata-service');
const { createMetadataCoverService } = require('../../server/services/metadata-cover-service');

function waitFor(check, timeoutMs = 12000) {
  const started = Date.now();
  return new Promise((resolve,reject) => {
    const tick = () => {
      try { const value = check(); if (value) return resolve(value); } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata live recovery smoke timeout'));
      setTimeout(tick,25);
    };
    tick();
  });
}

async function runBrowserCapture(root) {
  const store = createMetadataStoreService({ storePath:path.join(root,'capture-metadata.json') });
  const coverCalls = [];
  const coverService = {
    async cacheRemoteCover(provider,url,options) {
      coverCalls.push({ providerId:provider.id,url,hasCookie:Object.prototype.hasOwnProperty.call(options,'cookie') });
      return { assetId:'a'.repeat(64), mime:'image/jpeg', ext:'jpg', bytes:10, url:`/api/metadata/covers/${'a'.repeat(64)}` };
    }
  };
  const browser = createMetadataBrowserCaptureService({
    store,
    coverService,
    describeProviders:() => [
      { id:'builtin-naver-series', name:'네이버 시리즈', enabled:true, supportsDirect:true },
      { id:'builtin-munpia', name:'문피아', enabled:true, supportsDirect:true },
      { id:'builtin-joara', name:'조아라', enabled:true, supportsDirect:true }
    ]
  });
  const novel = { id:'n1', title:'내가 키운 S급들', author:'근서', progressAliases:['n1'] };
  const pairing = browser.createPairing(novel,'owner:1');
  assert.equal(pairing.providers.length,3);
  await assert.rejects(() => browser.importCapture(novel,'owner:2',pairing.token,{ pageUrl:'https://series.naver.com/novel/detail.series?productNo=3777351', title:novel.title }), error => error.code === 'METADATA_BROWSER_CAPTURE_TOKEN_FORBIDDEN');
  const result = await browser.importCapture(novel,'owner:1',pairing.token,{
    pageUrl:'https://series.naver.com/novel/detail.series?productNo=3777351',
    title:novel.title,
    author:'근서',
    synopsis:'브라우저에서 추출한 작품 소개',
    genres:['판타지'], tags:['회귀'], publicationStatus:'완결', publicationYear:2018, sourceLanguage:'ko',
    coverUrl:'https://comicthumb-phinf.pstatic.net/example.jpg',
    evidence:{ fieldSources:{ title:'og:title' }, jsonLdTypes:['Book'], documentTitle:'내가 키운 S급들 - 네이버 시리즈' }
  });
  assert.equal(result.candidate.data.title,novel.title);
  assert.equal(result.candidate.data.coverUrl,`/api/metadata/covers/${'a'.repeat(64)}`);
  assert.equal(coverCalls[0].hasCookie,false,'browser capture cover download must not receive Cookie options');
  await assert.rejects(() => browser.importCapture(novel,'owner:1',pairing.token,{ pageUrl:'https://series.naver.com/novel/detail.series?productNo=3777351', title:novel.title }), error => error.code === 'METADATA_BROWSER_CAPTURE_TOKEN_FORBIDDEN');
  const munpia = resolveMetadataSiteDirectTarget('https://www.munpia.com/novel/detail/123456');
  assert(munpia && munpia.canonicalUrl === 'https://www.munpia.com/novel/detail/123456');
  const legacy = resolveMetadataSiteDirectTarget('https://novel.munpia.com/123456');
  assert(legacy && legacy.canonicalUrl === 'https://www.munpia.com/novel/detail/123456');
  return result.candidate.id;
}

async function runBulkDiagnostics(root) {
  const transport = { async fetchProvider() { const error = new Error('getaddrinfo EAI_AGAIN provider.example'); error.code='EAI_AGAIN'; throw error; } };
  const store = createMetadataStoreService({ storePath:path.join(root,'bulk-metadata.json') });
  const cover = createMetadataCoverService({ coverDir:path.join(root,'covers'), transport });
  let virtualNow = 0;
  const service = createMetadataService({
    store, transport, coverService:cover,
    queuePath:path.join(root,'bulk-queue.json'), bulkDir:path.join(root,'batches'), enabled:true,
    requestIntervalMs:250, now:() => virtualNow, delay:async ms => { virtualNow += ms; }, random:() => 0, concurrency:1, maxJobs:32, maxAttempts:1, pollMs:20
  });
  try {
    const result = await service.collectMissing([{ id:'n2', title:'실패 작품', author:'작가', progressAliases:['n2'] }], {}, 'owner');
    const job = await waitFor(() => {
      const current = service.getJob(result.job.id);
      return current && ['completed','failed'].includes(current.status) ? current : null;
    });
    assert.equal(job.status,'completed','bulk job should continue after an item failure');
    assert.equal(job.failed,1);
    assert(Array.isArray(job.recentFailures) && job.recentFailures.length === 1);
    assert(job.recentFailures[0].attempts.every(item => item.stage === 'dns'));
    return job.recentFailures[0].attempts.length;
  } finally { await service.stop(); }
}

async function run() {
  assert.equal(looksLikeJavascriptShell('<html><body><div id="root"></div><script src="app.js"></script></body></html>'),true);
  const classified = classifyProviderFailure(Object.assign(new Error('getaddrinfo EAI_AGAIN host'),{ code:'EAI_AGAIN' }),'search_transport');
  assert.equal(classified.stage,'dns');
  const captureRequired = classifyProviderFailure(Object.assign(new Error('browser capture'),{ code:'METADATA_BROWSER_CAPTURE_REQUIRED' }),'search_parse');
  assert.equal(captureRequired.stage,'browser_capture_required');
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'metadata-v579-'));
  try {
    const candidateId = await runBrowserCapture(root);
    const attempts = await runBulkDiagnostics(root);
    console.log(JSON.stringify({ pass:'v579-metadata-live-recovery-smoke-pass', candidateId, attempts }));
  } finally { fs.rmSync(root,{ recursive:true,force:true }); }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
