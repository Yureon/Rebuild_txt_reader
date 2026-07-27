#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider, listMetadataProviders } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService, classifyUrl, validateInteractiveUrl } = require('../../server/services/metadata-playwright-service');

const PROVIDER_IDS = [
  'builtin-naver-series',
  'builtin-kakaopage',
  'builtin-novelpia',
  'builtin-munpia',
  'builtin-joara'
];

function response(url) {
  return { status:() => 200, headers:() => ({ 'content-type':'text/html; charset=utf-8' }), url:() => url, body:async() => Buffer.from('<html></html>') };
}
function page(trace) {
  let current = 'about:blank';
  return {
    url:() => current,
    isClosed:() => false,
    async goto(url) { current = url; trace.gotos.push(url); return response(url); },
    async waitForTimeout() {},
    locator() { return { innerText:async() => '로그인 완료된 공급자 화면' }; },
    async screenshot() { return Buffer.from('png'); },
    async content() { return '<html><head><meta property="og:title" content="작품"></head><body>작품</body></html>'; },
    mouse:{ click:async()=>{}, wheel:async()=>{} },
    keyboard:{ insertText:async()=>{}, press:async()=>{} },
    close:async()=>{}
  };
}
function chromium(trace) {
  return {
    async launchPersistentContext(dir) {
      fs.mkdirSync(dir, { recursive:true });
      fs.writeFileSync(path.join(dir, 'profile-marker.json'), '{}');
      const first = page(trace);
      return {
        pages:() => [first],
        newPage:async() => page(trace),
        request:{ fetch:async(url) => response(url) },
        close:async()=>{}
      };
    }
  };
}

(async () => {
  const providers = listMetadataProviders();
  assert.equal(providers.find(item => item.id === 'builtin-ssn')?.browserProfileSupported, false, 'public-only SSN provider must not expose a Playwright profile');
  const playwrightProviders = providers.filter(item => item.browserProfileSupported);
  assert.deepStrictEqual(playwrightProviders.map(item => item.id), PROVIDER_IDS);
  for (const provider of playwrightProviders) {
    assert.strictEqual(provider.browserProfileSupported, true, `${provider.id} must support Playwright profiles`);
    assert.match(provider.browserHomeUrl, /^https:\/\//);
    assert.match(provider.browserLoginUrl, /^https:\/\//);
    assert.doesNotThrow(() => validateInteractiveUrl(provider, provider.browserHomeUrl));
    assert.doesNotThrow(() => validateInteractiveUrl(provider, provider.browserLoginUrl));
  }
  assert.strictEqual(classifyUrl(getMetadataProvider('builtin-munpia'), 'https://nssl.munpia.com/login'), 'auth');
  assert.strictEqual(classifyUrl(getMetadataProvider('builtin-joara'), 'https://www.joara.com/login'), 'provider');

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-all-providers-v593-'));
  const trace = { gotos:[] };
  const service = createMetadataPlaywrightService({
    profilesDir:path.join(temp, 'profiles'),
    statePath:path.join(temp, 'profiles', 'profiles.json'),
    chromium:chromium(trace),
    providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => [{ address:'93.184.216.34', family:4, hostname }],
    settleMs:0,
    logger:{ warn(){} }
  });
  try {
    for (const providerId of PROVIDER_IDS) {
      const provider = getMetadataProvider(providerId);
      const started = await service.startLogin(providerId);
      assert.match(started.sessionId, /^mpl_[a-f0-9]{24}$/);
      await service.interact(providerId, started.sessionId, { action:'goto', url:provider.browserHomeUrl });
      const ready = await service.finishLogin(providerId, started.sessionId);
      assert.strictEqual(ready.status, 'ready');
      assert.strictEqual(service.canFetch(providerId), true);
      await service.clearProfile(providerId);
    }
  } finally {
    await service.stop();
    fs.rmSync(temp, { recursive:true, force:true });
  }
  console.log(JSON.stringify({ pass:'v593-metadata-playwright-all-providers-smoke-pass', providers:PROVIDER_IDS.length, launches:trace.gotos.length }));
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
