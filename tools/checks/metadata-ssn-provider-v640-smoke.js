#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  getMetadataSiteAdapter,
  resolveMetadataSiteDirectTarget
} = require('../../server/services/metadata-site-adapters');
const {
  getMetadataProvider,
  listMetadataProviders,
  resolveDirectMetadataTarget,
  isHostAllowed,
  isPathAllowed
} = require('../../server/services/metadata-provider-registry');

const root = path.resolve(__dirname, '../..');
const fixture = rel => fs.readFileSync(path.join(root, 'tools/fixtures/metadata/ssn-series-v1/r1', rel), 'utf8');
const adapter = getMetadataSiteAdapter('ssn-series-v1');
const provider = getMetadataProvider('builtin-ssn');

assert(adapter, 'ssn adapter missing');
assert(provider, 'ssn provider missing');
assert.equal(provider.name, '소설넷');
assert.equal(provider.priority, 5);
assert.equal(provider.browserProfileSupported, false);
assert.equal(provider.supportsSearch, true);
assert.equal(provider.supportsDirect, true);
assert.equal(listMetadataProviders().length, 6);

const requests = adapter.buildSearchRequests({ title:'전능한 검색창을 얻었다', author:'글이술술' }, 5);
assert.equal(requests.length, 1);
const searchUrl = new URL(requests[0].url);
assert.equal(searchUrl.origin, 'https://ssn.so');
assert.equal(searchUrl.pathname, '/series/');
assert.equal(searchUrl.searchParams.get('keyword'), '전능한 검색창을 얻었다');
assert.equal(requests[0].requestProfile, 'browser-html');

const results = adapter.parseSearchResults(fixture('search-primary.html'), requests[0].url, { title:'전능한 검색창을 얻었다', author:'글이술술' }, 10);
assert(results.length >= 1);
assert.equal(results[0].remoteId, '283549');
assert.equal(results[0].sourceUrl, 'https://ssn.so/series/283549/');
assert.equal(results[0].title, '전능한 검색창을 얻었다');
assert.equal(results[0].author, '글이술술');

const detail = adapter.parseDetail(fixture('detail-primary.html'), results[0].sourceUrl, 8000);
assert(detail, 'ssn detail missing');
assert.equal(detail.remoteId, '283549');
assert.equal(detail.sourceUrl, 'https://ssn.so/series/283549/');
assert.equal(detail.title, '전능한 검색창을 얻었다');
assert.equal(detail.author, '글이술술');
assert(detail.genres.includes('현대판타지'));
assert(detail.synopsis && detail.synopsis.length >= 20);
assert.equal(detail.publicationYear, 2026);
assert.equal(detail.sourceLanguage, 'ko');
assert.equal(detail.coverUrl, 'https://cdn1.munpia.com/v2/files/cover/2026/test');

const direct = resolveMetadataSiteDirectTarget('https://ssn.so/series/283549/');
assert.deepEqual(direct, { adapterKey:'ssn-series-v1', remoteId:'283549', canonicalUrl:'https://ssn.so/series/283549/' });
assert.equal(resolveDirectMetadataTarget('https://ssn.so/series/283549/')?.providerId, 'builtin-ssn');
assert.equal(resolveMetadataSiteDirectTarget('https://ssn.so/series/?keyword=test'), null);
assert.equal(resolveMetadataSiteDirectTarget('http://ssn.so/series/283549/'), null);
assert.equal(resolveMetadataSiteDirectTarget('https://evil.invalid/series/283549/'), null);

assert.equal(isHostAllowed(provider, 'ssn.so'), true);
assert.equal(isHostAllowed(provider, 'www.ssn.so'), true);
assert.equal(isHostAllowed(provider, 'evil.invalid'), false);
assert.equal(isHostAllowed(provider, 'cdn1.munpia.com', 'cover'), true);
assert.equal(isPathAllowed(provider, '/series/'), true);
assert.equal(isPathAllowed(provider, '/series/283549/'), true);
assert.equal(isPathAllowed(provider, '/admin'), false);

console.log(JSON.stringify({
  pass:'v640-metadata-ssn-provider-pass',
  priority:provider.priority,
  providers:listMetadataProviders().length,
  searchResults:results.length,
  detailFields:['title','author','genres','synopsis','publicationYear','coverUrl']
}));
