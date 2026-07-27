#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('public/admin/users.html');
const js=read('public/scripts/admin/library-cleanup.js');
for(const token of ['v643-library-cleanup-visible-candidates-pass','normalizePlan','library-cleanup-progress','previewPollTimer','MAX_PREVIEW_POLLS','visibleGroups','groupLimit = 200']) assert(js.includes(token),token);
for(const text of ['현재 조건에 해당하는 정리 후보가 없습니다.','앞의 ','fingerprint']) assert(js.includes(text),text);
for(const token of ['data-cleanup-panel="duplicates"','data-cleanup-panel="organization"']) assert(html.includes(token),token);
assert(html.includes('중복 정리'));
assert(html.includes('라이브러리 정리'));
console.log(JSON.stringify({pass:'v643-library-cleanup-candidates-pass',emptyState:true,progress:true,boundedRefresh:true}));
