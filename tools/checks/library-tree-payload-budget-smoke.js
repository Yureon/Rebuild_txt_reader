#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createNovelsRouter, LIBRARY_TREE_API_PASS } = require('../../server/routes/novels-routes');

function makeLibrary(novelCount = 1000, episodeCount = 20) {
  return Array.from({ length:novelCount }, (_, index) => ({
    id:`novel-${index}`,
    title:`작품 ${String(index).padStart(4, '0')}`,
    category:['장르', index % 2 ? '판타지' : '현대'],
    categoryPath:`장르 > ${index % 2 ? '판타지' : '현대'}`,
    isMultiFile:true,
    episodes:Array.from({ length:episodeCount }, (_unused, ep) => ({ id:`novel-${index}-ep-${ep}`, title:`${ep + 1}화`, path:`작품/${index}/${ep}.txt` }))
  }));
}

async function run() {
  const library = makeLibrary();
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:'/virtual',
    libraryService:{ getLibraryCached:() => library, setLibraryMetaHeaders(res){ res.setHeader('X-Library-Signature','tree-payload-fixture'); res.setHeader('X-Library-Build-Count','1'); }, recordNovelsApiPayloadMetrics(){} },
    contentService:{},
    setNoStore(){}
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  try {
    const fullStarted=performance.now();
    const fullResponse=await fetch(`${base}/novels`);
    const fullText=await fullResponse.text();
    const fullMs=performance.now()-fullStarted;
    const treeStarted=performance.now();
    const treeResponse=await fetch(`${base}/novels/tree`);
    const treeText=await treeResponse.text();
    const treeMs=performance.now()-treeStarted;
    assert.equal(treeResponse.headers.get('x-library-tree-api'), LIBRARY_TREE_API_PASS);
    const tree=JSON.parse(treeText);
    assert.equal(tree.items.length, 1000);
    assert.ok(tree.items.every(item => item.episodes.length === 0 && item.episodesLoaded === false));
    const fullBytes=Buffer.byteLength(fullText);
    const treeBytes=Buffer.byteLength(treeText);
    const result={ pass:'v575-library-tree-payload-budget-smoke-pass', fullBytes, treeBytes, reductionPercent:Number((100-(treeBytes/fullBytes*100)).toFixed(1)), fullMs:Number(fullMs.toFixed(2)), treeMs:Number(treeMs.toFixed(2)) };
    console.log(JSON.stringify(result));
    assert.ok(treeBytes < fullBytes * 0.40, 'compact tree payload must be at least 60% smaller than full catalog fixture while preserving episode/file search text');
    return result;
  } finally {
    server.close();
    await once(server,'close');
  }
}

if(require.main===module) run().catch(error=>{ console.error(error); process.exitCode=1; });
module.exports={ run };
