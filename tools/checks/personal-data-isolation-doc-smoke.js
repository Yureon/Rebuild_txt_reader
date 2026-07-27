#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.resolve(__dirname, '..', '..');
const PASS = 'v427-personal-data-isolation-doc-smoke-pass';
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function runPersonalDataIsolationDocSmoke() {
  const doc = read('docs/user-data-isolation.md');
  const multi = read('docs/multi-user-access-control.md');
  const api = read('docs/api-contract.md');
  const app = read('server/app.js');
  const stateRoutes = read('server/routes/state-routes.js');
  const fontService = read('server/services/font-service.js');
  const fontRoutes = read('server/routes/font-routes.js');
  const novelsRoutes = read('server/routes/novels-routes.js');
  for (const token of [
    '기준 버전: rebuild-v660',
    '공유되는 것은 owner가 보유한 라이브러리 파일뿐이다.',
    'data/user-data/<userId>/state.json',
    'data/user-data/<userId>/fonts',
    'data/user-data/<userId>/font-library.json',
    '일반 사용자 글꼴을 `data/fonts` 전역 저장소에 저장하지 않는다.',
    'v427-user-data-isolation-doc-pass'
  ]) assert.ok(doc.includes(token), 'user data isolation doc must include ' + token);
  assert.ok(multi.includes('라이브러리 파일만 owner 권한 설정과 맞물려 공유하고'), 'multi-user doc must restate isolation goal');
  assert.ok(api.includes('## v427 font API scope'), 'api contract must document font scope');
  assert.ok(app.includes('createUserStateServiceManager({ userDataDir: paths.USER_DATA_DIR'), 'app must use user data dir for state manager');
  assert.ok(app.includes('userDataDir: paths.USER_DATA_DIR'), 'app must pass user data dir to font service');
  assert.ok(stateRoutes.includes('resolveStateWriteService'), 'state routes must resolve scoped write service');
  assert.ok(novelsRoutes.includes('filterLibraryByAccess'), 'novel routes must keep library access filtering');
  assert.ok(fontService.includes("path.join(scopedUserDataDir, ownerId, 'fonts')"), 'font service must resolve user-scoped font dir');
  assert.ok(fontService.includes("path.join(scopedUserDataDir, ownerId, 'font-library.json')"), 'font service must resolve user-scoped font metadata');
  assert.ok(fontRoutes.includes('requireFontSession'), 'font routes must use owner/user font session, not owner-only mutation');
  assert.ok(!fontRoutes.includes("router.post('/fonts/upload', requireOwnerSession"), 'font upload must not be owner-only');
  return { pass: PASS };
}
if (require.main === module) console.log(JSON.stringify(runPersonalDataIsolationDocSmoke()));
module.exports = { runPersonalDataIsolationDocSmoke };
