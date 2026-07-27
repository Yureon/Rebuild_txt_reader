export const LIBRARY_VIRTUAL_RENDER_SCHEDULER_PASS = 'v297-library-virtual-render-scheduler-pass';

export function scheduleLibraryVirtualRenderRuntime(app, deps = {}) {
  if (!deps.isLibraryVirtualRendererEnabled?.(app)) return false;
  const box = app?.els?.novelList;
  if (!box || box.dataset.libraryVirtualActive !== '1') return false;
  if (app.state.libraryVirtualRenderRaf) return false;
  app.state.libraryVirtualRenderRaf = window.requestAnimationFrame(() => {
    app.state.libraryVirtualRenderRaf = 0;
    deps.renderLibrary?.(app, { source:'virtual-scroll' });
  });
  return true;
}

export function cancelLibraryVirtualRenderRuntime(app) {
  if (!app?.state?.libraryVirtualRenderRaf) return false;
  window.cancelAnimationFrame(app.state.libraryVirtualRenderRaf);
  app.state.libraryVirtualRenderRaf = 0;
  return true;
}
