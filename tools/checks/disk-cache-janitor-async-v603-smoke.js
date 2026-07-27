#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createDiskCacheJanitorService } = require('../../server/services/disk-cache-janitor-service');

async function run() {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'txt-reader-janitor-v603-'));
  const cache = path.join(tmp, 'cache');
  await fs.promises.mkdir(cache, { recursive:true });
  await fs.promises.writeFile(path.join(cache, 'old.tmp'), Buffer.alloc(32));
  const janitor = createDiskCacheJanitorService({ dataDir:tmp, cacheDirs:[{label:'test',dir:cache}], enabled:true, minFileAgeMs:0, maxDeletePerRun:10, usagePct:99, targetUsagePct:98, minFreeMb:0, targetFreeMb:0 });
  const originals = { readdirSync:fs.readdirSync, statSync:fs.statSync, unlinkSync:fs.unlinkSync };
  try {
    fs.readdirSync = () => { throw new Error('sync readdir forbidden'); };
    fs.statSync = () => { throw new Error('sync stat forbidden'); };
    fs.unlinkSync = () => { throw new Error('sync unlink forbidden'); };
    const result = await janitor.pruneOnceAsync(true);
    assert.strictEqual(result.lastResult.deletedFiles, 1, 'async janitor must delete eligible file');
    const status = await janitor.getStatusAsync();
    assert.strictEqual(status.cacheFiles, 0, 'async status must refresh cache summary');
  } finally {
    Object.assign(fs, originals);
    await janitor.stop();
    await fs.promises.rm(tmp, { recursive:true, force:true });
  }
  console.log(JSON.stringify({pass:'v603-disk-cache-janitor-async-pass'}));
}
if (require.main===module) run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={run};
