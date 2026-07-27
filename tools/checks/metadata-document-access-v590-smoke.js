#!/usr/bin/env node
const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('server/app.js', 'utf8');
const routeStart = app.indexOf("app.get('/metadata.html'");
const routeEnd = app.indexOf("app.use(applyVersionedRebuildAssetCache", routeStart);
assert.ok(routeStart >= 0 && routeEnd > routeStart, 'metadata document route missing');
const route = app.slice(routeStart, routeEnd);
assert.ok(route.includes("res.redirect(303, '/library.html?notice=metadata_access_required')"), 'metadata document navigation must redirect safely to the library notice');
assert.ok(!route.includes("type('text/plain"), 'metadata document must not return an unrelated plain-text error contract');
const api = fs.readFileSync('server/routes/metadata-routes.js', 'utf8');
assert.ok(api.includes("error:'metadata_access_required'"), 'metadata APIs must keep the same error code');
const docs = fs.readFileSync('docs/api-contract.md', 'utf8');
assert.ok(docs.includes('v590-metadata-document-access-contract-pass'));
console.log(JSON.stringify({ pass:'v590-metadata-document-access-pass' }));
