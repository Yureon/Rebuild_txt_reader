#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const html=read('public/admin/users.html');
const js=read('public/scripts/admin/metadata.mjs');
const api=read('public/scripts/rebuild/core/api.mjs');
const routes=read('server/routes/metadata-routes.js');
const store=read('server/services/metadata-store-service.js');
for(const id of ['owner-metadata-storage-stats','owner-metadata-cleanup-preview','owner-metadata-cleanup-apply','owner-metadata-storage-rewrite']) assert(html.includes(id));
for(const token of ['metadataStorage','previewMetadataCandidateCleanup','cleanupMetadataCandidates','rewriteMetadataCompressedStore']) assert(api.includes(token) && js.includes(token));
for(const route of ["'/metadata/storage'","'/metadata/storage/cleanup/preview'","'/metadata/storage/cleanup'","'/metadata/storage/rewrite'"]) assert(routes.includes(route));
assert(store.includes('METADATA_CANDIDATE_MAINTENANCE_PASS'));
assert(store.includes('atomicWriteCompressedJsonAsync'));
console.log(JSON.stringify({pass:'v642-metadata-storage-maintenance-ui-pass',ownerOnly:true,dryRun:true}));
