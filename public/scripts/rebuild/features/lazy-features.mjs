import { status, toast } from './ui.mjs';
import { applyPrefs } from './settings/appearance.mjs';
import { isShortcut } from './settings/shortcuts.mjs';
import { ensureDeferredUi } from '../core/feature-fragments.mjs';

export const LAZY_FEATURE_RUNTIME_PASS = 'v568-lazy-feature-runtime-pass';
export const LAZY_READER_INTENT_PRELOAD_PASS = 'v568-lazy-reader-intent-preload-pass';

const FEATURE_LABELS = {
  reader: '리더',
  search: '본문 검색',
  bookmarks: '북마크',
  readData: '독서 데이터',
  settings: '설정',
  devtools: '진단 도구'
};

function createRuntime(app) {
  const records = new Map();
  const runtime = {
    pass: LAZY_FEATURE_RUNTIME_PASS,
    records,
    isLoaded(name) {
      return records.get(name)?.status === 'loaded';
    },
    getApi(name) {
      return records.get(name)?.api || null;
    },
    snapshot() {
      return Array.from(records.entries()).map(([name, record]) => ({
        name,
        status: record.status,
        startedAt: record.startedAt || 0,
        loadedAt: record.loadedAt || 0,
        durationMs: record.durationMs || 0,
        error: record.error || ''
      }));
    }
  };
  app.lazyFeatures = runtime;
  return runtime;
}

function featureLoader(app, runtime, name, importer, installer) {
  return async function ensureFeature() {
    const current = runtime.records.get(name);
    if (current?.status === 'loaded') return current.api;
    if (current?.promise) return current.promise;

    const startedAt = Date.now();
    const startedPerf = globalThis.performance?.now?.() ?? startedAt;
    const record = {
      name,
      status: 'loading',
      startedAt,
      loadedAt: 0,
      durationMs: 0,
      api: null,
      error: '',
      promise: null
    };
    runtime.records.set(name, record);
    document.documentElement?.setAttribute?.(`data-feature-${name}`, 'loading');
    window.dispatchEvent?.(new CustomEvent('txt-reader:lazy-feature', { detail:{ name, status:'loading', pass:LAZY_FEATURE_RUNTIME_PASS } }));

    record.promise = Promise.resolve()
      .then(importer)
      .then(module => installer(module))
      .then(api => {
        const loadedAt = Date.now();
        const loadedPerf = globalThis.performance?.now?.() ?? loadedAt;
        record.status = 'loaded';
        record.loadedAt = loadedAt;
        record.durationMs = Math.max(0, loadedPerf - startedPerf);
        record.api = api || true;
        record.promise = null;
        const perf = globalThis.__TXT_READER_PERF__;
        if (perf && typeof perf === 'object') {
          perf.resources ||= {};
          perf.resources[`feature:${name}`] = { durationMs:record.durationMs, loadedAt, pass:LAZY_FEATURE_RUNTIME_PASS };
        }
        document.documentElement?.setAttribute?.(`data-feature-${name}`, 'loaded');
        window.dispatchEvent?.(new CustomEvent('txt-reader:lazy-feature', { detail:{ name, status:'loaded', durationMs:record.durationMs, pass:LAZY_FEATURE_RUNTIME_PASS } }));
        return record.api;
      })
      .catch(error => {
        record.status = 'error';
        record.error = error?.message || String(error);
        record.promise = null;
        document.documentElement?.setAttribute?.(`data-feature-${name}`, 'error');
        window.dispatchEvent?.(new CustomEvent('txt-reader:lazy-feature', { detail:{ name, status:'error', error:record.error, pass:LAZY_FEATURE_RUNTIME_PASS } }));
        toast(app, 'error', `${FEATURE_LABELS[name] || name} 불러오기 실패`, record.error);
        throw error;
      });
    return record.promise;
  };
}

function createReaderFacade(app, ensureReader, runtime) {
  const asyncMethods = [
    'openNovel', 'reloadCurrent', 'loadChunk', 'goRelative', 'goSearchResult', 'goBlock', 'goPercent',
    'goEpisode', 'debugGoChunk', 'goPosition', 'ensureBlockManifest', 'ensureFolderBlockManifest',
    'prepareOfflineChunks', 'recordManualDiagnostics', 'clearManualDiagnostics', 'exportManualDiagnostics',
    'importManualDiagnostics'
  ];
  const facade = {};
  asyncMethods.forEach(method => {
    facade[method] = (...args) => ensureReader().then(reader => reader?.[method]?.(...args));
  });
  facade.getViewportAddress = () => runtime.getApi('reader')?.getViewportAddress?.() || null;
  facade.updateProgress = () => runtime.getApi('reader')?.updateProgress?.();
  facade.persistProgress = () => runtime.getApi('reader')?.persistProgress?.();
  facade.invalidateLayout = () => runtime.getApi('reader')?.invalidateLayout?.();
  facade.__lazy = true;
  return facade;
}

function createBookmarksFacade(ensureBookmarks, runtime) {
  const facade = {};
  ['addCurrent', 'render', 'persist', 'goto'].forEach(method => {
    facade[method] = (...args) => ensureBookmarks().then(bookmarks => bookmarks?.[method]?.(...args));
  });
  facade.__lazy = true;
  return facade;
}

function createSearchFacade(ensureSearch, runtime) {
  const facade = {};
  ['open', 'run', 'move'].forEach(method => {
    facade[method] = (...args) => ensureSearch().then(search => search?.[method]?.(...args));
  });
  ['close', 'updateRemote', 'resetSession', 'resetForReaderChange'].forEach(method => {
    facade[method] = (...args) => runtime.getApi('search')?.[method]?.(...args);
  });
  facade.__lazy = true;
  return facade;
}

function replayClickAfterLoad(target, isLoaded, ensure) {
  if (!target) return () => {};
  const handler = event => {
    if (isLoaded()) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    target.disabled = true;
    ensure()
      .then(() => {
        target.disabled = false;
        target.click();
      })
      .catch(() => { target.disabled = false; });
  };
  target.addEventListener('click', handler, { capture:true });
  return () => target.removeEventListener('click', handler, { capture:true });
}

function preloadOnIntent(target, ensure) {
  if (!target) return () => {};
  let requested = false;
  const start = () => {
    if (requested) return;
    requested = true;
    ensure().catch(() => { requested = false; });
  };
  target.addEventListener('pointerover', start, { passive:true });
  target.addEventListener('focusin', start, { passive:true });
  return () => {
    target.removeEventListener('pointerover', start);
    target.removeEventListener('focusin', start);
  };
}


function isEditableTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || '').toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;
}

function installLazyShortcutBridge(app, runtime, ensureSettings, ensureBookmarks, ensureSearch) {
  const handler = event => {
    if (isEditableTarget(event.target)) return;
    if (!runtime.isLoaded('search') && isShortcut(app, 'searchOpen', event)) {
      event.preventDefault();
      ensureSearch().then(search => search?.open?.()).catch(() => {});
      return;
    }
    if (isShortcut(app, 'settingsOpen', event)) {
      event.preventDefault();
      ensureSettings().then(() => {
        if (app.isLibraryProfile) app.openLibrarySettingsPage?.();
        else app.openReaderSettings?.();
      }).catch(() => {});
      return;
    }
    if (isShortcut(app, 'bookmarksOpen', event)) {
      event.preventDefault();
      ensureBookmarks().then(bookmarks => {
        bookmarks?.render?.();
        app.openLayer?.('bookmarkOverlay');
      }).catch(() => {});
      return;
    }
    if (isShortcut(app, 'themeToggle', event)) {
      event.preventDefault();
      app.state.prefs.themeMode = app.state.prefs.themeMode === 'dark' ? 'light' : 'dark';
      applyPrefs(app);
    }
  };
  window.addEventListener('keydown', handler);
  app.lazyShortcutRuntimeInstalled = true;
  return () => {
    window.removeEventListener('keydown', handler);
    app.lazyShortcutRuntimeInstalled = false;
  };
}


function installDeferredFeatureIntentBridge(app, runtime, loaders) {
  const mapping = new Map([
    ['open-read-data-btn', 'readData'],
    ['open-read-data-advanced-btn', 'readData'],
    ['open-dev-debug-btn', 'devtools'],
    ['open-device-management-btn', 'devtools'],
    ['open-device-management-advanced-btn', 'devtools'],
    ['open-custom-css-btn', 'settings'],
    ['open-custom-css-advanced-btn', 'settings'],
    ['open-shortcut-btn', 'settings'],
    ['open-theme-editor-btn', 'settings'],
    ['open-preprocess-editor-btn', 'settings'],
    ['font-modal-btn', 'settings']
  ]);
  const handler = event => {
    const element = event.target instanceof Element ? event.target.closest('[id]') : null;
    const feature = mapping.get(element?.id || '');
    const ensure = loaders[feature];
    if (!feature || !ensure || runtime.isLoaded(feature)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    element.disabled = true;
    ensure().then(() => {
      element.disabled = false;
      element.click();
    }).catch(() => { element.disabled = false; });
  };
  document.addEventListener('click', handler, { capture:true });
  return () => document.removeEventListener('click', handler, { capture:true });
}

function installReaderIntentPreload(app, ensureReader) {
  if (app?.profile === 'library') return () => {};
  const target = app.els?.novelList;
  if (!target) return () => {};
  const maybePreload = event => {
    const element = event.target instanceof Element ? event.target : null;
    if (!element?.closest?.('.library-shelf-card,.novel-item,.episode-item,[data-library-open]')) return;
    document.documentElement?.setAttribute?.('data-reader-intent-preload-pass', LAZY_READER_INTENT_PRELOAD_PASS);
    ensureReader().catch(() => {});
  };
  target.addEventListener('pointerdown', maybePreload, { passive:true, capture:true });
  target.addEventListener('focusin', maybePreload, { passive:true, capture:true });
  return () => {
    target.removeEventListener('pointerdown', maybePreload, { capture:true });
    target.removeEventListener('focusin', maybePreload, { capture:true });
  };
}

export function installLazyFeatureRuntime(app) {
  app.lazyFeatureCleanup?.();
  const runtime = createRuntime(app);
  const disposers = [];

  const ensureReader = featureLoader(app, runtime, 'reader',
    () => import('./reader.mjs'),
    module => {
      module.installReader(app);
      const api = app.reader;
      status(app, 'sync', '리더 준비 완료', 900);
      return api;
    }
  );
  const ensureBookmarks = featureLoader(app, runtime, 'bookmarks',
    () => ensureDeferredUi(app).then(() => import('./bookmarks.mjs')),
    module => {
      module.installBookmarks(app);
      return app.bookmarks;
    }
  );
  const ensureSearch = featureLoader(app, runtime, 'search',
    () => ensureDeferredUi(app).then(() => import('./search.mjs')),
    module => {
      module.installSearch(app);
      return app.search;
    }
  );
  const ensureReadData = featureLoader(app, runtime, 'readData',
    () => ensureDeferredUi(app).then(() => import('./bookmarks/read-data-modal.mjs')),
    module => {
      module.installReadDataModal(app);
      return module;
    }
  );
  const ensureSettings = featureLoader(app, runtime, 'settings',
    () => ensureDeferredUi(app).then(() => import('./theme-settings.mjs')),
    module => {
      module.installThemeAndSettings(app);
      return module;
    }
  );
  const ensureDevtools = featureLoader(app, runtime, 'devtools',
    () => ensureDeferredUi(app).then(() => import('./sync-devtools.mjs')),
    async module => {
      await app.library?.preloadDiagnostics?.();
      module.installDevtools(app);
      return module;
    }
  );

  app.ensureReader = ensureReader;
  app.ensureBookmarks = ensureBookmarks;
  app.ensureSearch = ensureSearch;
  app.ensureReadData = ensureReadData;
  app.ensureSettings = ensureSettings;
  app.ensureDevtools = ensureDevtools;
  app.ensureFeature = name => ({ reader:ensureReader, bookmarks:ensureBookmarks, search:ensureSearch, readData:ensureReadData, settings:ensureSettings, devtools:ensureDevtools }[name]?.());

  app.reader = createReaderFacade(app, ensureReader, runtime);
  app.bookmarks = createBookmarksFacade(ensureBookmarks, runtime);
  app.search = createSearchFacade(ensureSearch, runtime);
  const lazyOpenRecoveryCenter = async options => {
    await ensureDevtools();
    const handler = app.openRecoveryCenter;
    if (typeof handler !== 'function' || handler === lazyOpenRecoveryCenter) return null;
    return handler(options);
  };
  app.openRecoveryCenter = lazyOpenRecoveryCenter;

  disposers.push(replayClickAfterLoad(app.els?.settingsBtn, () => runtime.isLoaded('settings'), ensureSettings));
  disposers.push(replayClickAfterLoad(app.els?.librarySettingsPageBtn, () => runtime.isLoaded('settings'), ensureSettings));
  disposers.push(replayClickAfterLoad(app.els?.bookmarkBtn, () => runtime.isLoaded('bookmarks'), ensureBookmarks));
  disposers.push(replayClickAfterLoad(app.els?.novelSearchBtn, () => runtime.isLoaded('search'), ensureSearch));
  disposers.push(replayClickAfterLoad(app.els?.openReadDataBtn, () => runtime.isLoaded('readData'), ensureReadData));
  disposers.push(replayClickAfterLoad(app.els?.openReadDataAdvancedBtn, () => runtime.isLoaded('readData'), ensureReadData));
  disposers.push(replayClickAfterLoad(app.els?.openDevDebugBtn, () => runtime.isLoaded('devtools'), ensureDevtools));
  disposers.push(replayClickAfterLoad(app.els?.openDeviceManagementAdvancedBtn, () => runtime.isLoaded('devtools'), ensureDevtools));
  disposers.push(replayClickAfterLoad(app.els?.themeToggleBtn, () => runtime.isLoaded('settings'), ensureSettings));

  disposers.push(preloadOnIntent(app.els?.settingsBtn, ensureSettings));
  disposers.push(preloadOnIntent(app.els?.librarySettingsPageBtn, ensureSettings));
  disposers.push(installReaderIntentPreload(app, ensureReader));
  disposers.push(installLazyShortcutBridge(app, runtime, ensureSettings, ensureBookmarks, ensureSearch));
  disposers.push(installDeferredFeatureIntentBridge(app, runtime, { settings:ensureSettings, readData:ensureReadData, devtools:ensureDevtools }));

  app.lazyFeatureCleanup = () => {
    disposers.splice(0).forEach(dispose => { try { dispose(); } catch {} });
  };
  return runtime;
}
