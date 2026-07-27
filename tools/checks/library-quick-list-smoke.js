#!/usr/bin/env node
const { createLibraryArchitecture } = require('./current-library-architecture-contract.js');
const graph=createLibraryArchitecture(process.cwd());
graph.assertReachable('features/library-quick-list.mjs','features/library-quick-actions.mjs');
graph.assertSourceContains('features/library-quick-list.mjs','installLibraryQuickListDelegation','renderLibraryQuickList','removeLibraryQuickRecentItem');
graph.assertSourceContains('features/library-quick-actions.mjs','openLibraryQuickItem','revealLibraryQuickItemInList');
console.log(JSON.stringify({pass:'v613-library-quick-list-smoke-pass'}));
