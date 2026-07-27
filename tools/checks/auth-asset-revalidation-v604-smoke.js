#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const PASS = 'v604-auth-asset-revalidation-smoke-pass';

const fontRoute = fs.readFileSync('server/routes/font-routes.js', 'utf8');
const metadataRoute = fs.readFileSync('server/routes/metadata-routes.js', 'utf8');
for (const [name, source] of [['font', fontRoute], ['metadata cover', metadataRoute]]) {
  assert(source.includes("private, max-age=0, must-revalidate"), `${name} asset must revalidate authorization on every reuse`);
  assert(source.includes("appendVaryCookie(res)"), `${name} asset cache must vary by session cookie`);
  assert(source.includes("res.setHeader('ETag'"), `${name} asset must retain inexpensive ETag revalidation`);
}
assert(!fontRoute.includes("private, max-age=3600"));
assert(!metadataRoute.includes("max-age=31536000, immutable"));

for (const file of ['public/login.html','public/library.html','public/mobile.html','public/site.html']) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/<link[^>]+href="https:\/\/fonts\.googleapis\.com\/css2[^>]*>/g)) {
    assert(match[0].includes('crossorigin="anonymous"'), `${file} Google Fonts stylesheet must opt into CORS under COEP`);
  }
}
const fontLoader = fs.readFileSync('public/scripts/rebuild/features/settings/font-resources.mjs', 'utf8');
assert(fontLoader.includes("link.crossOrigin = 'anonymous'"));
console.log(JSON.stringify({ pass:PASS }));
