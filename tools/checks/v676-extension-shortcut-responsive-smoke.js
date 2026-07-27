#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');
const manifest=JSON.parse(fs.readFileSync('extensions/metadata-login-helper/manifest.json','utf8'));
const html=fs.readFileSync('extensions/metadata-login-helper/popup.html','utf8');
const css=fs.readFileSync('extensions/metadata-login-helper/popup.css','utf8');
const js=fs.readFileSync('extensions/metadata-login-helper/popup.js','utf8');
assert(manifest.commands?._execute_action,'_execute_action command missing');
assert.equal(manifest.commands._execute_action.suggested_key.default,'Ctrl+Shift+Y');
assert(html.includes('id="shortcut-key"')&&html.includes('shortcut-hint'));
for(const token of ['--popup-width: 380px','width: var(--popup-width)','overflow-wrap: anywhere','grid-template-columns: repeat(3, minmax(0, 1fr))']) assert(css.includes(token),`CSS missing ${token}`);
assert(!css.includes('max-width: 100vw'),'popup width must not depend on its own viewport');
assert(js.includes('chrome.commands.getAll')&&js.includes("item.name === '_execute_action'"));
assert(html.includes('id="action-stack" class="action-stack" hidden')&&html.includes('id="import-button" type="button" hidden'));
assert(js.includes('importButton.hidden = !normalizedLabel'));
console.log(JSON.stringify({pass:'v676-extension-shortcut-responsive-smoke-pass',shortcut:true,fixedPopupWidth:true,blankActionHidden:true}));
