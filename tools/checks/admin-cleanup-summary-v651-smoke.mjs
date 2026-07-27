#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const script = read('public/scripts/admin/library-cleanup.js');
const css = read('public/styles/admin-users-v651.css') + '\n' + read('public/styles/admin-users-v652.css');
const html = read('public/admin/users.html');

assert(script.includes("v657-library-cleanup-disclosure-layout-pass"));
assert(script.includes("class:'library-cleanup-group-summary-layout'"));
assert(script.includes('AUTO_GROUP_BATCH = 24'));
assert(script.includes("loadMoreButton('다음 작품 묶음 표시'"));
assert(script.includes('createDisclosure'));
assert(!script.includes('hydrateDetailsBody'));
assert(!script.includes("el('details'"));
assert(script.includes('preserveDomOnSamePlan:automatic'));
assert(css.includes('.library-cleanup-group-summary{'));
assert(css.includes('.library-cleanup-group[data-cleanup-disclosure]'));
assert(!css.includes('data-cleanup-disclosure="v652"'), 'disclosure styling must not depend on a stale version value');
assert(css.includes('appearance:none!important;'));
assert(css.includes('.library-cleanup-group-summary-layout{'));
assert(css.includes('.library-cleanup-load-more{'));
assert(html.includes('/styles/admin-users-v652.css'));
assert(html.includes('data-library-cleanup-current-ui-pass="v657-library-cleanup-disclosure-layout-pass"'));

class FakeNode {
  constructor(tag) {
    this.tagName = String(tag || '').toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.listeners = {};
    this.className = '';
    this.classList = {
      add: (...names) => { const set = new Set(this.className.split(/\s+/).filter(Boolean)); names.forEach(name => set.add(name)); this.className = [...set].join(' '); },
      remove: (...names) => { const remove = new Set(names); this.className = this.className.split(/\s+/).filter(name => name && !remove.has(name)).join(' '); },
      contains: name => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => { const has = this.className.split(/\s+/).includes(name); const next = force == null ? !has : !!force; if (next) this.classList.add(name); else this.classList.remove(name); return next; }
    };
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.open = false;
    this.title = '';
  }
  appendChild(child) {
    if (child?.tagName === '#FRAGMENT') {
      for (const item of [...child.children]) this.appendChild(item);
      child.children.length = 0;
      return child;
    }
    this.children.push(child);
    child.parentNode = this;
    return child;
  }
  append(...children) { for (const child of children) this.appendChild(child); }
  replaceChildren(...children) { this.children = []; for (const child of children) this.appendChild(child); }
  setAttribute(key, value) {
    const text = String(value);
    this.attributes.set(key, text);
    if (key.startsWith('data-')) {
      const camel = key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[camel] = text;
    }
  }
  removeAttribute(key) { this.attributes.delete(key); }
  addEventListener(type, handler) { (this.listeners[type] ||= []).push(handler); }
  removeEventListener(type, handler) { this.listeners[type] = (this.listeners[type] || []).filter(item => item !== handler); }
  dispatch(type) { for (const handler of [...(this.listeners[type] || [])]) handler({ target:this }); }
  closest() { return null; }
  click() { for (const handler of this.listeners.click || []) handler({ target:this }); }
}

const document = {
  createElement: tag => new FakeNode(tag),
  createTextNode: text => { const node = new FakeNode('#text'); node.textContent = String(text); return node; },
  createDocumentFragment: () => new FakeNode('#fragment'),
  querySelector: () => null,
  body: new FakeNode('body')
};
const sandbox = { window:{}, document, console, setTimeout, clearTimeout, Blob, URL, Date, Math, Number, String, Set, Array };
vm.createContext(sandbox);
vm.runInContext(script, sandbox, { filename:'library-cleanup.js' });
const api = sandbox.window.AdminLibraryCleanup;
assert(api && typeof api.renderPlan === 'function');

const nodes = new Map();
for (const id of ['library-cleanup-list','library-cleanup-progress','library-cleanup-plan-hash','library-cleanup-summary','library-cleanup-download-btn']) nodes.set(id, new FakeNode('div'));
for (const id of ['library-cleanup-duplicates','library-cleanup-superseded','library-cleanup-alternate','library-cleanup-suspected']) {
  const input = new FakeNode('input'); input.checked = true; nodes.set(id, input);
}
const ctx = { $: id => nodes.get(id) || null, jf:() => Promise.resolve({}), log:() => {} };
const groups = Array.from({ length:411 }, (_, index) => ({
  title:`작품 ${index + 1}`,
  confidence:.97,
  preferenceKey:`g-${index}`,
  canonical:{ id:`c-${index}`, relativePath:`소설/대표-${index}.txt` },
  candidates:[{
    id:`d-${index}`,
    relation:'duplicate-copy',
    relativePath:`소설/중복-${index}.txt`,
    bytes:1000 + index,
    mtimeMs:Date.now(),
    similarity:{ score:.98, breakdown:{ title:1, author:1, synopsis:.9, prefix:1, middle:.8, range:1 } }
  }]
}));
api.renderPlan(ctx, { planHash:'fixture-v651', summary:{ groupCount:411 }, groups, reviewGroups:[], excludedPairs:[], skipped:[] });
const list = nodes.get('library-cleanup-list');
const disclosures = list.children.filter(node => node.tagName === 'ARTICLE');
assert.equal(disclosures.length, 24, 'initial DOM must render only one bounded batch');
assert(disclosures.every(node => node.children[0]?.tagName === 'BUTTON'), 'every group must use a browser-independent button disclosure');
assert(disclosures.every(node => node.children[0]?.children[0]?.className === 'library-cleanup-group-summary-layout'), 'summary grid must live in a child wrapper');
assert.equal(disclosures[0].dataset.cleanupHydrated, 'true', 'only the initially open group should hydrate immediately');
assert.equal(disclosures[0].dataset.open, 'true', 'the first group should be visibly open');
assert.equal(disclosures[1].children.length, 1, 'closed groups must keep only their toggle until opened');
disclosures[1].children[0].click();
assert.equal(disclosures[1].dataset.cleanupHydrated, 'true', 'opening a group must lazily hydrate its body');
assert.equal(disclosures[1].dataset.open, 'true', 'opening must be reflected in data-open');
assert.equal(disclosures[1].children.length, 2, 'hydrated group must append exactly one body');
disclosures[1].children[0].click();
assert.equal(disclosures[1].dataset.open, 'false', 'second click must collapse the group');
assert.equal(disclosures[1].children.length, 2, 'repeated toggle must not duplicate the body');
const preservedChildren = list.children;
api.renderPlan(ctx, { planHash:'fixture-v651', summary:{ groupCount:411, fingerprintStatus:{ queueLength:100 } }, groups, reviewGroups:[], excludedPairs:[], skipped:[] }, { preserveDomOnSamePlan:true });
assert.equal(list.children, preservedChildren, 'same-plan background refresh must preserve existing DOM');
const more = list.children.find(node => node.className === 'library-cleanup-load-more');
assert(more, 'load-more control must be rendered');
more.click();
const disclosuresAfter = list.children.filter(node => node.tagName === 'ARTICLE');
assert.equal(disclosuresAfter.length, 48, 'load-more must add one bounded batch');
assert(disclosuresAfter.length < 200, 'mobile DOM must not eagerly create the previous 200 disclosure nodes');

console.log(JSON.stringify({
  pass:'v657-admin-cleanup-disclosure-smoke-pass',
  initialGroups:disclosures.length,
  afterLoadMore:disclosuresAfter.length,
  customDisclosure:true
}));
