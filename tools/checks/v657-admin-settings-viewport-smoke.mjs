#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { applySettingsMobilePageState } from '../../public/scripts/rebuild/features/settings/tab-switching.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const cleanupScript = read('public/scripts/admin/library-cleanup.js');
const cleanupCss = read('public/styles/admin-users-v652.css');
const adminHtml = read('public/admin/users.html');
const settingsCss = read('public/styles/deferred-ui.css');
const settingsFragment = read('public/fragments/deferred-ui.html');

assert(cleanupScript.includes("'data-cleanup-disclosure':'v657'"));
assert(cleanupCss.includes('.library-cleanup-group[data-cleanup-disclosure]{'));
assert(!cleanupCss.includes('data-cleanup-disclosure="v652"'), 'cleanup card layout must survive version-marker changes');
assert(adminHtml.includes('v657-library-cleanup-disclosure-layout-pass'));
assert.match(cleanupCss, /\.library-cleanup-group\[data-cleanup-disclosure\]\{[\s\S]*?min-height:58px!important;[\s\S]*?contain:none!important;/);
assert.match(cleanupCss, /\.library-cleanup-group\[data-cleanup-disclosure\] \.library-cleanup-group-summary-layout\{[\s\S]*?min-height:58px!important;/);

const viewportMarker = '/* v659: consolidated library settings workspace and read-data modal contract. */';
const viewportCss = settingsCss.slice(settingsCss.indexOf(viewportMarker));
assert(viewportCss.startsWith(viewportMarker), 'current viewport settings contract missing');
assert.match(viewportCss, /\.settings-panel\.settings-page\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\)!important;[\s\S]*?overflow:hidden!important;/);
assert.match(viewportCss, /\.settings-panel\.settings-page \.settings-page-layout\{[\s\S]*?height:auto!important;[\s\S]*?min-height:0!important;[\s\S]*?overflow:hidden!important;/);
assert.match(viewportCss, /\.settings-panel\.settings-page \.settings-workspace-main\{[\s\S]*?grid-template-rows:auto minmax\(0,1fr\)!important;[\s\S]*?overflow:hidden!important;/);
assert.match(viewportCss, /\.settings-panel\.settings-page \.sp-body\{[\s\S]*?height:auto!important;[\s\S]*?min-height:0!important;[\s\S]*?overflow-y:auto!important;/);
assert(!/\.settings-panel\.settings-page \.sp-body\{[^}]*height:100%!important/.test(viewportCss), 'detail scroll owner must not claim 100% in addition to its header row');
assert(settingsFragment.includes('id="settings-panel-body" class="sp-body"'));
assert(settingsFragment.includes('class="settings-mobile-detail-header"'));

function classList() {
  const values = new Set();
  return { toggle(name, force){ if (force) values.add(name); else values.delete(name); }, contains(name){ return values.has(name); } };
}
function region() {
  const attrs = new Map();
  return { classList:classList(), setAttribute(k,v){ attrs.set(k,String(v)); }, removeAttribute(k){ attrs.delete(k); }, getAttribute(k){ return attrs.get(k) ?? null; } };
}
for (const viewport of [
  { width:320, height:568 },
  { width:360, height:640 },
  { width:390, height:844 },
  { width:768, height:1024 },
  { width:980, height:700 },
  { width:981, height:700 },
  { width:1440, height:900 }
]) {
  const mobile = viewport.width <= 980;
  const header = mobile ? 60 : 68;
  const detailHeader = mobile ? 58 : 0;
  const workspace = viewport.height - header;
  const scrollClient = workspace - detailHeader;
  assert(scrollClient > 0, `non-positive detail viewport at ${viewport.width}x${viewport.height}`);
  for (const contentHeight of [1200, 1800, 2600]) {
    assert(contentHeight > scrollClient, `fixture must require scrolling at ${viewport.width}x${viewport.height}`);
  }

  const nav = region();
  const main = region();
  const layout = {
    dataset:{},
    classList:classList(),
    querySelector(selector){ return selector === '.settings-workspace-nav' ? nav : selector === '.settings-workspace-main' ? main : null; }
  };
  const state = applySettingsMobilePageState(layout, mobile ? 'detail' : 'index', { mobile });
  assert.equal(state.applied, true);
  assert.equal(main.getAttribute('inert'), null);
  if (mobile) assert.equal(nav.getAttribute('inert'), '');
}

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.children = [];
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = {};
    this.className = '';
    this.classList = { add:(...names) => { this.className = [...new Set([...this.className.split(/\s+/).filter(Boolean), ...names])].join(' '); } };
    this.textContent = '';
    this.hidden = false;
  }
  appendChild(child){ if (child?.tagName === '#FRAGMENT') { for (const item of [...child.children]) this.appendChild(item); return child; } this.children.push(child); return child; }
  replaceChildren(...children){ this.children = []; children.forEach(child => this.appendChild(child)); }
  setAttribute(k,v){ this.attributes.set(k,String(v)); if (k.startsWith('data-')) this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = String(v); }
  addEventListener(type, fn){ (this.listeners[type] ||= []).push(fn); }
  closest(){ return null; }
}
const document = {
  createElement: tag => new FakeNode(tag),
  createTextNode: text => Object.assign(new FakeNode('#text'), { textContent:String(text) }),
  createDocumentFragment: () => new FakeNode('#fragment'),
  querySelector: () => null
};
const sandbox = { window:{}, document, console, setTimeout, clearTimeout, Blob, URL, Date, Math, Number, String, Set, Array };
vm.createContext(sandbox);
vm.runInContext(cleanupScript, sandbox, { filename:'library-cleanup.js' });
const nodes = new Map();
for (const id of ['library-cleanup-list','library-cleanup-progress','library-cleanup-plan-hash','library-cleanup-summary','library-cleanup-download-btn']) nodes.set(id,new FakeNode('div'));
for (const id of ['library-cleanup-duplicates','library-cleanup-superseded','library-cleanup-alternate','library-cleanup-suspected']) nodes.set(id,Object.assign(new FakeNode('input'),{checked:true}));
const groups = Array.from({length:423},(_,i)=>({
  title:`작품 ${i+1}`,
  confidence:.98,
  preferenceKey:`group-${i}`,
  canonical:{id:`canonical-${i}`,relativePath:`장르/대표-${i}.txt`},
  candidates:[{id:`candidate-${i}`,relation:'duplicate-copy',relativePath:`장르/중복-${i}.txt`,bytes:1024,mtimeMs:Date.now(),similarity:{score:.99,breakdown:{title:1,author:1,synopsis:.9,prefix:.9,middle:.9,range:1}}}]
}));
sandbox.window.AdminLibraryCleanup.renderPlan({ $:id=>nodes.get(id)||null, jf:()=>Promise.resolve({}) }, { planHash:'v657-fixture', summary:{groupCount:423,suspectedMatchCount:331}, groups, reviewGroups:[], excludedPairs:[], skipped:[] }, { resetPagination:true });
const cards = nodes.get('library-cleanup-list').children.filter(node => node.tagName === 'ARTICLE');
assert.equal(cards.length,24);
assert(cards.every(card => card.dataset.cleanupDisclosure === 'v657'));
assert(cards.every(card => card.children[0]?.children[0]?.children?.length >= 3), 'collapsed cleanup cards must retain title, count, and affordance content');

console.log(JSON.stringify({ pass:'v657-admin-settings-viewport-smoke-pass', cleanupCards:cards.length, viewportCases:7, settingsScrollOwner:true }));
