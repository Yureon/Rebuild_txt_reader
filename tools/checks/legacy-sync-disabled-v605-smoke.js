#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const source=fs.readFileSync('server/routes/state-routes.js','utf8');
const getIndex=source.indexOf("router.get('/sync'");
const postIndex=source.indexOf("router.post('/sync'");
assert(getIndex>=0 && postIndex>getIndex,'legacy sync GET/POST routes must remain explicit');
const getSlice=source.slice(getIndex,postIndex);
assert(getSlice.includes('status(410)') && getSlice.includes('legacy sync api disabled'),'legacy sync GET must be disabled');
const postSlice=source.slice(postIndex,postIndex+420);
assert(postSlice.includes('status(410)') && postSlice.includes('legacy sync api disabled'),'legacy sync POST must remain disabled');
assert(!source.includes('getLegacySyncState())'),'legacy state payload must not be returned to restricted users');
const docs=fs.readFileSync('docs/api-contract.md','utf8');
assert(docs.includes('GET /api/sync` / `POST /api/sync') && docs.includes('410 legacy sync api disabled'),'API contract must document full legacy sync retirement');
console.log(JSON.stringify({pass:'v605-legacy-sync-disabled-smoke-pass'}));
