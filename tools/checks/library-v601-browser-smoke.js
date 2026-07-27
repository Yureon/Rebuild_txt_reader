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
    console.log(JSON.stringify({ pass:'v601-library-browser-smoke-skipped', reason:'chromium-not-found', executablePath }));
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
    const shell = fs.readFileSync(path.join(publicRoot,'fragments/app-shell.html'),'utf8');
    await page.setContent(`<!doctype html><html><head><base href="https://reader.test/"></head><body>${shell}</body></html>`);
    await page.addStyleTag({ content:fs.readFileSync(path.join(publicRoot,'styles/app.css'),'utf8') });

    await page.evaluate(async () => {
      const module = await import('https://reader.test/scripts/rebuild/features/library-shelf-filters.mjs');
      const byId = id => document.getElementById(id);
      const app = {
        els:{
          libraryFilterPopover:byId('library-filter-popover'), libraryFilterTrigger:byId('library-filter-trigger'), libraryFilterCount:byId('library-filter-count'),
          libraryFilterClear:byId('library-filter-clear'), libraryFilterStatus:byId('library-filter-status'), libraryFilterStatusOptions:byId('library-filter-status-options'),
          libraryFilterAuthorOptions:byId('library-filter-author-options'), libraryFilterCategoryOptions:byId('library-filter-category-options'), libraryFilterTagOptions:byId('library-filter-tag-options'),
          libraryFilterGroupOptions:byId('library-filter-group-options'), libraryTagMinCount:byId('library-tag-min-count'), libraryTagThresholdNote:byId('library-tag-threshold-note'),
          libraryActiveFilters:byId('library-active-filters')
        },
        state:{
          libraryShelfFilters:{ publicationStatuses:[], authors:[], categories:[], tags:['선택태그'], groupKinds:[] },
          libraryTagFacetMinCount:'auto', libraryShelfFacetNovelTotal:3500, libraryShelfFacetUserTags:['내태그'], userTags:['내태그'],
          libraryShelfFacets:{
            authors:[], categories:[], publicationStatuses:[], groupKinds:[],
            tags:[
              ...Array.from({length:20},(_,index)=>({value:`보편-${index + 1}`,count:10})),
              ...Array.from({length:40},(_,index)=>({value:`희소-${index + 1}`,count:1})),
              {value:'내태그',count:1}, {value:'선택태그',count:1}
            ]
          },
          libraryShelfFacetsLoaded:true, libraryShelfFacetsLoading:false, libraryShelfFacetsError:'', libraryNavigationPersistedUi:null,
          expandedEpisodeNovels:new Set(), collapsedFolders:new Set(), libraryViewMode:'shelf', libraryExplorerPath:'', libraryShelfScope:'all', libraryShelfSort:'title', libraryShelfDensity:'default'
        },
        api:{
          novelShelfFilters:async()=>({
            facets:{ ...app.state.libraryShelfFacets, tags:app.state.libraryShelfFacets.tags.slice(0, 50) },
            tagPage:{ nextCursor:'fixture-page-2', hasMore:true },
            tagDistribution:{ distinct:62, histogram:[{count:10,tags:20},{count:1,tags:42}] }
          }),
          novelShelfFilterTags:async()=>({ items:app.state.libraryShelfFacets.tags.slice(50), nextCursor:'', hasMore:false })
        }
      };
      const on = (target,type,handler) => target?.addEventListener?.(type,handler);
      module.installLibraryShelfFilterControls(app,on,{loadShelfPage:async()=>{}});
      app.els.libraryFilterPopover.open = true;
      app.els.libraryFilterPopover.dispatchEvent(new Event('toggle'));
      window.__facetApp = app;
    });

    const auto = await page.evaluate(() => ({
      values:Array.from(document.querySelectorAll('#library-filter-tag-options .library-filter-option>span:first-child')).map(el=>el.textContent),
      note:document.getElementById('library-tag-threshold-note')?.textContent || '',
      select:document.getElementById('library-tag-min-count')?.value || '',
      panelScrollbar:getComputedStyle(document.querySelector('.library-filter-panel')).scrollbarWidth,
      optionsScrollbar:getComputedStyle(document.getElementById('library-filter-tag-options')).scrollbarWidth
    }));
    assert.strictEqual(auto.values.filter(value=>value.startsWith('보편-')).length,20, 'frequently used tags must remain visible');
    assert(!auto.values.some(value=>value.startsWith('희소-')), 'one-off metadata tags must be suppressed by the relative distribution');
    assert(auto.values.includes('내태그') && auto.values.includes('선택태그'), 'user-defined and selected tags must remain visible');
    assert(auto.note.includes('자동 기준 2개 이상') && auto.note.includes('전체 62개 태그') && auto.note.includes('희소 태그 40개 숨김'), auto.note);
    assert.strictEqual(auto.select,'auto');
    assert.strictEqual(auto.panelScrollbar,'thin');
    assert.strictEqual(auto.optionsScrollbar,'thin');

    await page.waitForFunction(() => {
      const select = document.getElementById('library-tag-min-count');
      select.value = '1';
      select.dispatchEvent(new Event('change', { bubbles:true }));
      return window.__facetApp?.state?.libraryTagFacetMinCount === '1';
    });
    await page.waitForFunction(() => (document.getElementById('library-tag-threshold-note')?.textContent || '').includes('태그 빈도 제한 없음'));
    const all = await page.evaluate(() => ({
      values:Array.from(document.querySelectorAll('#library-filter-tag-options .library-filter-option>span:first-child')).map(el=>el.textContent),
      saved:window.__facetApp.state.libraryTagFacetMinCount,
      note:document.getElementById('library-tag-threshold-note')?.textContent || ''
    }));
    assert.strictEqual(all.values.length,62);
    assert(all.values.includes('희소-1') && all.values.includes('내태그') && all.values.includes('선택태그'));
    assert.strictEqual(all.saved,'1');
    assert(all.note.includes('태그 빈도 제한 없음'));

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
          userTags:['완결'], novelUserTags:{'novel-a-old':['완결']}, favorites:new Set(), bookmarks:[], recents:[], shared:{},
          libraryViewMode:'shelf', libraryShelfFacetsLoaded:true, libraryShelfFacets:{ authors:[],categories:[],tags:[],publicationStatuses:[],groupKinds:[] },
          libraryShelfFacetNovelTotal:10, libraryShelfFacetUserTags:['완결']
        },
        api:{ putShared:async shared => ({ shared }) },
        library:{ loadShelf:async () => {} }
      };
      window.__aliasTagApp = app;
      module.openUserTagDialog(app, { id:'novel-a', title:'별칭 작품', progressAliases:['novel-a','novel-a-old'], variantMemberIds:['novel-a-old'] });
    });
    const checkbox = page.locator('.user-tag-row input[type=checkbox]');
    assert.strictEqual(await checkbox.isChecked(), true, 'alias assignment must hydrate as checked');
    await checkbox.uncheck();
    await page.locator('#user-tag-save').click();
    await page.waitForFunction(() => document.getElementById('user-tag-overlay')?.hidden === true);
    const aliases = await page.evaluate(() => window.__aliasTagApp.state.novelUserTags);
    assert.deepStrictEqual(aliases, {}, 'unchecking a grouped novel tag must clear alias assignments');

    assert.deepStrictEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
    await context.close();
    console.log(JSON.stringify({ pass:'v601-library-browser-smoke-pass', auto, all, aliases }));
  } finally {
    await browser.close();
  }
}
run().catch(error => { console.error(error.stack || error); process.exit(1); });
