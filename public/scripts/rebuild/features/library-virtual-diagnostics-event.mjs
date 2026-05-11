export const LIBRARY_VIRTUAL_DIAGNOSTICS_EVENT_PASS = 'v301-library-virtual-diagnostics-event-pass';

export function createLibraryVirtualDiagnosticsNotifier({ isLibraryVirtualRendererRequested } = {}) {
  return function notifyLibraryVirtualDiagnosticsRuntime(app) {
    try {
      document.dispatchEvent(new CustomEvent('txt-reader:library-virtual-diagnostics', {
        detail: {
          version: app?.state?.version || '',
          active: app?.els?.novelList?.dataset?.libraryVirtualActive === '1',
          requested: typeof isLibraryVirtualRendererRequested === 'function' ? isLibraryVirtualRendererRequested(app) : false,
          at: Date.now()
        }
      }));
    } catch {}
  };
}

export function getLibraryVirtualDiagnosticsEventContract() {
  return {
    pass: LIBRARY_VIRTUAL_DIAGNOSTICS_EVENT_PASS,
    eventName: 'txt-reader:library-virtual-diagnostics',
    fields: ['version', 'active', 'requested', 'at']
  };
}
