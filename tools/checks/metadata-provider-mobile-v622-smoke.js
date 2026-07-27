#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMetadataSiteAdapter, resolveMetadataSiteDirectTarget } = require('../../server/services/metadata-site-adapters');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');

const root = path.resolve(__dirname, '../..');
const fixture = rel => fs.readFileSync(path.join(root, 'tools/fixtures/metadata', rel), 'utf8');
const terms = {
  naver:{ title:'사월의 상애 [독점]', author:'한서연' },
  kakao:{ title:'오직 탈출만이 살 길이다 [19세 완전판]', author:'메냑우유' },
  novelpia:{ title:'재벌집 망나니가 되었다', author:'물랑말랑' },
  joara:{ title:'모바일 치트 수저를 물고 태어난 변방의 남작은 할 일이 많다.', author:'더인디고' }
};

function assertDevicePlan(adapter, expectedRevision, expectedSearchCount, detailUrl, remoteId, expectedDetailCount) {
  assert.equal(adapter.revision, expectedRevision);
  const requests = adapter.buildSearchRequests(terms[adapter.key.startsWith('naver') ? 'naver' : adapter.key.startsWith('kakao') ? 'kakao' : adapter.key.startsWith('novelpia') ? 'novelpia' : 'joara'], 5);
  assert.equal(requests.length, expectedSearchCount);
  assert(requests.some(item => item.deviceProfile === 'desktop'));
  assert(requests.some(item => item.deviceProfile === 'mobile'));
  assert(requests.some(item => item.deviceProfile === 'mobile' && item.fallbackOnly === true));
  const details = adapter.buildDetailRequests(detailUrl, remoteId);
  assert.equal(details.length, expectedDetailCount);
  assert(details.some(item => item.deviceProfile === 'mobile'));
  assert(details.some(item => item.deviceProfile === 'desktop'));
  return { requests, details };
}

const naver = getMetadataSiteAdapter('naver-series-webnovel-v1');
const naverPlan = assertDevicePlan(naver, 4, 2, 'https://m.series.naver.com/novel/detail.series?productNo=13327562', '13327562', 2);
assert.equal(new URL(naverPlan.requests[1].url).hostname, 'm.series.naver.com');
assert.equal(new URL(naverPlan.requests[1].url).searchParams.get('q'), terms.naver.title);
assert.equal(resolveMetadataSiteDirectTarget('https://m.series.naver.com/novel/detail.series?productNo=13327562')?.canonicalUrl, 'https://series.naver.com/novel/detail.series?productNo=13327562');
const naverSearch = naver.parseSearchResults(fixture('naver-series-webnovel-v1/r4/search-mobile.html'), naverPlan.requests[1].url, terms.naver, 5);
assert.equal(naverSearch[0]?.remoteId, '13327562');
assert.equal(naverSearch[0]?.author, '한서연');
const naverDetail = naver.parseDetail(fixture('naver-series-adult-detail.html'), naverPlan.details[0].url, 8000);
assert.equal(naverDetail?.title, terms.naver.title);
assert.equal(naver.shouldFetchDetailFallback([{ body:'<html><head><meta property="og:title" content="사월의 상애 [독점]"></head></html>', finalUrl:naverPlan.details[0].url }], naverPlan.details[0].url, '13327562', 8000), true);

const kakao = getMetadataSiteAdapter('kakaopage-webnovel-v1');
const kakaoPlan = assertDevicePlan(kakao, 12, 2, 'https://page.kakao.com/content/69767422', '69767422', 3);
assert.equal(kakaoPlan.requests[0].requestProfile, 'kakaopage-json');
assert.equal(kakaoPlan.details[0].requestProfile, 'kakaopage-json');
const kakaoSearch = kakao.parseSearchResults(fixture('kakaopage-webnovel-v1/r12/search-mobile.html'), kakaoPlan.requests[1].url, terms.kakao, 5);
assert.equal(kakaoSearch[0]?.remoteId, '69767422');
const kakaoMobileDetail = kakao.parseDetail(fixture('kakaopage-adult-detail.html'), kakaoPlan.details[2].url, 8000);
assert.equal(kakaoMobileDetail?.author, '메냑우유');

const novelpia = getMetadataSiteAdapter('novelpia-webnovel-v1');
const novelpiaPlan = assertDevicePlan(novelpia, 11, 3, 'https://novelpia.com/novel/294489', '294489', 2);
assert.equal(novelpiaPlan.requests[0].requestProfile, 'novelpia-json');
assert.equal(new URL(novelpiaPlan.requests[1].url).searchParams.get('novel_age'), '19');
const novelpiaSearch = novelpia.parseSearchResults(fixture('novelpia-webnovel-v1/r10/search-mobile.html'), novelpiaPlan.requests[2].url, terms.novelpia, 5);
assert.equal(novelpiaSearch[0]?.remoteId, '294489');
assert.equal(novelpia.parseDetail(fixture('novelpia-adult-detail.html'), novelpiaPlan.details[0].url, 8000)?.author, '물랑말랑');

const joara = getMetadataSiteAdapter('joara-search-card-v1');
const joaraPlan = assertDevicePlan(joara, 5, 2, 'https://www.joara.com/book/1728770', '1728770', 2);
const joaraSearch = joara.parseSearchResults(fixture('joara-search-card-v1/r5/search-mobile.html'), joaraPlan.requests[1].url, terms.joara, 5);
assert.equal(joaraSearch[0]?.remoteId, '1728770');
assert.equal(joaraSearch[0]?.inlineMetadata?.genres[0], '판타지');

const munpia = getMetadataSiteAdapter('munpia-webnovel-v1');
assert.equal(munpia.revision, 5);
assert.equal(munpia.buildSearchRequests({ title:'창설자' })[1].deviceProfile, 'mobile');
assert.equal(munpia.buildDetailRequests('https://www.munpia.com/novel/detail/523433', '523433')[1].deviceProfile, 'desktop');

for (const [adapter, url] of [
  [naver, naverPlan.requests[0].url], [kakao, kakaoPlan.requests[1].url],
  [novelpia, novelpiaPlan.requests[2].url], [joara, joaraPlan.requests[0].url]
]) {
  assert.throws(() => adapter.parseSearchResults('<html><body>비정상적인 접근입니다. CAPTCHA를 완료하세요.</body></html>', url, { title:'검증' }, 5), error => error?.code === 'METADATA_PROVIDER_ACCESS_BLOCKED');
  assert.throws(() => adapter.parseSearchResults('<html><body>성인 본인 인증이 필요합니다.</body></html>', url, { title:'검증' }, 5), error => error?.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED');
  assert.throws(() => adapter.parseSearchResults('<html><body>로그인 후 이용해 주세요.</body></html>', url, { title:'검증' }, 5), error => error?.code === 'METADATA_PLAYWRIGHT_LOGIN_REQUIRED');
}

for (const id of ['builtin-naver-series','builtin-kakaopage','builtin-novelpia','builtin-munpia','builtin-joara']) {
  const provider = getMetadataProvider(id);
  assert(provider.browserProfileSupported);
  assert(provider.browserReadySelector);
}

const serviceSource = fs.readFileSync(path.join(root, 'server/services/metadata-service.js'), 'utf8');
const playwrightSource = fs.readFileSync(path.join(root, 'server/services/metadata-playwright-service.js'), 'utf8');
assert(serviceSource.includes('shouldFetchDetailFallback'));
assert(serviceSource.includes("'METADATA_PROVIDER_ACCESS_BLOCKED'"));
assert(playwrightSource.includes('MOBILE_VIEWPORT'));
assert(playwrightSource.includes("['novelpia-json','kakaopage-json']"));
assert(playwrightSource.includes('credentials:\'include\''));

console.log(JSON.stringify({ pass:'v622-metadata-provider-mobile-pass', providers:6, mobileFixtures:4 }));
