#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

const metadataHtml = read('public/metadata.html');
const metadataPage = read('public/scripts/rebuild/metadata-page.mjs');
const adminHtml = read('public/admin/users.html');
const adminMetadata = read('public/scripts/admin/metadata.mjs');
const adminCss = read('public/styles/admin-users.css');
const cache = read('server/middleware/cache-policy.js');
const app = read('server/app.js');
const manifest = JSON.parse(read('extensions/metadata-login-helper/manifest.json'));
const current = require('./current-rebuild-version.js');
const build = current.CURRENT_REBUILD_VERSION;
const versionLabel = `v${current.CURRENT_REBUILD_VERSION_NUMBER}`;

assert.equal(manifest.version, require('../../package.json').version);
for (const token of [
  `data-build-version="${build}"`,
  'class="metadata-build-badge"',
  `>${versionLabel}<`,
  `/scripts/rebuild/metadata-page.mjs?v=${build}`
]) assert(metadataHtml.includes(token), `metadata build identity missing: ${token}`);

for (const forbidden of [
  'Cookie 저장', 'Cookie 제거', 'Cookie 미설정',
  '브라우저 Cookie 요청 헤더 값', 'data-provider-cookie',
  'data-admin-section="metadata"', 'owner-metadata-login-modal'
]) {
  assert(!metadataHtml.includes(forbidden) && !metadataPage.includes(forbidden), `collection page must not expose owner/Cookie setting: ${forbidden}`);
}

for (const token of [
  'data-admin-tab="metadata"',
  'data-admin-section="metadata"',
  'owner-metadata-login-modal',
  `/scripts/admin/metadata.mjs?v=${build}`
]) assert(adminHtml.includes(token), `owner metadata settings shell missing: ${token}`);

for (const token of [
  "OWNER_METADATA_SETTINGS_PASS = 'v587-owner-metadata-settings-pass'",
  'api.metadataProviders',
  'api.startMetadataProviderBrowserLogin',
  'api.metadataProviderBrowserLoginSession',
  'canManageBrowserProfiles',
  '로그인 시작',
  '다시 로그인'
]) assert(adminMetadata.includes(token), `owner login UI guard missing: ${token}`);

for (const forbidden of ['Cookie 저장','Cookie 제거','Cookie 미설정','chrome.cookies']) {
  assert(!adminHtml.includes(forbidden) && !adminMetadata.includes(forbidden), `legacy Cookie UI token remains: ${forbidden}`);
}

for (const token of [
  'rebuild-v644: owner metadata provider settings and Playwright login relay',
  '.owner-metadata-login-modal',
  'height:100dvh',
  'grid-template-columns:repeat(2,minmax(0,1fr))'
]) assert(adminCss.includes(token), `owner metadata mobile style missing: ${token}`);

for (const token of [
  'no-store, no-cache, must-revalidate, max-age=0',
  "res.setHeader('Pragma', 'no-cache')",
  "res.setHeader('Expires', '0')",
  "res.setHeader('X-TXT-Reader-Build', TXT_READER_BUILD)",
  "const { BUILD_ID: TXT_READER_BUILD } = require('../version-contract')"
]) assert(cache.includes(token), `cache/build header guard missing: ${token}`);
assert(app.includes('build: BUILD_ID'), 'health endpoint build identity missing');
console.log(JSON.stringify({ pass:'v587-owner-metadata-auth-ui-smoke-pass', build, helper:manifest.version }));
