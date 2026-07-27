#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');

function waitFor(check, timeoutMs = 5000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      try { const value = check(); if (value) return resolve(value); } catch (error) { return reject(error); }
      if (Date.now() - start > timeoutMs) return reject(new Error('NovelPia adult metadata pipeline timeout'));
      setTimeout(tick, 20);
    };
    tick();
  });
}
function disableOtherProviders(store) {
  for (const id of ['builtin-ssn','builtin-naver-series','builtin-kakaopage','builtin-munpia','builtin-joara']) store.setProviderSettings(id, { enabled:false });
  store.setProviderSettings('builtin-novelpia', { enabled:true, autoApply:true, priority:1 });
}
async function createHarness(root, mode) {
  const calls = { playwright:[], transport:[], covers:[] };
  const detail = fs.readFileSync(path.join(__dirname, '../fixtures/metadata/novelpia-adult-detail.html'), 'utf8');
  const adultJson = JSON.stringify({ status:200, result:{ novels:[{ novel_no:'294489', novel_name:'재벌집 망나니가 되었다', writer_nick:'물랑말랑' }] } });
  const emptyJson = JSON.stringify({ status:200, result:{ novels:[] } });
  const playwrightService = {
    describe:() => ({ supported:true, configured:true, status:'ready', enabled:true }),
    canFetch:() => true,
    async fetchProvider(_provider, url, options = {}) {
      calls.playwright.push({ url, profile:options.profile });
      const parsed = new URL(url);
      if (parsed.pathname === '/proc/novel') {
        const age = parsed.searchParams.get('novel_age');
        if (age === '19') {
          if (mode === 'verification-required') {
            throw Object.assign(new Error('노벨피아 성인·본인 인증이 필요합니다.'), { code:'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED' });
          }
          return { statusCode:200, body:adultJson, finalUrl:url, headers:{ 'content-type':'application/json' } };
        }
        return { statusCode:200, body:emptyJson, finalUrl:url, headers:{ 'content-type':'application/json' } };
      }
      if (parsed.pathname === '/novel/294489') return { statusCode:200, body:detail, finalUrl:url, headers:{ 'content-type':'text/html' } };
      throw new Error(`unexpected Playwright URL ${url}`);
    }
  };
  const transport = {
    async fetchProvider(_provider, url, options = {}) {
      calls.transport.push({ url, profile:options.profile });
      const parsed = new URL(url);
      if (parsed.pathname === '/proc/novel' && parsed.searchParams.get('novel_age') !== '19') {
        return { statusCode:200, body:emptyJson, finalUrl:url, headers:{ 'content-type':'application/json' } };
      }
      throw new Error(`authenticated or rendered NovelPia request reached public transport: ${url}`);
    }
  };
  const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
  disableOtherProviders(store);
  let virtualNow = 0;
  const service = createMetadataService({
    store,
    transport,
    coverService:{
      cacheRemoteCover:async(_provider, url, options = {}) => {
        calls.covers.push({ url, referer:options.referer });
        return null;
      }
    },
    playwrightService,
    queuePath:path.join(root, 'queue.json'),
    bulkDir:path.join(root, 'batches'),
    enabled:true,
    requestIntervalMs:3000,
    now:() => virtualNow,
    delay:async ms => { virtualNow += ms; },
    random:() => 0,
    concurrency:1,
    maxJobs:16,
    maxAttempts:1,
    pollMs:10
  });
  return { service, calls };
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-novelpia-adult-collection-v617-'));
  try {
    const success = await createHarness(path.join(root, 'success'), 'success');
    const novelpiaDescriptor = success.service.listProviders().find(item => item.id === 'builtin-novelpia');
    assert.match(String(novelpiaDescriptor?.browserVerificationHint || ''), /19세 작품/);
    const novel = { id:'np-adult-1', title:'재벌집 망나니가 되었다', author:'물랑말랑', progressAliases:['np-adult-1'] };
    const job = await success.service.collect(novel, { providerIds:['builtin-novelpia'] }, 'owner');
    const completed = await waitFor(() => {
      const value = success.service.getJob(job.id);
      return value && ['completed','failed'].includes(value.status) ? value : null;
    });
    assert.equal(completed.status, 'completed', completed.lastError);
    const metadata = success.service.getNovelMetadata(novel);
    assert(metadata.applied, 'adult NovelPia candidate should be automatically applied');
    assert.equal(metadata.applied.data.title, novel.title);
    assert(success.calls.playwright.some(call => new URL(call.url).searchParams.get('novel_age') === '19'));
    assert(success.calls.playwright.some(call => new URL(call.url).pathname === '/novel/294489'));
    assert.equal(success.calls.transport.length, 1, 'standard public search should use lightweight transport before authenticated adult search');
    assert.deepEqual(success.calls.covers, [{
      url:'https://images.novelpia.com/imagebox/cover/fixture_q_ori.file',
      referer:'https://novelpia.com/novel/294489'
    }], 'verified NovelPia cover must reach the cache downloader with its detail-page referer');
    await success.service.stop();

    const blocked = await createHarness(path.join(root, 'blocked'), 'verification-required');
    const blockedNovel = { id:'np-adult-2', title:'성인 인증 검증작', author:'검증작가', progressAliases:['np-adult-2'] };
    const blockedJob = await blocked.service.collect(blockedNovel, { providerIds:['builtin-novelpia'] }, 'owner');
    const failed = await waitFor(() => {
      const value = blocked.service.getJob(blockedJob.id);
      return value && ['completed','failed'].includes(value.status) ? value : null;
    });
    assert.equal(failed.status, 'failed');
    assert.match(String(failed.lastError || ''), /성인·본인 인증이 필요/);
    assert.equal(blocked.calls.transport.length, 1, 'only the standard public search may use transport before the authenticated adult request');
    await blocked.service.stop();

    console.log(JSON.stringify({
      pass:'v617-metadata-novelpia-adult-collection-pass',
      successfulPlaywrightCalls:success.calls.playwright.length,
      blockedTransportFallbacks:blocked.calls.transport.length
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
