#!/usr/bin/env node
const fs = require('fs');
const assert = require('assert');
const ui = fs.readFileSync('public/scripts/rebuild/features/ui.mjs','utf8');
const css = fs.readFileSync('public/styles/app.css','utf8');
const dataTools = fs.readFileSync('public/scripts/rebuild/features/settings/data-tools.mjs','utf8');
const siteLanguage = fs.readFileSync('public/scripts/rebuild/features/settings/site-language.mjs','utf8');
for (const pair of [
  "['siteLanguageEditorOverlay', 'siteLanguageEditorModal']",
  "['accountPasswordOverlay', 'accountPasswordModal']"
]) assert.ok(ui.includes(pair), `modal pair missing: ${pair}`);
assert.ok(ui.includes('assignNestedModalStack'));
assert.ok(ui.includes("overlay.style.setProperty('z-index', String(overlayZ), 'important')"));
assert.ok(ui.includes("panel.style.setProperty('z-index', String(panelZ), 'important')"));
assert.ok(ui.includes('maximum + 10'), 'nested modal must stack above the currently open modal');
assert.ok(ui.includes('clearNestedModalStack'));
assert.ok(dataTools.includes("app.openLayer('accountPasswordOverlay', 'accountPasswordModal')"));
assert.ok(siteLanguage.includes("app.openLayer('siteLanguageEditorOverlay', 'siteLanguageEditorModal')"));
assert.ok(css.includes('[data-modal-stack-overlay]') && css.includes('[data-modal-stack-panel]'));
console.log('v577-settings-nested-modal-stack-smoke-pass');
