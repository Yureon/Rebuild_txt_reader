#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-render-options.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-render-options-smoke-pass', modules:graph.files.length }));
