import { buildTree } from './library-model.mjs';
import { createRootDropZone } from './library-prototype-rows.mjs';
import { renderLibraryTree } from './library-tree-renderer.mjs';

export const LIBRARY_FULL_RENDERER_PASS = 'v293-library-full-renderer-pass';

export function buildLibraryFullRenderRecord({ reason = 'full-render', options = {}, rowHeightMeasurement = null, anchorRestored = false, activeFollowApplied = false } = {}) {
  return {
    mode: 'full',
    kind: 'informational-full-render',
    blocking: false,
    reason,
    rowCount: null,
    rowHeightEstimate: rowHeightMeasurement?.fixedEstimatePx || rowHeightMeasurement?.stats?.average || null,
    rowHeightMeasurement: options.summarizeRowHeightMeasurement?.(rowHeightMeasurement) || rowHeightMeasurement || null,
    source: options.source || 'render',
    fullRendererPass: LIBRARY_FULL_RENDERER_PASS,
    scrollPolicy: {
      resetScroll: !!options.resetScroll,
      anchorKey: options.scrollAnchor?.key || '',
      anchorRestored,
      followActive: !!options.followActive,
      activeFollowApplied
    },
    at: Date.now()
  };
}

export function renderLibraryFull(app, box, novels, reason = 'full-render', options = {}, deps = {}) {
  box.classList.remove('library-virtual-active');
  delete box.dataset.libraryVirtualActive;
  app.state.libraryVirtualWindowRenderCache = null;

  const tree = buildTree(novels);
  const fragment = document.createDocumentFragment();
  fragment.append((deps.createRootDropZone || createRootDropZone)());
  renderLibraryTree(app, fragment, tree, [], { libraryDraggableAttrs: deps.libraryDraggableAttrs });
  box.replaceChildren(fragment);

  const anchorRestored = options.scrollAnchor ? !!deps.restoreLibraryScrollAnchor?.(app, options.scrollAnchor) : false;
  let activeFollowApplied = false;
  if (!anchorRestored && options.followActive) {
    const activeEl = box.querySelector('.novel-item.active,.ep-item.active');
    if (activeEl) {
      try {
        activeEl.scrollIntoView({ block: 'center' });
        activeFollowApplied = true;
      } catch {}
    }
  }
  if (options.resetScroll) box.scrollTop = 0;

  const rowHeightMeasurement = deps.getLibraryRowHeightMeasurementDiagnostics?.(app) || null;
  const record = buildLibraryFullRenderRecord({
    reason,
    options: { ...options, summarizeRowHeightMeasurement: deps.summarizeLibraryRowHeightMeasurement },
    rowHeightMeasurement,
    anchorRestored,
    activeFollowApplied
  });
  deps.recordLibraryVirtualRender?.(app, record);
  return { rendered: true, reason, anchorRestored, activeFollowApplied, record, pass: LIBRARY_FULL_RENDERER_PASS };
}
