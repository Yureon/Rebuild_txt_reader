#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const doc = read('docs/web-metadata.md');
for (const token of [
  '기준 버전: `rebuild-v679`', '네이버 시리즈', '카카오페이지', '노벨피아', '문피아', '조아라',
  '서버 Playwright 영구 프로필', 'Metadata Helper 확장 프로그램', 'metadata-browser-profiles',
  '/admin/users.html#metadata', '`metadata.html`', 'METADATA_PLAYWRIGHT_ENABLED', 'METADATA_PLAYWRIGHT_HEADLESS',
  'HTTPS 443만 허용', 'loopback, private, link-local', 'content-addressed', '32 shard', '20,000개',
  '48 MiB', 'folder prefix facet', '이미 불러온 item 수', '실제 5개 공급자 계정 로그인',
  'v584-web-metadata-doc-pass', 'v676-web-metadata-bounded-load-pass'
]) assert.ok(doc.includes(token), `web metadata doc token missing: ${token}`);
assert(!doc.includes('AES-256-GCM'));
const env = read('.env.example');
for (const token of ['METADATA_FETCH_ENABLED=1','METADATA_PLAYWRIGHT_ENABLED=1','METADATA_PLAYWRIGHT_HEADLESS=1','METADATA_QUEUE_CONCURRENCY=1','METADATA_REQUEST_INTERVAL_MS=3000','METADATA_MAX_CANDIDATE_RESIDENT_BYTES=50331648']) assert.ok(env.includes(token), `.env metadata token missing: ${token}`);
for (const rel of ['docker-compose.yml','docker-compose.example.yml','docker-compose.cloudflare-tunnel.example.yml']) {
  const compose = read(rel);
  for (const token of ['METADATA_FETCH_ENABLED','METADATA_PLAYWRIGHT_ENABLED','METADATA_PLAYWRIGHT_HEADLESS','METADATA_QUEUE_CONCURRENCY']) assert.ok(compose.includes(token), `${rel} missing ${token}`);
  assert(!compose.includes('METADATA_AUTH_SECRET'));
}
for (const rel of ['extensions/metadata-login-helper/manifest.json','extensions/metadata-login-helper/popup.js','extensions/metadata-login-helper/background.js','server/services/metadata-browser-capture-service.js','server/services/metadata-playwright-service.js','server/workers/metadata-candidate-bounded-loader.js','public/scripts/admin/metadata.mjs']) assert.ok(fs.existsSync(path.join(root, rel)), `metadata asset missing: ${rel}`);
console.log(JSON.stringify({ pass:'v676-metadata-docs-smoke-pass' }));
