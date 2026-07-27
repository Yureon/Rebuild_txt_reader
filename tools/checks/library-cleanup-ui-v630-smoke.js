#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('public/admin/users.html');
const script = read('public/scripts/admin/library-cleanup.js');
const css = read('public/styles/admin-users.css');
const service = read('server/services/library-cleanup-service.js');

assert(html.includes('data-library-cleanup-ui-pass="v642-library-cleanup-similarity-ui-pass"'));
assert(html.includes('작품 묶음·대표 파일 검토'));
assert(html.includes('실제 서재 경로'));
assert(html.includes('정리 스크립트 다운로드'));
assert(script.includes("class:'library-cleanup-target-preview'"), 'collapsed groups must show an actual candidate path');
assert(script.includes('groupIndex === 0') && script.includes('createDisclosure'), 'the first cleanup group must use the open custom disclosure contract');
assert(script.includes("txt-reader-library-cleanup.ps1"));
assert(script.includes("['\\ufeff', String(result.script || '')]"), 'PowerShell download must retain Korean paths through a UTF-8 BOM');
assert(css.includes('.library-cleanup-target-preview'));
assert(/\.library-cleanup-list\{[^}]*min-height:180px[^}]*visibility:visible[^}]*opacity:1/u.test(css));
assert(service.includes("fileName:`txt-reader-library-cleanup-${selected.scriptPlanHash.slice(0, 12)}.ps1`"));
assert(service.includes("scriptFormat:'ps1'"));
assert(!/fileName:`[^`]+\.cjs`/u.test(service), 'the API must not export CJS cleanup scripts');
console.log(JSON.stringify({ pass:'v630-library-cleanup-ui-smoke-pass', targetPreview:true, scriptFormat:'ps1' }));
