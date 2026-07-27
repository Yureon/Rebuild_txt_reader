#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { createSessionStore } = require('../../server/services/session-store');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

(async () => {
  const prodProbe = spawnSync(process.execPath, ['-e', `
    process.env.NODE_ENV='production';
    process.env.SESSION_STORE_SECRET='change_this_to_a_long_random_secret_32_chars_or_more';
    try { require(${JSON.stringify(path.join(root,'server/services/session-store.js'))}).createSessionStore({storePath:${JSON.stringify(path.join(os.tmpdir(),'v641-secret-probe.json'))}}); process.exit(2); }
    catch (e) { if (e && e.code === 'SESSION_STORE_SECRET_REQUIRED') process.exit(0); console.error(e); process.exit(3); }
  `], { encoding:'utf8' });
  assert.equal(prodProbe.status, 0, prodProbe.stderr || prodProbe.stdout);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v641-session-rollback-'));
  let failWrites = false;
  const writeJson = (_file, payload, callback) => {
    if (failWrites) return setImmediate(() => callback(new Error('injected durable write failure')));
    fs.writeFileSync(path.join(tmp, 'snapshot.json'), JSON.stringify(payload));
    return setImmediate(() => callback(null));
  };
  const store = createSessionStore({
    storePath:path.join(tmp,'sessions.json'),
    sessionStoreSecret:'v641-test-session-secret-123456789',
    writeJson,
    retryDelayMs:50,
    logger:{ error(){}, warn(){} }
  });
  const token = store.createSession({ kind:'user', userId:'user-1', sessionVersion:3 });
  assert.equal((await store.flush()).ok, true);
  failWrites = true;
  await assert.rejects(() => store.updateSessionDurably(token, { sessionVersion:4 }), err => err && err.code === 'SESSION_STORE_UPDATE_PERSIST_FAILED');
  assert.equal(store.getSession(token).sessionVersion, 3, 'failed durable update must roll back in-memory session');
  failWrites = false;
  await store.close();
  fs.rmSync(tmp, { recursive:true, force:true });

  assert(!fs.existsSync(path.join(root,'public/admin/users-static.html')));
  assert(!fs.existsSync(path.join(root,'public/admin/users-static.html.gz')));
  assert(!fs.existsSync(path.join(root,'public/admin/users-static.html.br')));

  const metadataService = read('server/services/metadata-service.js');
  assert(metadataService.includes('durableRenameAsync(tempPath, finalPath)'));
  assert(metadataService.includes('reconcileBulkBatchesOnStartup'));
  assert(metadataService.includes('METADATA_BULK_BATCH_NOT_FOUND'));

  const fontService = read('server/services/font-service.js');
  assert(fontService.includes('.deleting'));
  assert(fontService.includes('recovered:true'));
  assert(fontService.includes('totalBytes') && fontService.includes('scanFontDiskUsage'));
  const languageService = read('server/services/site-language-service.js');
  assert(languageService.includes('deleteJournalPath'));
  assert(languageService.includes('.deleting'));

  const auditService = read('server/services/audit-log-service.js');
  assert(auditService.includes('fsync'));
  assert(auditService.includes('enableSyncQuery === true'));
  const contentCache = read('server/services/content-service.js');
  assert(contentCache.includes('atomicWriteFileAsync') || contentCache.includes('atomicWriteFileSync'));
  const blockCache = read('server/services/block-manifest-service.js');
  assert(blockCache.includes('atomicWriteFile'));

  const dockerfile = read('Dockerfile');
  assert(!/^COPY tools /m.test(dockerfile), 'production image must not copy the full tools directory');
  const extManifest = JSON.parse(read('extensions/metadata-login-helper/manifest.json'));
  assert(extManifest.host_permissions.length > 0);
  assert(extManifest.host_permissions.every(item => !item.includes('*://') && !item.includes('://*.')));

  console.log(JSON.stringify({
    pass:'v641-audit-security-durability-pass',
    checks:['production-secret','session-rollback','stale-admin-removed','bulk-durability','recovery','fsync','docker-tools','extension-hosts']
  }));
})().catch(error => { console.error(error); process.exit(1); });
