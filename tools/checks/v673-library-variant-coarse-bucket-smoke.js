#!/usr/bin/env node
'use strict';
const assert = require('assert');
const { performance } = require('perf_hooks');
const {
  LIBRARY_VARIANT_COARSE_BUCKET_PASS,
  buildLibraryVariantPresentation
} = require('../../server/services/library-variant-service');

function suffixCode(index) {
  let value = index;
  let out = '';
  for (let i = 0; i < 6; i += 1) { out = String.fromCharCode(97 + (value % 26)) + out; value = Math.floor(value / 26); }
  return out;
}

function novel(index) {
  const serial = suffixCode(index);
  return {
    id:`variant-${serial}`,
    title:`공통접두어 작품 고유후미 ${serial}`,
    author:`작가-${serial}`,
    singlePath:`fixture/공통접두어 작품 고유후미 ${serial}.txt`,
    categoryPath:'fixture',
    category:['fixture'],
    isMultiFile:false,
    size:1000 + index,
    mtimeMs:index,
    episodes:[]
  };
}

const fixtureCount = 20_000;
const fixture = Array.from({ length:fixtureCount }, (_, index) => novel(index));
const started = performance.now();
const result = buildLibraryVariantPresentation(fixture, { queueFingerprintWork:false });
const elapsedMs = performance.now() - started;

assert.equal(LIBRARY_VARIANT_COARSE_BUCKET_PASS, 'v673-library-variant-coarse-bucket-pass');
assert.equal(result.coarseBucketPass, LIBRARY_VARIANT_COARSE_BUCKET_PASS);
assert.equal(result.items.length, fixtureCount, 'unrelated numbered works must not collapse into variant groups');
assert.equal(result.hiddenVariantCount, 0);
assert.equal(result.reviewGroups.length, 0);
assert(elapsedMs < 8000, `20k unrelated work presentation exceeded bounded runtime: ${elapsedMs.toFixed(2)}ms`);

console.log(JSON.stringify({
  pass:'v673-library-variant-coarse-bucket-smoke-pass',
  fixtureWorks:fixtureCount,
  elapsedMs:Number(elapsedMs.toFixed(2)),
  outputItems:result.items.length,
  hiddenVariantCount:result.hiddenVariantCount
}));
