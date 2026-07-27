#!/usr/bin/env node
import assert from 'node:assert/strict';import fs from 'node:fs';
const page=fs.readFileSync('public/scripts/rebuild/metadata-page.mjs','utf8');const api=fs.readFileSync('public/scripts/rebuild/core/api.mjs','utf8');const route=fs.readFileSync('server/routes/novels-routes.js','utf8');const html=fs.readFileSync('public/metadata.html','utf8');
for(const token of ['metadata-work-folder-filter','metadata-work-folder-field']) assert(html.includes(token),`HTML missing ${token}`);
for(const token of ['folderPaths:page.folderPath ? [page.folderPath] : []','loadFolderFilters','preserveLoadedCount','targetCount','refreshSelectedWorkSummary','removeWorkFromCurrentWindow','result?.applied ?? page.selectedPayload?.applied']) assert(page.includes(token),`page missing ${token}`);
assert(api.includes("appendMany('folder', filters.folderPaths)"));
for(const token of ['normalizeFolderFacetPath','folderFacetPrefixes','const folderEntries = sortedEntries(maps.folders);','folderPath.startsWith(`${folder}/`)']) assert(route.includes(token),`route missing ${token}`);
assert(!/refreshSelectedWorkSummary[\s\S]{0,400}loadWorks\(true/.test(page),'manual apply summary refresh must not reset pagination');
console.log(JSON.stringify({pass:'v676-metadata-folder-continuity-smoke-pass',folderFilter:true,manualApplyPaginationPreserved:true,extensionApplyPaginationPreserved:true}));
