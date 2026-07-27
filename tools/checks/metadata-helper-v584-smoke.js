#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const helper = read('extensions/metadata-login-helper/popup.js');
const background = read('extensions/metadata-login-helper/background.js');
const urlPolicy = read('extensions/metadata-login-helper/url-policy.js');
const popupHtml = read('extensions/metadata-login-helper/popup.html');
const popupCss = read('extensions/metadata-login-helper/popup.css');
const naverLogin = read('tools/fixtures/metadata/naver-series-adult-search-v582/login.html');
const naverGuest = read('tools/fixtures/metadata/naver-series-adult-search-v582/guest.html');
const manifest = JSON.parse(read('extensions/metadata-login-helper/manifest.json'));
const gateFixture = read('tools/fixtures/metadata/kakaopage-adult-login-v583/age-gate.html');
const kakaoAuthFixture = read('tools/fixtures/metadata/kakaopage-adult-login-v583/account-redirect.txt').trim();

assert.equal(manifest.version, require('../../package.json').version);
assert(helper.includes("provider?.id !== 'builtin-kakaopage' && provider?.id !== 'builtin-naver-series'"), 'Naver and Kakao rendered search support missing');
for (const token of [
  'a[href*="/novel/detail.series"][href*="productNo="]',
  "item?.querySelector('.author')",
  "item?.querySelector('.ico.n19')",
  '19over_book',
  'coverAvailable',
  "['access', best.ageRestricted"
]) assert(helper.includes(token), `search candidate token missing: ${token}`);
assert(!helper.includes('outerHTML:'), 'raw HTML must not enter helper payload');
assert(popupHtml.includes('class="popup-header"') && popupHtml.includes('class="guide-card"') && popupHtml.includes('class="action-stack"'));
assert(popupCss.includes('width: 360px') && popupCss.includes('min-width: 260px') && popupCss.includes('@media (max-width: 300px)') && popupCss.includes('.action-stack'));
assert(popupHtml.includes('id="action-stack" class="action-stack" hidden') && popupHtml.includes('id="import-button" type="button" hidden'));
assert.equal(manifest.commands?._execute_action?.suggested_key?.default, 'Ctrl+Shift+Y');
for (const html of [naverLogin, naverGuest]) {
  assert(html.includes('productNo=4431634'));
  assert(html.includes('황제의 독사과'));
  assert(html.includes('class="author">주산지의꿈'));
  assert(html.includes('class="ico n19">19금'));
}
assert(naverLogin.includes('cover.jpg') && naverLogin.includes('class="dsc"'));
assert(naverGuest.includes('19over_book2_79x119.gif') && !naverGuest.includes('class="dsc"'));
assert.equal(manifest.background?.service_worker, 'background.js');
assert(!manifest.permissions.includes('tabs'), 'broad tabs permission is unnecessary when exact auth host permissions are present');
for (const host of ['https://accounts.kakao.com/*', 'https://kauth.kakao.com/*', 'https://nid.naver.com/*']) {
  assert(manifest.host_permissions.includes(host), `missing auth host permission: ${host}`);
}
for (const token of [
  'createNavigation(provider, best.url, best.title, tab.id)',
  'recoverTargetFromAuthUrl',
  '로그인 완료 후 작품 페이지로 돌아가기',
  '카카오 로그인 계속',
  '서비스 이용을 위해 연령 확인이 필요',
  "navigation:null, capture"
]) assert(helper.includes(token), `popup redirect token missing: ${token}`);
for (const token of [
  'chrome.tabs.onUpdated.addListener',
  'continueKakaoAgeGate',
  "url.pathname === '/relay/login'",
  'restoreCount',
  'recoverTargetFromAuthUrl'
]) assert(background.includes(token), `background redirect token missing: ${token}`);
assert(gateFixture.includes('서비스 이용을 위해 연령 확인이 필요') && gateFixture.includes('로그인 후 이용해 주세요.'));
assert(kakaoAuthFixture.includes('accounts.kakao.com/login') && kakaoAuthFixture.includes('60374376'));
assert(!helper.includes('input[type="password"]') && !background.includes('input[type="password"]'), 'helper must not inspect login credentials');
assert(!background.includes('lastAuthUrl') && !background.includes('lastRelayUrl'), 'transient OAuth/login URLs must not be persisted');

const KEY = 'txtReaderMetadataCaptureWorkflowV1';
const future = new Date(Date.now() + 3600_000).toISOString();
const flush = () => new Promise(resolve => setTimeout(resolve, 0));
function makeWorkflow(providerId, providerName, targetUrl, withNavigation = true) {
  return {
    pairing: {
      token: 'token', workId: 'work', workTitle: '성인 작품', expiresAt: future,
      providers: [{ id: providerId, name: providerName, hosts: providerId === 'builtin-kakaopage' ? ['page.kakao.com'] : ['series.naver.com'] }]
    },
    capture: null,
    ...(withNavigation ? { navigation: {
      schemaVersion: 1, providerId, providerName, targetUrl, targetTitle: '성인 작품', tabId: 7,
      phase: 'opening-detail', startedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), restoreCount: 0
    } } : {})
  };
}
async function createHarness(initialWorkflow, gateResult = { detected:false, clicked:false }) {
  let listener = null;
  const store = { [KEY]: structuredClone(initialWorkflow) };
  const updates = [];
  const chrome = {
    storage: { local: {
      async get(key) { return { [key]: store[key] }; },
      async set(value) { Object.assign(store, structuredClone(value)); },
      async remove(key) { delete store[key]; }
    } },
    scripting: { async executeScript() { return [{ result: gateResult }]; } },
    tabs: {
      onUpdated: { addListener(fn) { listener = fn; } },
      async update(tabId, detail) { updates.push({ tabId, ...detail }); return { id:tabId, url:detail.url }; }
    }
  };
  const context = { chrome, URL, Set, Date, decodeURIComponent, console }; context.self = context; vm.runInNewContext(`${urlPolicy}\n${background.replace(/^importScripts\([^\n]+\);?\s*/u, '')}`, context, { filename:'background.js' });
  assert.equal(typeof listener, 'function');
  async function emit(changeInfo, url = changeInfo.url) {
    listener(7, changeInfo, { id:7, url });
    await flush(); await flush(); await flush();
  }
  return { store, updates, emit };
}

(async () => {
  const kakaoTarget = 'https://page.kakao.com/content/60374376';
  const kakao = await createHarness(makeWorkflow('builtin-kakaopage', '카카오페이지', kakaoTarget, false), { detected:true, clicked:true });
  await kakao.emit({ status:'complete' }, kakaoTarget);
  assert.equal(kakao.store[KEY].navigation.phase, 'age-gate-continued');
  assert(kakao.store[KEY].navigation.gateContinuedAt);
  assert.equal(kakao.store[KEY].navigation.discoveredFromDetailUrl, true);
  await kakao.emit({ url:kakaoAuthFixture }, kakaoAuthFixture);
  assert.equal(kakao.store[KEY].navigation.phase, 'login');
  assert(kakao.store[KEY].navigation.seenLoginAt);
  await kakao.emit({ status:'complete' }, 'https://page.kakao.com/');
  assert.deepStrictEqual(kakao.updates.at(-1), { tabId:7, url:kakaoTarget });
  assert.equal(kakao.store[KEY].navigation.restoreCount, 1);

  const naverTarget = 'https://series.naver.com/novel/detail.series?productNo=4431634';
  const naver = await createHarness(makeWorkflow('builtin-naver-series', '네이버 시리즈', naverTarget));
  const naverLogin = `https://nid.naver.com/nidlogin.login?url=${encodeURIComponent(naverTarget)}`;
  await naver.emit({ url:naverLogin }, naverLogin);
  assert.equal(naver.store[KEY].navigation.phase, 'login');
  await naver.emit({ status:'complete' }, 'https://series.naver.com/search/search.series?q=test');
  assert.deepStrictEqual(naver.updates.at(-1), { tabId:7, url:naverTarget });

  const recovered = await createHarness(makeWorkflow('builtin-kakaopage', '카카오페이지', kakaoTarget, false));
  await recovered.emit({ url:kakaoAuthFixture }, kakaoAuthFixture);
  assert.equal(recovered.store[KEY].navigation.providerId, 'builtin-kakaopage');
  assert.equal(recovered.store[KEY].navigation.targetUrl, kakaoTarget);
  assert.equal(recovered.store[KEY].navigation.recoveredFromAuthUrl, true);

  console.log(JSON.stringify({ pass:'v584-metadata-helper-redirect-smoke-pass', flows:['naver-direct-login','kakao-age-gate-login','auth-url-recovery'] }));
})().catch(error => { console.error(error); process.exitCode = 1; });
