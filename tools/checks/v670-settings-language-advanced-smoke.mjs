#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('public/fragments/deferred-ui.html');
const css = read('public/styles/deferred-ui.css');
const runtime = read('public/scripts/rebuild/features/settings/site-language-runtime.mjs');
const control = read('public/scripts/rebuild/features/settings/site-language.mjs');
const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
const lazy = read('public/scripts/rebuild/features/lazy-features.mjs');
const ui = read('public/scripts/rebuild/features/ui.mjs');
const readData = read('public/scripts/rebuild/features/bookmarks/read-data-modal.mjs');
const customCss = read('public/scripts/rebuild/features/settings/custom-css.mjs');

assert.match(html, /id="site-language-combobox"[^>]*data-site-language-combobox="v670"/);
assert.match(html, /id="site-language-trigger"[^>]*aria-haspopup="listbox"/);
assert.match(html, /id="site-language-list"[^>]*role="listbox"/);
assert.match(html, /id="site-language-select"[^>]*site-language-native-select/);
assert.match(css, /\.site-language-list\{[^}]*background:color-mix\([^}]*var\(--surface\)/s);
assert.match(css, /\.site-language-option\[aria-selected="true"\]/);
assert.match(runtime, /function syncThemedSiteLanguageList\(select\)/);
assert.match(control, /data-site-language-value/);
assert.match(control, /ArrowDown/);
assert.match(control, /pointerdown/);

assert.match(html, /class="settings-inline-stepper ui-font-stepper" role="group"/);
assert.match(html, /<output id="ui-fs-val"/);
assert.match(css, /\.settings-panel \.ui-font-step-btn\{/);
assert.match(css, /border-radius:10px/);

const debugTab = html.slice(html.indexOf('id="settings-tab-debug"'), html.indexOf('</button>', html.indexOf('id="settings-tab-debug"')));
assert.match(debugTab, /<strong>고급<\/strong>/);
assert.match(debugTab, /관리 도구 · 진단/);
const advancedStart = html.indexOf('class="setting-block advanced-management-block"');
const debugStart = html.indexOf('class="setting-block developer-debug-block"');
assert(advancedStart > -1 && debugStart > advancedStart, 'advanced management tools must appear before developer debug');
for (const id of ['open-device-management-advanced-btn','open-read-data-advanced-btn','open-custom-css-advanced-btn']) {
  assert(html.includes(`id="${id}"`), `${id} missing`);
  assert(elements.includes(`'${id}'`), `${id} missing from element collector`);
  assert(lazy.includes(`['${id}',`), `${id} missing from deferred feature mapping`);
}
assert.match(ui, /openDeviceManagementAdvancedBtn/);
assert.match(readData, /openReadDataAdvancedBtn/);
assert.match(customCss, /openCustomCssAdvancedBtn/);
assert.match(css, /\.advanced-management-grid\{/);

console.log('v670 settings language advanced smoke pass');
