const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert');
const {createUserStateServiceManager}=require('../../server/services/user-state-service');
const {createFontService}=require('../../server/services/font-service');
const PASS='v426-multi-user-isolation-boundary-smoke-pass';
function runMultiUserIsolationBoundarySmoke(){
 const root=path.join(__dirname,'../..');
 const app=fs.readFileSync(path.join(root,'server/app.js'),'utf8'),stateRoutes=fs.readFileSync(path.join(root,'server/routes/state-routes.js'),'utf8'),novelsRoutes=fs.readFileSync(path.join(root,'server/routes/novels-routes.js'),'utf8'),fontRoutes=fs.readFileSync(path.join(root,'server/routes/font-routes.js'),'utf8'),doc=fs.readFileSync(path.join(root,'docs/multi-user-access-control.md'),'utf8');
 assert.ok(app.includes('createUserStateServiceManager({ userDataDir: paths.USER_DATA_DIR'));
 assert.ok(app.includes('userDataDir: paths.USER_DATA_DIR'));
 assert.ok(stateRoutes.includes('resolveStateWriteService'));
 assert.ok(novelsRoutes.includes('filterLibraryByAccess'));
 assert.ok(fontRoutes.includes('req.fontScope'));
 assert.ok(doc.includes('라이브러리 파일만 owner 권한 설정과 맞물려 공유'));
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'multi-user-isolation-'));
 try{
  const m=createUserStateServiceManager({userDataDir:path.join(tmp,'user-data'),logger:{error(){}}});
  const a=m.getStatePathForSession({kind:'user',userId:'reader-a'}),b=m.getStatePathForSession({kind:'user',userId:'reader-b'});
  assert.notStrictEqual(a,b); assert.ok(a.endsWith(path.join('reader-a','state.json'))); assert.ok(b.endsWith(path.join('reader-b','state.json')));
  const f=createFontService({fontDir:path.join(tmp,'fonts'),fontMetaPath:path.join(tmp,'font-library.json'),legacyFontDir:path.join(tmp,'legacy-fonts'),legacyFontMetaPath:path.join(tmp,'legacy-font-library.json'),userDataDir:path.join(tmp,'user-data'),now:()=>1710000000000});
  const fa=f.resolveFontScope({ownerId:'reader-a'}),fb=f.resolveFontScope({ownerId:'reader-b'});
  assert.notStrictEqual(fa.fontDir,fb.fontDir); assert.ok(fa.fontDir.endsWith(path.join('reader-a','fonts'))); assert.ok(fb.fontMetaPath.endsWith(path.join('reader-b','font-library.json')));
 } finally{fs.rmSync(tmp,{recursive:true,force:true});}
 return{pass:PASS};
}
if(require.main===module)console.log(JSON.stringify(runMultiUserIsolationBoundarySmoke()));
module.exports={runMultiUserIsolationBoundarySmoke};
