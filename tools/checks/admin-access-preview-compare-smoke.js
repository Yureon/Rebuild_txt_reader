#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const express = require('express');
const { CURRENT_REBUILD_VERSION_NUMBER } = require('./current-rebuild-version');
function read(rel) { return fs.readFileSync(path.join(__dirname, '../..', rel), 'utf8'); }
async function postJson(url, payload) { const response = await fetch(url, { method:'POST', headers:{ 'Content-Type':'application/json', Cookie:'__Host-session_token=owner-token', 'X-CSRF-Token':'csrf-token', Origin:'http://127.0.0.1' }, body:JSON.stringify(payload) }); return { status:response.status, body:await response.json() }; }
async function runAdminAccessPreviewCompareSmoke() {
  const route = read('server/routes/admin-users-routes.js'), page = read('public/admin/users.html') + '\n' + read('public/scripts/admin-users.js') + '\n' + read('public/scripts/admin/permissions.js'), docs = read('docs/multi-user-access-control.md');
  assert.ok(route.includes('/admin/users/:userId/library-preview/compare'), 'access compare endpoint missing');
  assert.ok(route.includes('v396-admin-access-preview-compare-pass'), 'access compare pass marker missing');
  assert.ok(route.includes('admin.user.library_preview_compare'), 'access compare audit event missing');
  assert.ok(page.includes(`data-current-build="v${CURRENT_REBUILD_VERSION_NUMBER}"`), 'current Owner console badge missing');
  assert.ok(page.includes('권한 변경 영향 미리보기'), 'access impact preview button missing');
  assert.ok(page.includes('create-folder-search') && page.includes('edit-folder-search'), 'folder search controls missing');
  assert.ok(page.includes('선택된 권한 폴더'), 'selected folder summary label missing');
  assert.ok(docs.includes('v396-admin-access-preview-compare-smoke-pass'), 'v396 docs marker missing');
  const { createAdminUsersRouter } = require('../../server/routes/admin-users-routes');
  const app = express(); const auditEvents = [];
  app.use(express.json());
  app.use('/api', createAdminUsersRouter({
    sessionStore:{ getSession: token => token === 'owner-token' ? { kind:'owner', userId:'owner', role:'owner' } : null },
    accountService:{ listUsers:()=>[{ id:'reader-a', username:'reader-a', enabled:true, accessVersion:1, sessionVersion:1, libraryAccess:{ mode:'folders', folders:['판타지'] } }], findUserById:id=>id==='reader-a'?{ id:'reader-a', username:'reader-a', enabled:true, accessVersion:1, sessionVersion:1, libraryAccess:{ mode:'folders', folders:['판타지'] } }:null, createUser(){}, updateUser(){}, resetPassword(){}, deleteUser(){}, revokeUserSessions(){} },
    libraryService:{ getLibraryCached:()=>[
      { id:'novel-fantasy', title:'용사의 길', categoryPath:'판타지', singlePath:'판타지/용사의 길.txt' },
      { id:'novel-murim', title:'검의 길', categoryPath:'무협/작가A', singlePath:'무협/작가A/검의 길.txt' },
      { id:'novel-other', title:'검의 길 외전', categoryPath:'무협/작가A_다른폴더', singlePath:'무협/작가A_다른폴더/외전.txt' }
    ] },
    userStateServiceManager:{}, setNoStore:res=>res.set('Cache-Control','no-store'), requireSameOrigin:(req,res,next)=>next(), requireCsrf:(req,res,next)=>req.get('x-csrf-token')==='csrf-token'?next():res.status(403).json({ error:'csrf blocked' }), auditLogService:{ appendEvent:(type,event)=>{ auditEvents.push({ type,event }); return { ok:true }; } }
  }));
  const server = http.createServer(app); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const { status, body } = await postJson(`http://127.0.0.1:${server.address().port}/api/admin/users/reader-a/library-preview/compare`, { libraryAccess:{ mode:'folders', folders:['무협/작가A'] } });
    assert.strictEqual(status, 200, 'access compare route must return 200');
    assert.strictEqual(body.pass, 'v396-admin-access-preview-compare-pass', 'route pass mismatch');
    assert.strictEqual(body.current.accessibleNovelCount, 1, 'current fantasy access should include one novel');
    assert.strictEqual(body.proposed.accessibleNovelCount, 1, 'proposed murim access should include one novel');
    assert.strictEqual(body.diff.addedCount, 1, 'proposed access should add one novel');
    assert.strictEqual(body.diff.revokedCount, 1, 'proposed access should revoke one novel');
    assert.strictEqual(body.diff.addedSample[0].id, 'novel-murim', 'segment prefix should allow exact folder child');
    assert.ok(!body.proposed.sample.some(novel => novel.id === 'novel-other'), 'segment prefix must not allow 작가A_다른폴더');
    assert.ok(auditEvents.some(entry => entry.type === 'admin.user.library_preview_compare'), 'compare request must write audit event');
  } finally { await new Promise(resolve => server.close(resolve)); }
  return { pass:'v396-admin-access-preview-compare-smoke-pass' };
}
if (require.main === module) runAdminAccessPreviewCompareSmoke().then(r=>console.log(JSON.stringify(r))).catch(e=>{console.error(e);process.exit(1)});
module.exports = { runAdminAccessPreviewCompareSmoke };
