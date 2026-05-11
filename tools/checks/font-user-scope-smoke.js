const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { createFontService } = require('../../server/services/font-service');
const PASS = 'v426-user-font-library-scope-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }
function runFontUserScopeSmoke() {
  const route = read('server/routes/font-routes.js'), app = read('server/app.js'), doc = read('docs/multi-user-access-control.md');
  assert.ok(route.includes('requireFontSession'), 'font mutations must be available to authenticated user/owner sessions');
  assert.ok(!route.includes("router.delete('/fonts/:filename', requireOwnerSession"), 'font delete must not be owner-only');
  assert.ok(!route.includes("'/fonts/upload',\n    requireOwnerSession"), 'font upload must not be owner-only');
  assert.ok(route.includes('v426-user-font-library-scope-pass'), 'font scope marker missing in route');
  assert.ok(route.includes('v426-user-font-upload-route-pass'), 'font upload route marker missing');
  assert.ok(app.includes('userDataDir: paths.USER_DATA_DIR'), 'app must pass userDataDir to font service');
  assert.ok(doc.includes('v426-user-font-library-scope-smoke-pass'), 'multi-user font scope doc marker missing');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'font-user-scope-'));
  try {
    const service = createFontService({ fontDir:path.join(tmp,'owner-fonts'), fontMetaPath:path.join(tmp,'owner-font-library.json'), legacyFontDir:path.join(tmp,'legacy-fonts'), legacyFontMetaPath:path.join(tmp,'legacy-font-library.json'), userDataDir:path.join(tmp,'user-data'), now:() => 1700000000000 });
    const body = Buffer.from('wOFF0000fontdata'), alice = { ownerId:'Alice', kind:'user' }, bob = { ownerId:'Bob', kind:'user' };
    const aliceUpload = service.uploadFont({ scope:alice, rawFilename:'sample.woff', rawFamily:'My Font', bodyBuffer:body });
    assert.strictEqual(aliceUpload.scope.ownerId, 'alice');
    assert.strictEqual(aliceUpload.scope.userScoped, true);
    assert.strictEqual(service.getFontListResponse(alice).items.length, 1);
    assert.strictEqual(service.getFontListResponse(bob).items.length, 0);
    assert.throws(() => service.getFontFileForResponse(aliceUpload.filename, bob), /file not found/);
    const bobUpload = service.uploadFont({ scope:bob, rawFilename:'sample.woff', rawFamily:'My Font', bodyBuffer:body });
    assert.strictEqual(bobUpload.scope.ownerId, 'bob');
    assert.strictEqual(service.getFontListResponse(bob).items.length, 1);
    service.deleteFont(aliceUpload.filename, alice);
    assert.strictEqual(service.getFontListResponse(alice).items.length, 0);
    assert.strictEqual(service.getFontListResponse(bob).items.length, 1);
  } finally { fs.rmSync(tmp, { recursive:true, force:true }); }
  return { pass: PASS };
}
if (require.main === module) console.log(JSON.stringify(runFontUserScopeSmoke()));
module.exports = { runFontUserScopeSmoke };
