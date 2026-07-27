#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAdminDiagnosticsService } = require('../../server/services/admin-diagnostics-service');

async function run() {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'txt-reader-admin-diag-async-v603-'));
  const data = path.join(tmp, 'data');
  const library = path.join(tmp, 'library');
  await fs.promises.mkdir(library, { recursive:true });
  const svc = createAdminDiagnosticsService({
    paths:{ DATA_DIR:data, ACCOUNTS_PATH:path.join(data,'accounts.json'), SIGNUP_CODES_PATH:path.join(data,'signup.json'), USER_DATA_DIR:path.join(data,'users'), FONT_DIR:path.join(data,'fonts'), SESSION_STORE_PATH:path.join(data,'sessions.json') },
    env:{ LIBRARY_PATH:library, DEPLOYMENT_MODE:'direct', APP_ORIGIN:'http://localhost:3000', REQUIRE_STRICT_ORIGIN:false, HOST:'127.0.0.1', PORT:'3000', ADMIN_PW:'long-enough-owner-password', OWNER_PASSWORD_MIN_LENGTH:14, USER_PASSWORD_MIN_LENGTH:8, resolveTrustProxyValue:()=>false },
    libraryService:{ getLibraryCachedAsync:async()=>[], getCacheStatus:()=>({available:true}) },
    auditLogService:{ flush:async()=>{}, getStatusAsync:async()=>({ok:true,writable:true}) },
    accountService:{ listUsers:()=>[] }, sessionStore:{sessionMeta:new Map()}, contentService:{getCacheStatus:()=>({})}, blockManifestService:{getCacheStatus:()=>({})}, diskCacheJanitorService:{getStatus:()=>({})}
  });
  const originals = { existsSync:fs.existsSync, mkdirSync:fs.mkdirSync, accessSync:fs.accessSync, statSync:fs.statSync };
  try {
    for (const key of Object.keys(originals)) fs[key] = () => { throw new Error(`sync ${key} forbidden`); };
    const result = await svc.buildDiagnostics({protocol:'http',secure:false,get:name=>name==='host'?'localhost:3000':''});
    assert.strictEqual(result.storage.dataDir.ok, true);
    assert.strictEqual(result.storage.libraryPath.ok, true);
    assert.strictEqual(result.storage.auditLog.writable, true);
  } finally {
    Object.assign(fs, originals);
    await fs.promises.rm(tmp, { recursive:true, force:true });
  }
  console.log(JSON.stringify({pass:'v603-admin-diagnostics-filesystem-async-pass'}));
}
if (require.main===module) run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
module.exports={run};
