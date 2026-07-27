#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const page=fs.readFileSync(path.join(root,'public/scripts/rebuild/metadata-page.mjs'),'utf8');
const modal=fs.readFileSync(path.join(root,'public/scripts/rebuild/features/library-metadata-runtime.mjs'),'utf8');
for(const token of ['v643-metadata-locale-collection-pass','metadataAvailableForLocale','providerField.hidden','0/0','한국어 사이트 언어에서만']) assert(page.includes(token),token);
assert(page.includes("button.disabled = !page.metadataAvailableForLocale"));
assert(page.includes("if (!page.metadataAvailableForLocale) return toast"));
for(const token of ['v643-library-metadata-locale-pass','metadataAvailableForLocale ? providerControls','controller.payload?.metadataAvailableForLocale === false']) assert(modal.includes(token),token);
console.log(JSON.stringify({pass:'v643-metadata-page-locale-pass',standalone:true,libraryModal:true}));
