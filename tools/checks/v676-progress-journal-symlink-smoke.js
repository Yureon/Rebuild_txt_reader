#!/usr/bin/env node
'use strict';
const assert=require('assert');const fs=require('fs');const os=require('os');const path=require('path');
const normalizer=require('../../server/services/state-normalizer');const {createSyncStateService}=require('../../server/services/sync-state-service');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-v676-journal-'));const syncPath=path.join(dir,'state.json');const journal=`${syncPath}.progress.ndjson`;const outside=path.join(dir,'outside.txt');fs.writeFileSync(outside,'SAFE');let linked=true;try{fs.symlinkSync(outside,journal);}catch{linked=false;}
 if(!linked){fs.rmSync(dir,{recursive:true,force:true});console.log(JSON.stringify({pass:'v676-progress-journal-symlink-smoke-pass',environmentBlocked:true,reason:'symlink unavailable'}));process.exit(77);return;}
 const service=createSyncStateService({syncPath,snapshotDir:path.join(dir,'snapshots'),createEmptyState:normalizer.createEmptyUserState,normalizeState:normalizer.normalizeUserState,applyProgressJournalEntry:normalizer.applyProgressJournalEntry,logger:{warn(){},error(){}}});
 await assert.rejects(()=>service.appendProgressJournal({novelId:'x'},()=>true),error=>['PROGRESS_JOURNAL_NOFOLLOW','ELOOP'].includes(error?.code));
 assert.equal(fs.readFileSync(outside,'utf8'),'SAFE');
 await service.close().catch(()=>{});fs.rmSync(dir,{recursive:true,force:true});
 console.log(JSON.stringify({pass:'v676-progress-journal-symlink-smoke-pass',symlinkBlocked:true,outsideUnchanged:true}));
})().catch(error=>{console.error(error.stack||error);process.exitCode=1});
