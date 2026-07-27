#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright-chromium');

const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
const executablePath = process.env.TXT_READER_CHROMIUM_PATH || chromium.executablePath();
const SAMPLE_COUNT = Math.max(3, Math.min(7, Number(process.env.TXT_READER_PERF_SAMPLES) || 3));
const MAX_MODULES = 100;
const MAX_LONG_TASKS = 2;
const MAX_LONG_TASK_MS = 180;
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.ico':'image/x-icon' };

function apiPayload(pathname) {
  if (pathname === '/api/user-state') return { shared:null, device:null, sharedVersion:0, deviceVersion:0, syncPolicySummary:null };
  if (pathname === '/api/user-access/snapshot') return { userId:'v600-browser', accessVersion:1, accessibleNovelIds:[], metadataAccessAllowed:true, appPermissions:{ fullSearch:true, metadataAccess:true }, libraryAccess:{ mode:'all', folders:[] }, folderMutationAccess:{ moveFolders:[], deleteFolders:[] } };
  if (pathname === '/api/novels/shelf') return { items:[], total:0, nextCursor:'', counts:{ all:0, favorites:0, recent:0 } };
  if (pathname === '/api/novels/shelf/filters') return { publicationStatuses:[], authors:[], categories:[], tags:[], groupKinds:[] };
  if (pathname === '/api/csrf') return { csrfToken:'v600-browser-csrf' };
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
async function installRoutes(page) {
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
}
async function measure(browser, label) {
  const context = await browser.newContext({ viewport:{ width:390, height:844 }, serviceWorkers:'block', reducedMotion:'reduce', locale:'ko-KR' });
  const page = await context.newPage();
  const errors = [];
  const moduleUrls = new Set();
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.endsWith('.mjs')) moduleUrls.add(url.pathname); });
  page.on('pageerror', error => errors.push(String(error.message || error)));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await installRoutes(page);
  let html = fs.readFileSync(path.join(publicRoot, 'library.html'), 'utf8');
  html = html.replace('<head>', '<head><base href="https://reader.test/">').replace(/<script[^>]+service-worker-register[^>]*><\/script>/gi, '');
  await page.setContent(html, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.__TXT_READER_REBUILD_BOOT_OK__ === true, null, { timeout:20000 });
  await page.waitForTimeout(100);
  const perf = await page.evaluate(() => {
    const store = window.__TXT_READER_PERF__ || {};
    const bootStart = Number(store.phases?.bootStart?.at);
    const bootComplete = Number(store.phases?.bootComplete?.at);
    const longTasks = (store.longTasks || []).filter(item => {
      const taskStart = Number(item.startTime);
      const duration = Math.max(0, Number(item.duration) || 0);
      const taskEnd = taskStart + duration;
      return Number.isFinite(bootStart) && Number.isFinite(bootComplete) && Number.isFinite(taskStart) && taskStart < bootComplete && taskEnd > bootStart;
    }).map(item => ({ startTime:Number(item.startTime) || 0, duration:Number(item.duration) || 0 }));
    return {
      bootOk:window.__TXT_READER_REBUILD_BOOT_OK__ === true,
      bootStart,
      bootComplete,
      bootDuration:Number(store.bootDurationMs || store.phases?.bootComplete?.durationMs || 0),
      longTasks,
      cards:document.querySelectorAll('.library-shelf-card').length
    };
  });
  await context.close();
  const maxLongTask = perf.longTasks.length ? Math.max(...perf.longTasks.map(item => item.duration)) : 0;
  return { label, modules:moduleUrls.size, errors, ...perf, maxLongTask };
}
async function run() {
  if (!fs.existsSync(executablePath)) {
    console.log(JSON.stringify({ pass:'v600-browser-initial-load-smoke-skipped', reason:'chromium-not-found', executablePath }));
    return;
  }
  const browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const warmup = await measure(browser, 'warmup');
    const samples = [];
    for (let index = 0; index < SAMPLE_COUNT; index += 1) samples.push(await measure(browser, `sample-${index + 1}`));
    for (const sample of samples) {
      assert(sample.bootOk, `${sample.label}: library boot must complete`);
      assert(sample.bootDuration > 0, `${sample.label}: boot duration must be positive`);
      assert(sample.modules <= MAX_MODULES, `${sample.label}: browser boot module requests ${sample.modules} > ${MAX_MODULES}`);
      assert(sample.longTasks.length <= MAX_LONG_TASKS, `${sample.label}: too many boot-window long tasks: ${sample.longTasks.length}`);
      assert(sample.maxLongTask <= MAX_LONG_TASK_MS, `${sample.label}: boot-window long task ${sample.maxLongTask}ms > ${MAX_LONG_TASK_MS}ms`);
      assert.deepStrictEqual(sample.errors, [], `${sample.label}: browser errors: ${sample.errors.join(' | ')}`);
    }
    console.log(JSON.stringify({ pass:'v600-browser-initial-load-smoke-pass', budget:{ modules:MAX_MODULES, longTasks:MAX_LONG_TASKS, maxLongTaskMs:MAX_LONG_TASK_MS }, warmup, samples }));
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error.stack || error); process.exit(1); });
