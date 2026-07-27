#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const fragmentHtml = fs.readFileSync(path.join(root, 'public/fragments/deferred-ui.html'), 'utf8');
const topLevelIds = [
  'shared-font-file', 'recovery-import-file', 'bookmark-overlay', 'settings-overlay', 'settings-panel',
  'device-management-overlay', 'device-management-modal', 'read-data-overlay', 'custom-css-overlay', 'custom-css-panel',
  'site-language-editor-overlay', 'site-language-editor-modal', 'shortcut-overlay', 'account-password-overlay',
  'account-password-modal', 'shortcut-panel', 'nsearch-overlay', 'nsearch-panel', 'search-nav-remote',
  'preprocess-editor-overlay', 'preprocess-editor-modal', 'font-modal-overlay', 'font-modal',
  'recovery-center-overlay', 'recovery-center-modal', 'theme-editor-overlay', 'theme-editor-modal',
  'devdbg-modal-overlay', 'devdbg-modal'
];

const nodes = new Map([
  ['settings-panel', { id:'settings-panel' }],
  ['nsearch-panel', { id:'nsearch-panel' }]
]);
const links = [];
let fetchCalls = 0;
let linkAttempts = 0;

function cloneNode(node) { return { ...node, cloneNode:() => cloneNode(node) }; }
const documentMock = {
  documentElement:{ dataset:{} },
  getElementById(id) { return nodes.get(id) || links.find(link => link.id === id) || null; },
  querySelector(selector) {
    const match = /data-deferred-ui-style-pass="([^"]+)"/.exec(selector);
    return match ? links.find(link => link.dataset?.deferredUiStylePass === match[1]) || null : null;
  },
  querySelectorAll() { return []; },
  createElement(tag) {
    if (tag === 'link') {
      const link = { tagName:'LINK', dataset:{}, remove() { const index=links.indexOf(link); if(index>=0) links.splice(index,1); } };
      return link;
    }
    if (tag === 'template') {
      const template = { content:{ children:[] } };
      Object.defineProperty(template, 'innerHTML', {
        set(value) {
          assert.equal(value, fragmentHtml);
          template.content.children = topLevelIds.map(id => cloneNode({ id }));
        }
      });
      return template;
    }
    throw new Error('unexpected element: ' + tag);
  },
  head:{ append(link) { links.push(link); linkAttempts += 1; queueMicrotask(() => linkAttempts === 1 ? link.onerror?.() : link.onload?.()); } },
  body:{ append(node) { if (node.id) nodes.set(node.id, node); } }
};

globalThis.document = documentMock;
globalThis.window = { dispatchEvent() {} };
globalThis.CustomEvent = class CustomEvent { constructor(type, options) { this.type=type; this.detail=options?.detail; } };
globalThis.fetch = async () => {
  fetchCalls += 1;
  return { ok:true, text:async()=>fragmentHtml };
};

const moduleUrl = pathToFileURL(path.join(root, 'public/scripts/rebuild/core/feature-fragments.mjs')).href + '?runtime-recovery=' + Date.now();
const { ensureDeferredUi } = await import(moduleUrl);
const app = { els:{}, refreshDeferredUiBindings() {} };
await ensureDeferredUi(app);
assert.equal(fetchCalls, 1, 'missing deferred nodes must fetch the fragment once');
assert.equal(linkAttempts, 2, 'a transient stylesheet load failure must retry with a fresh link');
for (const id of topLevelIds) assert.ok(nodes.has(id), 'missing recovered node: ' + id);

nodes.delete('bookmark-overlay');
await ensureDeferredUi(app);
assert.equal(fetchCalls, 2, 'a node removed after the first load must trigger a fresh fragment recovery fetch');
assert.ok(nodes.has('bookmark-overlay'));
console.log(JSON.stringify({ pass:'v573-deferred-ui-runtime-recovery-smoke-pass', required:topLevelIds.length, fetchCalls }));
