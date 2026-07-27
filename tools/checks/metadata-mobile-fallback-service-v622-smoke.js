#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');

function waitFor(check, timeoutMs = 5000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { const value = check(); if (value) return resolve(value); } catch (error) { return reject(error); }
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata mobile fallback service timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}
function disableOtherProviders(store) {
  for (const id of ['builtin-ssn','builtin-kakaopage','builtin-novelpia','builtin-munpia','builtin-joara']) store.setProviderSettings(id, { enabled:false });
  store.setProviderSettings('builtin-naver-series', { enabled:true, autoApply:true, priority:1 });
}
async function harness(root, mode) {
  const mobileSearch = fs.readFileSync(path.join(__dirname, '../fixtures/metadata/naver-series-webnovel-v1/r4/search-mobile.html'), 'utf8');
  const fullDetail = fs.readFileSync(path.join(__dirname, '../fixtures/metadata/naver-series-adult-detail.html'), 'utf8');
  const calls = { playwright:[], transport:[] };
  const playwrightService = {
    describe:() => ({ supported:true, configured:true, status:'ready', enabled:true }),
    canFetch:() => true,
    async fetchProvider(_provider, url, options = {}) {
      calls.playwright.push({ url, ...options });
      const parsed = new URL(url);
      if (mode === 'access-blocked') throw Object.assign(new Error('접근 제한'), { code:'METADATA_PROVIDER_ACCESS_BLOCKED' });
      if (parsed.pathname.includes('/search/')) {
        if (parsed.hostname === 'series.naver.com') {
          const body = mode === 'desktop-success' ? mobileSearch : '<html><body><ul class="lst_list"></ul></body></html>';
          return { statusCode:200, body, finalUrl:url, headers:{ 'content-type':'text/html' } };
        }
        return { statusCode:200, body:mobileSearch, finalUrl:url, headers:{ 'content-type':'text/html' } };
      }
      if (parsed.pathname === '/novel/detail.series') {
        if (parsed.hostname === 'm.series.naver.com') {
          const body = mode === 'desktop-success'
            ? fullDetail
            : '<html><head><meta property="og:title" content="사월의 상애 [독점]"><meta property="og:url" content="https://m.series.naver.com/novel/detail.series?productNo=13327562"></head><body></body></html>';
          return { statusCode:200, body, finalUrl:url, headers:{ 'content-type':'text/html' } };
        }
        return { statusCode:200, body:fullDetail, finalUrl:url, headers:{ 'content-type':'text/html' } };
      }
      throw new Error(`unexpected Naver URL ${url}`);
    }
  };
  const transport = {
    async fetchProvider(_provider, url, options = {}) {
      calls.transport.push({ url, ...options });
      const parsed = new URL(url);
      if (mode === 'access-blocked') throw Object.assign(new Error('접근 제한'), { code:'METADATA_PROVIDER_ACCESS_BLOCKED' });
      if (parsed.pathname.includes('/search/')) {
        if (parsed.hostname === 'series.naver.com') {
          const body = mode === 'desktop-success' ? mobileSearch : '<html><body><ul class="lst_list"></ul></body></html>';
          return { statusCode:200, body, finalUrl:url, headers:{ 'content-type':'text/html' } };
        }
        return { statusCode:200, body:mobileSearch, finalUrl:url, headers:{ 'content-type':'text/html' } };
      }
      if (parsed.pathname === '/novel/detail.series') {
        if (parsed.hostname === 'm.series.naver.com') {
          const body = mode === 'desktop-success'
            ? fullDetail
            : '<html><head><meta property="og:title" content="사월의 상애 [독점]"><meta property="og:url" content="https://m.series.naver.com/novel/detail.series?productNo=13327562"></head><body></body></html>';
          return { statusCode:200, body, finalUrl:url, headers:{ 'content-type':'text/html' } };
        }
        return { statusCode:200, body:fullDetail, finalUrl:url, headers:{ 'content-type':'text/html' } };
      }
      throw new Error(`unexpected Naver URL ${url}`);
    }
  };
  const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
  disableOtherProviders(store);
  let virtualNow = 0;
  const service = createMetadataService({
    store, transport, playwrightService,
    coverService:{ cacheRemoteCover:async() => null },
    queuePath:path.join(root, 'queue.json'), bulkDir:path.join(root, 'batches'), enabled:true,
    requestIntervalMs:3000, now:() => virtualNow, delay:async ms => { virtualNow += ms; }, random:() => 0,
    concurrency:1, maxJobs:16, maxAttempts:1, pollMs:10
  });
  return { service, calls };
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-mobile-fallback-v622-'));
  const novel = { id:'naver-mobile-1', title:'사월의 상애 [독점]', author:'한서연', progressAliases:['naver-mobile-1'] };
  try {
    const fallback = await harness(path.join(root, 'fallback'), 'mobile-fallback');
    const job = await fallback.service.collect(novel, { providerIds:['builtin-naver-series'] }, 'owner');
    const completed = await waitFor(() => {
      const item = fallback.service.getJob(job.id);
      return item && ['completed','failed'].includes(item.status) ? item : null;
    });
    assert.equal(completed.status, 'completed', completed.lastError);
    assert(fallback.calls.transport.some(call => new URL(call.url).hostname === 'm.series.naver.com' && call.variant === 'mobile-current'));
    assert(fallback.calls.transport.some(call => new URL(call.url).hostname === 'series.naver.com' && new URL(call.url).pathname === '/novel/detail.series'), 'incomplete mobile detail must fetch desktop fallback');
    assert.equal(fallback.calls.playwright.length, 0, 'public Naver requests should stay on the lightweight transport');
    assert.equal(fallback.service.getNovelMetadata(novel).applied?.data?.author, '한서연');
    await fallback.service.stop();

    const primary = await harness(path.join(root, 'primary'), 'desktop-success');
    const primaryJob = await primary.service.collect({ ...novel, id:'naver-primary-1', progressAliases:['naver-primary-1'] }, { providerIds:['builtin-naver-series'] }, 'owner');
    const primaryDone = await waitFor(() => {
      const item = primary.service.getJob(primaryJob.id);
      return item && ['completed','failed'].includes(item.status) ? item : null;
    });
    assert.equal(primaryDone.status, 'completed', primaryDone.lastError);
    const searchCalls = primary.calls.transport.filter(call => new URL(call.url).pathname.includes('/search/'));
    assert(searchCalls.some(call => new URL(call.url).hostname === 'series.naver.com'));
    assert(!searchCalls.some(call => new URL(call.url).hostname === 'm.series.naver.com'), 'desktop search success must skip mobile fallback');
    const detailCalls = primary.calls.transport.filter(call => new URL(call.url).pathname === '/novel/detail.series');
    assert(detailCalls.some(call => new URL(call.url).hostname === 'm.series.naver.com'));
    assert(!detailCalls.some(call => new URL(call.url).hostname === 'series.naver.com'), 'sufficient mobile detail must skip desktop fallback');
    await primary.service.stop();

    const blocked = await harness(path.join(root, 'blocked'), 'access-blocked');
    const blockedJob = await blocked.service.collect({ ...novel, id:'naver-blocked-1', progressAliases:['naver-blocked-1'] }, { providerIds:['builtin-naver-series'] }, 'owner');
    const blockedDone = await waitFor(() => {
      const item = blocked.service.getJob(blockedJob.id);
      return item && ['completed','failed'].includes(item.status) ? item : null;
    });
    assert.equal(blockedDone.status, 'failed');
    assert.match(String(blockedDone.lastError || ''), /접근 제한/);
    assert(blocked.calls.transport.length > 0, 'public transport must be attempted first');
    assert(blocked.calls.playwright.length > 0, 'transport access failure may use the authenticated fallback without masking the access error');
    await blocked.service.stop();

    console.log(JSON.stringify({ pass:'v622-metadata-mobile-fallback-service-pass', desktopSkip:true, detailMerge:true, transportFirst:true, authMaskingBlocked:true }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
