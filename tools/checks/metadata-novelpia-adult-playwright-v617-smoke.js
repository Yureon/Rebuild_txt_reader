#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService } = require('../../server/services/metadata-playwright-service');

function response(url, body = '<html></html>', contentType = 'text/html; charset=utf-8') {
  return {
    status:() => 200,
    headers:() => ({ 'content-type':contentType }),
    url:() => url,
    body:async() => Buffer.from(body, 'utf8')
  };
}
function makePage(trace, kind) {
  let current = 'about:blank';
  let closed = false;
  return {
    url:() => current,
    isClosed:() => closed,
    async goto(url) { current = url; trace.gotos.push({ kind, url }); return response(url); },
    async waitForTimeout() {},
    async waitForSelector(selector) { trace.selectors.push(selector); },
    async setViewportSize(value) { trace.viewportSizes.push(value); },
    async setExtraHTTPHeaders(value) { trace.extraHeaders.push(value); },
    locator() { return { innerText:async() => trace.loginBody }; },
    async content() { return '<html><head><meta property="og:title" content="성인 대상 검증작"></head><body>작품 상세</body></html>'; },
    async evaluate(fn, input) {
      trace.evaluateSource = String(fn);
      trace.evaluateInputs.push(input);
      return {
        statusCode:trace.apiStatus,
        headers:{ 'content-type':'application/json; charset=utf-8' },
        body:trace.apiBody,
        finalUrl:input.url,
        byteLength:Buffer.byteLength(trace.apiBody, 'utf8')
      };
    },
    mouse:{ click:async()=>{}, wheel:async()=>{} },
    keyboard:{ insertText:async()=>{}, press:async()=>{} },
    async screenshot() { return Buffer.from('png'); },
    async close() { closed = true; trace.pageCloses += 1; }
  };
}
function makeChromium(trace) {
  return {
    async launchPersistentContext(dir) {
      fs.mkdirSync(dir, { recursive:true });
      fs.writeFileSync(path.join(dir, 'profile-marker.json'), '{"profile":true}', { mode:0o600 });
      const loginPage = makePage(trace, 'login');
      trace.launches += 1;
      return {
        pages:() => [loginPage],
        newPage:async() => makePage(trace, 'collector'),
        request:{
          async fetch(url, options = {}) {
            trace.apiRequestFallbacks += 1;
            trace.apiRequestOptions.push({ url, options });
            return response(url, trace.apiBody, 'application/json; charset=utf-8');
          }
        },
        close:async() => { trace.contextCloses += 1; }
      };
    }
  };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-novelpia-adult-v617-'));
  const profilesDir = path.join(temp, 'profiles');
  const statePath = path.join(profilesDir, 'profiles.json');
  const trace = {
    gotos:[], selectors:[], evaluateInputs:[], evaluateSource:'', viewportSizes:[], extraHeaders:[],
    loginBody:'로그인 완료된 노벨피아 작품 목록',
    apiStatus:200,
    apiBody:JSON.stringify({ status:200, result:{ novels:[{ novel_no:'991919', novel_name:'성인 대상 검증작', writer_nick:'검증성인작가' }] } }),
    launches:0, pageCloses:0, contextCloses:0, apiRequestFallbacks:0, apiRequestOptions:[]
  };
  const service = createMetadataPlaywrightService({
    profilesDir,
    statePath,
    chromium:makeChromium(trace),
    providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => [{ address:'93.184.216.34', family:4, hostname }],
    requestPinnedHttps:async (url, options, pinned) => {
      trace.apiRequestFallbacks += 1;
      trace.apiRequestOptions.push({ url:url.toString(), options, pinned });
      return {
        statusCode:trace.apiStatus,
        headers:{ 'content-type':'application/json; charset=utf-8' },
        buffer:Buffer.from(trace.apiBody, 'utf8')
      };
    },
    settleMs:0,
    persistDelayMs:0,
    logger:{ warn(){}, error(){} }
  });
  const provider = getMetadataProvider('builtin-novelpia');
  try {
    const login = await service.startLogin(provider.id);
    await service.interact(provider.id, login.sessionId, { action:'goto', url:provider.browserHomeUrl });
    const ready = await service.finishLogin(provider.id, login.sessionId);
    assert.equal(ready.status, 'ready');
    assert.equal(service.canFetch(provider.id), true);

    const adultUrl = provider.adapter.buildSearchRequests({ title:'성인 대상 검증작' })[1].url;
    const result = await service.fetchProvider(provider, adultUrl, {
      profile:'novelpia-json',
      referer:'https://novelpia.com/search',
      deviceProfile:'mobile'
    });
    assert.equal(result.statusCode, 200);
    assert(result.body.includes('991919'));
    assert.equal(trace.apiRequestFallbacks, 1, 'NovelPia JSON must use the cookie-aware API request fast path before page fallback');
    assert.equal(trace.evaluateInputs.length, 0, 'successful JSON fast path must not create or evaluate a provider page');
    assert.match(String(trace.apiRequestOptions[0]?.options?.headers?.['x-requested-with'] || ''), /XMLHttpRequest/u);
    assert.match(String(trace.apiRequestOptions[0]?.options?.headers?.['user-agent'] || ''), /Mobile Safari/u);
    assert.equal(result.lowCpuPass, 'v672-metadata-playwright-low-cpu-pass');

    trace.apiBody = JSON.stringify({ status:429, errmsg:'비정상적인 접근입니다. CAPTCHA를 완료하세요.' });
    await assert.rejects(
      () => service.fetchProvider(provider, adultUrl, { profile:'novelpia-json', referer:'https://novelpia.com/search', deviceProfile:'mobile' }),
      error => error && error.code === 'METADATA_PROVIDER_ACCESS_BLOCKED'
    );
    assert.equal(service.describe(provider.id).status, 'ready', 'access block must not expire or delete the saved profile');

    trace.apiBody = JSON.stringify({ status:403, errmsg:'성인 인증이 필요합니다. 본인 인증 후 이용해 주세요.' });
    await assert.rejects(
      () => service.fetchProvider(provider, adultUrl, { profile:'novelpia-json', referer:'https://novelpia.com/search' }),
      error => error && error.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED'
    );
    const verification = service.describe(provider.id);
    assert.equal(verification.status, 'verification_required');
    assert.equal(verification.configured, true, 'age verification failure must preserve the persistent profile');
    assert.equal(service.canFetch(provider.id), false);
    assert(fs.existsSync(path.join(profilesDir, provider.id, 'profile-marker.json')));

    const verifyLogin = await service.startLogin(provider.id, { targetUrl:'https://novelpia.com/novel/991919' });
    trace.loginBody = '성인 인증이 필요합니다. 본인 인증 후 이용해 주세요.';
    await assert.rejects(
      () => service.finishLogin(provider.id, verifyLogin.sessionId),
      error => error && error.code === 'METADATA_PLAYWRIGHT_AGE_VERIFICATION_REQUIRED'
    );
    trace.loginBody = '성인 대상 검증작 작품 상세 본문';
    const verified = await service.finishLogin(provider.id, verifyLogin.sessionId);
    assert.equal(verified.status, 'ready');
    assert.equal(service.canFetch(provider.id), true);

    const persisted = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    assert.equal(persisted.providers[provider.id].status, 'ready');
    const adminUi = fs.readFileSync('public/scripts/admin/metadata.mjs', 'utf8');
    const libraryUi = fs.readFileSync('public/scripts/rebuild/features/library-metadata-runtime.mjs', 'utf8');
    const adminCss = fs.readFileSync('public/styles/admin-users.css', 'utf8');
    const metadataCss = fs.readFileSync('public/styles/metadata-page.css', 'utf8');
    assert(adminUi.includes("status === 'verification_required'") && adminUi.includes('browserVerificationHint'));
    assert(libraryUi.includes("status === 'verification_required'"));
    assert(adminCss.includes('status-verification_required'));
    assert(metadataCss.includes('status-verification_required'));
    console.log(JSON.stringify({
      pass:'v622-metadata-mobile-playwright-pass',
      pageOriginFallbacks:trace.evaluateInputs.length,
      requestFastPaths:trace.apiRequestFallbacks,
      profilePreserved:true
    }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
