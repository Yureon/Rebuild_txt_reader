import { saveLocalSerialized } from './storage.mjs';
import { chooseLocalProgressPayload, queueProgressStateSave } from './progress-storage.mjs';

export const PROGRESS_PERSISTENCE_RUNTIME_PASS='v612-progress-persistence-runtime-pass';

export async function persistProgressState(state,options={}){
  const selected=chooseLocalProgressPayload(state.progress,options),localSaved=!!selected.serialized&&saveLocalSerialized('progress',selected.serialized);
  state.progressPersistence={...(state.progressPersistence||{}),pass:PROGRESS_PERSISTENCE_RUNTIME_PASS,localSaved,localCompacted:selected.compacted,localBytes:selected.bytes,indexedDbPending:true,updatedAt:Date.now()};
  try{
    const idbResult=await queueProgressStateSave(state.progress,{immediate:options.immediate===true});
    state.progressPersistence={...(state.progressPersistence||{}),indexedDbPending:false,indexedDbSaved:idbResult?.ok===true,indexedDbUnavailable:idbResult?.unavailable===true,indexedDbError:'',updatedAt:Date.now()};
    return{localSaved,localCompacted:selected.compacted,localBytes:selected.bytes,idbResult};
  }catch(error){
    state.progressPersistence={...(state.progressPersistence||{}),indexedDbPending:false,indexedDbSaved:false,indexedDbError:error?.message||String(error),updatedAt:Date.now()};
    return{localSaved,localCompacted:selected.compacted,localBytes:selected.bytes,idbError:error};
  }
}
