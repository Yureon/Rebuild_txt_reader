#!/usr/bin/env node
const assert = require('assert');
const express = require('express');
const { once } = require('events');
const { createMetadataRouter } = require('../../server/routes/metadata-routes');

async function run() {
  const library = [
    { id:'n1', title:'허용 작품', singlePath:'허용/허용 작품.txt', categoryPath:'허용', category:['허용'], isMultiFile:false, episodes:[] },
    { id:'n2', title:'차단 작품', singlePath:'차단/차단 작품.txt', categoryPath:'차단', category:['차단'], isMultiFile:false, episodes:[] }
  ];
  let collected = 0;
  let hasCoverChecks = 0;
  let scopedCoverChecks = 0;
  let browserLoginStarts = 0;
  const metadataService = {
    enabled:true,
    listProviders:() => [{ id:'p', name:'공급자', enabled:true }],
    queueStatus:() => ({ active:0, queued:0 }),
    getNovelMetadata:novel => ({ applied:null, candidates:[], providers:[], fields:[], enabled:true, novelTitle:novel.title }),
    collect:novel => { collected += 1; return { id:'j1', novel:{ id:novel.id } }; },
    createBrowserCapturePairing:novel => ({ workId:novel.id, token:'x'.repeat(43), expiresAt:new Date(Date.now()+60000).toISOString(), providers:[{ id:'p', name:'공급자', hosts:['example.com'] }] }),
    importBrowserCapture:async novel => ({ candidate:{ id:'c1', novelId:novel.id }, provider:{ id:'p', name:'공급자' }, evidence:{ source:'browser-capture-v1' }, warnings:[] }),
    collectMissing:() => [],
    applyCandidate:() => ({ id:'applied' }),
    removeApplied:() => true,
    listJobs:() => [], getJob:() => null, cancelJob:() => null,
    setProviderSettings:() => ({}),
    probeProvider:async providerId => ({ ok:false, providerId, providerName:'공급자', stage:'dns', code:'EAI_AGAIN', message:'DNS 실패' }),
    hasCoverAsset:assetId => { hasCoverChecks += 1; return assetId === 'a'.repeat(64); },
    canAccessCover:(assetId, novels) => { scopedCoverChecks += 1; return assetId === 'a'.repeat(64) && novels.some(item => item.id === 'n1'); }
  };
  const coverService = { findAsset:() => null };
  const sessionStore = {
    getSession(token) {
      if (token === 'owner') return { kind:'owner', id:'owner' };
      if (token === 'full') return { kind:'user', userId:'full' };
      if (token === 'limited') return { kind:'user', userId:'limited' };
      if (token === 'denied') return { kind:'user', userId:'denied' };
      return null;
    }
  };
  const accountService = {
    getUserLibraryAccess:userId => userId === 'full' ? { mode:'all', folders:[] } : { mode:'folders', folders:['허용'] },
    getUserAppPermissions:userId => ({ fullSearch:true, metadataAccess:userId !== 'denied' })
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createMetadataRouter({
    metadataService, coverService,
    libraryService:{ getLibraryCached:() => library },
    sessionStore, accountService,
    requireSameOrigin:(_req,_res,next) => next(), requireCsrf:(_req,_res,next) => next(), checkApiWriteLimit:() => true,
    playwrightService:{ startLogin:async()=>{ browserLoginStarts += 1; return { sessionId:'mpl_'+ 'a'.repeat(24) }; }, getLoginSession:()=>({}), screenshot:async()=>({ buffer:Buffer.from('png'), summary:{} }), interact:async()=>({}), finishLogin:async()=>({ status:'ready' }), cancelLogin:async()=>({}), clearProfile:async()=>({}) }
  }));
  const server = app.listen(0,'127.0.0.1');
  await once(server,'listening');
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    let res = await fetch(`${base}/api/metadata/providers`, { headers:{ cookie:'session_token=denied' } });
    assert.equal(res.status, 403, 'metadata-disabled user must not list providers');
    assert.equal((await res.json()).error, 'metadata_access_required');
    res = await fetch(`${base}/api/novels/n1/metadata`, { headers:{ cookie:'session_token=denied' } });
    assert.equal(res.status, 403, 'metadata-disabled user must not read novel metadata');
    assert.equal((await res.json()).error, 'metadata_access_required');
    res = await fetch(`${base}/api/novels/n1/metadata`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).novelTitle, '허용 작품');
    res = await fetch(`${base}/api/novels/n2/metadata`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 404, 'limited user must not discover inaccessible novel metadata');
    res = await fetch(`${base}/api/novels/n1/metadata/collect`, { method:'POST', headers:{ cookie:'session_token=limited', 'content-type':'application/json' }, body:'{}' });
    assert.equal(res.status, 403);
    res = await fetch(`${base}/api/novels/n1/metadata/collect`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json', 'accept-language':'*' }, body:'{}' });
    assert.equal(res.status, 202);
    assert.equal(collected, 1);
    res = await fetch(`${base}/api/novels/n1/metadata/browser-capture/pairing`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json' }, body:'{}' });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).pairing.workId, 'n1');
    res = await fetch(`${base}/api/novels/n1/metadata/browser-capture/import`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json' }, body:JSON.stringify({ pairingToken:'x'.repeat(43), capture:{ pageUrl:'https://example.com/work/1', title:'허용 작품' } }) });
    assert.equal(res.status, 201);
    res = await fetch(`${base}/api/novels/n1/metadata/browser-capture/import`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json' }, body:JSON.stringify({ pairingToken:'x'.repeat(43), capture:{ pageUrl:'https://example.com/work/1', title:'허용 작품', html:'<html>' } }) });
    assert.equal(res.status, 400, 'raw HTML must be rejected');
    res = await fetch(`${base}/api/metadata/covers/${'b'.repeat(64)}`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 404);
    assert.equal(scopedCoverChecks, 1);
    scopedCoverChecks = 0;
    res = await fetch(`${base}/api/metadata/covers/${'a'.repeat(64)}`, { headers:{ cookie:'session_token=full' } });
    assert.equal(res.status, 404, 'known cover without a cache file still returns 404');
    assert.equal(hasCoverChecks, 1, 'full-library cover authorization must use the O(1) cover index');
    assert.equal(scopedCoverChecks, 0);
    res = await fetch(`${base}/api/metadata/covers/${'a'.repeat(64)}`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 404);
    assert.equal(scopedCoverChecks, 1, 'folder-limited cover authorization must verify accessible novels');
    res = await fetch(`${base}/api/metadata/jobs`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 403);
    res = await fetch(`${base}/api/metadata/providers`, { headers:{ cookie:'session_token=limited' } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).canManageBrowserProfiles, false);
    res = await fetch(`${base}/api/metadata/providers/p/browser-login/start`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json' }, body:'{}' });
    assert.equal(res.status, 403, 'normal users must not control shared Playwright profiles');
    res = await fetch(`${base}/api/metadata/providers/p/browser-login/start`, { method:'POST', headers:{ cookie:'session_token=owner', 'content-type':'application/json' }, body:'{}' });
    assert.equal(res.status, 201);
    assert.equal(browserLoginStarts, 1);
    res = await fetch(`${base}/api/metadata/providers`, { headers:{ cookie:'session_token=owner' } });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).canManageBrowserProfiles, true);
    res = await fetch(`${base}/api/metadata/providers/p/probe`, { method:'POST', headers:{ cookie:'session_token=full', 'content-type':'application/json' }, body:JSON.stringify({ query:'테스트' }) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).diagnostic.stage, 'dns');
    console.log(JSON.stringify({ pass:'v588-metadata-routes-access-smoke-pass', collected }));
  } finally { server.close(); await once(server,'close'); }
}
run().catch(error => { console.error(error && error.stack || error); process.exitCode=1; });
