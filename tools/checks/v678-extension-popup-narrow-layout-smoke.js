#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('extensions/metadata-login-helper/popup.html','utf8');
const css=fs.readFileSync('extensions/metadata-login-helper/popup.css','utf8');
const js=fs.readFileSync('extensions/metadata-login-helper/popup.js','utf8');
for(const token of ['id="action-stack" class="action-stack" hidden','id="import-button" type="button" hidden','class="popup-description"','class="step-number"','class="step-label"']) assert(html.includes(token),`popup HTML missing ${token}`);
for(const token of ['--popup-width: 380px','width: var(--popup-width)','min-width: var(--popup-width)','max-width: var(--popup-width)','grid-template-areas: "mark heading" "description description"','.action-stack[hidden]','button[hidden]']) assert(css.includes(token),`popup CSS missing ${token}`);
assert(!css.includes('max-width: 100vw'),'self-referential viewport width regression');
assert(!/@media\s*\(max-width:\s*(?:270|300)px\)/.test(css),'obsolete narrow media query regression');
for(const token of ['importButton.hidden = !normalizedLabel','actionStack.hidden = !hasVisibleAction','function showResetAction(show)','setAction(null, null);','캡처 연결을 기다리고 있습니다']) assert(js.includes(token),`popup JS missing ${token}`);
assert(!js.includes("setStatus('진행 중인 TXT Reader pairing을 찾지 못했습니다.', true)"),'no-pairing state must not render as an error');
console.log(JSON.stringify({pass:'v678-extension-popup-narrow-layout-smoke-pass',intrinsicWidth:380,blankActionHidden:true}));
