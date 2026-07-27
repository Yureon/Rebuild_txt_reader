export const LIBRARY_LOGOUT_RUNTIME_PASS = 'v613-library-logout-user-scope-reset-pass';

export async function logoutFromLibrary(app, button) {
  if (button?.disabled) return;
  const originalText = button?.textContent || '로그아웃';
  if (button) { button.disabled = true; button.textContent = '로그아웃 중…'; }
  try {
    await app.reader?.persistProgress?.();
    await app.deviceSync?.push?.({ force:true, allowBackground:true });
    await app.api.logout();
    try {
      const [{ resetProgressStorageRuntime }, { resetReaderCacheRuntime }, { setStorageScope }] = await Promise.all([
        import('../core/progress-storage.mjs'),
        import('./reader/cache-store.mjs'),
        import('../core/storage.mjs')
      ]);
      resetProgressStorageRuntime();
      resetReaderCacheRuntime();
      setStorageScope('anonymous');
    } catch {}
    if (app?.state) {
      app.state.current = null;
      app.state.progress = { lastRead:null, byNovel:{}, positions:{}, readMeta:{} };
      app.state.bookmarks = [];
      app.state.recents = [];
      app.state.favorites = new Set();
      app.state.userTags = [];
      app.state.novelUserTags = {};
      app.state.userAccessSnapshot = null;
    }
    try { localStorage.removeItem('csrf_token'); } catch {}
    location.replace('/login.html');
  } catch (error) {
    if (button) { button.disabled = false; button.textContent = originalText; }
    globalThis.alert?.(error?.data?.message || error?.message || '로그아웃에 실패했습니다.');
  }
}
