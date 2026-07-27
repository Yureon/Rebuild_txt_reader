#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const routes=read('server/routes/metadata-routes.js');
const store=read('server/services/metadata-store-service.js');
const service=read('server/services/metadata-service.js');
const owner=read('public/scripts/admin/metadata.mjs');
const ownerLanguage=read('public/scripts/admin/site-language-runtime.mjs');
const page=read('public/scripts/rebuild/metadata-page.mjs');
const modal=read('public/scripts/rebuild/features/library-metadata-runtime.mjs');
const api=read('public/scripts/rebuild/core/api.mjs');
for(const token of ['requestedSiteLanguage','metadataAvailableForLocale','requireMetadataKoreanLocale','metadata_locale_unsupported','ko-only']) assert(routes.includes(token),token);
for(const route of ["'/novels/:novelId/metadata/collect'","'/metadata/collect-missing'","'/metadata/apply-pending'","'/metadata/providers/:providerId'","'/metadata/providers/:providerId/probe'"]) {
  const line=routes.split('\n').find(value=>value.includes(route));
  assert(line && line.includes('requireMetadataKoreanLocale'),route);
}
for(const field of ['autoApplyThreshold','requestIntervalMs','searchLimit']) {
  assert(store.includes(field),`store ${field}`);
  assert(service.includes(field),`service ${field}`);
  assert(owner.includes(field),`owner ${field}`);
}
assert(service.includes('effectiveProviderSettings'));
assert(owner.includes('v643-owner-metadata-locale-settings-pass'));
assert(ownerLanguage.includes('v643-owner-site-language-runtime-pass'));
assert(api.includes('X-Txt-Reader-Site-Language'));
for(const source of [page,modal]) {
  assert(source.includes('metadataAvailableForLocale'));
  assert(source.includes('한국어 사이트 언어에서만'));
}
console.log(JSON.stringify({pass:'v643-owner-metadata-locale-settings-pass',localeGate:true,directSettings:true,clients:true}));
