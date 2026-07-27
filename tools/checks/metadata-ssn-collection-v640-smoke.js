#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');

function waitFor(check, timeoutMs = 6000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { const value = check(); if (value) return resolve(value); } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('ssn collection timeout'));
      setTimeout(tick, 15);
    };
    tick();
  });
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-ssn-v640-'));
  const fixtureRoot = path.join(__dirname, '../fixtures/metadata/ssn-series-v1/r1');
  const searchHtml = fs.readFileSync(path.join(fixtureRoot, 'search-primary.html'), 'utf8');
  const detailHtml = fs.readFileSync(path.join(fixtureRoot, 'detail-primary.html'), 'utf8');
  const calls = [];
  try {
    const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
    for (const id of ['builtin-naver-series','builtin-kakaopage','builtin-novelpia','builtin-munpia','builtin-joara']) {
      store.setProviderSettings(id, { enabled:false });
    }
    store.setProviderSettings('builtin-ssn', { enabled:true, autoApply:true, priority:5 });
    const transport = {
      async fetchProvider(provider, url, options = {}) {
        calls.push({ providerId:provider.id, url, profile:options.profile || '' });
        const parsed = new URL(url);
        assert.equal(provider.id, 'builtin-ssn');
        if (parsed.pathname === '/series/' && parsed.searchParams.has('keyword')) {
          return { statusCode:200, body:searchHtml, finalUrl:url, headers:{ 'content-type':'text/html; charset=utf-8' } };
        }
        if (parsed.pathname === '/series/283549/') {
          return { statusCode:200, body:detailHtml, finalUrl:url, headers:{ 'content-type':'text/html; charset=utf-8' } };
        }
        throw new Error(`unexpected ssn URL: ${url}`);
      }
    };
    let virtualNow = 0;
    const service = createMetadataService({
      store,
      transport,
      coverService:{ async cacheRemoteCover() { return null; } },
      queuePath:path.join(root, 'queue.json'),
      bulkDir:path.join(root, 'batches'),
      enabled:true,
      requestIntervalMs:3000,
      now:() => virtualNow,
      delay:async ms => { virtualNow += ms; },
      random:() => 0,
      concurrency:1,
      maxJobs:8,
      maxAttempts:1,
      pollMs:10
    });
    const novel = { id:'ssn-v640-1', title:'전능한 검색창을 얻었다', author:'글이술술', progressAliases:['ssn-v640-1'] };
    const queued = await service.collect(novel, { providerIds:['builtin-ssn'] }, 'owner');
    const done = await waitFor(() => {
      const current = service.getJob(queued.id);
      return current && ['completed','failed'].includes(current.status) ? current : null;
    });
    assert.equal(done.status, 'completed', done.lastError);
    assert.equal(calls.length, 2);
    assert.equal(calls[0].providerId, 'builtin-ssn');
    assert.equal(new URL(calls[0].url).searchParams.get('keyword'), novel.title);
    assert.equal(new URL(calls[1].url).pathname, '/series/283549/');
    const metadata = service.getNovelMetadata(novel);
    assert(metadata.applied, 'exact title/author ssn result should auto apply');
    assert.equal(metadata.applied.providerId, 'builtin-ssn');
    assert.equal(metadata.applied.data.title, novel.title);
    assert.equal(metadata.applied.data.author, novel.author);
    assert(metadata.applied.data.genres.includes('현대판타지'));
    assert.equal(metadata.candidates.length, 1);
    await service.stop();
    console.log(JSON.stringify({
      pass:'v640-metadata-ssn-collection-pass',
      calls:calls.length,
      appliedProvider:metadata.applied.providerId,
      virtualDelayMs:virtualNow
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
