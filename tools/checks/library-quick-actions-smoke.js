#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-quick-actions.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-quick-actions-smoke-pass', modules:graph.files.length }));
