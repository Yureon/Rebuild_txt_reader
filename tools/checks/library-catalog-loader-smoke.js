#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph=createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-catalog-loader.mjs','features/library-shelf-runtime.mjs');
graph.assertSourceContains('features/library-catalog-loader.mjs',"import('./library-access-reconcile.mjs')");
graph.assertSourceContains('features/library-catalog-loader.mjs','app.api.userAccessSnapshot','includeNovelIds:true','loadShelfPage','loadFullCatalog');
console.log(JSON.stringify({pass:'v613-library-catalog-loader-smoke-pass'}));
