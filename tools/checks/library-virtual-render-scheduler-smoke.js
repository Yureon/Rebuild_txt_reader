#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph = createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-virtual-render-scheduler.mjs');
console.log(JSON.stringify({ pass:'v613-current-library-virtual-render-scheduler-smoke-pass', modules:graph.files.length }));
