#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const express = require('express');
const { createAdminUsersRouter } = require('../../server/routes/admin-users-routes');

function write(root, relativePath, content) {
  const target = path.join(root, ...relativePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive:true });
  fs.writeFileSync(target, content);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  return { status:response.status, body:await response.json() };
}

async function run() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'txt-reader-v628-admin-cleanup-'));
  const auditEvents = [];
  write(root, 'updates/Example Story 1-100.txt', 'old');
  write(root, 'updates/Example Story 1-120.txt', 'latest');
  write(root, 'updates/Example Story 1-120 (2).txt', 'copy');
  const novels = [
    { id:'old', title:'Example Story 1-100', fileName:'Example Story 1-100', categoryPath:'updates', singlePath:'updates/Example Story 1-100.txt', isMultiFile:false },
    { id:'latest', title:'Example Story 1-120', fileName:'Example Story 1-120', categoryPath:'updates', singlePath:'updates/Example Story 1-120.txt', isMultiFile:false },
    { id:'copy', title:'Example Story 1-120 (2)', fileName:'Example Story 1-120 (2)', categoryPath:'updates', singlePath:'updates/Example Story 1-120 (2).txt', isMultiFile:false }
  ];
  const libraryService = {
    getLibraryCachedAsync:async () => novels,
    safeJoinUnderLibrary(relativePath) {
      const target = path.resolve(root, relativePath);
      const relative = path.relative(root, target);
      if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
        throw new Error('unsafe path');
      }
      return target;
    }
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createAdminUsersRouter({
    sessionStore:{
      getSession(token) {
        return token === 'owner-token' ? { kind:'owner', userId:'owner', role:'owner' } : null;
      }
    },
    accountService:{ listUsers:() => [] },
    libraryService,
    userStateServiceManager:{},
    setNoStore:res => res.set('Cache-Control', 'no-store'),
    requireSameOrigin:(req, res, next) => next(),
    requireCsrf:(req, res, next) => req.get('x-csrf-token') === 'csrf-token'
      ? next()
      : res.status(403).json({ ok:false, error:'csrf_blocked' }),
    auditLogService:{ appendEvent:(type, payload) => auditEvents.push({ type, payload }) }
  }));
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const ownerHeaders = { Cookie:'__Host-session_token=owner-token' };
  try {
    const anonymous = await requestJson(`${base}/admin/library-cleanup/plan`);
    assert.equal(anonymous.status, 403, 'cleanup plan must be Owner-only');

    const plan = await requestJson(`${base}/admin/library-cleanup/plan`, { headers:ownerHeaders });
    assert.equal(plan.status, 200);
    assert.equal(plan.body.pass, 'v628-library-cleanup-plan-pass');
    assert.equal(plan.body.summary.supersededCount, 1);
    assert.equal(plan.body.summary.duplicateCopyCount, 1);

    const csrfBlocked = await requestJson(`${base}/admin/library-cleanup/script`, {
      method:'POST',
      headers:{ ...ownerHeaders, 'Content-Type':'application/json' },
      body:JSON.stringify({ relations:['superseded'] })
    });
    assert.equal(csrfBlocked.status, 403, 'script generation must require CSRF validation');

    const generated = await requestJson(`${base}/admin/library-cleanup/script`, {
      method:'POST',
      headers:{ ...ownerHeaders, 'Content-Type':'application/json', 'X-CSRF-Token':'csrf-token' },
      body:JSON.stringify({ relations:['superseded'] })
    });
    assert.equal(generated.status, 200);
    assert.equal(generated.body.pass, 'v630-library-cleanup-powershell-script-pass');
    assert.equal(generated.body.summary.candidateCount, 1);
    assert.match(generated.body.fileName, /^txt-reader-library-cleanup-[a-f0-9]{12}\.ps1$/u);
    assert.equal(generated.body.scriptFormat, 'ps1');
    assert.ok(generated.body.script.includes('[switch]$Apply'));
    assert.ok(!generated.body.script.includes('#!/usr/bin/env node'));
    assert.ok(auditEvents.some(event => event.type === 'admin.library_cleanup.script_generate'));
    assert.ok(!auditEvents.some(event => JSON.stringify(event).includes(generated.body.script)), 'audit log must not contain the generated script or paths');

    console.log(JSON.stringify({
      pass:'v628-library-cleanup-admin-route-smoke-pass',
      candidates:plan.body.summary.candidateCount
    }));
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive:true, force:true });
  }
}

run().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
});
