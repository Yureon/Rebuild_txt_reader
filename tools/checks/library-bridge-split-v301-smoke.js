const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const LIBRARY_BRIDGE_SPLIT_V301_SMOKE_PASS = 'v301-library-bridge-split-smoke-pass';

async function runLibraryBridgeSplitV301Smoke(projectRoot = path.join(__dirname, '..', '..')) {
  const libraryPath = path.join(projectRoot, 'public/scripts/rebuild/features/library.mjs');
  const library = fs.readFileSync(libraryPath, 'utf8');
  const modules = [
    ['library-virtual-diagnostics-event.mjs', 'v301-library-virtual-diagnostics-event-pass'],
    ['library-navigation-bridge.mjs', 'v301-library-navigation-bridge-pass'],
    ['library-favorites-bridge.mjs', 'v301-library-favorites-bridge-pass'],
    ['library-event-delegation-bridge.mjs', 'v301-library-event-delegation-bridge-pass'],
    ['library-virtual-auto-fallback-reset.mjs', 'v301-library-virtual-auto-fallback-reset-pass'],
    ['library-action-orchestrator-bridge.mjs', 'v301-library-action-orchestrator-bridge-pass']
  ];
  for (const [file, marker] of modules) {
    const rel = `public/scripts/rebuild/features/${file}`;
    const source = fs.readFileSync(path.join(projectRoot, rel), 'utf8');
    if (!source.includes(marker)) throw new Error(`v301 bridge module marker missing: ${marker}`);
    if (!library.includes(`from './${file}'`)) throw new Error(`library.mjs missing v301 bridge import: ${file}`);
  }

  [
    'installLibraryEventDelegationRuntime',
    'getLibraryActionTargetRuntime',
    'clearLibraryLongPressRuntime',
    'closeSidebarAfterLibraryOpenRuntime',
    'openNovelFromElementRuntime',
    'openEpisodeFromElementRuntime',
    'toggleLibraryFavoriteRuntime',
    'resetLibraryVirtualAutoFallbackState',
    'runLibraryListActionRuntime',
    'moveDraggedLibraryItemRuntime',
    'createLibraryActionOrchestratorDeps'
  ].forEach(marker => {
    if (library.includes(marker)) throw new Error('library.mjs still owns direct runtime bridge marker: ' + marker);
  });
  if (library.includes('function notifyLibraryVirtualDiagnostics(app)')) {
    throw new Error('notifyLibraryVirtualDiagnostics implementation still lives in library.mjs');
  }
  const lineCount = library.split(/\r?\n/).length;
  if (lineCount > 390) throw new Error('library.mjs v301 bridge split line count regression: ' + lineCount);

  const eventModule = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-diagnostics-event.mjs')).href);
  let dispatched = null;
  const oldDocument = global.document;
  const oldCustomEvent = global.CustomEvent;
  global.CustomEvent = class CustomEvent {
    constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
  };
  global.document = { dispatchEvent(event) { dispatched = event; } };
  try {
    const notify = eventModule.createLibraryVirtualDiagnosticsNotifier({ isLibraryVirtualRendererRequested: () => true });
    notify({ state:{ version:'rebuild-v301' }, els:{ novelList:{ dataset:{ libraryVirtualActive:'1' } } } });
    if (!dispatched || dispatched.type !== 'txt-reader:library-virtual-diagnostics') throw new Error('diagnostics notifier did not dispatch expected event');
    if (dispatched.detail.version !== 'rebuild-v301' || dispatched.detail.active !== true || dispatched.detail.requested !== true) {
      throw new Error('diagnostics notifier detail mismatch');
    }
  } finally {
    global.document = oldDocument;
    global.CustomEvent = oldCustomEvent;
  }

  const favModule = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/library-favorites-bridge.mjs')).href);
  const favoriteCalls = [];
  const favBridge = favModule.createLibraryFavoritesBridge({
    getLibraryScrollAnchor: () => ({ key:'anchor' }),
    persistBookData: () => favoriteCalls.push('persist'),
    renderLibrary: (_app, options) => favoriteCalls.push(options.source),
    toast: () => favoriteCalls.push('toast')
  });
  const favApp = { state:{ favorites:new Set() } };
  const favResult = favBridge.toggleFavorite(favApp, 'n1');
  if (!favResult.changed || !favApp.state.favorites.has('n1')) throw new Error('favorites bridge toggle failed');
  if (!favoriteCalls.includes('persist') || !favoriteCalls.includes('favorite-toggle')) throw new Error('favorites bridge dependency calls missing');

  const resetModule = await import(pathToFileURL(path.join(projectRoot, 'public/scripts/rebuild/features/library-virtual-auto-fallback-reset.mjs')).href);
  const resetCalls = [];
  const reset = resetModule.createLibraryVirtualAutoFallbackReset({
    storageKey:'k',
    defaultRolloutPass:'pass',
    notifyLibraryVirtualDiagnostics: () => resetCalls.push('notify'),
    renderLibrary: (_app, options) => resetCalls.push(options.source),
    toast: () => resetCalls.push('toast'),
    getLibraryVirtualRenderDiagnostics: () => ({ ok:true })
  });
  const resetApp = { state:{}, storage:{ local:{ removeItem: () => resetCalls.push('remove') } } };
  const resetResult = reset(resetApp);
  if (!resetResult.ok || !resetCalls.includes('notify') || !resetCalls.includes('recovery-reset-virtual-auto-fallback')) {
    throw new Error('auto fallback reset bridge dependency calls missing');
  }

  return { pass: LIBRARY_BRIDGE_SPLIT_V301_SMOKE_PASS, modules: modules.length, lineCount };
}

module.exports = { LIBRARY_BRIDGE_SPLIT_V301_SMOKE_PASS, runLibraryBridgeSplitV301Smoke };
if (require.main === module) {
  runLibraryBridgeSplitV301Smoke().catch(error => {
    console.error(error && error.stack || error);
    process.exit(1);
  });
}
