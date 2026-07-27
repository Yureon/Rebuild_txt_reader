#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright-chromium');

const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
const executablePath = process.env.TXT_READER_CHROMIUM_PATH || chromium.executablePath();
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon' };
function apiPayload(pathname) {
  if (pathname === '/api/user-state') return { shared:null, device:null, sharedVersion:0, deviceVersion:0, syncPolicySummary:null };
  if (pathname === '/api/user-access/snapshot') return { userId:'v599-browser', accessVersion:1, accessibleNovelIds:[], metadataAccessAllowed:true, appPermissions:{ fullSearch:true, metadataAccess:true }, libraryAccess:{ mode:'all', folders:[] }, folderMutationAccess:{ moveFolders:[], deleteFolders:[] } };
  if (pathname === '/api/novels/shelf') return { items:[], total:0, nextCursor:'', counts:{ all:0, favorites:0, recent:0 } };
  if (pathname === '/api/novels/shelf/filters') return { publicationStatuses:[], authors:[], categories:[], tags:[], groupKinds:[] };
  if (pathname === '/api/csrf') return { csrfToken:'v599-browser-csrf' };
  if (pathname === '/api/fonts') return { fonts:[] };
  if (pathname === '/api/search-performance-profile') return { profile:'balanced' };
  return { ok:true };
}
function safeFile(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const rel = pathname === '/' ? 'library.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(publicRoot, rel);
  return file.startsWith(publicRoot + path.sep) || file === publicRoot ? file : null;
}
async function run() {
  const browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block', reducedMotion:'reduce', locale:'ko-KR' });
    const page = await context.newPage();
    const moduleUrls = new Set();
    page.on('request', request => { const url = new URL(request.url()); if (url.pathname.endsWith('.mjs')) moduleUrls.add(url.pathname); });
    page.on('pageerror', error => errors.push(String(error.message || error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('https://reader.test/**', async route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/api/')) {
        return route.fulfill({ status:200, contentType:'application/json; charset=utf-8', headers:{'access-control-allow-origin':'*'}, body:JSON.stringify(apiPayload(url.pathname)) });
      }
      const file = safeFile(url.pathname);
      if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status:404, body:'not found' });
      return route.fulfill({ status:200, contentType:contentTypes[path.extname(file)] || 'application/octet-stream', headers:{'access-control-allow-origin':'*'}, body:fs.readFileSync(file) });
    });
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ status:200, contentType:'text/css; charset=utf-8', body:'' }));
    await page.route('https://fonts.gstatic.com/**', route => route.fulfill({ status:204, body:'' }));
    let html = fs.readFileSync(path.join(publicRoot, 'library.html'), 'utf8');
    html = html.replace('<head>', '<head><base href="https://reader.test/">').replace(/<script[^>]+service-worker-register[^>]*><\/script>/gi, '');
    await page.setContent(html, { waitUntil:'domcontentloaded' });
    await page.waitForFunction(() => window.__TXT_READER_REBUILD_BOOT_OK__ === true, null, { timeout:20000 });
    await page.waitForTimeout(250);
    const perf = await page.evaluate(() => ({
      bootOk:window.__TXT_READER_REBUILD_BOOT_OK__ === true,
      longTasks:(window.__TXT_READER_PERF__?.longTasks || []).map(item => Number(item.duration) || 0),
      bootDuration:Number(window.__TXT_READER_PERF__?.phases?.bootComplete?.durationMs || window.__TXT_READER_PERF__?.bootDurationMs || 0),
      cards:document.querySelectorAll('.library-shelf-card').length
    }));
    const maxLongTask = perf.longTasks.length ? Math.max(...perf.longTasks) : 0;
    assert(perf.bootOk, 'library boot must complete');
    assert(moduleUrls.size <= 100, `browser boot module requests ${moduleUrls.size} > 100`);
    assert(perf.longTasks.length <= 2, `too many initial long tasks: ${perf.longTasks.length}`);
    assert(maxLongTask <= 180, `initial long task too long: ${maxLongTask}`);
    assert.deepStrictEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
    console.log(JSON.stringify({ pass:'v599-browser-initial-load-smoke-pass', modules:moduleUrls.size, longTasks:perf.longTasks, maxLongTask, bootDuration:perf.bootDuration }));
    await context.close();
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error.stack || error); process.exit(1); });
