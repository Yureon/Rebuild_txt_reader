#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const route = read('server/routes/novels-routes.js');
const service = read('server/services/library-service.js');
assert(route.includes("v453-library-catalog-performance-pass"), 'novels route performance marker missing');
assert(route.includes("v453-novels-api-payload-budget-pass"), 'novels route payload budget marker missing');
assert(route.includes('novelsResponseCache'), 'novels response cache missing');
assert(route.includes('X-Novels-Api-Performance'), 'performance header missing');
assert(route.includes('X-Novels-Api-Response-Cache'), 'response cache header missing');
assert(route.includes('X-Novels-Api-Response-Cache-Budget'), 'response cache budget header missing');
assert(route.includes('X-Novels-Api-Response-Cache-Bytes'), 'response cache bytes header missing');
assert(route.includes('NOVELS_RESPONSE_CACHE_MAX_BYTES'), 'response cache byte budget missing');
assert(route.includes('buildAuthCacheScope(auth, accountService)'), 'cache key must include auth cache scope');
assert(route.includes('librarySignature'), 'cache key must include library signature');
assert(service.includes('recordNovelsApiPayloadMetrics'), 'library service metrics recorder missing');
assert(service.includes('novelsApi: Object.assign'), 'library cache status must expose novels API metrics');
assert(service.includes('responseCacheBudgetPass'), 'library cache status must expose response cache budget marker');
assert(service.includes('responseCacheBytes'), 'library cache status must expose response cache byte usage');
console.log('v453-library-catalog-performance-smoke-pass');
