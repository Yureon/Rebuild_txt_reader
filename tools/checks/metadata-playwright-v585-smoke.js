#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService } = require('../../server/services/metadata-playwright-service');

function makeFakeChromium(trace) {
  return {
    async launchPersistentContext(userDataDir) {
      fs.mkdirSync(userDataDir, { recursive:true });
      fs.writeFileSync(path.join(userDataDir, 'profile-marker.json'), '{"profile":true}', { mode:0o600 });
      let closed = false;
      const page = makePage(trace);
      const context = {
        pages:() => [page],
        async newPage() { return makePage(trace); },
        request:{
          async fetch(url, options) {
            trace.requests.push({ url, options });
            return makeResponse(url, 200, 'application/json; charset=utf-8', Buffer.from('{"ok":true}', 'utf8'));
          }
        },
        async close() { closed = true; trace.contextCloses += 1; },
        get closed() { return closed; }
      };
      trace.launches.push({ userDataDir });
      return context;
    }
  };
}
function makeResponse(url, status, contentType, body) {
  return {
    status:() => status,
    headers:() => ({ 'content-type':contentType }),
    url:() => url,
    body:async() => body
  };
}
function makePage(trace) {
  let currentUrl = 'about:blank';
  let closed = false;
  return {
    url:() => currentUrl,
    isClosed:() => closed,
    async goto(url) { currentUrl = url; trace.gotos.push(url); return makeResponse(url, 200, 'text/html; charset=utf-8', Buffer.alloc(0)); },
    async reload() { trace.reloads += 1; return makeResponse(currentUrl, 200, 'text/html; charset=utf-8', Buffer.alloc(0)); },
    async waitForTimeout() {},
    async screenshot() { return Buffer.from('89504e470d0a1a0a', 'hex'); },
    locator() { return { innerText:async() => '로그인 완료된 공급자 페이지' }; },
    async content() { return '<!doctype html><html><head><meta property="og:title" content="테스트 작품"></head><body>정상 상세</body></html>'; },
    mouse:{
      async click(x,y) { trace.clicks.push([x,y]); },
      async wheel(x,y) { trace.scrolls.push([x,y]); }
    },
    keyboard:{
      async insertText(text) { trace.typed.push(text); },
      async press(key) { trace.keys.push(key); }
    },
    async close() { closed = true; trace.pageCloses += 1; }
  };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-playwright-v585-'));
  const trace = { launches:[], gotos:[], clicks:[], scrolls:[], typed:[], keys:[], requests:[], reloads:0, contextCloses:0, pageCloses:0 };
  const profilesDir = path.join(temp, 'profiles');
  const statePath = path.join(profilesDir, 'profiles.json');
  const service = createMetadataPlaywrightService({
    profilesDir,
    statePath,
    chromium:makeFakeChromium(trace),
    providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => [{ address:'93.184.216.34', family:4, hostname }],
    requestPinnedHttps:async (url, options, pinned) => {
      trace.requests.push({ url:url.toString(), options, pinned });
      return { statusCode:200, headers:{ 'content-type':'application/json; charset=utf-8' }, buffer:Buffer.from('{"ok":true}', 'utf8') };
    },
    settleMs:0,
    sessionTtlMs:60_000,
    logger:{ warn(){} }
  });
  try {
    const started = await service.startLogin('builtin-naver-series');
    assert.match(started.sessionId, /^mpl_[a-f0-9]{24}$/);
    assert.equal(started.locationType, 'auth');
    assert.equal(service.describe('builtin-naver-series').status, 'login_active');

    await service.interact('builtin-naver-series', started.sessionId, { action:'click', x:120, y:240 });
    await service.interact('builtin-naver-series', started.sessionId, { action:'type', text:'admin@example.invalid' });
    await service.interact('builtin-naver-series', started.sessionId, { action:'type', text:'not-a-real-password' });
    await service.interact('builtin-naver-series', started.sessionId, { action:'key', key:'Enter' });
    await service.interact('builtin-naver-series', started.sessionId, { action:'goto', url:'https://series.naver.com/' });
    const shot = await service.screenshot('builtin-naver-series', started.sessionId);
    assert(shot.buffer.length > 0);
    const ready = await service.finishLogin('builtin-naver-series', started.sessionId);
    assert.equal(ready.status, 'ready');
    assert.equal(service.canFetch('builtin-naver-series'), true);

    const html = await service.fetchProvider(getMetadataProvider('builtin-naver-series'), 'https://series.naver.com/novel/detail.series?productNo=4431634', { profile:'default' });
    assert.equal(html.statusCode, 200);
    assert(html.body.includes('정상 상세'));
    const json = await service.fetchProvider(getMetadataProvider('builtin-naver-series'), 'https://series.naver.com/novel/detail.series?productNo=4431634', { profile:'browser-json' });
    assert.equal(json.body, '{"ok":true}');

    const persisted = fs.readFileSync(statePath, 'utf8');
    assert(!persisted.includes('admin@example.invalid'));
    assert(!persisted.includes('not-a-real-password'));
    const profileMode = fs.statSync(path.join(profilesDir, 'builtin-naver-series')).mode & 0o777;
    const stateMode = fs.statSync(statePath).mode & 0o777;
    if (process.platform !== 'win32') {
      assert.equal(profileMode, 0o700);
      assert.equal(stateMode, 0o600);
    }

    const cleared = await service.clearProfile('builtin-naver-series');
    assert.equal(cleared.status, 'not_configured');

    const manifest = JSON.parse(fs.readFileSync('extensions/metadata-login-helper/manifest.json','utf8'));
    assert.equal(manifest.version, '6.44.0');
    assert(!manifest.permissions.includes('cookies'), 'Metadata Helper must not request the cookies permission');
    assert(!fs.existsSync('server/services/metadata-auth-service.js'), 'legacy Cookie credential store must be removed');
    const env = fs.readFileSync('.env.example','utf8');
    assert(!env.includes('METADATA_AUTH_SECRET'));
    for (const token of ['METADATA_PLAYWRIGHT_ENABLED=1','METADATA_PLAYWRIGHT_HEADLESS=1','METADATA_PLAYWRIGHT_NO_SANDBOX=0']) assert(env.includes(token), `missing env token: ${token}`);
    const routes = fs.readFileSync('server/routes/metadata-routes.js','utf8');
    assert(!routes.includes("providers/:providerId/auth"));
    assert(routes.includes("providers/:providerId/browser-login/start") && routes.includes("providers/:providerId/browser-profile"));
    const page = fs.readFileSync('public/scripts/rebuild/metadata-page.mjs','utf8');
    const ownerMetadata = fs.readFileSync('public/scripts/admin/metadata.mjs','utf8');
    assert(ownerMetadata.includes('openLogin') && ownerMetadata.includes('finishLogin'));
    assert(!page.includes('openBrowserLogin') && !page.includes('finishBrowserLogin'));
    const api = fs.readFileSync('public/scripts/rebuild/core/api.mjs','utf8');
    assert(api.includes('startMetadataProviderBrowserLogin') && api.includes('finishMetadataProviderBrowserLogin'));
    assert(!page.includes('saveMetadataProviderAuth'));
    const helper = fs.readFileSync('extensions/metadata-login-helper/popup.js','utf8');
    assert(!helper.includes('chrome.cookies'));
    assert(helper.includes('__TXT_READER_METADATA_CAPTURE_HELPER_IMPORT')); 

    console.log(JSON.stringify({ pass:'v585-metadata-playwright-profile-smoke-pass', launches:trace.launches.length, browserFetches:trace.requests.length }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
