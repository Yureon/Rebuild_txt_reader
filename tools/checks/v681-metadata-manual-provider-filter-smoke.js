#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const {
  METADATA_MANUAL_PROVIDER_FILTER_PASS,
  MANUAL_METADATA_PROVIDER_ID,
  metadataProviderMatchesFilter
} = require('../../server/services/metadata-filter-service');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

(async () => {
  assert.strictEqual(MANUAL_METADATA_PROVIDER_ID, 'manual');
  assert.strictEqual(metadataProviderMatchesFilter({ providerId:'manual' }, ['manual']), true);
  assert.strictEqual(metadataProviderMatchesFilter({ providerId:'builtin-novelpia' }, ['manual']), false);
  assert.strictEqual(metadataProviderMatchesFilter(null, ['manual']), false);
  assert.strictEqual(metadataProviderMatchesFilter({ providerId:'manual' }, []), true);
  assert.strictEqual(metadataProviderMatchesFilter({ providerId:'manual\u0000' }, ['manual']), true);

  global.window = { location:{ origin:'http://localhost' } };
  global.location = { href:'http://localhost/metadata.html', pathname:'/metadata.html' };
  const { ApiClient } = await import(`${pathToFileURL(path.join(root, 'public/scripts/rebuild/core/api.mjs')).href}?v681-manual-provider-filter`);
  const client = new ApiClient({ deviceId:'manual-provider-filter' });
  let requested = '';
  client.get = async value => { requested = String(value); return { ok:true }; };
  await client.novelShelf({ filters:{ metadataStatuses:['applied'], metadataProviderIds:['manual'] }, limit:60 });
  const url = new URL(requested, 'http://localhost');
  assert.deepStrictEqual(url.searchParams.getAll('metadataStatus'), ['applied']);
  assert.deepStrictEqual(url.searchParams.getAll('metadataProvider'), ['manual']);

  const html = read('public/metadata.html');
  assert(html.includes('<span>적용 출처</span>'), 'metadata source label missing');
  assert(html.includes('<option value="manual">수동 입력 (직접 추가)</option>'), 'manual source option missing from initial HTML');

  const page = read('public/scripts/rebuild/metadata-page.mjs');
  assert(page.includes("const MANUAL_METADATA_PROVIDER_ID = 'manual';"), 'manual provider constant missing');
  assert(page.includes("if (id === MANUAL_METADATA_PROVIDER_ID) return MANUAL_METADATA_PROVIDER_LABEL;"), 'manual provider display label missing');
  assert(page.includes("node('option',{ value:MANUAL_METADATA_PROVIDER_ID, text:`${MANUAL_METADATA_PROVIDER_LABEL} (직접 추가)` })"), 'manual provider dynamic option missing');
  assert(page.includes('provider.disabled = page.metadataStatus === \'missing\';'), 'manual filter must remain available outside missing status');
  assert(page.includes('url.searchParams.set(\'metadataProvider\''), 'manual filter URL persistence missing');

  const route = read('server/routes/novels-routes.js');
  assert(route.includes("require('../services/metadata-filter-service')"), 'novel shelf must use metadata provider filter helper');
  assert(route.includes('metadataProviderMatchesFilter(metadata, query.metadataProviderIds)'), 'metadata provider predicate helper wiring missing');

  const store = read('server/services/metadata-store-service.js');
  assert(store.includes("providerId:'manual'"), 'manual metadata persistence provider marker missing');

  console.log(JSON.stringify({ pass:METADATA_MANUAL_PROVIDER_FILTER_PASS, providerId:MANUAL_METADATA_PROVIDER_ID }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
