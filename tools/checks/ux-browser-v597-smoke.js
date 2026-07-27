#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-chromium');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const executablePath = process.env.TXT_READER_CHROMIUM_PATH || chromium.executablePath();
async function run(){
  const browser = await chromium.launch({ executablePath, headless:true, args:['--no-sandbox','--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport:{width:390,height:844}, serviceWorkers:'block' });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><body data-client-profile="library" class="library-shelf-mode"><div class="sb-header"><div class="sb-header-row"><h1>작품 서재</h1></div><input id="search"><div id="library-view-tabs" class="library-view-tabs"><button class="library-view-tab">카드</button><button class="library-view-tab">트리</button><button class="library-view-tab">탐색</button></div><div id="library-scope-tabs" class="library-scope-tabs"><button class="library-scope-tab">전체</button><button class="library-scope-tab">즐겨찾기</button><button class="library-scope-tab">최근</button></div><div class="library-shelf-status-row"><div class="library-shelf-summary">48 / 500 작품</div><button class="library-filter-trigger">필터</button></div></div><div class="library-shelf-card"><button class="library-shelf-favorite-btn">★</button><button class="library-shelf-menu-btn">⋯</button></div></body></html>`);
    await page.addStyleTag({content:read('public/styles/app.css')});
    const sizes = await page.evaluate(() => ({
      favorite:document.querySelector('.library-shelf-favorite-btn').getBoundingClientRect().toJSON(),
      menu:document.querySelector('.library-shelf-menu-btn').getBoundingClientRect().toJSON(),
      header:document.querySelector('.sb-header').getBoundingClientRect().height
    }));
    assert(sizes.favorite.width >= 44 && sizes.favorite.height >= 44, 'favorite touch target must be 44px');
    assert(sizes.menu.width >= 44 && sizes.menu.height >= 44, 'menu touch target must be 44px');
    assert(sizes.header <= 245, `mobile library header must stay compact, got ${sizes.header}`);

    await page.setContent(read('public/fragments/app-shell.html'));
    await page.addStyleTag({content:read('public/styles/app.css')});
    for (const id of ['menu-btn','novel-search-btn','offline-ready-btn','bookmark-btn','fs-btn','theme-toggle-btn','settings-btn']) {
      const box = await page.locator('#'+id).boundingBox();
      assert(box && box.width >= 44 && box.height >= 44, `${id} touch target must be 44px`);
      const name = await page.locator('#'+id).evaluate(el => el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent.trim());
      assert(name, `${id} accessible name missing`);
    }

    await page.setContent(read('public/metadata.html'));
    await page.addStyleTag({content:read('public/styles/app.css')+'\n'+read('public/styles/metadata-page.css')});
    const moreVisible = await page.locator('#metadata-work-more').evaluate(el => getComputedStyle(el).display !== 'none');
    assert.strictEqual(moreVisible,false,'hidden metadata load-more must not render');
    await context.close();
    console.log('v597-browser-ux-smoke-pass');
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e.stack||e);process.exit(1)});
