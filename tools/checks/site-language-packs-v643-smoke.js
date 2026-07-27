#!/usr/bin/env node
'use strict';
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const root=path.resolve(__dirname,'../..');
const dir=path.join(root,'site-language-packs');
const files=fs.readdirSync(dir).filter(name=>name.endsWith('.json')).sort();
assert.equal(files.length,23);
const required=['사이트 언어','중복 정리','라이브러리 정리','변환 미리보기','변환 스크립트 다운로드','검색 우선순위','자동 적용 기준','수집 완료 후 쿨타임 기준(초)','검색 결과 수','한국어에서만 메타데이터 공급자를 사용할 수 있습니다.'];
for(const file of files){
  const pack=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8'));
  assert.equal(pack.pass,'v643-owner-console-language-pack-pass',file);
  assert.equal(pack.updatedAt,'2026-07-25T00:00:00.000Z',file);
  for(const key of required) assert(Object.prototype.hasOwnProperty.call(pack.map||{},key),`${file}: ${key}`);
}
const fallback=fs.readFileSync(path.join(root,'public/scripts/rebuild/features/settings/site-language-en.mjs'),'utf8');
for(const key of required) assert(fallback.includes(JSON.stringify(key)) || fallback.includes(`'${key}'`),`fallback: ${key}`);
console.log(JSON.stringify({pass:'v643-site-language-packs-pass',packs:files.length,requiredKeys:required.length}));
