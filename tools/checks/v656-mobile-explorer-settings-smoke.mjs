#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySettingsMobilePageState } from '../../public/scripts/rebuild/features/settings/tab-switching.mjs';
import { toggleLibraryExplorerMobileNavigationRuntime } from '../../public/scripts/rebuild/features/library-event-delegation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

function classes(initial = []) {
  const set = new Set(initial);
  return {
    toggle(name, force) { if (force === undefined ? !set.has(name) : force) set.add(name); else set.delete(name); },
    contains(name) { return set.has(name); },
    values() { return [...set]; }
  };
}
function node(initial = []) {
  const attrs = new Map();
  return {
    classList: classes(initial),
    setAttribute(name, value) { attrs.set(name, String(value)); },
    removeAttribute(name) { attrs.delete(name); },
    getAttribute(name) { return attrs.get(name) ?? null; },
    attrs
  };
}
const nav = node();
const main = node();
const layout = {
  dataset:{},
  classList:classes(),
  querySelector(selector) { return selector === '.settings-workspace-nav' ? nav : selector === '.settings-workspace-main' ? main : null; }
};
let state = applySettingsMobilePageState(layout, 'detail', { mobile:true });
assert.equal(state.detailVisible, true);
assert.equal(layout.dataset.mobileView, 'detail');
assert(nav.classList.contains('settings-mobile-hidden'));
assert(!main.classList.contains('settings-mobile-hidden'));
assert.equal(nav.getAttribute('inert'), '');
assert.equal(main.getAttribute('inert'), null);
state = applySettingsMobilePageState(layout, 'index', { mobile:true });
assert.equal(state.navVisible, true);
assert(!nav.classList.contains('settings-mobile-hidden'));
assert(main.classList.contains('settings-mobile-hidden'));

const tree = node();
const chevron = { textContent:'▾' };
const navigation = node();
const button = node();
button.closest = selector => selector === '.library-explorer-navigation' ? navigation : null;
button.querySelector = selector => selector === '.library-explorer-mobile-nav-chevron' ? chevron : null;
assert.equal(toggleLibraryExplorerMobileNavigationRuntime(button), true);
assert(navigation.classList.contains('is-mobile-open'));
assert.equal(button.getAttribute('aria-expanded'), 'true');
assert.equal(chevron.textContent, '▴');
assert.equal(toggleLibraryExplorerMobileNavigationRuntime(button), false);
assert(!navigation.classList.contains('is-mobile-open'));

const ui = read('public/scripts/rebuild/features/ui.mjs');
const elements = read('public/scripts/rebuild/features/ui/elements.mjs');
const explorer = read('public/scripts/rebuild/features/library-explorer-renderer.mjs');
const appCss = read('public/styles/app.css');
const settingsCss = read('public/styles/deferred-ui.css');
assert(ui.includes('resolve every node lazily'), 'deferred settings nodes are still captured before fragment load');
assert(ui.includes("onDeferred(getSettingsMobileBack(), 'settings-mobile-back'"), 'mobile settings back control is not rebound after deferred load');
assert(elements.includes("'settings-mobile-scope','settings-panel-body','bookmark-btn'"), 'settings body is not recollected after deferred load');
assert(explorer.includes('library-explorer-mobile-nav-toggle'), 'mobile Explorer folder drawer toggle missing');
assert(explorer.includes("class:'library-explorer-nav-tree'"), 'mobile Explorer folder tree wrapper missing');
assert(appCss.includes('grid-template-rows:auto minmax(0,1fr)!important'), 'mobile Explorer workspace height contract missing');
assert(appCss.includes('.library-explorer-navigation.is-mobile-open .library-explorer-nav-tree{display:block}'), 'mobile Explorer drawer open state missing');
assert(settingsCss.includes('.settings-page-layout[data-mobile-view="index"] .settings-workspace-main') && settingsCss.includes('.settings-page-layout[data-mobile-view="detail"] .settings-workspace-nav'), 'mobile settings explicit visibility state missing');
assert(settingsCss.includes('.settings-page-layout.is-mobile-detail .settings-workspace-main'), 'mobile settings detail layout missing');
console.log(JSON.stringify({ pass:'v656-mobile-explorer-settings-smoke-pass', mobileSettings:true, mobileExplorer:true }));
