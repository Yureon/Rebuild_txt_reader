import { purgeReaderCacheOutsideAllowedNovelIds, purgeSearchCacheManifestOutsideAllowedNovelIds } from './reader/cache-store.mjs';

const ACCESS_SNAPSHOT_STORAGE_KEY='txt-reader.multi.userAccessSnapshot.v1';
const REVOKED_READER_PASS='v392-reader-access-revoked-current-reader-pass';
export const LIBRARY_ACCESS_RECONCILE_LAZY_PASS='v612-library-access-reconcile-lazy-pass';

function setStoredAccessSignature(snapshot,signature,purge){
  try{localStorage.setItem(`${ACCESS_SNAPSHOT_STORAGE_KEY}:${snapshot.userId||'anonymous'}`,JSON.stringify({signature,userId:snapshot.userId||'',accessVersion:snapshot.accessVersion||1,accessibleNovelCount:snapshot.accessibleNovelCount||0,updatedAt:Date.now(),purge:{removed:purge.removed||0,bytes:purge.bytes||0}}))}catch{}
}

export function closeCurrentReaderForRevokedAccess(app,snapshot,deps={}){
  const current=app?.state?.current,novelId=current?.novel?.id||current?.novelId||'';
  if(!novelId||snapshot.accessibleNovelIds.includes(String(novelId)))return false;
  const abort=app.state.chunkFetchAbort;abort?.abort?.();
  Object.assign(app.state,{current:null,readerSessionId:(Number(app.state.readerSessionId)||0)+1,chunkFetchAbort:null,readerFolderManifest:null,readerFolderManifestRequest:null,readerBlockManifest:null,readerBlockManifestRequest:null,currentChunks:[],chunkWindow:null,virtualDocument:null});
  if(app.els?.reader)app.els.reader.style.display='none';if(app.els?.empty)app.els.empty.style.display='flex';if(app.els?.toolbarTitle)app.els.toolbarTitle.textContent='소설을 선택하세요';
  deps.status?.(app,'reader','접근 권한이 변경되어 현재 작품을 닫았습니다.');deps.toast?.(app,'warn','접근 권한 변경','현재 열람 중이던 작품의 접근 권한이 회수되어 목록으로 돌아왔습니다.');
  app.state.userAccessRevokedCurrentReader={pass:REVOKED_READER_PASS,novelId,userId:snapshot.userId||'',accessVersion:snapshot.accessVersion||1,at:Date.now()};return true;
}

export async function reconcileRestrictedAccessDetails(app,baseSnapshot,signature,deps={},detailRequest=null){
  const detailed=await(detailRequest||app.api.userAccessSnapshot({noRedirect:true,includeNovelIds:true}));
  if(!detailed||detailed.ok===false||!Array.isArray(detailed.accessibleNovelIds))return null;
  const reader=await purgeReaderCacheOutsideAllowedNovelIds(app,detailed.accessibleNovelIds),search=await purgeSearchCacheManifestOutsideAllowedNovelIds(app,detailed.accessibleNovelIds),purge={...reader,reader,search,removed:(Number(reader?.removed)||0)+(Number(search?.removed)||0),bytes:Number(reader?.bytes)||0,pass:LIBRARY_ACCESS_RECONCILE_LAZY_PASS};
  if(purge.removed)deps.status?.(app,'sync',`권한 변경 캐시 정리 ${purge.removed}개`);
  closeCurrentReaderForRevokedAccess(app,detailed,deps);app.state.userAccessSnapshot={...baseSnapshot,...detailed};app.state.userAccessSnapshotPurge=purge;setStoredAccessSignature(detailed,signature,purge);return detailed;
}
