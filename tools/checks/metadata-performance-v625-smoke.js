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
      if (Date.now() - started > timeoutMs) return reject(new Error('metadata performance v625 timeout'));
      setTimeout(tick, 15);
    };
    tick();
  });
}
function disableOtherProviders(store) {
  for (const id of ['builtin-ssn','builtin-kakaopage','builtin-novelpia','builtin-munpia','builtin-joara']) store.setProviderSettings(id, { enabled:false });
  store.setProviderSettings('builtin-naver-series', { enabled:true, autoApply:true, priority:1 });
}
function searchHtml(secondTitle) {
  const secondAuthor = secondTitle === '사월의 상애 [독점]' ? '한서연' : '다른작가';
  return `<!doctype html><html><body>
  <a class="search_item" href="/novel/detail.series?productNo=13327562" data-title="사월의 상애 [독점]"><strong class="title">사월의 상애 [독점]</strong><span class="author">한서연</span></a>
  <a class="search_item" href="/novel/detail.series?productNo=13327563" data-title="${secondTitle}"><strong class="title">${secondTitle}</strong><span class="author">${secondAuthor}</span></a>
  </body></html>`;
}
function detailHtml(id, title = '사월의 상애 [독점]') {
  return `<!doctype html><html><head>
  <meta property="og:title" content="${title}">
  <meta property="og:url" content="https://m.series.naver.com/novel/detail.series?productNo=${id}">
  <meta property="og:image" content="https://comicthumb-phinf.pstatic.net/example/${id}.jpg">
  <meta name="description" content="충분한 길이의 작품 소개입니다. 메타데이터 상세 결과를 완성하기 위한 설명입니다.">
  </head><body><main>작가 한서연 작품 소개 충분한 길이의 작품 소개입니다. 메타데이터 상세 결과를 완성하기 위한 설명입니다. 총 120화 연재상태 연재 장르 로맨스 이용가 전체</main></body></html>`;
}
async function runCase(root, secondTitle) {
  const calls = [];
  const covers = [];
  const transport = {
    async fetchProvider(_provider, url, options = {}) {
      calls.push({ url, ...options });
      const parsed = new URL(url);
      if (parsed.pathname.includes('/search/')) return { statusCode:200, body:searchHtml(secondTitle), finalUrl:url, headers:{ 'content-type':'text/html' } };
      if (parsed.pathname === '/novel/detail.series') {
        const id = parsed.searchParams.get('productNo');
        return { statusCode:200, body:detailHtml(id), finalUrl:url, headers:{ 'content-type':'text/html' } };
      }
      throw new Error(`unexpected URL ${url}`);
    }
  };
  const store = createMetadataStoreService({ storePath:path.join(root, 'metadata.json') });
  disableOtherProviders(store);
  let virtualNow = 0;
  const service = createMetadataService({
    store, transport,
    coverService:{ async cacheRemoteCover(_provider, url) { covers.push(url); return null; } },
    queuePath:path.join(root, 'queue.json'), bulkDir:path.join(root, 'batches'), enabled:true,
    requestIntervalMs:3000, now:() => virtualNow, delay:async ms => { virtualNow += ms; }, random:() => 0,
    concurrency:1, maxJobs:8, maxAttempts:1, pollMs:10
  });
  const novel = { id:`novel-${path.basename(root)}`, title:'사월의 상애 [독점]', author:'한서연', progressAliases:[] };
  const job = await service.collect(novel, { providerIds:['builtin-naver-series'] }, 'owner');
  const done = await waitFor(() => {
    const current = service.getJob(job.id);
    return current && ['completed','failed'].includes(current.status) ? current : null;
  });
  assert.equal(done.status, 'completed', done.lastError);
  const detailCalls = calls.filter(item => new URL(item.url).pathname === '/novel/detail.series');
  await service.stop();
  return { calls, detailCalls, covers, virtualNow };
}

(async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-performance-v625-'));
  try {
    const strong = await runCase(path.join(root, 'strong'), '사월의 상애 외전');
    assert.equal(strong.detailCalls.length, 1, 'strong unique top match should request one detail only');
    assert(strong.covers.length <= 1, 'cover caching must be limited to the primary candidate');
    assert(strong.virtualNow <= 4500, `strong fast path should require one paced wait, got ${strong.virtualNow}ms`);

    const ambiguous = await runCase(path.join(root, 'ambiguous'), '사월의 상애 [독점]');
    assert.equal(ambiguous.detailCalls.length, 2, 'ambiguous equal matches should retain one alternative detail');
    assert(ambiguous.covers.length <= 1, 'alternative candidates must not serially download covers');
    assert(ambiguous.virtualNow <= 9000, `ambiguous path should be bounded to two paced detail waits, got ${ambiguous.virtualNow}ms`);

    const serviceSource = fs.readFileSync(path.join(__dirname, '../../server/services/metadata-service.js'), 'utf8');
    const adapterSource = fs.readFileSync(path.join(__dirname, '../../server/services/metadata-site-adapters.js'), 'utf8');
    assert(serviceSource.includes('requestCacheByContext'));
    assert(serviceSource.includes('strong_unique_primary_detail'));
    assert(serviceSource.includes('ranked.slice(0,2)'));
    assert(adapterSource.includes("variant:'bff-about', deviceProfile:'desktop', optional:true, fallbackOnly:true"));

    console.log(JSON.stringify({
      pass:'v625-metadata-adaptive-fast-path-pass',
      strongDetailRequests:strong.detailCalls.length,
      ambiguousDetailRequests:ambiguous.detailCalls.length,
      primaryCoverLimit:true,
      requestCache:true,
      strongVirtualDelayMs:strong.virtualNow,
      ambiguousVirtualDelayMs:ambiguous.virtualNow
    }));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
