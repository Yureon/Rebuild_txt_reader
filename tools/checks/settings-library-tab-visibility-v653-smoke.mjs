#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { activateSettingsTab } from '../../public/scripts/rebuild/features/settings/tab-switching.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ui = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/ui.mjs'), 'utf8');

function classList() {
  const values = new Set();
  return {
    toggle(name, force){ if (force) values.add(name); else values.delete(name); },
    contains(name){ return values.has(name); }
  };
}
function panel(id) {
  return {
    id,
    hidden:false,
    attrs:{},
    classList:classList(),
    setAttribute(name, value){ this.attrs[name] = String(value); if (name === 'hidden') this.hidden = true; },
    removeAttribute(name){ delete this.attrs[name]; if (name === 'hidden') this.hidden = false; },
    closest(){ return null; },
    scrollTop:10
  };
}
function tab(id) {
  return { dataset:{ tab:id }, classList:classList(), attrs:{}, setAttribute(name,value){ this.attrs[name] = String(value); } };
}

const tabs = [tab('general-panel'), tab('viewer-panel'), tab('data-panel')];
const panels = [panel('general-panel'), panel('viewer-panel'), panel('data-panel')];
assert.equal(activateSettingsTab(tabs[1], tabs, panels), true);
assert.equal(panels[1].hidden, false, 'selected settings panel must be explicitly unhidden');
assert.equal(panels[1].attrs['aria-hidden'], 'false');
assert.equal(panels[0].hidden, true, 'previous settings panel must be hidden');
assert.equal(panels[2].hidden, true, 'other settings panels must be hidden');
assert(panels[1].classList.contains('active'));
assert(!panels[0].classList.contains('active'));

assert(ui.includes("activateSettingsTab(tab, contextTabs, settingsPanelsForContext(context))"), 'settings click must pass context-filtered panels');
assert(ui.includes("handleSettingsTabKeydown(event, tab, settingsTabsForContext(context), settingsPanelsForContext(context))"), 'settings keyboard navigation must pass context-filtered panels');
assert(ui.includes("const SETTINGS_PAGE_HISTORY_KEY = 'txtReaderSettingsPageV654'"), 'settings history contract was not advanced');

console.log(JSON.stringify({ pass:'v653-settings-library-tab-visibility-smoke-pass', selectedVisible:true, inactiveHidden:true }));
