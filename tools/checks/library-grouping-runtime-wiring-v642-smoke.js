#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const read=rel=>fs.readFileSync(path.join(root,rel),'utf8');
const app=read('server/app.js');
const novels=read('server/routes/novels-routes.js');
const metadata=read('server/routes/metadata-routes.js');
const diagnostics=read('server/services/admin-diagnostics-service.js');
for(const marker of ['createLibraryContentFingerprintService','createLibraryVariantPreferenceService','LIBRARY_CONTENT_FINGERPRINT_PATH','LIBRARY_VARIANT_PREFERENCE_PATH']) assert(app.includes(marker));
assert(novels.includes('libraryContentFingerprintService') && novels.includes('libraryVariantPreferenceService'));
assert(metadata.includes('libraryContentFingerprintService') && metadata.includes('libraryVariantPreferenceService'));
assert(diagnostics.includes('libraryContentFingerprint') && diagnostics.includes('libraryVariantPreferences'));
console.log(JSON.stringify({pass:'v642-library-grouping-runtime-wiring-pass'}));
