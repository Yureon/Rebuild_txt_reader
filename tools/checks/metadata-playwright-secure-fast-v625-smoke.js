#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { getMetadataProvider } = require('../../server/services/metadata-provider-registry');
const { createMetadataPlaywrightService } = require('../../server/services/metadata-playwright-service');

function apiResponse(url, status, headers, body, trace) {
  return {
    status:() => status,
    headers:() => headers,
    url:() => url,
    body:async() => Buffer.from(body),
    async dispose() { trace.disposals += 1; }
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
    async goto(url) { current = url; trace.pageNavigations.push(url); return apiResponse(url, 200, { 'content-type':'text/html' }, '', trace); },
    async waitForSelector() { return {}; },
    async waitForTimeout() {},
    async content() { return '<html><head><meta property="og:title" content="작품"></head><body>작품 상세</body></html>'; },
    locator() { return { innerText:async() => '작품 상세' }; },
    async close() { closed = true; }
  };
}
function makeChromium(trace) {
  return {
    async launchPersistentContext() {
      const pages = [];
      return {
        pages:() => pages,
        async newPage() { trace.newPages += 1; const page = makePage(trace); pages.push(page); return page; },
        async route() {},
        request:{
          async fetch(url, options) {
            trace.apiCalls.push({ url, options });
            const parsed = new URL(url);
            if (!parsed.searchParams.has('step')) {
              return apiResponse(url, 302, { location:`${parsed.pathname}?step=2`, 'content-type':'text/html' }, '', trace);
            }
            return apiResponse(url, 200, { 'content-type':'text/html' }, '<html><head><meta property="og:title" content="작품"></head><body>작품</body></html>', trace);
          }
        },
        async close() { for (const page of pages) await page.close(); }
      };
    }
  };
}

(async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-playwright-v625-'));
  const profilesDir = path.join(temp, 'profiles');
  const providerDir = path.join(profilesDir, 'builtin-joara');
  fs.mkdirSync(providerDir, { recursive:true });
  fs.writeFileSync(path.join(providerDir, 'profile-marker.json'), '{}');
  fs.writeFileSync(path.join(profilesDir, 'profiles.json'), JSON.stringify({
    schemaVersion:1,
    providers:{ 'builtin-joara':{ providerId:'builtin-joara', status:'ready', updatedAt:new Date().toISOString() } }
  }));
  const trace = { apiCalls:[], disposals:0, dns:[], newPages:0, pageNavigations:[] };
  const service = createMetadataPlaywrightService({
    profilesDir,
    statePath:path.join(profilesDir, 'profiles.json'),
    chromium:makeChromium(trace),
    providerResolver:getMetadataProvider,
    resolvePublicAddresses:async hostname => { trace.dns.push(hostname); return [{ address:'93.184.216.34', family:4, hostname }]; },
    requestPinnedHttps:async (url, options, pinned) => {
      const value = url.toString();
      trace.apiCalls.push({ url:value, options, pinned });
      const parsed = new URL(value);
      if (!parsed.searchParams.has('step')) {
        return { statusCode:302, headers:{ location:`${parsed.pathname}?step=2`, 'content-type':'text/html' }, buffer:Buffer.alloc(0) };
      }
      return {
        statusCode:200,
        headers:{ 'content-type':'text/html' },
        buffer:Buffer.from('<html><head><meta property="og:title" content="?묓뭹"></head><body>?묓뭹</body></html>')
      };
    },
    settleMs:0,
    timeoutMs:5000,
    persistDelayMs:0,
    logger:{ warn(){}, error(){} }
  });
  const provider = getMetadataProvider('builtin-joara');
  try {
    const first = await service.fetchProvider(provider, 'https://www.joara.com/book/1234', { profile:'browser-json' });
    assert.equal(first.statusCode, 200);
    assert.equal(trace.apiCalls.length, 2, 'redirect chain must be followed manually');
    assert(trace.apiCalls.every(call => call.pinned.address === '93.184.216.34'), 'every redirect hop must use the selected public address as the socket pin');
    assert(trace.apiCalls.every(call => call.options.rawHeaders === true), 'cookie-aware requests must use the low-level pinned transport');
    assert(trace.dns.length >= 2, 'each redirect hop must be DNS-validated before request');

    await service.fetchProvider(provider, 'https://www.joara.com/book/1234', { profile:'browser-html' });
    await service.fetchProvider(provider, 'https://www.joara.com/book/1235', { profile:'browser-html' });
    assert.equal(trace.newPages, 0, 'static browser HTML must use the cookie-aware API request fast path');
    assert.equal(trace.pageNavigations.length, 0);

    await service.fetchProvider(provider, 'https://www.joara.com/book/1236', { profile:'browser-html', renderRequired:true });
    await service.fetchProvider(provider, 'https://www.joara.com/book/1237', { profile:'browser-html', renderRequired:true });
    assert.equal(trace.newPages, 2, 'render-required requests must use isolated ephemeral pages');
    assert.equal(trace.pageNavigations.length, 2);

    console.log(JSON.stringify({
      pass:'v625-metadata-playwright-secure-fast-path-pass',
      manualRedirectHops:trace.apiCalls.length,
      pinnedRedirectHops:2,
      directHtmlRequests:2,
      ephemeralRenderedPages:trace.newPages,
      lowCpuPass:first.lowCpuPass
    }));
  } finally {
    await service.stop().catch(() => {});
    fs.rmSync(temp, { recursive:true, force:true });
  }
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
