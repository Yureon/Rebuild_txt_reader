const fs=require('fs');
const s=fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
function need(x,m){if(!s.includes(x))throw new Error(m)}
need("flushReaderProgressBeforeContextChange(app, 'reader-context-change');",'openNovel must flush previous progress before context switch');
need("on(window, 'pagehide', () => flushReaderProgressBeforeContextChange(app, 'pagehide'))",'pagehide progress flush missing');
need("document.visibilityState === 'hidden'",'hidden progress flush missing');
need("app.state.readerSaveProgressDebounced?.cancel?.();",'stale progress debounce cancellation missing');
const flush=s.indexOf("flushReaderProgressBeforeContextChange(app, 'reader-context-change');");
const assign=s.indexOf('app.state.current = openState.current;');
if(!(flush>=0&&flush<assign))throw new Error('previous progress must flush before current assignment');
console.log('reader-context-progress-flush-v607-pass');
