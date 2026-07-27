#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  normalizeAppPermissions,
  createAccountService,
  TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_PASS
} = require('../../server/services/account-service');

assert.deepEqual(normalizeAppPermissions({}), { fullSearch:true, metadataAccess:false }, 'metadata access must default to denied');
assert.deepEqual(normalizeAppPermissions({ fullSearch:false, metadataAccess:true }), { fullSearch:false, metadataAccess:true });
assert.equal(TXT_READER_MULTI_METADATA_ACCESS_PERMISSION_PASS, 'v588-metadata-access-permission-pass');

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v588-metadata-access-'));
try {
  const accountsPath = path.join(temp, 'accounts.json');
  const service = createAccountService({ accountsPath, logger:{ error(){} } });
  service.load();
  let createError = null;
  const created = service.createUser({
    username:'metadata-user',
    password:'metadata-user-password-123',
    libraryAccess:{ mode:'all', folders:[] },
    appPermissions:{ fullSearch:true }
  }, error => { createError = error || null; });
  assert.ifError(createError);
  assert.equal(created.appPermissions.metadataAccess, false, 'new users without an explicit grant must be denied');
  assert.equal(service.canUserMetadataAccess(created.id), false);
  const beforeVersion = created.accessVersion;
  let updateError = null;
  const updated = service.updateUser(created.id, {
    appPermissions:{ fullSearch:true, metadataAccess:true }
  }, error => { updateError = error || null; });
  assert.ifError(updateError);
  assert.equal(updated.appPermissions.metadataAccess, true);
  assert.equal(service.canUserMetadataAccess(created.id), true);
  assert.equal(updated.accessVersion, beforeVersion + 1, 'permission changes must invalidate access snapshots');
} finally {
  fs.rmSync(temp, { recursive:true, force:true });
}

const app = fs.readFileSync('server/app.js', 'utf8');
const routes = fs.readFileSync('server/routes/metadata-routes.js', 'utf8');
const accessRoute = fs.readFileSync('server/routes/user-access-routes.js', 'utf8');
const adminHtml = fs.readFileSync('public/admin/users.html', 'utf8');
const adminActions = fs.readFileSync('public/scripts/admin/actions.js', 'utf8');
const signupActions = fs.readFileSync('public/scripts/admin/signup-actions.js', 'utf8');
const shell = fs.readFileSync('public/fragments/app-shell.html', 'utf8');
const catalog = fs.readFileSync('public/scripts/rebuild/features/library-catalog-loader.mjs', 'utf8');
const listActions = fs.readFileSync('public/scripts/rebuild/features/library-list-actions.mjs', 'utf8');
const orchestrator = fs.readFileSync('public/scripts/rebuild/features/library-action-orchestrator-bridge.mjs', 'utf8');

assert.ok(app.includes("app.get('/metadata.html'"), 'metadata document must have an explicit authorization route');
assert.ok(app.includes('canUserMetadataAccess(session.userId)'), 'metadata document route must check the live account permission');
assert.ok(routes.includes("error:'metadata_access_required'"), 'metadata API must reject users without permission');
assert.ok(routes.includes("router.get('/metadata/providers', requireViewer"), 'provider list must require metadata viewer permission');
assert.ok(accessRoute.includes('metadataAccessAllowed: appPermissions.metadataAccess === true'), 'access snapshot must expose the permission');
assert.ok(adminHtml.includes('id="create-metadata-access"'));
assert.ok(adminHtml.includes('id="edit-metadata-access"'));
assert.ok(adminHtml.includes('id="signup-code-metadata-access"'));
assert.ok(adminActions.includes('metadataAccess: !!(metadataAccess && metadataAccess.checked === true)'));
assert.ok(signupActions.includes('metadataAccess: !!(metadataAccess && metadataAccess.checked === true)'));
assert.ok(/id="library-metadata-page-link"[^>]*hidden/.test(shell), 'metadata navigation must be hidden until the access snapshot resolves');
assert.ok(catalog.includes('syncLibraryMetadataAccessUi(app,s)'), 'snapshot reconciliation must synchronize metadata navigation');
assert.ok(listActions.includes("if (action === 'metadata')"));
assert.ok(listActions.includes('snapshot.metadataAccessAllowed === true'));
assert.ok(orchestrator.includes("'메타데이터 화면 접근 권한이 없습니다.'"), 'action execution needs a second permission guard');

console.log('v588-metadata-access-permission-smoke-pass');
