#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  getMetadataSiteAdapter,
  resolveMetadataSiteDirectTarget
} = require('../../server/services/metadata-site-adapters');
const { listMetadataProviders, getMetadataProvider, isPathAllowed } = require('../../server/services/metadata-provider-registry');

const root = path.resolve(__dirname, '../..');
const fixtureRoot = path.join(root, 'tools/fixtures/metadata');
const read = rel => fs.readFileSync(path.join(fixtureRoot, rel), 'utf8');
const json = rel => JSON.parse(read(rel));

function assertFields(actual, expected, fields) {
  assert(actual, 'metadata parse result must exist');
  for (const field of fields) assert.deepStrictEqual(actual[field] ?? null, expected[field] ?? null, `${field} mismatch`);
}

const directCases = [
  ['naver-series-webnovel-v1', 'naver-series-adult-detail.html', 'https://series.naver.com/novel/detail.series?productNo=13327562', { title:'사월의 상애 [독점]', author:'한서연', publicationStatus:'completed' }],
  ['kakaopage-webnovel-v1', 'kakaopage-adult-detail.html', 'https://page.kakao.com/content/69767422', { title:'오직 탈출만이 살 길이다 [19세 완전판]', author:'메냑우유', publicationStatus:'completed' }],
  ['novelpia-webnovel-v1', 'novelpia-adult-detail.html', 'https://novelpia.com/novel/294489', { title:'재벌집 망나니가 되었다', author:'물랑말랑', publicationStatus:'ongoing' }],
  ['joara-search-card-v1', 'joara-adult-detail.html', 'https://www.joara.com/book/1728770', { title:'모바일 치트 수저를 물고 태어난 변방의 남작은 할 일이 많다.', author:'더인디고', publicationStatus:null }]
];
for (const [key, fixture, url, expected] of directCases) {
  const adapter = getMetadataSiteAdapter(key);
  assert(adapter, `${key} adapter missing`);
  assertFields(adapter.parseDetail(read(fixture), url, 8000), expected, ['title','author','publicationStatus']);
}

{
  const adapter = getMetadataSiteAdapter('novelpia-webnovel-v1');
  const expected = json('novelpia-webnovel-v1/r1/expected.json');
  const results = adapter.parseSearchResults(read('novelpia-webnovel-v1/r1/search-primary.html'), 'https://novelpia.com/proc/novel?cmd=novel_search', { title:expected.searchQuery, author:expected.author }, 5);
  assert(results.length >= 1);
  const detail = adapter.parseDetail(read('novelpia-webnovel-v1/r1/detail-primary.html'), results[0].sourceUrl, 8000);
  assertFields(detail, expected, ['remoteId','sourceUrl','title','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','coverUrl']);
  const requests = adapter.buildSearchRequests({ title:'성인 대상 검증작', author:'검증성인작가' });
  assert.equal(requests.length, 3);
  assert.equal(requests[0].requestProfile, 'novelpia-json');
  assert.equal(new URL(requests[0].url).searchParams.get('novel_age'), '');
  assert.equal(new URL(requests[1].url).searchParams.get('novel_age'), '19');
  assert.equal(requests[1].requiresBrowserProfile, true);
  assert.equal(requests[1].optional, true);
  const adult = adapter.parseSearchResults(read('novelpia-webnovel-v1/r2/search-adult.json'), requests[1].url, { title:'성인 대상 검증작', author:'검증성인작가' }, 5);
  assert.equal(adult[0]?.remoteId, '991919');
  assert.equal(adult[0]?.sourceUrl, 'https://novelpia.com/novel/991919');
  assert.throws(
    () => adapter.parseSearchResults(read('novelpia-webnovel-v1/r2/age-gate.json'), requests[1].url, { title:'성인 대상 검증작' }, 5),
    error => error && error.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED'
  );
}
{
  const adapter = getMetadataSiteAdapter('munpia-webnovel-v1');
  const expected = json('munpia-webnovel-v1/r1/expected.json');
  const results = adapter.parseSearchResults(read('munpia-webnovel-v1/r1/search-primary.html'), 'https://www.munpia.com/search?query=test', { title:expected.searchQuery, author:expected.author }, 5);
  assert(results.length >= 1);
  const detail = adapter.parseDetail(read('munpia-webnovel-v1/r1/detail-primary.html'), results[0].sourceUrl, 8000);
  assertFields(detail, expected, ['remoteId','sourceUrl','title','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','coverUrl']);
  const currentHtml = '<html><body><a href="/novel/detail/912345" title="현재 문피아 작품">현재 문피아 작품</a><span class="author">현재작가</span></body></html>';
  const current = adapter.parseSearchResults(currentHtml, 'https://www.munpia.com/search?query=current', { title:'현재 문피아 작품', author:'현재작가' }, 5);
  assert.equal(current[0]?.sourceUrl, 'https://www.munpia.com/novel/detail/912345');
}
{
  const adapter = getMetadataSiteAdapter('joara-search-card-v1');
  const expected = json('joara-search-card-v1/r1/expected.json');
  const results = adapter.parseSearchResults(read('joara-search-card-v1/r1/search-primary.html'), 'https://www.joara.com/search?word=test', { title:expected.searchQuery, author:expected.author }, 5);
  assert(results.length >= 1);
  assertFields(results[0].inlineMetadata, expected, ['title','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','coverUrl']);
}
{
  const adapter = getMetadataSiteAdapter('kakaopage-webnovel-v1');
  const expected = json('kakaopage-webnovel-v1/r11/expected.json');
  const results = adapter.parseSearchResults(read('kakaopage-webnovel-v1/r11/search-primary.json'), 'https://bff-page.kakao.com/api/gateway/api/v2/search/series', { title:expected.title, author:expected.author }, 5);
  assert(results.length >= 1);
  const requests = adapter.buildDetailRequests(results[0].sourceUrl, results[0].remoteId);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].deviceProfile, 'mobile');
  const documents = [
    { requestUrl:requests[0].url, finalUrl:requests[0].url, responseType:'json', body:read('kakaopage-webnovel-v1/r11/detail-overview.json') },
    { requestUrl:requests[1].url, finalUrl:requests[1].url, responseType:'json', body:read('kakaopage-webnovel-v1/r11/detail-about.json') }
  ];
  const detail = adapter.parseDetailDocuments(documents, results[0].sourceUrl, results[0].remoteId, 8000);
  assertFields(detail, expected, ['remoteId','sourceUrl','title','author','synopsis','genres','tags','publicationStatus','publicationYear','sourceLanguage','coverUrl']);
}

const directUrls = [
  'https://series.naver.com/novel/detail.series?productNo=13327562',
  'https://m.series.naver.com/novel/detail.series?productNo=13327562',
  'https://page.kakao.com/content/69767422',
  'https://novelpia.com/novel/294489',
  'https://www.munpia.com/novel/detail/900002',
  'https://novel.munpia.com/900002',
  'https://www.joara.com/book/1728770',
  'https://ssn.so/series/283549/'
];
for (const url of directUrls) assert(resolveMetadataSiteDirectTarget(url), `direct URL unsupported: ${url}`);
assert.equal(listMetadataProviders().length, 6);
const kakao = getMetadataProvider('builtin-kakaopage');
assert(kakao.coverHosts.includes('page-images.kakaoentcdn.com'));
const munpia = getMetadataProvider('builtin-munpia');
assert.equal(isPathAllowed(munpia, '/900002'), true);
assert.equal(isPathAllowed(munpia, '/search'), true);
assert.equal(isPathAllowed(munpia, '/novel/detail/900002'), true);
assert.equal(isPathAllowed(munpia, '/not-allowed'), false);
assert.equal(kakao.browserProfileSupported, true);
assert.deepEqual(kakao.browserAuthHosts, ['accounts.kakao.com','kauth.kakao.com']);
assert.equal(getMetadataProvider('builtin-naver-series').browserProfileSupported, true);

console.log(JSON.stringify({ pass:'v622-metadata-provider-adapters-smoke-pass', providers:6, directFixtures:directCases.length }));
