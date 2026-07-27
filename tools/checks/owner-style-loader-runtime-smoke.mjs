#!/usr/bin/env node
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const links = [];
let attempts = 0;
const doc = {
  head:{ appendChild(link) { links.push(link); attempts += 1; queueMicrotask(() => attempts === 1 ? link.onerror?.() : link.onload?.()); } },
  getElementById(id) { return links.find(link => link.id === id) || null; },
  createElement() {
    const link = { dataset:{}, remove() { const index=links.indexOf(link); if(index>=0) links.splice(index,1); } };
    return link;
  }
};
const moduleUrl = pathToFileURL(path.join(root, 'public/scripts/rebuild/features/owner-style-loader.mjs')).href + '?runtime-retry=' + Date.now();
const { ensureOwnerStylesLoaded } = await import(moduleUrl);
assert.equal(await ensureOwnerStylesLoaded(doc), false);
assert.equal(links.length, 0, 'failed owner stylesheet link must be removed');
assert.equal(await ensureOwnerStylesLoaded(doc), true);
assert.equal(attempts, 2, 'second call must create a new owner stylesheet link');
assert.equal(links[0].dataset.ownerCssLoaded, '1');
links[0].remove();
assert.equal(await ensureOwnerStylesLoaded(doc), true);
assert.equal(attempts, 3, 'removing a loaded link must allow a new load');
console.log(JSON.stringify({ pass:'v573-owner-style-loader-runtime-smoke-pass', attempts }));
