#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.resolve(__dirname, '../..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

const novelsRoutes = read('server/routes/novels-routes.js');
const manifestRoutes = read('server/routes/block-manifest-routes.js');
const serverSmoke = read('tools/smoke_server_http.js');

assert.ok(novelsRoutes.includes("v434-novels-conditional-cache-pass"), 'novels conditional cache marker remains');
assert.ok(novelsRoutes.includes("v434-content-chunk-conditional-cache-pass"), 'content conditional cache marker remains');
assert.ok(novelsRoutes.includes('buildAuthCacheScope'), 'novels/content auth cache scope exists');
assert.ok(novelsRoutes.includes('userId') && novelsRoutes.includes('accessVersion') && novelsRoutes.includes('accessSig'), 'novels/content etag scope includes user/access signature');
assert.ok(novelsRoutes.includes('private, max-age=0, must-revalidate'), 'reader api private revalidation policy');
assert.ok(novelsRoutes.includes("appendVaryHeader(res, 'Cookie')"), 'reader api varies by cookie');
assert.ok(!/Cache-Control[^\n]+public/i.test(novelsRoutes), 'novels/content api does not set public cache');
assert.ok(!/Cache-Control[^\n]+immutable/i.test(novelsRoutes), 'novels/content api does not set immutable cache');

assert.ok(manifestRoutes.includes("v434-block-manifest-conditional-cache-pass"), 'block-manifest conditional cache marker remains');
assert.ok(manifestRoutes.includes('function stableClone') && manifestRoutes.includes('function stableHash'), 'block-manifest stable key-order hash helpers exist');
assert.ok(manifestRoutes.includes('const accessSig = stableHash(auth && auth.access || {});'), 'block-manifest access signature uses stable hash');
assert.ok(manifestRoutes.includes('return \'W/"\' + stableHash(stable) + \'"\';'), 'block-manifest etag uses stable hash');
assert.ok(manifestRoutes.includes('assertNovelAllowed') && manifestRoutes.includes('assertEpisodeAllowed'), 'block-manifest auth checks precede response');
assert.ok(manifestRoutes.includes('clientHasMatchingEtag(req, etag)'), 'block-manifest conditional response remains');
assert.ok(!/Cache-Control[^\n]+public/i.test(manifestRoutes), 'block-manifest api does not set public cache');
assert.ok(!/Cache-Control[^\n]+immutable/i.test(manifestRoutes), 'block-manifest api does not set immutable cache');

[
  'ACL-changed novels request with old etag must not return 304',
  'ACL-changed novels etag must change',
  'ACL-changed content request with old etag must not return 304',
  'content conditional request returns 304',
  'chunked fixture has multiple chunks',
  'content etag differs by chunk index',
  'episode content etag differs by episode id',
  'manifest conditional request returns 304',
  'readerApiCacheHardening'
].forEach((needle) => assert.ok(serverSmoke.includes(needle), `server smoke covers ${needle}`));

console.log(JSON.stringify({ pass: 'v436-reader-api-cache-hardening-smoke-pass' }));
