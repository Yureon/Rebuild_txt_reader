#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { buildLibraryVariantPresentation, sketchCandidateKeys } = require('../../server/services/library-variant-service');
const { buildSketch, sketchSimilarity } = require('../../server/services/library-fingerprint-sketch');
function fp(text, bytes) {
  return {
    prefixHash:crypto.createHash('sha256').update(text).digest('hex'),
    prefixSketch:buildSketch(text),
    middleHash:'', middleSketch:'', bytes, mtimeMs:1, replacementRatio:0
  };
}
const shared = '성문 앞에서 검을 든 주인공은 오래된 동료와 다시 만나 북쪽 왕국으로 향했다. '.repeat(80);
const changed = shared.replace('오래된 동료', '과거의 동료').replace('북쪽 왕국', '북부 왕국');
assert(sketchSimilarity(buildSketch(shared), buildSketch(changed)) >= 0.9);
assert([...sketchCandidateKeys(buildSketch(shared),'prefix')].some(key => sketchCandidateKeys(buildSketch(changed),'prefix').has(key)));
let background = null;
const fingerprintById = { a:fp(shared, 100000), b:fp(changed, 101000) };
const fingerprintService = {
  requestLibrary(source, options) { background={ count:source.length, limit:options.limit }; return { considered:source.length, queued:0 }; },
  getCached(novel) { return fingerprintById[novel.id] || null; },
  requestCandidates() {}
};
const novels = [
  { id:'a', title:'용사의 귀환', author:'김작가', description:'왕국으로 향하는 귀환자의 이야기', singlePath:'A/용사의 귀환 1-100.txt' },
  { id:'b', title:'북부의 검객', author:'김작가', description:'다른 소개 문구', singlePath:'B/북부 검객 1-100.txt' }
];
const result = buildLibraryVariantPresentation(novels, { fingerprintService, fingerprintBackgroundBatch:32 });
assert.deepEqual(background,{count:2,limit:32});
assert.equal(result.items.length,2,'different titles should not be auto-merged on prefix evidence alone');
assert.equal(result.reviewGroups.length,1,'content LSH should discover differently named files as review candidates');
assert.equal(result.reviewGroups[0].pairs.length,1);
assert.equal(result.reviewGroups[0].pairs[0].contentReview,true);
const nearTitle = [
  { id:'c', title:'용사의 귀환', author:'김작가', description:'왕국으로 향하는 귀환자의 이야기', singlePath:'C/용사의 귀환 1-100.txt', contentFingerprint:fp(shared,100000) },
  { id:'d', title:'용사의 귀환 개정판', author:'김작가', description:'다른 소개 문구', singlePath:'D/용사의 귀환 개정판 1-100.txt', contentFingerprint:fp(changed,101000) }
];
const autoResult=buildLibraryVariantPresentation(nearTitle);
assert.equal(autoResult.items.length,1,'near title plus near-identical content should auto-group');
console.log(JSON.stringify({pass:'v642-library-content-discovery-pass',similarity:sketchSimilarity(buildSketch(shared),buildSketch(changed)),background,review:true,auto:true}));
