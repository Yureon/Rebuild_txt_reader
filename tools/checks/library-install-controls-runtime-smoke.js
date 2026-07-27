#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-install-controls-runtime.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-install-controls-runtime-smoke-pass', modules:graph.files.length }));
