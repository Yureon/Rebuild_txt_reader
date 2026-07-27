#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '../..');
const PASS = 'v453-static-asset-preload-budget-smoke-pass';
function size(rel){ return fs.statSync(path.join(root, rel)).size; }
function read(rel){ return fs.readFileSync(path.join(root, rel), 'utf8'); }
const assets = ['public/library.html','public/site.html','public/mobile.html','public/styles/app.css','public/scripts/rebuild/main.mjs','public/scripts/rebuild/library-page.mjs','public/scripts/rebuild/site.mjs','public/scripts/rebuild/mobile.mjs'];
const report = assets.map(rel => ({ rel, bytes:size(rel), gzip:fs.existsSync(path.join(root, rel+'.gz')), br:fs.existsSync(path.join(root, rel+'.br')) }));
for (const item of report) {
  assert(item.bytes > 0, item.rel + ' is empty');
  assert(item.gzip && item.br, item.rel + ' precompressed sidecar missing');
}
const library = read('public/library.html');
const site = read('public/site.html');
const mobile = read('public/mobile.html');
assert(library.includes('rel="modulepreload"'), 'library modulepreload missing');
assert(site.includes('rel="modulepreload"'), 'site modulepreload missing');
assert(mobile.includes('rel="modulepreload"'), 'mobile modulepreload missing');
assert(library.includes('rebuild-v679') && site.includes('rebuild-v679') && mobile.includes('rebuild-v679'), 'entrypoint version marker missing');
console.log(PASS + ' ' + JSON.stringify({ assets:report }));
