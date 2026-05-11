const fs = require('fs');
const path = require('path');

const LIBRARY_VIRTUAL_RUNTIME_SPLIT_SMOKE_PASS = 'v283-library-virtual-runtime-split-smoke-pass';

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

function requireIncludes(source, markers, label) {
  const missing = markers.filter(marker => !source.includes(marker));
  if (missing.length) throw new Error(`${label} missing markers: ${missing.join(', ')}`);
}

function requireNotFunction(source, names, label) {
  const leaked = names.filter(name => new RegExp(`function\\s+${name}Runtime\\s*\\(`).test(source));
  if (leaked.length) throw new Error(`${label} leaked runtime implementations: ${leaked.join(', ')}`);
}

function runLibraryVirtualRuntimeSplitSmoke(projectRoot = path.join(__dirname, '..', '..')) {
  const library = read(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const session = read(projectRoot, 'public/scripts/rebuild/features/library-virtual-session-runtime.mjs');
  const trial = read(projectRoot, 'public/scripts/rebuild/features/library-virtual-trial-runtime.mjs');
  const diagnostics = read(projectRoot, 'public/scripts/rebuild/features/library-virtual-diagnostics-summary.mjs');
  const prototype = read(projectRoot, 'public/scripts/rebuild/features/library-prototype-rows.mjs');
  const fixture = read(projectRoot, 'public/scripts/rebuild/features/library-tree-render-fixture.mjs');

  const runtimeDepsBridge = read(projectRoot, 'public/scripts/rebuild/features/library-runtime-deps-bridge.mjs');
  const coreOpsBridge = read(projectRoot, 'public/scripts/rebuild/features/library-core-operations-bridge.mjs');
  const virtualOpsBridge = read(projectRoot, 'public/scripts/rebuild/features/library-virtual-operations-bridge.mjs');
  const libraryBridgeSource = [library, runtimeDepsBridge, coreOpsBridge, virtualOpsBridge].join('\n');
  requireIncludes(libraryBridgeSource, [
    "from './library-virtual-session-runtime.mjs'",
    "from './library-virtual-trial-runtime.mjs'",
    "from './library-virtual-diagnostics-summary.mjs'",
    "from './library-prototype-rows.mjs'",
    "from './library-tree-render-fixture.mjs'",
    'getLibraryVirtualTrialRuntimeDeps',
    'getLibraryVirtualSessionRuntimeDeps',
    'getLibraryVirtualDiagnosticsDeps',
    'getLibraryPrototypeRowsDeps'
  ], 'library split bridge');
  requireIncludes(session, [
    'LIBRARY_VIRTUAL_SESSION_RUNTIME_PASS',
    'startLibraryVirtualSessionOptInRuntime',
    'finishLibraryVirtualSessionOptInRuntime',
    'recordLibraryVirtualSessionOptInRenderRuntime',
    'recordLibraryVirtualSessionOptInFallbackRuntime'
  ], 'session runtime module');
  requireIncludes(trial, [
    'LIBRARY_VIRTUAL_TRIAL_RUNTIME_PASS',
    'startLibraryVirtualTrialRuntime',
    'finishLibraryVirtualTrialRuntime',
    'runLibraryVirtualTrialScenarioRuntime',
    'recordLibraryVirtualTrialObservationRuntime'
  ], 'trial runtime module');
  requireIncludes(diagnostics, [
    'LIBRARY_VIRTUAL_DIAGNOSTICS_SUMMARY_PASS',
    'buildLibraryVirtualRenderDiagnosticsForApp',
    'buildLibraryVirtualFallbackDiagnosticsForApp',
    'buildLibraryAutoEnableDiagnosticsForApp',
    'summarizeFullRenderRowHeight'
  ], 'diagnostics summary module');
  requireIncludes(prototype, [
    'LIBRARY_PROTOTYPE_ROWS_PASS',
    'createPrototypeLibraryRow',
    'decorateVirtualLibraryRow',
    'buildLibraryVirtualPrototypeWindowRows',
    'getLibraryPrototypeDiagnostics'
  ], 'prototype rows module');
  requireIncludes(fixture, [
    'LIBRARY_TREE_RENDER_FIXTURE_PASS',
    'getLibraryTreeRenderFixtureContract',
    'folderRowSelector',
    'novelRowSelector',
    'episodeRowSelector'
  ], 'tree render fixture module');
  requireNotFunction(library, [
    'startLibraryVirtualTrial',
    'finishLibraryVirtualTrial',
    'startLibraryVirtualSessionOptIn',
    'finishLibraryVirtualSessionOptIn'
  ], 'library');
  console.log('library virtual runtime split smoke OK');
  return { pass: LIBRARY_VIRTUAL_RUNTIME_SPLIT_SMOKE_PASS, ok: true };
}

module.exports = { LIBRARY_VIRTUAL_RUNTIME_SPLIT_SMOKE_PASS, runLibraryVirtualRuntimeSplitSmoke };
if (require.main === module) runLibraryVirtualRuntimeSplitSmoke();
