#!/usr/bin/env node
'use strict';
const assert=require('assert');
const { parseSyncVersion, parseClientTimestamp }=require('../../server/services/state-write-service');
const { safeSyncInteger, normalizeSyncMetaInput }=require('../../server/services/state-normalizer-sync-meta');
assert.strictEqual(parseSyncVersion(undefined),0);
assert.strictEqual(parseSyncVersion('12'),12);
for(const value of ['Infinity',Infinity,NaN,-1,1.5,Number.MAX_SAFE_INTEGER]) {
  assert.throws(()=>parseSyncVersion(value),/syncVersion invalid/);
}
assert.strictEqual(parseClientTimestamp(undefined),0);
const now=Date.now();
assert.strictEqual(parseClientTimestamp(String(now)),now);
// Keep a full minute beyond the allowed 24-hour skew so scheduler latency
// cannot turn this invalid fixture into a valid boundary value.
for(const value of ['Infinity',Infinity,NaN,-1,1.5,Date.now()+86400000+60000]) {
  assert.throws(()=>parseClientTimestamp(value),/updatedAt invalid/);
}
assert.strictEqual(safeSyncInteger(Number.MAX_VALUE,7),7);
assert.deepStrictEqual(normalizeSyncMetaInput({sharedVersion:Number.MAX_VALUE,sharedUpdatedAt:1.5,deviceVersions:{dev12345:'Infinity'}}),{sharedUpdatedAt:0,deviceUpdatedAt:{},sharedVersion:0,deviceVersions:{}});
const source=require('fs').readFileSync('server/services/state-write-service.js','utf8');
assert.strictEqual((source.match(/parseSyncVersion\(/g)||[]).length>=4,true,'all three write paths must validate syncVersion');
assert.strictEqual((source.match(/parseClientTimestamp\(/g)||[]).length>=4,true,'all three write paths must validate updatedAt');
console.log(JSON.stringify({pass:'v605-state-sync-number-validation-smoke-pass'}));
