import { resetLibraryVirtualAutoFallbackState } from './library-virtual-runtime-state.mjs';

export const LIBRARY_VIRTUAL_AUTO_FALLBACK_RESET_PASS = 'v301-library-virtual-auto-fallback-reset-pass';

export function createLibraryVirtualAutoFallbackReset(baseDeps = {}) {
  return function resetLibraryVirtualAutoFallback(app, reason = 'manual-reset') {
    resetLibraryVirtualAutoFallbackState(app, reason, {
      storageKey: baseDeps.storageKey,
      defaultRolloutPass: baseDeps.defaultRolloutPass
    });
    baseDeps.notifyLibraryVirtualDiagnostics?.(app);
    baseDeps.renderLibrary?.(app, { source:'recovery-reset-virtual-auto-fallback', followActive:true });
    baseDeps.toast?.(app, 'info', 'Virtual renderer fallback 초기화', '다음 렌더부터 guarded default virtual renderer를 다시 시도합니다. 문제가 다시 감지되면 full renderer로 자동 고정됩니다.');
    return typeof baseDeps.getLibraryVirtualRenderDiagnostics === 'function' ? baseDeps.getLibraryVirtualRenderDiagnostics(app) : null;
  };
}

export function getLibraryVirtualAutoFallbackResetContract() {
  return {
    pass: LIBRARY_VIRTUAL_AUTO_FALLBACK_RESET_PASS,
    runtime: 'library-virtual-runtime-state.mjs',
    operation: 'resetLibraryVirtualAutoFallback'
  };
}
