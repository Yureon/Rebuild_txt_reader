#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-virtual-runtime-state.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-virtual-runtime-state-smoke-pass', modules:graph.files.length }));
