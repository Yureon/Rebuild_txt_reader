const fs=require('fs'),path=require('path'),assert=require('assert');
function r(x){return fs.readFileSync(path.join(__dirname,'../..',x),'utf8')}
function runUserAccessRevokedCurrentReaderSmoke(){
  const loader=r('public/scripts/rebuild/features/library-catalog-loader.mjs'),doc=r('docs/multi-user-access-control.md');
  assert.ok(loader.includes('v392-reader-access-revoked-current-reader-pass'), 'revoked current reader marker missing');
  assert.ok(loader.includes('closeCurrentReaderForRevokedAccess'), 'close function missing');
  assert.ok(loader.includes('app.state.current = null'), 'current state clear missing');
  assert.ok(loader.includes('readerSessionId'), 'reader session invalidation missing');
  assert.ok(loader.includes('접근 권한이 변경되어 현재 작품을 닫았습니다'), 'status message missing');
  assert.ok(loader.includes('현재 열람 중이던 작품의 접근 권한이 회수'), 'toast message missing');
  assert.ok(doc.includes('v392-reader-access-revoked-current-reader-pass'), 'doc marker missing');
  return {pass:'v392-user-access-revoked-current-reader-smoke-pass'};
}
if(require.main===module)console.log(JSON.stringify(runUserAccessRevokedCurrentReaderSmoke()));
module.exports={runUserAccessRevokedCurrentReaderSmoke};
