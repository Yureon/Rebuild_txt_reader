#!/usr/bin/env node
const assert = require('assert');
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { once } = require('events');
const { createLibraryService, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS } = require('../../server/services/library-service');
const { createNovelsRouter, LIBRARY_SHELF_API_PASS } = require('../../server/routes/novels-routes');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-episode-api-'));
  const write = (rel) => {
    const full = path.join(root, rel);
    fs.mkdirSync(path.dirname(full), { recursive:true });
    fs.writeFileSync(full, rel, 'utf8');
  };
  ['판타지/연재작 1화.txt', '판타지/연재작 2화 제목.txt', '판타지/단독 작품.txt'].forEach(write);
  const libraryService = createLibraryService({
    libraryPath:root,
    encodeStableId:value => crypto.createHash('sha1').update(String(value)).digest('hex')
  });
  const app = express();
  app.use(createNovelsRouter({
    libraryPath:root,
    libraryService,
    contentService:{},
    sessionStore:{ getSession:token => token === 'token' ? { kind:'user', userId:'reader' } : null },
    accountService:{
      getUserLibraryAccess:() => ({ mode:'all', folders:[] }),
      getUserAccessSnapshot:() => ({ accessVersion:1 })
    },
    userStateServiceManager:{ readShelfStateForUserId:() => ({ favorites:[], recents:[] }) },
    setNoStore:res => res.setHeader('Cache-Control', 'no-store')
  }));
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { cookie:'session_token=token' };
  try {
    const shelf = await (await fetch(`${base}/novels/shelf`, { headers })).json();
    assert.equal(shelf.pass, LIBRARY_SHELF_API_PASS);
    const grouped = shelf.items.find(item => item.title === '연재작');
    assert.ok(grouped, 'derived episode group must appear on shelf');
    assert.equal(grouped.isMultiFile, true);
    assert.equal(grouped.isVirtualEpisodeGroup, true);
    assert.equal(grouped.episodeGroupingKind, 'filename-prefix');
    assert.equal(grouped.episodeGroupingPass, LIBRARY_EPISODE_SEQUENCE_GROUPING_PASS);
    assert.equal(grouped.episodeCount, 2);
    assert.equal(grouped.episodesLoaded, false);

    const meta = await (await fetch(`${base}/novels/${encodeURIComponent(grouped.id)}/meta`, { headers })).json();
    assert.equal(meta.novel.isVirtualEpisodeGroup, true);
    const episodeSummary = await (await fetch(`${base}/novels/${encodeURIComponent(grouped.id)}/episodes`, { headers })).json();
    assert.deepEqual(episodeSummary.episodes.map(item => item.title), ['연재작 1화', '연재작 2화 제목']);

    const raw = await (await fetch(`${base}/novels`, { headers })).json();
    const rawGroup = raw.find(item => item.id === grouped.id);
    assert.equal(rawGroup.isVirtualEpisodeGroup, true);
    assert.equal(rawGroup.episodeGroupingKind, 'filename-prefix');
    assert.equal(rawGroup.episodes.length, 2);
    console.log(JSON.stringify({ pass:'v574-library-episode-sequence-api-smoke-pass', shelf:shelf.items.length, episodes:episodeSummary.episodes.length }));
  } finally {
    server.close();
    await once(server, 'close');
    fs.rmSync(root, { recursive:true, force:true });
  }
}

run().catch(error => { console.error(error?.stack || error); process.exitCode = 1; });
