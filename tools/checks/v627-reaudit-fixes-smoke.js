#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS,
  hasUsableLibraryAccess,
  systemUpdateAuthorizationForSession
} = require('../../server/services/system-update-permission-service');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

assert.equal(TXT_READER_MULTI_SYSTEM_UPDATE_PERMISSION_PASS, 'v627-system-update-dual-permission-pass');
assert.equal(hasUsableLibraryAccess({ mode:'none', folders:[] }), false);
assert.equal(hasUsableLibraryAccess({ mode:'folders', folders:[] }), false);
assert.equal(hasUsableLibraryAccess({ mode:'folders', folders:['소설'] }), true);
assert.equal(hasUsableLibraryAccess({ mode:'all', folders:[] }), true);
const accountService = {
  getUserAccessSnapshot(id) {
    const records = {
      both:{ libraryAccess:{ mode:'folders', folders:['A'] }, appPermissions:{ metadataAccess:true } },
      libraryOnly:{ libraryAccess:{ mode:'all', folders:[] }, appPermissions:{ metadataAccess:false } },
      metadataOnly:{ libraryAccess:{ mode:'none', folders:[] }, appPermissions:{ metadataAccess:true } }
    };
    return records[id] || null;
  }
};
assert.equal(systemUpdateAuthorizationForSession({ kind:'owner' }, accountService).allowed, true);
assert.equal(systemUpdateAuthorizationForSession({ kind:'user', userId:'both' }, accountService).allowed, true);
assert.equal(systemUpdateAuthorizationForSession({ kind:'user', userId:'libraryOnly' }, accountService).allowed, false);
assert.equal(systemUpdateAuthorizationForSession({ kind:'user', userId:'metadataOnly' }, accountService).allowed, false);

const login = read('public/login.html');
assert(login.includes('service-worker-register.js'), 'login page must load the build handshake runtime');
assert(login.includes('data-update-ui="silent"'), 'login page handshake must stay silent without update popup UI');
const register = read('public/scripts/service-worker-register.js');
for (const token of [
  '/api/system-update/authorization',
  'authorizeSystemUpdate(true)',
  'TXT_READER_SYSTEM_UPDATE_DENIED',
  'v638-service-worker-update-coordination-pass'
]) assert(register.includes(token), `missing update client gate: ${token}`);
const sw = read('public/sw.js');
for (const token of [
  "fetch('/api/system-update/authorization'",
  'authorization.allowed === true',
  'TXT_READER_SYSTEM_UPDATE_DENIED',
  'v627-system-update-dual-permission-pass'
]) assert(sw.includes(token), `missing service-worker update gate: ${token}`);

const metadata = read('server/services/metadata-service.js');
for (const token of [
  'v627-metadata-score-first-live-competition-pass',
  'v627-metadata-abort-safe-pacing-pass',
  'v669-metadata-provider-completion-cooldown-pass',
  'autoApplyBestCandidate(job.novel, real)',
  'if (currentBest && Number(currentBest.matchScore) >= 1) break',
  'const tailByProvider = new Map()',
  'nextAllowedAtByProvider.set(key, completedAt + cooldownMs)'
]) assert(metadata.includes(token), `missing metadata fix: ${token}`);
assert(!metadata.includes('autoApplyBestCandidate(job.novel, saved)'), 'per-provider early auto apply must be removed');

const fileops = read('server/services/fileops-service.js');
for (const token of [
  'v627-fileops-stable-path-lock-pass',
  'sameLockPaths(plannedPaths, currentPaths)',
  "error.code = 'FILEOPS_PATH_UNSTABLE'",
  'for (let attempt = 0; attempt < 12; attempt += 1)'
]) assert(fileops.includes(token), `missing fileops stable lock fix: ${token}`);

const playwright = read('server/services/metadata-playwright-service.js');
for (const token of [
  'v627-metadata-playwright-dns-pin-pass',
  'v627-metadata-playwright-truncated-quota-pass',
  '--host-resolver-rules=',
  'before.truncated === true',
  'profileMeasurementTruncated:after.truncated === true'
]) assert(playwright.includes(token), `missing playwright fix: ${token}`);

const auth = read('server/routes/auth-routes.js');
assert(auth.includes('await sessionStore.flush()'), 'password change must durably flush the current session');
assert(auth.includes('SESSION_STORE_PASSWORD_CHANGE_PERSIST_FAILED'));
const content = read('server/services/content-service.js');
for (const token of ['async function flushChunkIndexWrites()', 'CHUNK_INDEX_PERSIST_FAILED', 'chunkIndexLastWriteError', 'flushChunkIndexWrites,']) assert(content.includes(token));
const app = read('server/app.js');
assert(app.includes('await contentService.closeWorkerPool(); await contentService.flushChunkIndexWrites();'));
const docs = read('docs/production-diagnostics.md');
assert(docs.includes('모든 네트워크 인터페이스에 listen'));

console.log(JSON.stringify({ pass:'v627-reaudit-fixes-smoke-pass', findingsFixed:8, updateDualPermission:true, loginPopupRemoved:true, silentHandshake:true }));
