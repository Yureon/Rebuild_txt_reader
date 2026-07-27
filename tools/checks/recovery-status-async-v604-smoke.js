#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createRecoveryService } = require('../../server/services/recovery-service');
const PASS = 'v604-recovery-status-async-smoke-pass';
(async()=>{
  const root=await fs.promises.mkdtemp(path.join(os.tmpdir(),'txt-reader-recovery-v604-'));
  const snapshots=path.join(root,'snapshots'); await fs.promises.mkdir(snapshots,{recursive:true});
  const sync=path.join(root,'sync.json'), sessions=path.join(root,'sessions.json'), fonts=path.join(root,'fonts.json');
  await Promise.all([fs.promises.writeFile(sync,'{}'),fs.promises.writeFile(sessions,'{}'),fs.promises.writeFile(fonts,'[]'),fs.promises.writeFile(path.join(snapshots,'state-20260101.json'),'{}')]);
  const service=createRecoveryService({syncDataPath:sync,sessionStorePath:sessions,fontMetaPath:fonts,snapshotDir:snapshots,snapshotPrefix:'state',libraryService:{getCacheStatus:()=>({libraryCache:{count:1},dirScanCacheEntries:2})},contentService:{getCacheStatus:()=>({fileCacheEntries:3})},syncStateService:{getPersistenceStatus:()=>({dirty:false})}});
  const originals={existsSync:fs.existsSync,statSync:fs.statSync,readdirSync:fs.readdirSync};
  fs.existsSync=()=>{throw new Error('sync exists forbidden');}; fs.statSync=()=>{throw new Error('sync stat forbidden');}; fs.readdirSync=()=>{throw new Error('sync readdir forbidden');};
  try {
    const status=await service.getRecoveryStatusAsync();
    assert.strictEqual(status.syncData.exists,true);
    assert.strictEqual(status.snapshot.count,1);
    assert.strictEqual(status.libraryCache.count,1);
    assert.strictEqual(status.fileCacheEntries,3);
  } finally { Object.assign(fs,originals); }
  const source=fs.readFileSync('server/routes/recovery-routes.js','utf8');
  assert(source.includes("router.get('/recovery-status', requireOwnerSession, async"));
  assert(source.includes('getRecoveryStatusAsync'));
  await fs.promises.rm(root,{recursive:true,force:true});
  console.log(JSON.stringify({pass:PASS}));
})().catch(error=>{console.error(error&&error.stack||error);process.exitCode=1;});
