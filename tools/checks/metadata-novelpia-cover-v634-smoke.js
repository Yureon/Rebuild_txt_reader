#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getMetadataSiteAdapter } = require('../../server/services/metadata-site-adapters');

const root = path.resolve(__dirname, '../..');
const adapter = getMetadataSiteAdapter('novelpia-webnovel-v1');
assert(adapter, 'NovelPia adapter must exist');
assert.equal(adapter.revision, 11);

const verifiedAdultHtml = fs.readFileSync(
  path.join(root, 'tools/fixtures/metadata/novelpia-adult-detail.html'),
  'utf8'
);
const verifiedAdult = adapter.parseDetail(
  verifiedAdultHtml,
  'https://novelpia.com/novel/294489',
  8000
);
assert.equal(
  verifiedAdult.coverUrl,
  'https://images.novelpia.com/imagebox/cover/fixture_q_ori.file',
  'the verified cover viewer link must win over NovelPia generic Open Graph art'
);

const page = coverMarkup => `<!doctype html><html><head>
  <link rel="canonical" href="https://novelpia.com/novel/282407">
  <meta property="og:image" content="//images.novelpia.com/img/2025-novelpia2.jpg">
  <meta property="og:image:secure_url" content="//images.novelpia.com/img/2025-novelpia2.jpg">
  <meta name="twitter:image" content="//images.novelpia.com/img/2025-novelpia2.jpg">
  </head><body>
  <div class="epnew-cover-box">${coverMarkup}</div>
  <div class="epnew-novel-title">가족 친화적인 게임</div>
  <a class="writer-name">SirLogan</a>
  </body></html>`;

assert.throws(
  () => adapter.parseDetail(
    page('<img class="cover_img s_inv" src="//images.novelpia.com/img/novel/adult_cover_img.jpg">'),
    'https://novelpia.com/novel/282407',
    8000
  ),
  error => error && error.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED' && /성인 모드 ON/u.test(error.message),
  'adult placeholder must produce an actionable verification-required error'
);

const lazyCover = adapter.parseDetail(
  page('<picture><source data-srcset="//images.novelpia.com/imagebox/cover/282407_q_ori.file 1x, //images.novelpia.com/imagebox/cover/282407_q_ori@2x.file 2x"><img class="cover_img" src="//images.novelpia.com/img/layout/readycover4.png"></picture>'),
  'https://novelpia.com/novel/282407',
  8000
);
assert.equal(lazyCover.coverUrl, 'https://images.novelpia.com/imagebox/cover/282407_q_ori.file');

const backgroundCover = adapter.parseDetail(
  page('<div style="background-image:url(//images.novelpia.com/imagebox/cover/282407_background.file)"></div>'),
  'https://novelpia.com/novel/282407',
  8000
);
assert.equal(backgroundCover.coverUrl, 'https://images.novelpia.com/imagebox/cover/282407_background.file');

const playwrightSource = fs.readFileSync(path.join(root, 'server/services/metadata-playwright-service.js'), 'utf8');
const registrySource = fs.readFileSync(path.join(root, 'server/services/metadata-provider-registry.js'), 'utf8');
assert(playwrightSource.includes("provider.id === 'builtin-novelpia'") && playwrightSource.includes('adult_cover_img'), 'Playwright must classify NovelPia adult placeholder responses as verification-required');
assert(registrySource.includes('성인 모드 ON') && registrySource.includes('실제 표지가 보이는 상태'), 'profile hint must explain the adult-cover requirement');

console.log(JSON.stringify({
  pass:'v634-metadata-novelpia-cover-smoke-pass',
  verifiedCover:verifiedAdult.coverUrl,
  placeholderRejected:true
}));
