#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');

const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
const executablePath = process.env.TXT_READER_CHROMIUM_PATH || chromium.executablePath();
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function stripExternalAssets(html) {
  return html
    .replace(/<script\b[^>]*src=["'][^"']+["'][^>]*><\/script>/gi, '')
    .replace(/<script\b[^>]*type=["']module["'][^>]*><\/script>/gi, '')
    .replace(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi, '')
    .replace(/<link\b[^>]*rel=["']manifest["'][^>]*>/gi, '');
}

function adminApiPayload(url) {
  const pathname = new URL(String(url), 'https://reader.test').pathname;
  if (pathname === '/api/csrf') return { csrfToken:'v596-browser-test-csrf' };
  if (pathname === '/api/admin/users/status') return { ok:true, owner:true };
  if (pathname === '/api/admin/users') return { users:[{
    id:'u1', username:'reader-a', enabled:true,
    libraryAccess:{ mode:'folders', folders:['판타지'] },
    folderMutationAccess:{ moveFolders:['판타지'], deleteFolders:[] },
    appPermissions:{ fullSearch:true, metadataAccess:true }
  }] };
  if (pathname === '/api/admin/library-tree') return { libraryTree:{ flattened:[
    { path:'판타지', name:'판타지', depth:0, novelCount:20, childCount:2 },
    { path:'판타지/완결', name:'완결', depth:1, novelCount:10, childCount:0 },
    { path:'무협', name:'무협', depth:0, novelCount:8, childCount:0 }
  ] } };
  if (pathname === '/api/admin/signup-codes') return { codes:[] };
  if (pathname === '/api/admin/site-languages') return { languages:[] };
  if (/^\/api\/admin\/users\/[^/]+\/state\/snapshots$/.test(pathname)) return { snapshots:[], user:{ username:'reader-a' }, pass:'test' };
  return { ok:true, events:[], languages:[], codes:[], snapshots:[], summary:{ grade:'ok', message:'test' } };
}

async function visible(locator) {
  return locator.evaluate(element => {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && !element.hidden && rect.width > 0 && rect.height > 0;
  });
}

async function installAdminPage(page) {
  await page.exposeFunction('__v596AdminApiPayload', adminApiPayload);
  await page.setContent(stripExternalAssets(read('public/admin/users.html')), { waitUntil:'domcontentloaded' });
  await page.addStyleTag({ content:read('public/styles/admin-users.css') });
  await page.evaluate(() => {
    window.confirm = () => true;
    window.prompt = () => 'test';
    window.fetch = async input => new Response(JSON.stringify(await window.__v596AdminApiPayload(String(input))), {
      status:200,
      headers:{ 'content-type':'application/json; charset=utf-8' }
    });
  });
  const scripts = [
    'public/scripts/admin/core.js',
    'public/scripts/admin/sections.js',
    'public/scripts/admin/ops.js',
    'public/scripts/admin/users.js',
    'public/scripts/admin/state.js',
    'public/scripts/admin/audit.js',
    'public/scripts/admin/signup.js',
    'public/scripts/admin/actions.js',
    'public/scripts/admin/audit-actions.js',
    'public/scripts/admin/signup-actions.js',
    'public/scripts/admin/site-languages.js',
    'public/scripts/admin/state-actions.js',
    'public/scripts/admin/permissions.js',
    'public/scripts/admin/form-workflow.js',
    'public/scripts/admin-users.js'
  ];
  for (const script of scripts) await page.addScriptTag({ content:read(script) });
}

function metadataModuleSource() {
  let source = read('public/scripts/rebuild/metadata-page.mjs');
  source = source.replace("import { ApiClient } from './core/api.mjs';", `
class ApiClient {
  constructor(){ this.deviceId='test'; }
  metadataProviders(){ return Promise.resolve({ providers:[{ id:'builtin-naver-series', name:'네이버 시리즈', enabled:true },{ id:'builtin-kakaopage', name:'카카오페이지', enabled:true }], queue:{ queued:0, running:0 } }); }
  metadataJobs(){ return Promise.resolve({ jobs:[], queue:{ queued:0, running:0 } }); }
  novelShelf(){ return Promise.resolve({ items:[{ id:'n1', title:'첫 번째 작품', author:'작가 A', categoryPath:'판타지', metadata:null },{ id:'n2', title:'두 번째 작품', author:'작가 B', categoryPath:'무협', metadata:{ title:'두 번째 작품' } }], total:2, nextCursor:'' }); }
  novelMetadata(){ return Promise.resolve({ canEdit:true, providers:[{ id:'builtin-naver-series', name:'네이버 시리즈', enabled:true }], applied:null, candidates:[] }); }
  logout(){ return Promise.resolve({ ok:true }); }
  collectMissingMetadata(){ return Promise.resolve({ count:0, job:null }); }
  cancelMetadataJob(){ return Promise.resolve({ ok:true }); }
}`);
  source = source.replace("import { createState } from './state/app-state.mjs';", `const createState = () => ({ deviceId:'browser-v596', prefs:{ themeMode:'dark', uiFontSize:15 } });`);
  return source;
}

async function installMetadataPage(page) {
  await page.setContent(stripExternalAssets(read('public/metadata.html')), { waitUntil:'domcontentloaded' });
  await page.addStyleTag({ content:read('public/styles/app.css') + '\n' + read('public/styles/metadata-page.css') });
  await page.evaluate(() => {
    let state = null;
    history.pushState = next => { state = next; };
    history.replaceState = next => { state = next; };
    history.back = () => setTimeout(() => window.dispatchEvent(new PopStateEvent('popstate',{ state:null })), 0);
    try { Object.defineProperty(history, 'state', { configurable:true, get:() => state }); } catch {}
  });
  await page.addScriptTag({ type:'module', content:metadataModuleSource() });
}

async function run() {
  const screenshotDir = process.env.TXT_READER_UX_SCREENSHOT_DIR || '';
  if (screenshotDir) fs.mkdirSync(screenshotDir,{ recursive:true });
  const browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  const errors = [];
  try {
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, reducedMotion:'reduce', serviceWorkers:'block' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error.message || error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });

    await installAdminPage(page);
    await page.waitForFunction(() => document.documentElement.dataset.adminUserWorkflowPass === 'v596-admin-user-form-workflow-pass');
    await page.waitForFunction(() => document.querySelector('#create-folder-picker .folder-line'));
    assert.strictEqual(await page.locator('#create-form details[data-user-form-step]').count(), 3, 'create form must expose three workflow steps');
    const advanced = page.locator('#create-form details[data-user-form-step="advanced"]');
    assert.strictEqual(await advanced.getAttribute('open'), null, 'advanced permissions must start collapsed');
    assert.strictEqual(await page.locator('#create-move-folder-picker .folder-line').count(), 0, 'closed advanced picker must not render the tree');
    assert.strictEqual(await page.locator('#create-move-folder-picker').getAttribute('data-lazy-picker-pending'), 'true', 'closed advanced picker must be pending');
    await advanced.locator('summary').click();
    await page.waitForFunction(() => document.querySelectorAll('#create-move-folder-picker .folder-line').length === 3);
    assert(await visible(page.locator('#create-form .user-form-sticky-actions')), 'sticky review actions must be visible');
    await page.locator('#create-username').fill('reader-b');
    await page.locator('#create-access-mode').selectOption('folders');
    await page.locator('#create-folders').fill('판타지\n무협');
    assert((await page.locator('#create-change-summary').textContent()).includes('접근 폴더 2개'), 'summary must reflect access folders');
    if (screenshotDir) await page.screenshot({ path:path.join(screenshotDir,'v596-owner-user-workflow.png'), fullPage:true });
    const createTab = page.locator('[data-user-panel-tab="create"]');
    await createTab.focus();
    await createTab.press('ArrowRight');
    assert.strictEqual(await page.locator('[data-user-panel-tab="list"]').getAttribute('aria-selected'), 'true', 'owner tabs must support arrow keys');

    await page.setContent('<!doctype html><html><head></head><body></body></html>');
    await installMetadataPage(page);
    await page.waitForSelector('[data-work-id="n1"]');
    const browserPane = page.locator('.metadata-work-browser');
    const detailPane = page.locator('.metadata-work-detail');
    assert(await visible(browserPane), 'mobile work list must be visible initially');
    assert(!(await visible(detailPane)), 'mobile detail must be hidden initially');
    if (screenshotDir) await page.screenshot({ path:path.join(screenshotDir,'v596-metadata-mobile-list.png'), fullPage:true });
    await page.locator('[data-work-id="n1"]').focus();
    await page.locator('[data-work-id="n1"]').press('ArrowDown');
    assert.strictEqual(await page.evaluate(() => document.activeElement?.dataset?.workId), 'n2', 'work list arrow navigation must move focus');
    await page.locator('[data-work-id="n2"]').press('Enter');
    await page.waitForFunction(() => document.getElementById('metadata-page-works')?.classList.contains('metadata-mobile-detail-open'));
    assert(!(await visible(browserPane)), 'mobile list must hide while detail is open');
    assert(await visible(detailPane), 'mobile detail must show after selection');
    assert(!(await visible(page.locator('#metadata-work-detail-empty'))), 'selected detail must not retain the empty-state panel');
    await page.waitForFunction(() => document.activeElement?.id === 'metadata-detail-mobile-back');
    if (screenshotDir) await page.screenshot({ path:path.join(screenshotDir,'v596-metadata-mobile-detail.png'), fullPage:true });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.getElementById('metadata-page-works')?.classList.contains('metadata-mobile-detail-open'));
    assert(await visible(browserPane), 'Escape must return to list');
    await page.waitForFunction(() => document.activeElement?.dataset?.workId === 'n2');
    const tabs = page.locator('[data-metadata-page-tab]');
    await tabs.nth(0).focus();
    await tabs.nth(0).press('ArrowRight');
    assert.strictEqual(await tabs.nth(1).getAttribute('aria-selected'), 'true', 'metadata tabs must support arrow keys');

    const unnamed = await page.evaluate(() => Array.from(document.querySelectorAll('button,a[href],input,select,textarea')).filter(element => {
      const style = getComputedStyle(element);
      if (element.hidden || style.display === 'none' || style.visibility === 'hidden') return false;
      const explicitLabel = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.textContent : '';
      const wrappingLabel = element.closest('label')?.textContent || '';
      const name = element.getAttribute('aria-label') || element.getAttribute('title') || explicitLabel || wrappingLabel || element.textContent || element.getAttribute('placeholder') || element.getAttribute('alt');
      return !String(name || '').trim();
    }).map(element => element.outerHTML.slice(0,180)));
    assert.deepStrictEqual(unnamed, [], `visible controls must have accessible names: ${unnamed.join(' | ')}`);
    assert.deepStrictEqual(errors, [], `browser console/page errors: ${errors.join(' | ')}`);
    await context.close();
    console.log(JSON.stringify({ pass:'v596-browser-ux-e2e-pass', chromium:executablePath }));
  } finally {
    await browser.close();
  }
}

run().catch(error => { console.error(error && error.stack || error); process.exit(1); });
