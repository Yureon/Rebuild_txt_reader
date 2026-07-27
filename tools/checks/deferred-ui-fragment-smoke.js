#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { CURRENT_REBUILD_VERSION } = require('./current-rebuild-version.js');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const PASS = 'v569-deferred-ui-fragment-smoke-pass';
const core = read('public/fragments/app-shell.html');
const deferred = read('public/fragments/deferred-ui.html');
const loader = read('public/scripts/rebuild/core/feature-fragments.mjs');
const lazy = read('public/scripts/rebuild/features/lazy-features.mjs');
const coreCss = read('public/styles/app.css');
const deferredCss = read('public/styles/deferred-ui.css');
for (const id of ['settings-panel','nsearch-panel','bookmark-modal','recovery-center-modal','devdbg-modal']) {
  assert.ok(!core.includes(`id="${id}"`), `core shell must defer ${id}`);
  assert.ok(deferred.includes(`id="${id}"`), `deferred shell must contain ${id}`);
}
for (const id of ['app','novel-list','reader','list-action-overlay','chunk-jumper-panel']) assert.ok(core.includes(`id="${id}"`), `core shell must retain ${id}`);
const ids = Array.from((core + '\n' + deferred).matchAll(/\bid="([^"]+)"/g)).map(match => match[1]);
assert.equal(ids.length, new Set(ids).size, 'split shell must not duplicate IDs');
assert.ok(Buffer.byteLength(core) < 20000, 'core shell must stay below 20KB');
assert.ok(Buffer.byteLength(deferred) > Buffer.byteLength(core), 'deferred fragment must own cold UI');
for (const token of ['DEFERRED_UI_FRAGMENT_PASS','DEFERRED_UI_STYLE_PASS',`/fragments/deferred-ui.html?v=${CURRENT_REBUILD_VERSION}`,`/styles/deferred-ui.css?v=${CURRENT_REBUILD_VERSION}`,'DEFERRED_ASSET_RETRYABLE_STATUS','edge_retry=','collectElements()','refreshDeferredUiBindings']) assert.ok(loader.includes(token), `deferred loader token missing: ${token}`);
assert.ok(lazy.includes('ensureDeferredUi(app).then(() => import('), 'lazy features must load fragment before cold modules');
assert.ok(!coreCss.includes('.settings-panel{'), 'settings panel CSS must not stay in core CSS');
assert.ok(deferredCss.includes('.settings-panel{'), 'deferred CSS must contain settings panel styles');
console.log(JSON.stringify({ pass:PASS, coreBytes:Buffer.byteLength(core), deferredBytes:Buffer.byteLength(deferred), coreCssBytes:Buffer.byteLength(coreCss), deferredCssBytes:Buffer.byteLength(deferredCss) }));

assert.ok(loader.includes('link.remove()'), 'failed deferred stylesheet links must be removed before retry');
assert.ok(loader.includes('Array.from(template.content.children)'), 'partial deferred UI must recover missing top-level fragment nodes independently');
