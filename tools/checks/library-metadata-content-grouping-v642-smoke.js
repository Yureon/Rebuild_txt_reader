#!/usr/bin/env node
'use strict';
const assert = require('assert');
const crypto = require('crypto');
const { buildLibraryVariantPresentation } = require('../../server/services/library-variant-service');
const { buildSketch } = require('../../server/services/library-fingerprint-sketch');

function fingerprint(text, bytes, mtimeMs = 1000, middle = '') {
  return {
    prefixHash:crypto.createHash('sha256').update(text).digest('hex'),
    prefixSketch:buildSketch(text),
    middleHash:middle ? crypto.createHash('sha256').update(middle).digest('hex') : '',
    middleSketch:middle ? buildSketch(middle) : '',
    bytes, mtimeMs, replacementRatio:0
  };
}
const text = '그날 나는 죽었던 세계에서 다시 돌아왔다. 검을 들고 성문을 넘어 동료들과 긴 여행을 시작했다. '.repeat(30);
const novels = [
  { id:'short', title:'회귀한 용사', author:'김작가', description:'죽었던 용사가 돌아와 세계를 구하는 이야기', metadata:{ source:'provider-a' }, singlePath:'A/회귀한 용사 1-100.txt', contentFingerprint:fingerprint(text,100000) },
  { id:'complete', title:'회귀한 용사', author:'김작가', description:'죽었던 용사가 돌아와 세계를 구하는 이야기', metadata:{ source:'provider-b' }, singlePath:'B/회귀한 용사 1-200完.txt', contentFingerprint:fingerprint(text,200000) }
];
const result = buildLibraryVariantPresentation(novels);
assert.equal(result.items.length,1);
const group=result.items[0];
assert.equal(group.id,'complete');
assert.deepEqual(new Set(group.progressAliases),new Set(['short','complete']));
assert.strictEqual(result.byAlias.get('short'),group);
assert.equal(group.variants.find(item=>item.id==='short').relation,'superseded');
assert(group.variantConfidence >= 0.92);
assert(group.representativeQuality.reasons.includes('complete'));
console.log(JSON.stringify({ pass:'v642-library-metadata-content-grouping-pass', representative:group.id, confidence:group.variantConfidence }));
