#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const html = read('public/fragments/deferred-ui.html');
const css = read('public/styles/deferred-ui.css');
const ui = read('public/scripts/rebuild/features/ui.mjs');

for (const marker of [
  'id="settings-page-layout"',
  'class="sp-tabs settings-workspace-nav"',
  'class="settings-workspace-main"',
  'id="settings-mobile-detail-header"',
  'id="settings-mobile-back"',
  'data-mobile-view="index"'
]) assert(html.includes(marker), `settings workspace markup missing: ${marker}`);

for (const label of ['앱 모양 · 언어','글꼴 · 색상 · 본문','동작 · 상태 표시','기기 · 백업 · 계정','진단 · 복구']) {
  assert(html.includes(label), `settings navigation description missing: ${label}`);
}

for (const marker of [
  'grid-template-columns:240px minmax(0,1fr)!important',
  '.settings-panel.settings-page .settings-workspace-nav',
  '.settings-panel.settings-page .settings-workspace-main',
  '.settings-panel.settings-page .sp-body',
  'overflow-y:auto!important;',
  'grid-template-rows:auto minmax(0,1fr)!important',
  'touch-action:pan-y!important',
  'data-mobile-view="index"',
  'data-mobile-view="detail"',
  '.settings-mobile-detail-header'
]) assert(css.includes(marker), `settings workspace CSS missing: ${marker}`);

assert(css.includes('.settings-panel.settings-page .sp-tab-panel,\n.settings-panel.settings-page .sp-tab-body'), 'tab panels must explicitly relinquish nested scrolling');
assert(css.includes('overflow:visible!important;'), 'tab panel overflow must stay visible inside the single body scroller');

for (const marker of [
  "const SETTINGS_MOBILE_MEDIA = '(max-width: 980px)'",
  'const setSettingsMobileView = (view',
  'applySettingsMobilePageState(layout, normalized',
  "try { history.back(); } catch { finalizeSettingsPageClose(); }",
  "setSettingsMobileView('detail', { tab })",
  "onDeferred(getSettingsMobileBack(), 'settings-mobile-back'"
]) assert(ui.includes(marker), `settings workspace runtime missing: ${marker}`);

const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
assert.deepEqual([...new Set(duplicates)], [], 'settings workspace introduced duplicate IDs');

assert(!ui.includes('history.go(detail ? -2 : -1)'), 'settings close must not leave the site by over-navigating history');

console.log(JSON.stringify({
  pass:'v654-settings-workspace-compat-smoke-pass',
  desktop:'navigation+single-body-scroll',
  mobile:'index-detail',
  duplicateIds:0
}));
