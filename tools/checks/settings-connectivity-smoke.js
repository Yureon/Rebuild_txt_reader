#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const PASS = 'v369-settings-connectivity-smoke-pass';

const html = fs.readFileSync('public/fragments/app-shell.html', 'utf8');
const elements = fs.readFileSync('public/scripts/rebuild/features/ui/elements.mjs', 'utf8');
const controls = fs.readFileSync('public/scripts/rebuild/features/settings/controls.mjs', 'utf8');
const appearance = fs.readFileSync('public/scripts/rebuild/features/settings/appearance.mjs', 'utf8');

function findOpeningDivById(source, id) {
  const marker = `id="${id}"`;
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `missing #${id}`);
  const openIndex = source.lastIndexOf('<div', markerIndex);
  assert.ok(openIndex >= 0, `missing opening div for #${id}`);
  const closeBracket = source.indexOf('>', openIndex);
  assert.ok(closeBracket > openIndex, `malformed opening div for #${id}`);
  return openIndex;
}

function findMatchingDivClose(source, openIndex) {
  const tokens = source.matchAll(/<\/?div\b[^>]*>/gi);
  let depth = 0;
  let seen = false;
  for (const token of tokens) {
    const index = token.index;
    if (index < openIndex) continue;
    const text = token[0];
    if (text.startsWith('</')) {
      if (seen) {
        depth -= 1;
        if (depth === 0) return index + text.length;
      }
    } else {
      seen = true;
      depth += 1;
    }
  }
  throw new Error(`no matching </div> for opening div at ${openIndex}`);
}

const bodyStart = findOpeningDivById(html, 'settings-panel-body');
const bodyEnd = findMatchingDivClose(html, bodyStart);
const generalStart = findOpeningDivById(html, 'general-panel');
const generalEnd = findMatchingDivClose(html, generalStart);
const viewerStart = findOpeningDivById(html, 'viewer-panel');
const viewerEnd = findMatchingDivClose(html, viewerStart);
const funcStart = findOpeningDivById(html, 'func-panel');
const funcEnd = findMatchingDivClose(html, funcStart);
assert.ok(bodyStart < generalStart && generalEnd < viewerStart && viewerEnd < funcStart && funcEnd < bodyEnd,
  'settings tab panels must be sibling panels directly ordered under #settings-panel-body');
assert.ok(html.slice(generalStart, generalEnd).includes('data-settings-tab-body="general"'), 'general panel must contain general tab body');
assert.ok(html.slice(viewerStart, viewerEnd).includes('data-settings-tab-body="viewer"'), 'viewer panel must contain viewer tab body');
assert.ok(html.slice(funcStart, funcEnd).includes('data-settings-tab-body="func"'), 'features panel must contain func tab body');
assert.ok(!html.slice(generalStart, generalEnd).includes('id="viewer-panel"'), 'viewer panel must not be nested inside general panel');


for (const id of ['pad-v-val','anim-range','anim-val','open-dev-debug-btn','open-shortcut-btn']) {
  assert.ok(html.includes(`id="${id}"`), `settings shell must contain #${id}`);
  assert.ok(elements.includes(`'${id}'`), `collectElements must map #${id}`);
}
for (const removed of ['open-safe-area-settings-btn','library-dnd-hover-delay-slider','server-comm-notify-toggle','server-comm-notify-interval','library-virtual-settings-status']) {
  assert.ok(!html.includes(`id="${removed}"`), `removed setting control must stay absent: #${removed}`);
}
assert.ok(html.includes('shortcut-settings-card mobile-site-hidden'), 'shortcut settings card must be hidden on mobile profile');
assert.ok(html.includes('dev-debug-settings-card'), 'developer debug card must be independent');
assert.ok(html.includes('max="600" value="220"'), 'UI animation slider must allow the 220ms default');
assert.ok(appearance.includes("['padVVal', `${p.padV}px`]"), 'appearance sync must write vertical padding value label');
assert.ok(controls.includes('p.libraryDndHoverOpenDelay = 650'), 'library drag hover delay must be fixed to 650ms');
assert.ok(!controls.includes('serverCommNotifyToggle'), 'removed server notification setting must not be bound');
console.log(PASS);
