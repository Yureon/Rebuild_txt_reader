#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  createMetadataPlaywrightService,
  METADATA_PLAYWRIGHT_DNS_PINNING_PASS
} = require('../../server/services/metadata-playwright-service');

const PASS = 'v674-metadata-playwright-dns-pinning-smoke-pass';
const PUBLIC_ADDRESS = '93.184.216.34';

function provider() {
  return {
    id:'builtin-dns-pinning-test',
    name:'DNS pinning test provider',
    browserProfileSupported:true,
    searchHosts:['metadata.test'],
    detailHosts:['metadata.test'],
    coverHosts:['static.metadata.test'],
    browserAuthHosts:['auth.metadata.test'],
    browserResourceHostSuffixes:['metadata.test'],
    browserLoginPathPrefixes:['/login'],
    browserHomeUrl:'https://metadata.test/',
    browserLoginUrl:'https://auth.metadata.test/login',
    allowedPathPrefixes:['/']
  };
}

function makePage(trace) {
  let current = 'about:blank';
  let closed = false;
  return {
    url:() => current,
    isClosed:() => closed,
    once() {},
    async setViewportSize() {},
    async setExtraHTTPHeaders() {},
    async goto(url) {
      current = String(url);
      trace.pageNavigations.push(current);
      return { status:() => 200, headers:() => ({ 'content-type':'text/html' }) };
    },
    async waitForTimeout() {},
    locator() { return { innerText:async() => 'provider home' }; },
    async evaluate(_fn, input) {
      trace.pageEvaluateInputs.push(input);
      return {
        statusCode:200,
        headers:{ 'content-type':'application/json' },
        body:'{"via":"page"}',
        finalUrl:input.url,
        byteLength:14
      };
    },
    async close() { closed = true; }
  };
}

function makeChromium(trace) {
  return {
    async launchPersistentContext(_dir, options) {
      trace.launchOptions = options;
      const context = {
        pages:() => [],
        async newPage() { return makePage(trace); },
        async route(pattern, handler) {
          trace.routePattern = pattern;
          trace.routeHandler = handler;
        },
        async cookies() {
          return [{ name:'session', value:'profile-cookie', domain:'metadata.test', path:'/', secure:true, httpOnly:true }];
        },
        async addCookies(cookies) { trace.addedCookies.push(...cookies); },
        get request() {
          trace.apiRequestContextAccesses += 1;
          throw new Error('APIRequestContext must not be used by the pinned transport');
        },
        async close() {}
      };
      return context;
    }
  };
}

async function exerciseRoute(handler, url, resourceType) {
  const trace = { continued:0, aborted:0 };
  await handler({
    request:() => ({ url:() => url, resourceType:() => resourceType }),
    continue:async() => { trace.continued += 1; },
    abort:async() => { trace.aborted += 1; }
  });
  return trace;
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-playwright-v674-dns-'));
  const profilesDir = path.join(temp, 'profiles');
  const providerDir = path.join(profilesDir, provider().id);
  const statePath = path.join(profilesDir, 'profiles.json');
  fs.mkdirSync(providerDir, { recursive:true });
  fs.writeFileSync(path.join(providerDir, 'profile-marker.json'), '{}');
  fs.writeFileSync(statePath, JSON.stringify({
    schemaVersion:1,
    providers:{ [provider().id]:{ providerId:provider().id, status:'ready', updatedAt:new Date().toISOString() } }
  }));

  const trace = {
    resolverCalls:new Map(),
    socketPins:[],
    requestHeaders:[],
    addedCookies:[],
    pageNavigations:[],
    pageEvaluateInputs:[],
    launchOptions:null,
    routePattern:'',
    routeHandler:null,
    apiRequestContextAccesses:0
  };
  const service = createMetadataPlaywrightService({
    profilesDir,
    statePath,
    chromium:makeChromium(trace),
    providerResolver:id => id === provider().id ? provider() : null,
    resolvePublicAddresses:async hostname => {
      const host = String(hostname);
      const count = (trace.resolverCalls.get(host) || 0) + 1;
      trace.resolverCalls.set(host, count);
      // Launch pin + first low-level request are public. A subsequent lookup
      // simulates rebinding to loopback and must fail before any socket opens.
      if (host === 'metadata.test' && count >= 3) return [{ address:'127.0.0.1', family:4 }];
      return [{ address:PUBLIC_ADDRESS, family:4 }];
    },
    requestPinnedHttps:async (url, options, pinned) => {
      trace.socketPins.push({ url:url.toString(), pinned });
      trace.requestHeaders.push(options.headers);
      return {
        statusCode:200,
        headers:{
          'content-type':'application/json',
          'set-cookie':[
            'session=rotated-cookie; Path=/; Secure; HttpOnly; SameSite=Lax',
            'csrf=fresh-token; Path=/; Secure; SameSite=Strict'
          ]
        },
        buffer:Buffer.from('{"via":"pinned"}')
      };
    },
    settleMs:0,
    persistDelayMs:0,
    logger:{ warn(){}, error(){} }
  });

  try {
    const result = await service.fetchProvider(provider(), 'https://metadata.test/api/search', {
      profile:'novelpia-json',
      referer:'https://metadata.test/',
      browserSameOriginRequired:true
    });
    assert.equal(result.body, '{"via":"page"}');
    assert.equal(result.dnsPinPass, METADATA_PLAYWRIGHT_DNS_PINNING_PASS);
    assert.equal(trace.socketPins.length, 1);
    assert.deepStrictEqual(trace.socketPins[0].pinned, { address:PUBLIC_ADDRESS, family:4 });
    assert.match(String(trace.requestHeaders[0].cookie || ''), /session=profile-cookie/u, 'saved browser auth cookie must be forwarded to the pinned request');
    assert(trace.addedCookies.some(item => item.name === 'session' && item.value === 'rotated-cookie'), 'response auth cookie must return to the persistent browser context');
    assert.equal(trace.pageEvaluateInputs.length, 1, 'same-origin provider fallback must remain available');
    assert.equal(trace.resolverCalls.get('metadata.test'), 2, 'page fetch must use the launch-time Chromium pin instead of a second DNS precheck');
    assert.equal(trace.apiRequestContextAccesses, 0, 'APIRequestContext must not bypass the pinned socket transport');

    const resolverRules = String(trace.launchOptions.args.find(value => value.startsWith('--host-resolver-rules=')) || '');
    for (const host of ['metadata.test','auth.metadata.test','static.metadata.test']) {
      assert(resolverRules.includes(`MAP ${host} ${PUBLIC_ADDRESS}`), `exact host ${host} must be pinned in Chromium`);
    }
    assert(!resolverRules.includes('cdn.metadata.test'), 'suffix-only resource hosts must not be mapped');
    assert.equal(trace.routePattern, '**/*');
    const exactResource = await exerciseRoute(trace.routeHandler, 'https://static.metadata.test/app.js', 'script');
    assert.deepStrictEqual(exactResource, { continued:1, aborted:0 });
    const suffixOnlyResource = await exerciseRoute(trace.routeHandler, 'https://cdn.metadata.test/app.js', 'script');
    assert.deepStrictEqual(suffixOnlyResource, { continued:0, aborted:1 }, 'suffix-only resource host must fail closed without an exact pin');

    await assert.rejects(
      () => service.fetchProvider(provider(), 'https://metadata.test/api/search', { profile:'browser-json' }),
      error => error && error.code === 'METADATA_SSRF_BLOCKED'
    );
    assert.equal(trace.socketPins.length, 1, 'private rebound answer must be rejected before opening another socket');

    console.log(JSON.stringify({
      pass:PASS,
      dnsPinPass:METADATA_PLAYWRIGHT_DNS_PINNING_PASS,
      exactPinnedHosts:3,
      suffixOnlyBlocked:true,
      apiRequestContextAccesses:trace.apiRequestContextAccesses,
      pinnedSocketRequests:trace.socketPins.length,
      pageSameOriginFetches:trace.pageEvaluateInputs.length,
      reboundPrivateBlocked:true,
      profileCookiesForwarded:true,
      responseCookiesImported:trace.addedCookies.length
    }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
