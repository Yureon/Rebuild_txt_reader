#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildAccessSignature, isAllNovelsAccessible, isNovelAllowedBySnapshot } from '../../public/scripts/rebuild/features/library-catalog-loader.mjs';
const route=fs.readFileSync('server/routes/user-access-routes.js','utf8');
assert(route.includes('if (allNovelsAccessible)'), 'route must split all-library fast path');
assert(route.includes('libraryService.getCacheStatus'), 'all-library fast path must use cached count without forcing catalog build');
assert(route.includes('accessibleNovelIds = filtered.map'), 'restricted users must still receive allowed ids');
assert(route.includes('accessSignature:'), 'server must provide compact access signature');
const all={userId:'u',accessVersion:2,libraryAccess:{mode:'all'},allNovelsAccessible:true,accessibleNovelIds:null,accessSignature:'u:2:all'};
assert.equal(isAllNovelsAccessible(all),true);
assert.equal(isNovelAllowedBySnapshot(all,'novel-any'),true);
assert.equal(buildAccessSignature(all),'u:2:all');
const restricted={userId:'u',accessVersion:3,libraryAccess:{mode:'folders'},accessibleNovelIds:['a','b']};
assert.equal(isNovelAllowedBySnapshot(restricted,'a'),true);
assert.equal(isNovelAllowedBySnapshot(restricted,'z'),false);
console.log(JSON.stringify({pass:'v604-user-access-snapshot-payload-smoke-pass'}));
