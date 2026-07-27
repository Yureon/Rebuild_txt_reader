#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLibraryCoreOperationsBridge } from '../../public/scripts/rebuild/features/library-core-operations-bridge.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(root, 'public/scripts/rebuild/features/library-core-operations-bridge.mjs'), 'utf8');
assert(source.includes('getLibraryCurrentWindowRows, getLibraryVirtualRows'), 'current-window resolver import missing');
assert(source.includes('function safeGetLibraryCurrentWindowRows(app)'), 'settings diagnostics guard missing');
assert(source.includes("v647-library-settings-diagnostics-guard-pass"), 'v647 diagnostics marker missing');

const app = {
  state: {
    novels: [],
    libraryFilter: '',
    collapsedFolders: new Set(),
    expandedEpisodeNovels: new Set(),
    current: null
  },
  els: { novelList: null }
};
const bridge = createLibraryCoreOperationsBridge({
  isLibraryVirtualRendererRequested: () => false,
  isLibraryVirtualRendererEnabled: () => false,
  getLibraryVirtualTrialDiagnostics: () => null,
  getLibraryVirtualDiagnosticsDeps: () => ({})
});
const diagnostics = bridge.getLibraryVirtualRenderDiagnostics(app);
assert.equal(diagnostics?.lazy, true);
assert.equal(diagnostics?.fallback?.currentWindowRows, 0);
assert.equal(app.state.libraryVirtualDiagnosticsError, undefined);
console.log(JSON.stringify({ pass:'v647-library-settings-diagnostics-pass' }));
