#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const html=fs.readFileSync('public/metadata.html','utf8');
const css=fs.readFileSync('public/styles/metadata-page.css','utf8');
const {CURRENT_REBUILD_VERSION}=require('./current-rebuild-version.js');
assert(html.includes('id="metadata-work-folder-query" type="search"'),'folder search input missing');
assert(html.includes(`/styles/metadata-page.css?v=${CURRENT_REBUILD_VERSION}`),'metadata stylesheet cachebuster is not current');
for(const token of [
  '#metadata-work-folder-query{',
  'background-color:var(--bg2)',
  'color:var(--text)',
  '-webkit-text-fill-color:var(--text)',
  'border:1px solid var(--border)',
  'caret-color:var(--accent2)',
  '#metadata-work-folder-query::placeholder',
  '#metadata-work-folder-query:-webkit-autofill',
  'background-color:var(--surface)'
]) assert(css.includes(token),`metadata folder theme token missing: ${token}`);
assert(!css.includes('.metadata-work-folder-search-field input{width:100%;min-height:40px}'),'unstyled legacy folder input rule remains');
console.log(JSON.stringify({pass:'v678-metadata-folder-theme-smoke-pass',cachebuster:CURRENT_REBUILD_VERSION,themeOwned:true,autofillGuard:true}));
