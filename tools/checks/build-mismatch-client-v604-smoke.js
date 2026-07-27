#!/usr/bin/env node
const assert=require('assert');
const fs=require('fs');
const source=fs.readFileSync('public/scripts/rebuild/core/feature-fragments.mjs','utf8');
assert(source.includes('X-TXT-Reader-Reload-Required'));
assert(source.includes('TXT_READER_BUILD_MISMATCH'));
assert(source.includes('__TXT_READER_REQUIRE_UPDATE__') || source.includes('txt-reader:build-update-required'));
assert(!source.includes('location?.reload?.()'));
console.log(JSON.stringify({pass:'v622-build-mismatch-client-approved-update-smoke-pass'}));
