const fs=require('fs');
const s=fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
const checks=[
 'const openSessionId = resetReaderRequestScope(app);',
 'const openCurrent = app.state.current;',
 'const openSignal = app.state.chunkFetchAbort?.signal || null;',
 'isReaderRequestCurrent(app, { signal: openSignal, sessionId: openSessionId, current: openCurrent })',
 "await loadChunk(app, openCurrent.chunk, 'replace'"
];
for(const c of checks)if(!s.includes(c))throw new Error('missing open session guard: '+c);
const first=s.indexOf('const manifest = await manifestPromise.catch');
const guard=s.indexOf('isReaderRequestCurrent(app, { signal: openSignal, sessionId: openSessionId, current: openCurrent })',first);
const load=s.indexOf("await loadChunk(app, openCurrent.chunk, 'replace'",first);
if(!(first>=0&&guard>first&&load>guard))throw new Error('manifest completion must be guarded before chunk load');
console.log('reader-open-session-guard-v607-pass');
