import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import {
  READ_DATA_HUMAN_TITLE_RESOLUTION_PASS,
  createReadDataTitleResolver,
  isOpaqueReadDataIdentifier,
  shortReadDataIdentifier
} from '../../public/scripts/rebuild/features/bookmarks/read-data-model.mjs';

const require = createRequire(import.meta.url);
const { createUserStateServiceManager } = require('../../server/services/user-state-service');
const { createFontService } = require('../../server/services/font-service');
const root = path.resolve(import.meta.dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const HASH = 'bfabe3ddc110c570b2bb2daafd5a76bf';

assert.equal(isOpaqueReadDataIdentifier(HASH), true);
assert.equal(shortReadDataIdentifier(HASH), 'bfabe3dd…76bf');

const emptyApp = { state:{ novelById:new Map(), progress:{lastRead:null,byNovel:{},positions:{},readMeta:{}}, recents:[], bookmarks:[] } };
const unknown = createReadDataTitleResolver(emptyApp).resolve({ novelId:HASH, title:HASH });
assert.equal(unknown.label, '목록에서 찾을 수 없는 작품');
assert.equal(unknown.label.includes(HASH), false);
assert.equal(unknown.identifierHint, 'bfabe3dd…76bf');

const historyApp = { state:{
  novelById:new Map(),
  progress:{lastRead:null,byNovel:{},positions:{},readMeta:{ [`${HASH}-single`]:{novelId:HASH,title:HASH} }},
  recents:[{novelId:HASH,novelTitle:'기록에서 복구한 작품 제목',title:'기록에서 복구한 작품 제목'}],
  bookmarks:[]
} };
const recovered = createReadDataTitleResolver(historyApp).resolve({novelId:HASH,title:HASH});
assert.equal(recovered.label, '기록에서 복구한 작품 제목');

const liveApp = { state:{
  novelById:new Map([[HASH,{id:HASH,title:'현재 서재 작품',episodes:[{id:'ep-1',title:'1화 시작'}]}]]),
  progress:{lastRead:null,byNovel:{},positions:{},readMeta:{}}, recents:[], bookmarks:[]
} };
const live = createReadDataTitleResolver(liveApp).resolve({novelId:HASH,episodeId:'ep-1'});
assert.equal(live.label, '현재 서재 작품 · 1화 시작');
assert.equal(live.stale, false);

const modal = read('public/scripts/rebuild/features/bookmarks/read-data-modal.mjs');
const progress = read('public/scripts/rebuild/features/reader/progress.mjs');
const bookmarkModel = read('public/scripts/rebuild/features/bookmarks/model.mjs');
const css = read('public/styles/deferred-ui.css');
assert(modal.includes('createReadDataTitleResolver'));
assert(modal.includes('staleReadDataMeta'));
for (const unsafe of ["bm.title || novel?.title || bm.novelId", "item.title || item.label || group.novel?.title || item.novelId", "novel?.title || id"]) {
  assert.equal(modal.includes(unsafe), false, `raw ID title fallback remains: ${unsafe}`);
}
for (const token of ['novelTitle', 'episodeTitle', 'title:c.episode']) assert(progress.includes(token), `future progress title field missing: ${token}`);
for (const token of ['novelTitle:', 'episodeTitle:']) assert(bookmarkModel.includes(token), `bookmark title field missing: ${token}`);
assert(css.includes('v660: Reader settings navigation remains fully inside the modal'));
assert(css.includes('grid-template-columns:repeat(3,minmax(0,1fr))!important'));
assert(css.includes('.settings-workspace-nav .sp-tab'));
assert(css.includes('min-width:0!important'));
assert(css.includes('.settings-panel:not(.settings-page)[data-settings-context=\"reader\"]'));

const stateRoutes = read('server/routes/state-routes.js');
const appSource = read('server/app.js');
const storage = read('public/scripts/rebuild/core/storage.mjs');
const progressStorage = read('public/scripts/rebuild/core/progress-storage.mjs');
const readerCache = read('public/scripts/rebuild/features/reader/cache-store.mjs');
const fontRoutes = read('server/routes/font-routes.js');
const novelsRoutes = read('server/routes/novels-routes.js');
assert(stateRoutes.includes("router.get('/user-state', requireUserSession"));
assert(stateRoutes.includes('resolveStateWriteService'));
assert(stateRoutes.includes("router.get('/sync', requireUserSession"));
assert(stateRoutes.includes("status(410)"));
assert(appSource.includes('createUserStateServiceManager({ userDataDir: paths.USER_DATA_DIR'));
assert(storage.includes('txt-reader.rebuild.') && storage.includes('scope.'));
assert(progressStorage.includes('current::') || progressStorage.includes('`${PROGRESS_STATE_KEY_PREFIX}::'));
assert(readerCache.includes('userId') && readerCache.includes('accessVersion'));
assert(fontRoutes.includes('requireFontSession') && fontRoutes.includes('req.fontScope'));
assert(novelsRoutes.includes('filterLibraryByAccess'));

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'v660-isolation-'));
try {
  const manager = createUserStateServiceManager({userDataDir:path.join(tmp,'user-data'),logger:{error(){}}});
  const stateA = manager.getStatePathForSession({kind:'user',userId:'reader-a'});
  const stateB = manager.getStatePathForSession({kind:'user',userId:'reader-b'});
  assert.notEqual(stateA,stateB);
  assert(stateA.endsWith(path.join('reader-a','state.json')));
  assert(stateB.endsWith(path.join('reader-b','state.json')));
  const fonts = createFontService({fontDir:path.join(tmp,'fonts'),fontMetaPath:path.join(tmp,'font-library.json'),legacyFontDir:path.join(tmp,'legacy-fonts'),legacyFontMetaPath:path.join(tmp,'legacy-font-library.json'),userDataDir:path.join(tmp,'user-data'),now:()=>1710000000000});
  const fontA = fonts.resolveFontScope({ownerId:'reader-a'});
  const fontB = fonts.resolveFontScope({ownerId:'reader-b'});
  assert.notEqual(fontA.fontDir,fontB.fontDir);
  assert(fontA.fontDir.endsWith(path.join('reader-a','fonts')));
  assert(fontB.fontMetaPath.endsWith(path.join('reader-b','font-library.json')));
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}

console.log(JSON.stringify({
  pass:'v660-read-data-reader-tabs-isolation-smoke-pass',
  titleResolutionPass:READ_DATA_HUMAN_TITLE_RESOLUTION_PASS,
  assertions:42
},null,2));
