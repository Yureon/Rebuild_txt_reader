#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createUserStateServiceManager } = require('../../server/services/user-state-service');

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'txt-reader-shelf-state-v602-'));
  const manager = createUserStateServiceManager({ userDataDir:root, logger:{error(){}} });
  try {
    const writer = manager.getForUserId('reader');
    const firstWrite = writer.saveSharedState({ userTags:['태그'], novelUserTags:{n1:['태그']}, favorites:['n1'], syncVersion:0, updatedAt:Date.now() });
    assert.equal(firstWrite.skipped,undefined);
    const first = manager.readShelfStateForUserId('reader');
    const second = manager.readShelfStateForUserId('reader');
    assert.strictEqual(first,second,'same shared revision must reuse the shelf snapshot');
    assert(Object.isFrozen(first.novelUserTags) && Object.isFrozen(first.novelUserTags.n1));

    const secondWrite = writer.saveSharedState({ favorites:['n2'], syncVersion:first.sharedVersion, updatedAt:Date.now()+1 });
    assert(secondWrite.sharedVersion > first.sharedVersion);
    const third = manager.readShelfStateForUserId('reader');
    assert.notStrictEqual(third,first,'new shared revision must invalidate the shelf snapshot');
    assert.deepEqual(third.favorites,['n2']);

    const beforeResetVersion = third.sharedVersion;
    const reset = await manager.resetStateForUserId('reader',{skipBeforeSnapshot:true});
    const afterReset = manager.readShelfStateForUserId('reader');
    assert(afterReset.sharedVersion > beforeResetVersion,'admin reset must advance shared revision');
    assert.deepEqual(afterReset.favorites,[]);
    assert.equal(reset.state.syncMeta.sharedVersion,afterReset.sharedVersion);
    console.log(JSON.stringify({pass:'v602-user-state-shelf-cache-smoke-pass',version:afterReset.sharedVersion}));
  } finally {
    await manager.closeAll();
    fs.rmSync(root,{recursive:true,force:true});
  }
}
run().catch(error=>{console.error(error.stack||error);process.exit(1)});
