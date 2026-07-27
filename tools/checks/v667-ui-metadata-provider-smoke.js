#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const { createMetadataStoreService } = require('../../server/services/metadata-store-service');
const { createMetadataService } = require('../../server/services/metadata-service');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const {
  normalizeDefinition,
  createConfigurableProvider,
  createBuiltinRequestOverrideProvider
} = require('../../server/services/metadata-configurable-provider');

(async () => {
  const libraryHtml = read('public/library.html');
  assert(libraryHtml.includes('v675-library-entry-skeleton-pass'), 'library-only skeleton marker missing');
  assert(!libraryHtml.includes('reader-skeleton-block'), 'library boot must not render Reader skeleton blocks');
  assert(!libraryHtml.includes('app-skeleton-main'), 'library boot must not render Reader main skeleton');

  const metadataPage = read('public/scripts/rebuild/metadata-page.mjs');
  for (const token of ['async function refreshMetadataPage()', 'metadataPageRefreshing', "button.setAttribute('aria-busy','true')", 'await Promise.allSettled(tasks)', "button.textContent = '새로고침'"]) {
    assert(metadataPage.includes(token), `metadata refresh contract missing: ${token}`);
  }

  const guard = read('public/scripts/non-auth-autofill-guard.js');
  for (const token of ["GUARD_VERSION = 'v667'", "document.addEventListener('beforeinput'", "document.addEventListener('input', blockUnexpectedFill", "document.addEventListener('change', blockUnexpectedFill", 'data-autofill-readonly-lock', 'data-1p-ignore', 'data-bwignore', 'data-lpignore', 'data-protonpass-ignore']) {
    assert(guard.includes(token), `Whale/Chromium autofill guard missing: ${token}`);
  }
  assert(!guard.includes("document.addEventListener('focusin'"), 'focus alone must not unlock non-auth fields');
  assert(!guard.includes('1200'), 'time-based readonly release must not re-enable Chromium login autofill');

  const deferredHtml = read('public/fragments/deferred-ui.html');
  const deferredCss = read('public/styles/deferred-ui.css');
  const ownerCss = read('public/styles/owner.css');
  for (const token of ['보류 저장 다시 전송', '상태 다시 확인', 'recovery-action-group-label', '복구 요약', '캐시 관리', '검색 복구', '원본 상태', '수동 기록']) {
    assert(deferredHtml.includes(token), `recovery center cleanup missing: ${token}`);
  }
  assert(ownerCss.includes('rebuild-v667: recovery center information hierarchy'), 'recovery center hierarchy CSS missing');
  assert(deferredCss.includes('.settings-panel:not(.settings-page){height:min(820px,88vh);max-height:min(820px,88vh)}'), 'Reader settings modal fixed geometry missing');
  for (const token of ['.nsearch-retrybar{margin:0 12px 12px', '.nsearch-coverage-summary::before', "content:'범위'", '.nsearch-retry-actions{padding:3px']) {
    assert(deferredCss.includes(token), `search coverage footer polish missing: ${token}`);
  }

  const adminHtml = read('public/admin/users.html');
  const adminJs = read('public/scripts/admin/metadata.mjs');
  const api = read('public/scripts/rebuild/core/api.mjs');
  const routes = read('server/routes/metadata-routes.js');
  for (const tab of ['기본 메타데이터 공급자', '고급 메타데이터 공급자 관리', '메타데이터 정리']) assert(adminHtml.includes(tab), `metadata subtab missing: ${tab}`);
  for (const id of ['owner-metadata-custom-search-url','owner-metadata-custom-detail-url','owner-metadata-custom-provider-list']) assert(adminHtml.includes(id), `advanced provider form missing: ${id}`);
  for (const token of ['definitionDefaults', "value:'request'", "value:'selector'", '내장 parser 유지 · URL만 수정', 'selector parser로 교체', 'createCustomMetadataProvider', 'updateMetadataProviderDefinition', 'deleteMetadataProviderDefinition']) assert(adminJs.includes(token) || api.includes(token), `provider editor runtime missing: ${token}`);
  for (const route of ["router.post('/metadata/providers/custom'", "router.put('/metadata/providers/:providerId/definition'", "router.delete('/metadata/providers/:providerId/definition'"]) assert(routes.includes(route), `provider definition route missing: ${route}`);
  for (const boundary of ['requireSameOrigin', 'requireCsrf', 'requireOwner', 'requireMetadataKoreanLocale']) assert(routes.includes(boundary), `provider definition boundary missing: ${boundary}`);

  assert.throws(() => normalizeDefinition({ id:'bad', name:'Bad', searchUrlTemplate:'http://example.com/?q={query}', selectors:{} }), error => error?.code === 'METADATA_PROVIDER_DEFINITION_INVALID');
  assert.throws(() => normalizeDefinition({ id:'bad', name:'Bad', searchUrlTemplate:'https://example.com/?q={query}', selectors:{ searchResult:'div > a', searchTitle:'.title', searchLink:'a', detailTitle:'h1' } }), error => error?.code === 'METADATA_SELECTOR_UNSUPPORTED');

  const customDefinition = normalizeDefinition({
    id:'demo-site', name:'Demo', searchUrlTemplate:'https://books.example/search?q={query}', detailUrlTemplate:'https://books.example/book/{id}',
    selectors:{ searchResult:'.result', searchTitle:'.title', searchAuthor:'.author', searchLink:'a.detail', searchId:'a.detail', searchCover:'img.cover', detailTitle:'h1.title', detailAuthor:'.author', detailSynopsis:'.synopsis', detailGenres:'.genres .item', detailTags:'.tags .item', detailCover:'img.cover' },
    attributes:{ searchLink:'href', searchId:'data-id', searchCover:'src', detailCover:'src' }, coverHosts:['img.example']
  });
  assert.equal(customDefinition.id, 'custom-demo-site');
  const customProvider = createConfigurableProvider(customDefinition);
  const searchRequest = customProvider.adapter.buildSearchRequest({ title:'테스트 작품' }, 5);
  assert(searchRequest.url.includes('%ED%85%8C%EC%8A%A4%ED%8A%B8%20%EC%9E%91%ED%92%88'));
  const results = customProvider.adapter.parseSearchResults('<article class="result"><a class="detail" data-id="77" href="/book/77"><span class="title">테스트 작품</span></a><span class="author">작가</span><img class="cover" src="https://img.example/77.jpg"></article>', 'https://books.example/search?q=x', { title:'테스트 작품', author:'작가' }, 5);
  assert.equal(results[0]?.remoteId, '77');
  assert.equal(results[0]?.sourceUrl, 'https://books.example/book/77');
  const detail = customProvider.adapter.parseDetail('<h1 class="title">테스트 작품</h1><span class="author">작가</span><p class="synopsis">소개</p><div class="genres"><span class="item">판타지</span></div><div class="tags"><span class="item">성장</span></div><img class="cover" src="https://img.example/77.jpg">', 'https://books.example/book/77');
  assert.equal(detail.title, '테스트 작품');
  assert.deepEqual(detail.genres, ['판타지']);

  const builtin = getMetadataProvider('builtin-munpia');
  const requestOverride = createBuiltinRequestOverrideProvider({
    id:builtin.id, kind:'builtin', mode:'request', name:builtin.name,
    searchUrlTemplate:'https://www.munpia.com/search?query={query}&tab=NOVEL',
    detailUrlTemplate:'https://www.munpia.com/novel/detail/{id}'
  }, builtin);
  const requestList = requestOverride.adapter.buildSearchRequests({ title:'작품' }, 5);
  assert(requestList[0].url.includes('tab=NOVEL'), 'builtin URL override must replace primary request');
  assert(requestList.length >= 2, 'builtin URL override must preserve fallback requests');
  assert.strictEqual(requestOverride.adapter.parseSearchResults, builtin.adapter.parseSearchResults, 'URL-only override must preserve builtin parser');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'v667-provider-definition-'));
  const storePath = path.join(dir, 'work-metadata.json');
  const store = createMetadataStoreService({ storePath, logger:{ warn(){} } });
  await store.setProviderDefinitionDurably(customDefinition.id, customDefinition);
  assert.equal(store.getProviderDefinition(customDefinition.id)?.name, 'Demo');
  const service = createMetadataService({
    store,
    transport:{ async fetchProvider(){ throw new Error('network must not be used in v667 smoke'); } },
    coverService:{ async cacheRemoteCover(){ return null; } },
    queuePath:path.join(dir, 'queue.json'), bulkDir:path.join(dir, 'batches'), enabled:true, concurrency:1, maxJobs:4, maxAttempts:1, pollMs:20
  });
  const defaults = service.listProviders().find(item => item.id === 'builtin-munpia')?.definitionDefaults;
  assert(defaults?.searchUrlTemplate?.includes('{query}'), 'builtin provider editor must receive editable default search URL');
  const savedBuiltin = await service.saveProviderDefinition('builtin-munpia', { mode:'request', name:'문피아', searchUrlTemplate:'https://www.munpia.com/search?query={query}&tab=NOVEL', detailUrlTemplate:'https://www.munpia.com/novel/detail/{id}' });
  assert.equal(savedBuiltin.definitionMode, 'request');
  assert(savedBuiltin.adapterKey.includes('request-override'));
  assert(service.listProviders().some(item => item.id === customDefinition.id && item.providerKind === 'custom'));
  await service.removeCustomProvider(customDefinition.id);
  assert(!service.listProviders().some(item => item.id === customDefinition.id));
  await service.stop();

  const reload = createMetadataStoreService({ storePath, logger:{ warn(){} } });
  assert.equal(reload.getProviderDefinition('builtin-munpia')?.mode, 'request', 'builtin override must persist durably');
  assert.equal(reload.getProviderDefinition(customDefinition.id), null, 'deleted custom provider must stay deleted');
  await reload.close();
  fs.rmSync(dir, { recursive:true, force:true });

  console.log(JSON.stringify({
    pass:'v667-ui-metadata-provider-smoke-pass',
    requirements:8,
    customProvider:true,
    builtinUrlOverride:true,
    builtinParserPreserved:true,
    durableDefinitions:true,
    whaleGuard:'event-blocked'
  }));
})().catch(error => { console.error(error); process.exit(1); });
