#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const PASS = 'v371-library-multifile-disclosure-smoke-pass';

async function runLibraryMultifileDisclosureSmoke(projectRoot = path.resolve(__dirname, '..', '..')) {
  const treeRel = 'public/scripts/rebuild/features/library-tree-renderer.mjs';
  const protoRel = 'public/scripts/rebuild/features/library-prototype-rows.mjs';
  const eventRel = 'public/scripts/rebuild/features/library-event-delegation.mjs';
  const navRel = 'public/scripts/rebuild/features/library-navigation-actions.mjs';
  const quickRel = 'public/scripts/rebuild/features/library-quick-actions.mjs';
  const cssRel = 'public/styles/app.css';
  const tree = fs.readFileSync(path.join(projectRoot, treeRel), 'utf8');
  const proto = fs.readFileSync(path.join(projectRoot, protoRel), 'utf8');
  const event = fs.readFileSync(path.join(projectRoot, eventRel), 'utf8');
  const nav = fs.readFileSync(path.join(projectRoot, navRel), 'utf8');
  const quick = fs.readFileSync(path.join(projectRoot, quickRel), 'utf8');
  const css = fs.readFileSync(path.join(projectRoot, cssRel), 'utf8');

  for (const marker of [
    'v371-library-left-disclosure-pass',
    'v371-library-title-overflow-gate-pass',
    'episode-toggle-btn',
    'folder-toggle-btn',
    'library-title-track',
    'library-title-ghost',
    'v371-library-title-overflow-gate-pass'
  ]) assert.ok(tree.includes(marker), `tree renderer missing ${marker}`);
  assert.ok(proto.includes('v371-library-prototype-left-disclosure-pass'), 'prototype rows must include v370 disclosure marker');
  assert.ok(event.includes('v371-library-left-disclosure-event-pass'), 'event delegation must include v370 marker');
  assert.ok(nav.includes('v371-library-multifile-open-no-auto-expand-pass'), 'navigation must include no-auto-expand marker');
  assert.ok(!nav.includes("source:'expand-multifile-before-open'"), 'multi-file open must not render/expand episode list automatically');
  assert.ok(!quick.includes('expandedEpisodeNovels.add(novel.id);\n    persistLibraryUi(app.state);'), 'quick open must not auto-expand multi-file episode list');
  for (const marker of ['library-title-flow', '@media (hover:hover)', 'prefers-reduced-motion:no-preference', '.library-title-marquee.is-overflow', '.episode-toggle-btn', '.folder-toggle-btn']) {
    assert.ok(css.includes(marker), `css missing ${marker}`);
  }

  const eventMod = await import(pathToFileURL(path.join(projectRoot, eventRel)).href + `?smoke=${Date.now()}`);
  const calls = [];
  const app = {
    state: {
      novelById: new Map([
        ['multi', { id:'multi', isMultiFile:true, episodes:[{ id:'e1' }] }],
        ['single', { id:'single', isMultiFile:false }]
      ]),
      expandedEpisodeNovels: new Set(),
      collapsedFolders: new Set()
    }
  };
  const deps = {
    getLibraryScrollAnchor: () => ({ key:'anchor' }),
    persistLibraryUi: () => calls.push('persist'),
    renderLibrary: (_app, options) => calls.push(options?.source || 'render')
  };
  assert.strictEqual(eventMod.toggleCategoryFolderRuntime(app, 'A>B', deps), true, 'category folder row/button toggle should succeed');
  assert.ok(app.state.collapsedFolders.has('A>B'), 'category folder toggle should collapse from row click path');
  assert.strictEqual(eventMod.toggleCategoryFolderRuntime(app, 'A>B', deps), true, 'category folder second toggle should succeed');
  assert.ok(!app.state.collapsedFolders.has('A>B'), 'category folder second toggle should expand');
  assert.strictEqual(await eventMod.toggleEpisodeNovelRuntime(app, 'multi', deps), true, 'multi toggle should succeed');
  assert.ok(app.state.expandedEpisodeNovels.has('multi'), 'multi toggle should expand');
  assert.ok(calls.includes('episode-toggle-button'), 'multi toggle should render with button source');
  assert.strictEqual(await eventMod.toggleEpisodeNovelRuntime(app, 'multi', deps), true, 'multi toggle collapse should succeed');
  assert.ok(!app.state.expandedEpisodeNovels.has('multi'), 'multi toggle should collapse');
  assert.strictEqual(await eventMod.toggleEpisodeNovelRuntime(app, 'single', deps), false, 'single-file novel should not expose episode toggle behavior');

  const fakeClassSet = new Set();
  const fakeTitle = {
    clientWidth: 100,
    querySelector: selector => selector === '.library-title-text' ? { scrollWidth: 160 } : null,
    classList: { toggle: (name, enabled) => enabled ? fakeClassSet.add(name) : fakeClassSet.delete(name) }
  };
  const fakeTarget = { closest: selector => selector === '.library-title-marquee' ? fakeTitle : null };
  assert.strictEqual(eventMod.updateLibraryTitleOverflowRuntime(fakeTarget), true, 'overflow title should be marked flowable');
  assert.ok(fakeClassSet.has('is-overflow'), 'overflow title should receive is-overflow class');
  fakeTitle.querySelector = selector => selector === '.library-title-text' ? { scrollWidth: 90 } : null;
  assert.strictEqual(eventMod.updateLibraryTitleOverflowRuntime(fakeTarget), false, 'short title should not be marked flowable');
  assert.ok(!fakeClassSet.has('is-overflow'), 'short title should not keep is-overflow class');

  const navMod = await import(pathToFileURL(path.join(projectRoot, navRel)).href + `?smoke=${Date.now()}`);
  const opened = [];
  const navApp = {
    state: {
      novelById: new Map([['multi', { id:'multi', isMultiFile:true, episodes:[{ id:'e1' }] }]]),
      expandedEpisodeNovels: new Set(),
      progress: { byNovel:{ multi:{ episodeId:'e1' } }, lastRead:null, readMeta:{} }
    },
    reader: { openNovel: (novel, options) => opened.push({ novel, options }) }
  };
  const result = navMod.openNovelFromElementRuntime(navApp, { dataset:{ novelId:'multi' } }, {
    findEpisodeForSnapshot: novel => novel.episodes[0],
    openOptionsFromSnapshot: (base, snap) => ({ ...base, snap }),
    closeSidebarAfterLibraryOpen: () => opened.push({ close:true })
  });
  assert.ok(result.opened, 'multi-file novel row should still open the novel');
  assert.ok(!navApp.state.expandedEpisodeNovels.has('multi'), 'multi-file novel row open must not auto-expand episode list');

  return { pass: PASS };
}

module.exports = { PASS, runLibraryMultifileDisclosureSmoke };
if (require.main === module) runLibraryMultifileDisclosureSmoke().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error && error.stack || error); process.exit(1); });
