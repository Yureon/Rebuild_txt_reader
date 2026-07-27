#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const adminHtml = read('public/admin/users.html');
const adminModule = read('public/scripts/admin/metadata.mjs');
const adminCss = read('public/styles/admin-users.css');
const metadataHtml = read('public/metadata.html');
const metadataPage = read('public/scripts/rebuild/metadata-page.mjs');
const routes = read('server/routes/metadata-routes.js');

for (const token of [
  'data-admin-tab="metadata"',
  'data-admin-section="metadata"',
  '메타데이터 설정',
  'owner-metadata-provider-list',
  'owner-metadata-login-modal',
  '로그인 완료 및 프로필 저장',
  `/scripts/admin/metadata.mjs?v=${CURRENT_REBUILD_VERSION}`
]) assert(adminHtml.includes(token), `owner metadata admin UI missing: ${token}`);

for (const token of [
  "OWNER_METADATA_SETTINGS_PASS = 'v587-owner-metadata-settings-pass'",
  'api.metadataProviders',
  'api.updateMetadataProvider',
  'api.probeMetadataProvider',
  'api.startMetadataProviderBrowserLogin',
  'api.metadataProviderBrowserLoginSession',
  'api.metadataProviderBrowserLoginAction',
  'api.finishMetadataProviderBrowserLogin',
  'api.cancelMetadataProviderBrowserLogin',
  'api.deleteMetadataProviderBrowserProfile',
  "payload.canManageBrowserProfiles !== true",
  "deviceId:'owner-console-metadata'"
]) assert(adminModule.includes(token), `owner metadata module missing: ${token}`);

for (const token of [
  'rebuild-v644: owner metadata provider settings and Playwright login relay',
  '.owner-metadata-provider-card',
  '.owner-metadata-login-card',
  'height:100dvh',
  '.owner-metadata-provider-actions{grid-template-columns:1fr}'
]) assert(adminCss.includes(token), `owner metadata mobile/style contract missing: ${token}`);

for (const forbidden of [
  'data-metadata-page-tab="providers"',
  'metadata-page-providers',
  'metadata-provider-list',
  'metadata-browser-login-modal',
  '공급자와 로그인 설정'
]) assert(!metadataHtml.includes(forbidden), `metadata collection page still owns provider login UI: ${forbidden}`);

for (const forbidden of [
  'startMetadataProviderBrowserLogin',
  'metadataProviderBrowserLoginSession',
  'finishMetadataProviderBrowserLogin',
  'deleteMetadataProviderBrowserProfile',
  'handleProviderAction',
  'installBrowserLoginEvents',
  'renderProviderList'
]) assert(!metadataPage.includes(forbidden), `metadata collection runtime still owns provider login action: ${forbidden}`);

for (const forbidden of ['Cookie 저장','Cookie 제거','Cookie 미설정','브라우저 Cookie 요청 헤더 값']) {
  assert(!adminHtml.includes(forbidden) && !adminModule.includes(forbidden) && !metadataHtml.includes(forbidden) && !metadataPage.includes(forbidden), `legacy Cookie UI remains: ${forbidden}`);
}

for (const token of [
  'function requireOwner(req, res, next)',
  "session.kind !== 'owner'",
  "router.post('/metadata/providers/:providerId/browser-login/start'",
  "router.get('/metadata/providers/:providerId/browser-login/session'",
  "router.post('/metadata/providers/:providerId/browser-login/action'",
  "router.post('/metadata/providers/:providerId/browser-login/finish'",
  "router.delete('/metadata/providers/:providerId/browser-profile'"
]) assert(routes.includes(token), `owner-only Playwright API boundary missing: ${token}`);

console.log(JSON.stringify({ pass:'v587-owner-metadata-settings-smoke-pass', location:'/admin/users.html#metadata' }));
