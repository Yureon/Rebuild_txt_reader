const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

(async () => {
  global.window = { location:{ origin:'http://localhost' } };
  global.location = { href:'http://localhost/metadata.html', pathname:'/metadata.html' };
  const { ApiClient } = await import(`${pathToFileURL(path.join(root, 'public/scripts/rebuild/core/api.mjs')).href}?v623-filter-smoke`);
  const client = new ApiClient({ deviceId:'test-device' });
  let requested = '';
  client.get = async value => { requested = String(value); return { ok:true }; };
  await client.novelShelf({
    filters:{ metadataStatuses:['applied'], metadataProviderIds:['naver-series','novelpia'] },
    limit:60
  });
  const url = new URL(requested, 'http://localhost');
  assert.deepStrictEqual(url.searchParams.getAll('metadataStatus'), ['applied']);
  assert.deepStrictEqual(url.searchParams.getAll('metadataProvider'), ['naver-series','novelpia']);

  const route = read('server/routes/novels-routes.js');
  assert(route.includes("metadataStatuses:normalizeQueryList(query.metadataStatuses || query.metadataStatus || query.metadata"), 'metadata status query normalization missing');
  assert(route.includes("metadataProviderIds:normalizeQueryList(query.metadataProviderIds || query.metadataProvider || query.provider"), 'metadata provider query normalization missing');
  assert(route.includes("query.metadataStatuses[0] === 'applied' && !hasMetadata"), 'applied metadata predicate missing');
  assert(route.includes("query.metadataStatuses[0] === 'missing' && hasMetadata"), 'missing metadata predicate missing');
  assert(route.includes('metadataProviderMatchesFilter(metadata, query.metadataProviderIds)'), 'provider predicate missing');
  assert(route.includes('metadataStatuses:selected.filters.metadataStatuses'), 'metadata status response contract missing');
  assert(route.includes('metadataProviderIds:selected.filters.metadataProviderIds'), 'metadata provider response contract missing');

  const html = read('public/metadata.html');
  assert(html.includes('id="metadata-work-status-filter"'), 'metadata status select missing');
  assert(html.includes('id="metadata-work-provider-filter"'), 'metadata provider select missing');
  assert(html.includes('<option value="manual">수동 입력 (직접 추가)</option>'), 'manual provider filter option missing');
  assert(html.includes('id="metadata-work-filter-clear"'), 'metadata filter reset missing');

  const page = read('public/scripts/rebuild/metadata-page.mjs');
  assert(page.includes("metadataStatuses:page.metadataStatus === 'all' ? [] : [page.metadataStatus]"), 'client metadata status filter state missing');
  assert(page.includes("metadataProviderIds:page.metadataProviderId ? [page.metadataProviderId] : []"), 'client provider filter state missing');
  assert(page.includes('filters:currentWorkFilters()'), 'filtered shelf request missing');
  assert(page.includes("page.metadataStatus === 'missing' ? ''"), 'missing metadata/provider conflict handling missing');
  assert(page.includes('clearSelectedWork();'), 'stale selected work cleanup missing');
  assert(page.includes('metadataProviderName(work.metadata.providerId)'), 'provider badge label missing');
  assert(page.includes("url.searchParams.set('metadataProvider'"), 'filter URL persistence missing');
  assert(page.includes('consecutiveErrors >= 8'), 'metadata job polling retry boundary missing');
  assert(page.includes('수집 작업은 계속 실행될 수 있습니다.'), 'polling failure must not be reported as collection failure');
  assert(page.includes('수집 작업이 4분 이상 진행 중입니다.'), 'long-running job handoff message missing');

  const css = read('public/styles/metadata-page.css');
  assert(css.includes('.metadata-work-filters{'), 'filter layout style missing');
  assert(css.includes('.metadata-work-filter-clear[hidden]'), 'filter reset hidden contract missing');
  assert(css.includes('max-width:112px') && css.includes('text-overflow:ellipsis'), 'provider badge overflow guard missing');

  console.log('metadata work filters v623 smoke: ok');
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
