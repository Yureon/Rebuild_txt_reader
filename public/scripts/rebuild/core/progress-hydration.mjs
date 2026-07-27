import { loadProgressStateFromIndexedDb, primeLocalProgressFallback } from './progress-storage.mjs';
import { mergeProgress } from '../features/sync/server-state-hydration.mjs';
export const PROGRESS_INDEXED_DB_HYDRATION_PASS='v612-progress-indexeddb-hydration-pass';
export async function hydratePersistedProgress(app){
  try{
    // Prime the bounded local fallback before the full IndexedDB snapshot is
    // merged, so ordinary Reader saves never rescan the resident collection.
    primeLocalProgressFallback(app.state.progress);
    const stored=await loadProgressStateFromIndexedDb();
    if(stored)app.state.progress=mergeProgress(app.state.progress,stored);
    app.state.progressPersistenceHydrated={pass:PROGRESS_INDEXED_DB_HYDRATION_PASS,ok:true,at:Date.now()};
  }catch(error){
    app.state.progressPersistenceHydrated={pass:PROGRESS_INDEXED_DB_HYDRATION_PASS,ok:false,error:error?.message||String(error),at:Date.now()};
  }
}
