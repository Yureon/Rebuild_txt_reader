#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright-chromium');
const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
const executablePath = process.env.TXT_READER_CHROMIUM_PATH || chromium.executablePath();
const contentTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8' };
function safeFile(urlPath) {
  const pathname = decodeURIComponent(urlPath.split('?')[0]);
  const rel = pathname.replace(/^\/+/, '');
  const file = path.resolve(publicRoot, rel);
  return file.startsWith(publicRoot + path.sep) || file === publicRoot ? file : null;
}
async function installRoutes(page) {
  await page.route('https://reader.test/**', async route => {
    const url = new URL(route.request().url());
    const file = safeFile(url.pathname);
    if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status:404, body:'not found' });
    return route.fulfill({ status:200, contentType:contentTypes[path.extname(file)] || 'application/octet-stream', headers:{'access-control-allow-origin':'*'}, body:fs.readFileSync(file) });
  });
}
async function run() {
  if (!fs.existsSync(executablePath)) {
    console.log(JSON.stringify({ pass:'v600-library-browser-smoke-skipped', reason:'chromium-not-found', executablePath }));
    return;
  }
  const browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block', locale:'ko-KR' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error.message || error)));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await installRoutes(page);

    await page.setContent('<!doctype html><html><head><base href="https://reader.test/"></head><body><div id="library-quick-list"></div></body></html>');
    await page.addStyleTag({ content:fs.readFileSync(path.join(publicRoot,'styles/app.css'),'utf8') });
    await page.evaluate(async () => {
      const module = await import('https://reader.test/scripts/rebuild/features/library-quick-list.mjs');
      const novelA = { id:'novel-a', title:'최근 작품', categoryPath:'판타지', isMultiFile:false };
      const novelB = { id:'novel-b', title:'즐겨찾기 작품', categoryPath:'현대', isMultiFile:false };
      const app = {
        els:{ libraryQuickList:document.getElementById('library-quick-list') },
        state:{
          libraryFilter:'',
          libraryQuickUi:null,
          favorites:new Set(['novel-b']),
          recents:[{ novelId:'novel-a', title:'최근 작품', ts:Date.now() }],
          novelById:new Map([['novel-a',novelA],['novel-b',novelB]]),
          progress:{ byNovel:{}, readMeta:{} }
        }
      };
      module.installLibraryQuickListDelegation(app, (target,type,handler) => target.addEventListener(type,handler));
      module.renderLibraryQuickList(app);
      window.__quickApp = app;
    });
    const initial = await page.evaluate(() => ({
      tabs:document.querySelectorAll('.library-quick-switcher-tab').length,
      sections:document.querySelectorAll('.library-quick-section').length,
      active:document.querySelector('.library-quick-switcher-tab.active')?.textContent || '',
      selected:Array.from(document.querySelectorAll('.library-quick-switcher-tab')).map(el => el.getAttribute('aria-selected')),
      height:document.querySelector('.library-quick-switcher')?.getBoundingClientRect().height || 0
    }));
    assert.strictEqual(initial.tabs, 2, 'recent/favorite switcher must have two tabs');
    assert.strictEqual(initial.sections, 1, 'only one quick-list content section may render');
    assert(initial.active.includes('최근 항목'), 'recent items should be active initially');
    assert.deepStrictEqual(initial.selected, ['true','false']);
    await page.getByRole('tab', { name:/즐겨찾기/ }).click();
    const switched = await page.evaluate(() => ({
      sections:document.querySelectorAll('.library-quick-section').length,
      active:document.querySelector('.library-quick-switcher-tab.active')?.textContent || '',
      item:document.querySelector('.library-quick-title')?.textContent || '',
      selected:Array.from(document.querySelectorAll('.library-quick-switcher-tab')).map(el => el.getAttribute('aria-selected'))
    }));
    assert.strictEqual(switched.sections, 1);
    assert(switched.active.includes('즐겨찾기'));
    assert(switched.item.includes('즐겨찾기 작품'));
    assert.deepStrictEqual(switched.selected, ['false','true']);

    const shell = fs.readFileSync(path.join(publicRoot,'fragments/app-shell.html'),'utf8');
    await page.setContent(`<!doctype html><html><head><base href="https://reader.test/"></head><body>${shell}</body></html>`);
    await page.addStyleTag({ content:fs.readFileSync(path.join(publicRoot,'styles/app.css'),'utf8') });
    await page.evaluate(async () => {
      const module = await import('https://reader.test/scripts/rebuild/features/library-user-tags.mjs');
      const byId = id => document.getElementById(id);
      const app = {
        els:{
          userTagOverlay:byId('user-tag-overlay'), userTagDialogTitle:byId('user-tag-dialog-title'), userTagDialogSubtitle:byId('user-tag-dialog-subtitle'),
          userTagDialogClose:byId('user-tag-dialog-close'), userTagInput:byId('user-tag-input'), userTagAdd:byId('user-tag-add'), userTagStatus:byId('user-tag-status'),
          userTagList:byId('user-tag-list'), userTagCancel:byId('user-tag-cancel'), userTagSave:byId('user-tag-save')
        },
        state:{
          userTags:['완결'], novelUserTags:{}, favorites:new Set(), bookmarks:[], recents:[], shared:{},
          libraryViewMode:'shelf', libraryShelfFacetsLoaded:true, libraryShelfFacets:{ authors:[],categories:[],tags:[],publicationStatuses:[],groupKinds:[] }
        },
        api:{ putShared:async shared => ({ shared }) },
        library:{ loadShelf:async () => { app.state.__shelfReloads = (app.state.__shelfReloads || 0) + 1; } }
      };
      window.__tagApp = app;
      module.openUserTagDialog(app, { id:'novel-a', title:'태그 대상 작품' });
    });
    await page.locator('#user-tag-input').fill(' #판타지 ');
    await page.locator('#user-tag-add').click();
    const tagRows = await page.locator('.user-tag-row').count();
    assert.strictEqual(tagRows, 2, 'new tag row must be added');
    const fantasy = page.locator('.user-tag-row', { hasText:'#판타지' });
    assert.strictEqual(await fantasy.locator('input[type=checkbox]').isChecked(), true, 'new tag should be selected for the current novel');
    await page.locator('#user-tag-save').click();
    await page.waitForFunction(() => document.getElementById('user-tag-overlay')?.hidden === true);
    const saved = await page.evaluate(() => ({
      definitions:window.__tagApp.state.userTags,
      assignments:window.__tagApp.state.novelUserTags,
      shelfReloads:window.__tagApp.state.__shelfReloads || 0
    }));
    assert.deepStrictEqual(saved.definitions, ['완결','판타지']);
    assert.deepStrictEqual(saved.assignments, { 'novel-a':['판타지'] });
    assert.strictEqual(saved.shelfReloads, 1, 'tag save must refresh shelf data');
    assert.deepStrictEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
    await context.close();
    console.log(JSON.stringify({ pass:'v600-library-browser-smoke-pass', quick:initial, switched, saved }));
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error.stack || error); process.exit(1); });
