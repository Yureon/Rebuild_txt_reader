#!/usr/bin/env node
'use strict';
const assert=require('assert');
const crypto=require('crypto');
const { buildLibraryVariantPresentation, pairAnalysis }=require('../../server/services/library-variant-service');
const { buildSketch }=require('../../server/services/library-fingerprint-sketch');
function fp(text,bytes,middle=''){return {prefixHash:crypto.createHash('sha256').update(text).digest('hex'),prefixSketch:buildSketch(text),middleHash:middle?crypto.createHash('sha256').update(middle).digest('hex'):'',middleSketch:middle?buildSketch(middle):'',bytes,mtimeMs:1,replacementRatio:0};}
const shared='마법사는 탑을 내려와 왕국의 비밀을 추적했다. 오래된 계약과 잊힌 동료의 흔적이 이어졌다. '.repeat(30);
const duplicate=buildLibraryVariantPresentation([
 {id:'a',title:'마법사의 귀환',author:'이작가',description:'탑에서 돌아온 마법사의 이야기',metadata:{},singlePath:'마법사의 귀환 1-100完.txt',contentFingerprint:fp(shared,100000)},
 {id:'b',title:'마법사의 귀환',author:'이작가',description:'탑에서 돌아온 마법사의 이야기',metadata:{},singlePath:'마법사의 귀환 1-100完 (1).txt',contentFingerprint:fp(shared,100100)}
]).items[0];
assert.equal(duplicate.variants.find(x=>x.relation!=='canonical').relation,'duplicate-copy');

const revised=shared+'개정판 후기 한 문장이 추가되었다.';
const alternate=buildLibraryVariantPresentation([
 {id:'c',title:'마법사의 귀환',author:'이작가',description:'탑에서 돌아온 마법사의 이야기',metadata:{},singlePath:'판본1/마법사의 귀환 초판 1-100完.txt',contentFingerprint:fp(shared,100000,'중간 원문 '.repeat(100))},
 {id:'d',title:'마법사의 귀환',author:'이작가',description:'탑에서 돌아온 마법사의 이야기',metadata:{},singlePath:'판본2/마법사의 귀환 개정판 1-100完.txt',contentFingerprint:fp(revised,100500,'중간 원문 '.repeat(100)+'개정')}
]).items.find(x=>x.isVariantGroup);
assert(alternate,'similar edition should group');
assert.equal(alternate.variants.find(x=>x.relation!=='canonical').relation,'alternate-edition');

const review=pairAnalysis({signal:{id:'l',baseTitle:'용사의 귀환',metadataTitle:'용사의 귀환',normalizedAuthor:'김',synopsis:'한 용사가 고향으로 돌아온다',fingerprint:{prefixSketch:buildSketch('용사가 고향으로 돌아와 친구를 만난다 '.repeat(10))}}},{signal:{id:'r',baseTitle:'용사의 귀환 외전',metadataTitle:'용사의 귀환 외전',normalizedAuthor:'김',synopsis:'용사가 긴 여행 끝에 고향으로 돌아온다',fingerprint:{prefixSketch:buildSketch('용사가 먼 도시에서 새로운 적을 만난다 '.repeat(10))}}});
assert(!review.auto);
assert(review.score < 0.92 || review.review);
console.log(JSON.stringify({pass:'v642-library-variant-relations-pass',relations:['duplicate-copy','alternate-edition'],reviewScore:review.score}));
