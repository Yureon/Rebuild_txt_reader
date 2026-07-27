#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const source=fs.readFileSync('server/routes/metadata-routes.js','utf8');
assert(source.includes('function resolveSessionContext'));
assert(source.includes("router.get('/metadata/providers', requireViewerLight"));
assert(source.includes("router.get('/metadata/jobs', requireEditorLight"));
assert(source.includes("writeGuard('metadata-provider-probe', 20, 5*60_000), requireEditorLight"));
assert(source.includes('const lightCtx = resolveSessionContext(req,res,true)'));
assert(source.includes('if (!fullLibraryAccess)'));
const fullResolver=source.slice(source.indexOf('async function resolveContext'),source.indexOf('async function resolveNovel'));
assert(fullResolver.includes('getLibraryCachedAsync'));
const lightResolver=source.slice(source.indexOf('function resolveSessionContext'),source.indexOf('async function resolveContext'));
assert(!lightResolver.includes('getLibraryCached'));
console.log(JSON.stringify({pass:'v604-metadata-light-context-smoke-pass'}));
