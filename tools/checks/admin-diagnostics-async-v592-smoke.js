#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createAdminDiagnosticsService } = require('../../server/services/admin-diagnostics-service');
const PASS = 'v592-admin-diagnostics-async-smoke-pass';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-admin-diag-v592-'));
process.on('exit', () => fs.rmSync(tmp, { recursive:true, force:true }));
const data = path.join(tmp, 'data');
const library = path.join(tmp, 'library');
fs.mkdirSync(data, { recursive:true });
fs.mkdirSync(library, { recursive:true });
let asyncCalls = 0;
const service = createAdminDiagnosticsService({
  paths:{
    DATA_DIR:data,
    ACCOUNTS_PATH:path.join(data, 'accounts.json'),
    SIGNUP_CODES_PATH:path.join(data, 'signup-codes.json'),
    USER_DATA_DIR:path.join(data, 'users'),
    FONT_DIR:path.join(data, 'fonts'),
    SESSION_STORE_PATH:path.join(data, 'sessions.json')
  },
  env:{
    LIBRARY_PATH:library,
    DEPLOYMENT_MODE:'direct',
    APP_ORIGIN:'http://localhost:3000',
    REQUIRE_STRICT_ORIGIN:false,
    HOST:'127.0.0.1',
    PORT:'3000',
    OWNER_PASSWORD_MIN_LENGTH:14,
    USER_PASSWORD_MIN_LENGTH:8,
    resolveTrustProxyValue:() => false
  },
  libraryService:{
    getLibraryCached:() => { throw new Error('synchronous catalog build must not run in diagnostics'); },
    getLibraryCachedAsync:async () => { asyncCalls += 1; return [{ id:'1' }, { id:'2' }]; },
    getCacheStatus:() => ({ available:true })
  },
  auditLogService:{ getStatus:() => ({ writable:true }) },
  accountService:{ listUsers:() => [] },
  sessionStore:{ sessionMeta:new Map() },
  contentService:{ getCacheStatus:() => ({ available:true }) },
  blockManifestService:{ getCacheStatus:() => ({ available:true }) },
  diskCacheJanitorService:{ getStatus:() => ({ available:true }) }
});

(async () => {
  const req = { protocol:'http', secure:false, get:name => name === 'host' ? 'localhost:3000' : '' };
  const result = await service.buildDiagnostics(req);
  assert.strictEqual(asyncCalls, 1);
  assert.strictEqual(result.library.cachedNovelCount, 2);
  assert.strictEqual(result.library.error, '');
  console.log(JSON.stringify({ pass:PASS, novels:result.library.cachedNovelCount }));
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
