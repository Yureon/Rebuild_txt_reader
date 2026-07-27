#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMetadataSiteAdapter, resolveMetadataSiteDirectTarget } = require('../../server/services/metadata-site-adapters');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');

const root = path.resolve(__dirname, '../..');
const fixture = name => fs.readFileSync(path.join(root, 'tools/fixtures/metadata/munpia-webnovel-v1/r2', name), 'utf8');
const adapter = getMetadataSiteAdapter('munpia-webnovel-v1');
assert(adapter, 'munpia adapter missing');
assert.equal(adapter.revision, 5);
assert.equal(adapter.requestProfile, 'browser-html');

const requests = adapter.buildSearchRequests({ title:'창설자', author:'츠타에제르' });
assert.equal(requests.length, 2);
assert.equal(new URL(requests[0].url).hostname, 'www.munpia.com');
assert.equal(new URL(requests[0].url).searchParams.get('tab'), 'TAG');
assert.equal(new URL(requests[1].url).hostname, 'm.munpia.com');
assert.equal(requests[1].fallbackOnly, true);
assert.equal(requests[1].deviceProfile, 'mobile');
assert(requests.every(item => item.requestProfile === 'browser-html'));

const results = adapter.parseSearchResults(
  fixture('search-current.html'),
  requests[0].url,
  { title:'창설자', author:'츠타에제르' },
  5
);
assert.equal(results[0]?.remoteId, '523433');
assert.equal(results[0]?.sourceUrl, 'https://www.munpia.com/novel/detail/523433');
assert.equal(results[0]?.author, '츠타에제르');
const structured = adapter.parseSearchResults(
  '<script type="application/ld+json">{"@type":"Book","name":"구조화 문피아 작품","author":"구조화작가","url":"https://www.munpia.com/novel/detail/555001"}</script>',
  requests[0].url,
  { title:'구조화 문피아 작품', author:'구조화작가' },
  5
);
assert.equal(structured[0]?.remoteId, '555001', 'structured-data candidate missing');

const detailRequests = adapter.buildDetailRequests(results[0].sourceUrl, results[0].remoteId);
assert.equal(detailRequests.length, 2);
assert.equal(detailRequests[0].url, 'https://m.munpia.com/novel/detail/523433');
assert.equal(detailRequests[1].url, 'https://www.munpia.com/novel/detail/523433');
assert.equal(detailRequests[1].fallbackOnly, true);
assert.equal(detailRequests[0].deviceProfile, 'mobile');
assert.equal(detailRequests[1].deviceProfile, 'desktop');
const detail = adapter.parseDetail(fixture('detail-mobile.html'), detailRequests[0].url, 8000);
assert(detail, 'current mobile detail parse failed');
assert.equal(detail.remoteId, '523433');
assert.equal(detail.title, '창설자');
assert.equal(detail.author, '츠타에제르');
assert.equal(detail.synopsis, '괴물을 죽이는 존재들이 신들의 동맹 제안을 마주한다.');
assert.deepEqual(detail.genres, ['현대판타지','퓨전']);
assert(detail.tags.includes('생존'));
assert(detail.tags.includes('이능력'));
assert.equal(detail.publicationStatus, 'ongoing');
assert.equal(detail.publicationYear, 2026);
assert.equal(detail.coverUrl, 'https://cdn1.munpia.com/files/attach/current-cover.jpg');

const merged = adapter.parseDetailDocuments([
  { requestUrl:detailRequests[0].url, finalUrl:detailRequests[0].url, body:fixture('detail-mobile.html') },
  { requestUrl:detailRequests[1].url, finalUrl:'https://www.munpia.com/novel/detail/523433', body:'<html><head><meta property="og:title" content="창설자 - 문피아"><meta property="og:url" content="https://www.munpia.com/novel/detail/523433"></head><body><h1>창설자</h1></body></html>' }
], results[0].sourceUrl, results[0].remoteId, 8000);
assert.equal(merged.author, '츠타에제르');
assert.equal(merged.sourceUrl, 'https://www.munpia.com/novel/detail/523433');

assert.equal(resolveMetadataSiteDirectTarget('https://m.munpia.com/novel/detail/523433')?.remoteId, '523433');
assert.equal(resolveMetadataSiteDirectTarget('https://mm.munpia.com/?id=523433&menu=novel')?.remoteId, '523433');
const provider = getMetadataProvider('builtin-munpia');
assert(provider.browserReadySelector.includes('/novel/detail/'));

assert.throws(
  () => adapter.parseSearchResults('<html><body>비정상적인 접근입니다. 잠시 후 다시 시도하십시오.</body></html>', requests[0].url, { title:'창설자' }, 5),
  error => error && error.code === 'METADATA_MUNPIA_ACCESS_BLOCKED'
);

console.log(JSON.stringify({ pass:'v622-metadata-munpia-current-pass', searchVariants:requests.length, detailVariants:detailRequests.length }));
