#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const policy=fs.readFileSync('server/middleware/cache-policy.js','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');
const matcher=fs.readFileSync('public/scripts/rebuild/features/search/matcher.mjs','utf8');
assert(!policy.includes("source:'server-build-mismatch'"),'server must not replace stale scripts with a mismatch program');
assert(policy.includes("X-TXT-Reader-Stale-Build-Forwarded"),'non-executable transition marker is missing');
assert(policy.includes("error:'reload_required'"),'server stale executable must return reload_required');
assert(policy.includes("X-TXT-Reader-Reload-Required"),'server stale executable reload header is missing');
assert(sw.includes('blockExecutableRequest'),'worker must fail-closed on unconfirmed executable requests');
assert(sw.includes("error:'reload_required'"),'worker reload-required response is missing');
assert(!sw.includes('forwardNewerBuildAsset('),'worker must not forward future executable assets into the current runtime');
assert(matcher.includes("data.type === 'TXT_READER_BUILD_MISMATCH'"));
assert(matcher.includes("String(message).includes('TXT_READER_BUILD_MISMATCH')"));
assert(matcher.includes('__TXT_READER_REQUIRE_UPDATE__') || matcher.includes('txt-reader:build-update-required'));
assert(!matcher.includes('globalThis.location?.reload?.()'));
console.log(JSON.stringify({pass:'v637-build-mismatch-fail-closed-smoke-pass',forwarded:false}));
