#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-runtime-dependency-bags.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-runtime-dependency-bags-smoke-pass', modules:graph.files.length }));
