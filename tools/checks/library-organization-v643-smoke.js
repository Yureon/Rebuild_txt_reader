#!/usr/bin/env node
'use strict';
const assert=require('assert');
const {createLibraryOrganizationService,safeSegment}=require('../../server/services/library-organization-service');
(async()=>{
  let libraryReads=0;
  const novels=[
    {id:'a',title:'CON',author:'작가<1>',categoryPath:'판타지/귀환',singlePath:'원본/동일.txt'},
    {id:'b',title:'CON',author:'작가<1>',categoryPath:'판타지/귀환',singlePath:'다른/동일.txt'},
    {id:'c',title:'정상',author:'작가2',episodes:[{id:'e1',path:'연재/001.txt'},{id:'e2',path:'연재/002.txt'}]},
    {id:'d',title:'누락',author:'작가3'},
    {id:'e',title:'중복 경로',author:'작가4',singlePath:'연재/001.txt'}
  ];
  const service=createLibraryOrganizationService({
    libraryService:{async getLibraryCachedAsync(){libraryReads+=1;return novels;}},
    metadataService:{enrichNovel(novel){return {...novel,title:novel.title==='정상'?'메타:정상':novel.title};}}
  });
  const plan=await service.buildPlan({layout:'category-author-title',mode:'copy'});
  assert.equal(libraryReads,1);
  assert.equal(plan.pass,'v643-library-organization-plan-pass');
  assert.equal(plan.summary.novelCount,5);
  assert.equal(plan.summary.fileCount,4);
  assert.equal(plan.summary.skippedCount,2);
  assert(plan.skipped.some(item=>item.reason==='duplicate-source-path'));
  assert.equal(plan.entries.length,4);
  assert(plan.summary.collisionResolvedCount>=1);
  assert(plan.entries.some(item=>/__[0-9a-f]{8}\.txt$/u.test(item.targetPath)));
  assert(plan.entries.every(item=>!item.targetPath.split('/').some(part=>/[<>:"\\|?*]/u.test(part))));
  assert.equal(safeSegment('CON','fallback'),'fallback');
  const generated=await service.generateScript({layout:'author-title',mode:'move'});
  assert.equal(generated.pass,'v643-library-organization-script-pass');
  for(const token of ['[switch]$Apply','[DRY-RUN]','ReparsePoint','target already exists','Assert-UnderRoot','Library and Destination must be different','Library and Destination must not overlap','txt-reader-library-organization-result.json']) assert(generated.script.includes(token),token);
  assert(generated.fileName.endsWith('-move.ps1'));
  assert(generated.script.includes("-replace '\\s', ''"));
  console.log(JSON.stringify({pass:'v643-library-organization-pass',entries:plan.entries.length,collision:true,dryRun:true}));
})().catch(error=>{console.error(error);process.exit(1);});
