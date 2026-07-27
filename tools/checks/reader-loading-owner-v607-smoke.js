const fs=require('fs');
const s=fs.readFileSync('public/scripts/rebuild/features/reader.mjs','utf8');
const g=fs.readFileSync('public/scripts/rebuild/features/reader/request-guards.mjs','utf8');
for(const c of ['const loadOwner = { key, sessionId, current:c, mode, promise:null };','app.state.loadingChunkOwners ||= new Map();','app.state.loadingChunkOwners.set(key, loadOwner);','app.state.loadingChunkOwners?.get?.(key) === loadOwner'])if(!s.includes(c))throw new Error('missing load owner contract: '+c);
if(!s.includes('loadOwner.promise = operation;'))throw new Error('loading owner must expose the in-flight operation');
if(!g.includes('app.state.loadingChunkOwners?.clear?.();'))throw new Error('loading owners must reset with reader request scope');
console.log('reader-loading-owner-v607-pass');
