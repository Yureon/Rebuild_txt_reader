const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RECOVERY_LIBRARY_FULL_SPLIT_V307_SMOKE_PASS = 'v307-recovery-library-full-split-smoke-pass';

async function runRecoveryLibraryFullSplitV307Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const featureDir = path.join(projectRoot, 'public/scripts/rebuild/features');
  const recoveryDir = path.join(featureDir, 'recovery');
  const read = (file) => fs.readFileSync(path.join(recoveryDir, file), 'utf8');
  const readFeature = (file) => fs.readFileSync(path.join(featureDir, file), 'utf8');

  const adapter = read('library-diagnostics-adapter.mjs');
  const adapterMethods = read('library-diagnostics-adapter-methods.mjs');
  const contextResolvers = read('library-diagnostics-context-resolvers.mjs');
  if (!adapterMethods.includes('v293-recovery-library-diagnostics-adapter-pass')) throw new Error('adapter methods marker missing');
  if (!contextResolvers.includes('v307-recovery-library-context-resolvers-split-pass')) throw new Error('context resolver split marker missing');
  if (!adapter.includes("from './library-diagnostics-adapter-methods.mjs'") || !adapter.includes("from './library-diagnostics-context-resolvers.mjs'")) {
    throw new Error('compat adapter must re-export split method and context modules');
  }
  if (adapter.includes('export function createRecoveryLibraryDiagnosticsAdapter')) {
    throw new Error('compat adapter still owns method implementation after v307 split');
  }

  const exportPayload = read('library-diagnostics-export-payload.mjs');
  const exportCopyButton = read('library-diagnostics-export-copy-button.mjs');
  const panelCopyButtons = read('library-diagnostics-panel-copy-buttons.mjs');
  if (!exportCopyButton.includes('v307-recovery-library-diagnostics-export-copy-button-split-pass')) throw new Error('export copy button marker missing');
  if (exportPayload.includes('createEl(') || exportPayload.includes('addEventListener')) throw new Error('export payload still owns copy-button UI implementation');
  if (!panelCopyButtons.includes("from './library-diagnostics-export-copy-button.mjs'")) throw new Error('panel copy buttons must import export copy button split module');

  const aggregatePayloads = read('library-virtual-diagnostic-payloads.mjs');
  const fallbackPayload = read('library-virtual-fallback-sample-payload.mjs');
  const trialPayload = read('library-virtual-trial-result-payload.mjs');
  const rowPayload = read('library-row-height-diagnostics-payload.mjs');
  if (!aggregatePayloads.includes('v307-library-virtual-diagnostic-payloads-split-pass')) throw new Error('diagnostic payload aggregate split marker missing');
  if (!fallbackPayload.includes('v307-library-virtual-fallback-sample-payload-split-pass')) throw new Error('fallback sample payload marker missing');
  if (!trialPayload.includes('v307-library-virtual-trial-result-payload-split-pass')) throw new Error('trial result payload marker missing');
  if (!rowPayload.includes('v307-library-row-height-diagnostics-payload-split-pass')) throw new Error('row-height payload marker missing');
  if (aggregatePayloads.includes('function buildLibraryVirtualFallbackSamplePayload(') || aggregatePayloads.includes('function buildLibraryVirtualTrialResultPayload(') || aggregatePayloads.includes('function buildLibraryRowHeightDiagnosticsPayload(')) {
    throw new Error('diagnostic payload aggregate still owns v307 split implementations');
  }
  if (!panelCopyButtons.includes("from './library-virtual-fallback-sample-payload.mjs'") ||
      !panelCopyButtons.includes("from './library-virtual-trial-result-payload.mjs'") ||
      !panelCopyButtons.includes("from './library-row-height-diagnostics-payload.mjs'")) {
    throw new Error('panel copy buttons must import each diagnostic payload builder from its owner module');
  }

  const summary = readFeature('library-virtual-diagnostics-summary.mjs');
  const capture = readFeature('library-virtual-diagnostics-capture.mjs');
  const formatters = readFeature('library-virtual-diagnostics-formatters.mjs');
  if (!summary.includes('v307-library-virtual-diagnostics-summary-split-pass')) throw new Error('diagnostics summary split marker missing');
  if (!capture.includes('v307-library-virtual-diagnostics-capture-split-pass')) throw new Error('diagnostics capture split marker missing');
  if (!formatters.includes('v307-library-virtual-diagnostics-formatters-split-pass')) throw new Error('diagnostics formatters split marker missing');
  if (summary.includes('rawFallbackHistory.filter(') || summary.includes('summarizeLibraryRowHeightMeasurement(')) {
    throw new Error('diagnostics summary still owns capture/formatting implementation after v307 split');
  }

  const modules = await Promise.all([
    import(pathToFileURL(path.join(recoveryDir, 'library-diagnostics-adapter-methods.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-diagnostics-context-resolvers.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-diagnostics-export-copy-button.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-virtual-diagnostic-payloads.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-virtual-fallback-sample-payload.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-virtual-trial-result-payload.mjs')).href),
    import(pathToFileURL(path.join(recoveryDir, 'library-row-height-diagnostics-payload.mjs')).href),
    import(pathToFileURL(path.join(featureDir, 'library-virtual-diagnostics-summary.mjs')).href),
    import(pathToFileURL(path.join(featureDir, 'library-virtual-diagnostics-capture.mjs')).href),
    import(pathToFileURL(path.join(featureDir, 'library-virtual-diagnostics-formatters.mjs')).href)
  ]);

  const [adapterMethodsMod, contextResolversMod, exportCopyButtonMod, aggregateMod, fallbackMod, trialMod, rowMod, summaryMod, captureMod, formattersMod] = modules;
  if (typeof adapterMethodsMod.createRecoveryLibraryDiagnosticsAdapter !== 'function') throw new Error('adapter method export missing');
  if (typeof contextResolversMod.resolveRecoveryLibraryCopyPayloadContext !== 'function') throw new Error('copy payload context resolver export missing');
  if (typeof exportCopyButtonMod.createLibraryDiagnosticsSnapshotCopyButton !== 'function') throw new Error('export copy button export missing');
  if (typeof aggregateMod.buildLibraryVirtualFallbackSamplePayload !== 'function') throw new Error('aggregate fallback payload re-export missing');
  if (typeof fallbackMod.buildLibraryVirtualFallbackSamplePayload !== 'function') throw new Error('fallback payload export missing');
  if (typeof trialMod.buildLibraryVirtualTrialResultPayload !== 'function') throw new Error('trial payload export missing');
  if (typeof rowMod.buildLibraryRowHeightDiagnosticsPayload !== 'function') throw new Error('row-height payload export missing');
  if (typeof summaryMod.buildLibraryVirtualRenderDiagnosticsForApp !== 'function') throw new Error('diagnostics summary export missing');
  if (typeof captureMod.captureLibraryVirtualDiagnosticsRawState !== 'function') throw new Error('diagnostics capture export missing');
  if (typeof formattersMod.buildLibraryVirtualFallbackDiagnosticsForApp !== 'function') throw new Error('diagnostics formatter export missing');

  return {
    pass: RECOVERY_LIBRARY_FULL_SPLIT_V307_SMOKE_PASS,
    splitModules: 10,
    aggregatePayloadLineCount: aggregatePayloads.split(/\r?\n/).length,
    summaryLineCount: summary.split(/\r?\n/).length
  };
}

module.exports = { RECOVERY_LIBRARY_FULL_SPLIT_V307_SMOKE_PASS, runRecoveryLibraryFullSplitV307Smoke };

if (require.main === module) {
  runRecoveryLibraryFullSplitV307Smoke().catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
