#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-app-api.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-app-api-smoke-pass', modules:graph.files.length }));
