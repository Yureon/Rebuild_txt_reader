#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService } = require('../../server/services/metadata-playwright-service');

function response(url, body = '<html></html>') {
  return {
    status:() => 200,
    headers:() => ({ 'content-type':'text/html; charset=utf-8' }),
    url:() => url,
    body:async() => Buffer.from(body)
  };
}
function makePage(trace, collector = false) {
  let current = 'about:blank';
  let closed = false;
  return {
    url:() => current,
    isClosed:() => closed,
    async goto(url) {
      current = collector && trace.finalUrl ? trace.finalUrl : url;
      return response(current, trace.body);
    },
    async waitForTimeout() {},
    locator() { return { innerText:async() => trace.loginBody || '공급자 홈' }; },
    async content() { return trace.body || '<html><head><meta property="og:title" content="작품"></head><body>작품</body></html>'; },
    mouse:{ click:async()=>{}, wheel:async()=>{} },
    keyboard:{ insertText:async()=>{}, press:async()=>{} },
    async screenshot() { return Buffer.from('png'); },
    async close() { closed = true; }
  };
}
function makeChromium(trace) {
  return {
    async launchPersistentContext(dir) {
      fs.mkdirSync(dir, { recursive:true });
      fs.writeFileSync(path.join(dir, 'profile-marker.json'), '{}');
      const loginPage = makePage(trace, false);
      return {
        pages:() => [loginPage],
        newPage:async() => makePage(trace, true),
        request:{
          async fetch(url) {
            const finalUrl = trace.finalUrl || url;
            return response(finalUrl, trace.body || '<html></html>');
          }
        },
        close:async()=>{}
      };
    }
  };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-playwright-v593-security-'));
  const statePath = path.join(temp, 'profiles', 'profiles.json');
  const trace = { finalUrl:'', body:'<html><head><meta property="og:title" content="작품"></head><body>작품</body></html>', loginBody:'로그인' };
  const service = createMetadataPlaywrightService({
    profilesDir:path.join(temp, 'profiles'),
    statePath,
    chromium:makeChromium(trace),
    providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => [{ address:'93.184.216.34', family:4, hostname }],
    requestPinnedHttps:async url => {
      const current = url.toString();
      if (trace.finalUrl && trace.finalUrl !== current) {
        return { statusCode:302, headers:{ location:trace.finalUrl, 'content-type':'text/html; charset=utf-8' }, buffer:Buffer.alloc(0) };
      }
      return { statusCode:200, headers:{ 'content-type':'text/html; charset=utf-8' }, buffer:Buffer.from(trace.body || '<html></html>') };
    },
    settleMs:0,
    persistDelayMs:500,
    logger:{ warn(){}, error(){} }
  });
  const provider = getMetadataProvider('builtin-joara');
  const originalWriteFile = fs.promises.writeFile;
  const originalRm = fs.promises.rm;
  const originalRmSync = fs.rmSync;
  try {
    const started = await service.startLogin(provider.id);
    await assert.rejects(() => service.finishLogin(provider.id, started.sessionId), error => error && error.code === 'METADATA_PLAYWRIGHT_LOGIN_INCOMPLETE');
    trace.loginBody = '작품 목록';
    await service.interact(provider.id, started.sessionId, { action:'goto', url:provider.browserHomeUrl });
    await service.finishLogin(provider.id, started.sessionId);
    assert.strictEqual(service.canFetch(provider.id), true);

    let writes = 0;
    fs.promises.writeFile = async (...args) => { writes += 1; return originalWriteFile.apply(fs.promises, args); };
    trace.finalUrl = '';
    await Promise.all(Array.from({ length:12 }, () => service.fetchProvider(provider, 'https://www.joara.com/book/1234', { profile:'browser-json' })));
    await service.flushState();
    assert.strictEqual(writes, 1, 'successful fetch state updates must coalesce into one async persistence write');
    const fetchWrites = writes;

    trace.finalUrl = 'https://attacker.invalid/redirect';
    await assert.rejects(
      () => service.fetchProvider(provider, 'https://www.joara.com/book/1234', { profile:'browser-json' }),
      error => error && error.code === 'METADATA_PLAYWRIGHT_REDIRECT_BLOCKED'
    );

    trace.finalUrl = 'https://www.joara.com/login';
    trace.body = '<html><body>로그인</body></html>';
    await assert.rejects(
      () => service.fetchProvider(provider, 'https://www.joara.com/book/1234', { profile:'browser-json' }),
      error => error && error.code === 'METADATA_PLAYWRIGHT_LOGIN_REQUIRED'
    );
    assert.strictEqual(service.describe(provider.id).status, 'expired');

    let profileRemovals = 0;
    fs.promises.rm = async (target, options) => {
      if (String(target).includes('builtin-joara')) profileRemovals += 1;
      return originalRm.call(fs.promises, target, options);
    };
    fs.rmSync = () => { throw new Error('synchronous profile removal forbidden'); };
    await service.clearProfile(provider.id);
    assert.strictEqual(profileRemovals, 1, 'profile deletion must use one asynchronous recursive removal');
    fs.rmSync = originalRmSync;

    const source = fs.readFileSync('server/services/metadata-playwright-service.js', 'utf8');
    assert(!source.includes('fs.writeFileSync(statePath'), 'profile state persistence must not synchronously rewrite profiles.json');
    assert(!source.includes('fs.rmSync(profileDir'), 'profile deletion must not synchronously remove a Chromium profile');
    assert(source.includes('METADATA_PLAYWRIGHT_REDIRECT_BLOCKED'));
    console.log(JSON.stringify({ pass:'v593-metadata-playwright-security-persistence-smoke-pass', coalescedWrites:fetchWrites, profileRemovals }));
  } finally {
    fs.promises.writeFile = originalWriteFile;
    fs.promises.rm = originalRm;
    fs.rmSync = originalRmSync;
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
