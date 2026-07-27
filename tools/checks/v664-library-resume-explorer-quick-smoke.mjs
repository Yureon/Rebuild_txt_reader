import assert from 'node:assert/strict';
import { buildReaderPageUrl } from '../../public/scripts/rebuild/features/library-navigation-actions.mjs';
import { openLibraryQuickItem } from '../../public/scripts/rebuild/features/library-quick-actions.mjs';
import { renderLibraryOrchestratorRuntime } from '../../public/scripts/rebuild/features/library-render-orchestrator.mjs';
import { buildContinueReadingPromptCopy, hasResumableProgress, promptContinueReading, CONTINUE_READING_PROMPT_PASS } from '../../public/scripts/rebuild/features/reader/continue-reading-prompt.mjs';

class FakeClassList {
  constructor(){ this.values = new Set(); }
  add(...values){ values.forEach(value => this.values.add(value)); }
  remove(...values){ values.forEach(value => this.values.delete(value)); }
  contains(value){ return this.values.has(value); }
}
class FakeElement extends EventTarget {
  constructor(){ super(); this.dataset={}; this.classList=new FakeClassList(); this.attrs={}; this.textContent=''; this.focused=false; }
  setAttribute(name,value){ this.attrs[name]=String(value); }
  removeAttribute(name){ delete this.attrs[name]; }
  focus(){ this.focused=true; }
}

assert.equal(hasResumableProgress({ chunk:2 }), true);
assert.equal(hasResumableProgress({ chunk:1, ratio:0 }), false);
const copy = buildContinueReadingPromptCopy({ title:'검증 소설', episodes:[{ id:'ep2', title:'두 번째 회차' }] }, { episodeId:'ep2', documentRatio:0.425 });
assert.equal(copy.title, '검증 소설 이어보기');
assert.match(copy.meta, /두 번째 회차/);
assert.match(copy.meta, /42\.5%/);

const doc = new EventTarget();
globalThis.document = doc;
const els = {
  continueReadingBar:new FakeElement(), continueReadingTitle:new FakeElement(), continueReadingMeta:new FakeElement(),
  continueReadingRestart:new FakeElement(), continueReadingResume:new FakeElement()
};
const pending = promptContinueReading({ els }, { id:'novel-1', title:'검증 소설' }, { chunk:3, documentRatio:0.2 });
await new Promise(resolve => queueMicrotask(resolve));
assert.equal(els.continueReadingTitle.textContent, '검증 소설 이어보기');
assert.equal(els.continueReadingBar.classList.contains('open'), true);
assert.equal(els.continueReadingBar.dataset.continueReadingPass, CONTINUE_READING_PROMPT_PASS);
els.continueReadingResume.dispatchEvent(new Event('click'));
assert.equal(await pending, 'resume');
assert.equal(els.continueReadingBar.classList.contains('open'), false);
assert.equal(els.continueReadingBar.attrs['aria-hidden'], 'true');

const url = buildReaderPageUrl('novel-1', '', { windowObject:{ location:{ origin:'https://reader.example' }, localStorage:{ getItem(){ return 'site'; } }, matchMedia(){ return { matches:false }; } } });
assert.equal(url, '/site.html?novelId=novel-1&from=library');

let assignedHref = '';
globalThis.window = { location:{ assign(value){ assignedHref=String(value); }, origin:'https://reader.example' }, localStorage:{ getItem(){ return 'site'; } }, matchMedia(){ return { matches:false }; } };
const quickOpen = openLibraryQuickItem({ profile:'library', state:{ novelById:new Map([['novel-1',{ id:'novel-1', title:'검증 소설' }]]) } }, { dataset:{ novelId:'novel-1', episodeId:'' } });
assert.equal(quickOpen.navigated, true);
assert.equal(assignedHref, '/site.html?novelId=novel-1&from=library');

let quick=0, explorer=0;
const box = { scrollTop:0, classList:new FakeClassList() };
const app = { els:{ novelList:box }, state:{ libraryViewMode:'explorer' } };
renderLibraryOrchestratorRuntime(app, {}, {
  normalizeLibraryRenderOptions:value=>value,
  cancelLibraryVirtualRender(){}, syncLibraryChrome(){},
  renderLibraryQuickList(){ quick += 1; },
  getLibraryFilteredNovels(){ return [{ id:'novel-1' }]; },
  renderLibraryExplorer(){ explorer += 1; }
});
assert.equal(quick, 1, 'explorer view must render Recent/Favorites quick list');
assert.equal(explorer, 1);

console.log(JSON.stringify({ pass:'v664-library-resume-explorer-quick-pass', prompt:true, title:true, explorerQuick:true }));
