const fs=require('fs'),assert=require('assert');
const css=fs.readFileSync('public/styles/app.css','utf8');
const shell=fs.readFileSync('public/fragments/app-shell.html','utf8');
const state=fs.readFileSync('public/scripts/rebuild/state/app-state.mjs','utf8');
for(const token of ['@media(max-width:399px)','grid-template-columns:minmax(86px,30vw) minmax(0,1fr) 48px','data-library-density="compact"','data-library-density="large"']) assert(css.includes(token),`missing ${token}`);
assert(shell.includes('id="library-density-select"'), 'density control missing');
assert(state.includes("saveLocal('libraryShelfDensity'"), 'density persistence missing');
console.log('v598-mobile-library-structure-smoke-pass');
