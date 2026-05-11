import { createLibraryVirtualSpacer } from './library-virtual-row-inspection.mjs';

export const LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS = 'v294-library-virtual-window-renderer-pass';
export const LIBRARY_VIRTUAL_ANCHOR_SINGLE_RESTORE_PASS = 'v511-library-virtual-anchor-single-restore-pass';

export function buildLibraryVirtualWindowFragment({ app, visibleRows = [], windowPlan = {}, deps = {} } = {}) {
  const rows = Array.isArray(visibleRows) ? visibleRows : [];
  const start = Math.max(0, Number(windowPlan.renderStart) || 0);
  const end = Math.max(start, Number(windowPlan.renderEnd) || start);
  const renderRows = rows.slice(start, end);
  const fragment = document.createDocumentFragment();
  const createRootDropZone = deps.createRootDropZone;
  const createPrototypeLibraryRow = deps.createPrototypeLibraryRow;
  const decorateVirtualLibraryRow = deps.decorateVirtualLibraryRow;
  if (typeof createRootDropZone !== 'function') throw new Error('library virtual window renderer missing createRootDropZone');
  if (typeof createPrototypeLibraryRow !== 'function') throw new Error('library virtual window renderer missing createPrototypeLibraryRow');
  if (typeof decorateVirtualLibraryRow !== 'function') throw new Error('library virtual window renderer missing decorateVirtualLibraryRow');
  fragment.append(createRootDropZone());
  fragment.append(createLibraryVirtualSpacer('top', windowPlan.topSpacerHeight || 0, start));
  renderRows.forEach(row => fragment.append(decorateVirtualLibraryRow(row, createPrototypeLibraryRow(app, row))));
  fragment.append(createLibraryVirtualSpacer('bottom', windowPlan.bottomSpacerHeight || 0, Math.max(0, rows.length - end)));
  return {
    pass: LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS,
    fragment,
    renderRows,
    start,
    end,
    renderedRows: renderRows.length,
    topSpacerHeight: Number(windowPlan.topSpacerHeight) || 0,
    bottomSpacerHeight: Number(windowPlan.bottomSpacerHeight) || 0
  };
}

export function applyLibraryVirtualWindowFragment(box, fragment, { previousScrollTop = 0, restoreScrollTop = true } = {}) {
  if (!box || typeof box.replaceChildren !== 'function') return { pass: LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS, applied: false, reason: 'missing-box' };
  const scrollTop = Math.max(0, Number(previousScrollTop) || 0);
  box.classList.add('library-virtual-active');
  box.dataset.libraryVirtualActive = '1';
  box.replaceChildren(fragment);
  const currentScrollTop = Number(box.scrollTop) || 0;
  let restoredScrollTop = false;
  if (restoreScrollTop && Math.abs(currentScrollTop - scrollTop) > 1) {
    box.scrollTop = scrollTop;
    restoredScrollTop = true;
  }
  return {
    pass: LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS,
    applied: true,
    restoredScrollTop,
    restoreScrollTop,
    singleAnchorRestorePass: restoreScrollTop ? '' : LIBRARY_VIRTUAL_ANCHOR_SINGLE_RESTORE_PASS
  };
}

export function renderLibraryVirtualWindowDom({ app, box, visibleRows = [], windowPlan = {}, previousScrollTop = 0, restoreScrollTop = true, deps = {} } = {}) {
  const fragmentResult = buildLibraryVirtualWindowFragment({ app, visibleRows, windowPlan, deps });
  const applyResult = applyLibraryVirtualWindowFragment(box, fragmentResult.fragment, { previousScrollTop, restoreScrollTop });
  return { ...fragmentResult, applyResult };
}

export function getLibraryVirtualWindowRendererContract() {
  return {
    pass: LIBRARY_VIRTUAL_WINDOW_RENDERER_PASS,
    owns: ['virtual-window-fragment', 'root-dropzone', 'top-spacer', 'visible-rows', 'bottom-spacer', 'box-virtual-active-state'],
    deps: ['createRootDropZone', 'createPrototypeLibraryRow', 'decorateVirtualLibraryRow'],
    nonGoals: ['virtual-gate', 'window-plan-computation', 'render-history-recording']
  };
}
