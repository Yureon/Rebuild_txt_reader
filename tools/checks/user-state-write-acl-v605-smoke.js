#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const {
  filterProgressByAllowedNovelIds,
  filterSharedStateByAllowedNovelIds,
  filterSharedStatePatchByAllowedNovelIds,
  filterDeviceProfileByLibraryAccess,
  filterStateResponseByAllowedNovelIds
} = require('../../server/services/library-access-service');

const allowed = new Set(['novel', 'novel-allowed', 'plain']);
const known = new Set(['novel', 'novel-allowed', 'novel-denied', 'novel-secret', 'plain']);
const progress = {
  lastRead:{ novelId:'novel-denied', chunk:2 },
  byNovel:{
    'novel-allowed':{ novelId:'novel-allowed', chunk:3 },
    'novel-denied':{ novelId:'novel-denied', chunk:4 }
  },
  readMeta:{
    good:{ novelId:'novel-allowed' },
    bad:{ novelId:'novel-denied' }
  },
  positions:{
    'pos-novel-allowed-single':{ chunk:3 },
    'pos-novel-denied-single':{ chunk:4 },
    'pos-plain-single-2':'0.5000',
    'pos-novel-secret-single':{ chunk:9 }
  }
};
const filteredProgress = filterProgressByAllowedNovelIds(progress, allowed, known);
assert.strictEqual(filteredProgress.lastRead, null);
assert.deepStrictEqual(Object.keys(filteredProgress.byNovel), ['novel-allowed']);
assert.deepStrictEqual(Object.keys(filteredProgress.readMeta), ['good']);
assert.deepStrictEqual(Object.keys(filteredProgress.positions).sort(), ['pos-novel-allowed-single', 'pos-plain-single-2']);

const patch = filterSharedStatePatchByAllowedNovelIds({
  viewerPrefs:{ fontSize:'20' },
  favorites:['novel-allowed', 'novel-denied'],
  novelUserTags:{
    'novel-allowed':['keep'],
    'novel-denied':['drop']
  },
  progress,
  lastOpenedNovelId:'novel-denied'
}, allowed, known);
assert.deepStrictEqual(patch.viewerPrefs, { fontSize:'20' });
assert.deepStrictEqual(patch.favorites, ['novel-allowed']);
assert.deepStrictEqual(Object.keys(patch.novelUserTags), ['novel-allowed']);
assert.strictEqual(patch.lastOpenedNovelId, null);
assert.ok(!Object.prototype.hasOwnProperty.call(filterSharedStatePatchByAllowedNovelIds({ viewerPrefs:{} }, allowed), 'favorites'), 'partial shared patches must not synthesize destructive empty fields');

const response = filterSharedStateByAllowedNovelIds({
  favorites:['novel-allowed'],
  novelUserTags:{ 'novel-allowed':['keep'], 'novel-denied':['private'] },
  progress
}, allowed, known);
assert.deepStrictEqual(Object.keys(response.novelUserTags), ['novel-allowed']);
assert.ok(!response.progress.positions['pos-novel-denied-single']);


const folderAccess = { mode:'folders', folders:['허용'] };
const filteredDevice = filterDeviceProfileByLibraryAccess({ collapsedFolders:['허용','허용/하위','차단'], prefs:{ searchByFilename:true } }, folderAccess);
assert.deepStrictEqual(filteredDevice.collapsedFolders, ['허용','허용/하위']);
const filteredState = filterStateResponseByAllowedNovelIds({
  shared:{ novelUserTags:{ 'novel-allowed':['keep'], 'novel-denied':['drop'] }, progress },
  device:{ collapsedFolders:['허용','차단'] },
  deviceProfiles:{ one:{ collapsedFolders:['허용/하위','차단'] } }
}, allowed, folderAccess, known);
assert.deepStrictEqual(filteredState.device.collapsedFolders, ['허용']);
assert.deepStrictEqual(filteredState.deviceProfiles.one.collapsedFolders, ['허용/하위']);
const routeSource = fs.readFileSync('server/routes/state-routes.js', 'utf8');
assert(routeSource.includes("filterInputFor(req, 'shared', req.body)"), 'shared write must be filtered before persistence');
assert(routeSource.includes("filterInputFor(req, 'progress', req.body)"), 'progress write must be filtered before persistence');
const appSource = fs.readFileSync('server/app.js', 'utf8');
assert(appSource.includes('filterStateInput: filterStateInputForCurrentLibraryAccess'), 'state router must receive the input ACL filter');
assert(appSource.includes("if (!auth.ok || auth.access.mode === 'all') return { unrestricted:true"), 'full access must retain the catalog-free fast path');

console.log(JSON.stringify({ pass:'v605-user-state-write-acl-smoke-pass' }));
