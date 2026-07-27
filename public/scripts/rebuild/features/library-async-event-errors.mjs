import { toast } from './ui.mjs';
export const LIBRARY_ASYNC_EVENT_ERROR_RUNTIME_PASS='v612-library-async-event-error-runtime-pass';
export function reportLibraryAsyncEventError(app,error,type='event'){
  if(!app?.state)return;const at=Date.now(),entry={pass:LIBRARY_ASYNC_EVENT_ERROR_RUNTIME_PASS,type:String(type),message:error?.message||String(error),at},history=Array.isArray(app.state.libraryAsyncErrors)?app.state.libraryAsyncErrors:[];app.state.libraryAsyncErrors=[...history.slice(-19),entry];if(at-(Number(app.state.libraryAsyncErrorToastAt)||0)<4000)return;app.state.libraryAsyncErrorToastAt=at;if(typeof document!=='undefined')toast(app,'error','서재 작업 실패',entry.message)
}
