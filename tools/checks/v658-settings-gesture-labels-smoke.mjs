#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const css = read('public/styles/deferred-ui.css');
const metadataCss = read('public/styles/metadata-page.css');
const fragment = read('public/fragments/deferred-ui.html');
const shell = read('public/fragments/app-shell.html');
const runtime = read('public/scripts/rebuild/features/library-shelf-runtime.mjs');
const ui = read('public/scripts/rebuild/features/ui.mjs');

const pageMarker = '/* v659: consolidated library settings workspace and read-data modal contract. */';
const markerAt = css.indexOf(pageMarker);
assert(markerAt > 0, 'current library settings page CSS ownership marker is missing');
const pageCss = css.slice(markerAt);
assert.match(pageCss, /\.settings-panel\[data-settings-context="reader"\] \.sp-body\{[\s\S]*?overflow-y:auto!important;/,
  'reader modal scroll ownership must remain explicitly context-scoped');
assert.match(pageCss, /\.settings-panel\.settings-page \.sp-body\{[\s\S]*?overflow-y:auto!important;[\s\S]*?touch-action:pan-y!important;/,
  'library settings detail body must own vertical wheel and touch scrolling');
assert.match(pageCss, /\.settings-panel\.settings-page \.sp-tab-panel,[\s\S]*?overflow:visible!important;/,
  'library settings panels must not create an unbounded nested scroll owner');
assert.match(pageCss, /@media\(max-width:980px\)[\s\S]*?\.settings-panel\.settings-page \.settings-page-layout\.is-mobile-detail \.settings-workspace-main\{display:grid!important\}/,
  'mobile detail view must keep the scroll-owning workspace visible');

function elementSnippet(id, length = 520) {
  const at = fragment.indexOf(`id="${id}"`);
  assert(at >= 0, `${id} is missing`);
  return fragment.slice(at, at + length);
}
assert(elementSnippet('settings-tab-debug').includes('data-settings-contexts="reader"'),
  'developer tab must be reader-only');
assert(elementSnippet('debug-panel').includes('data-settings-contexts="reader"'),
  'developer panel must be reader-only');
assert(!elementSnippet('settings-tab-debug').includes('data-settings-contexts="library reader"'));
assert(!elementSnippet('debug-panel').includes('data-settings-contexts="library reader"'));
assert(ui.includes("'앱 모양, 읽기 화면, 조작과 표시, 데이터 및 계정 설정을 조정합니다.'"),
  'library settings accessibility description must not advertise developer tools');

assert(shell.includes('<h1 id="library-panel-title">서재</h1>'), 'initial library title must be 서재');
assert(runtime.includes("libraryPanelTitle.textContent = '서재';"), 'all library view modes must keep the 서재 title');
assert(shell.includes('aria-label="탐색기형 보기"'));
assert(shell.includes('title="탐색기형 보기"'));
assert(shell.includes('<span>탐색기형</span>'));
assert(!shell.includes('윈도우형'), 'old explorer label must not remain in the user-facing shell');

const metadataMarker = '/* v658: mobile metadata pages keep the full content width available for vertical pan gestures.';
const metadataAt = metadataCss.indexOf(metadataMarker);
assert(metadataAt >= 0, 'v658 metadata gesture ownership marker is missing');
const mobileGestureCss = metadataCss.slice(metadataAt);
assert.match(mobileGestureCss, /@media\(max-width:760px\)[\s\S]*?#metadata-page-works \.metadata-work-list\{[\s\S]*?overflow:visible;[\s\S]*?overscroll-behavior:auto;[\s\S]*?touch-action:pan-y;/,
  'mobile unbounded metadata list must delegate vertical gestures to the document');
assert.match(mobileGestureCss, /html,[\s\S]*?body\.metadata-page-body\{[\s\S]*?touch-action:pan-y;[\s\S]*?overscroll-behavior-y:auto;/,
  'mobile metadata document must accept vertical pan gestures across the viewport');

console.log(JSON.stringify({
  pass:'v658-settings-gesture-labels-smoke-pass',
  librarySettingsTabs:4,
  legacyModalScoped:true,
  metadataDocumentGestureOwner:true,
  explorerLabel:'탐색기형'
}));
