#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const source = fs.readFileSync('public/sw.js','utf8');
for (const token of [
  "const requestBuild = requestedBuild(requestUrl)",
  "requestBuild !== BUILD",
  "return blockExecutableRequest(clientId, 'requested-build-mismatch', requestBuild)",
  "fetch(request, { cache:'no-store' })",
  "CLIENT_STATE_CACHE",
  "waitForCurrentClientBuild"
]) assert(source.includes(token), `missing service worker build boundary token: ${token}`);
assert(!source.includes('forwardNewerBuildAsset('), 'future executable assets must not be forwarded');
assert(source.indexOf("requestBuild && requestBuild !== BUILD") < source.indexOf('cache.match(cacheRequest)'), 'build mismatch must be rejected before cache lookup');
assert(source.indexOf("requestBuild && requestBuild !== BUILD") < source.indexOf('cache.put(cacheRequest'), 'stale build must never enter normalized cache');
console.log(JSON.stringify({pass:'v637-service-worker-build-boundary-smoke-pass',forwarded:false}));
