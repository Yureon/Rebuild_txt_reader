export const V676_MODAL_FOCUS_MANAGER_PASS = 'v676-modal-stack-focus-manager-pass';
export const V675_MODAL_FOCUS_MANAGER_PASS = 'v675-modal-focus-manager-pass';

const modalStack = [];
let backgroundSnapshot = new Map();
let baseReturnFocus = null;

function focusableElements(root) {
  return Array.from(root?.querySelectorAll?.([
    'a[href]', 'button:not([disabled])', 'input:not([disabled])', 'select:not([disabled])',
    'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])'
  ].join(',')) || []).filter(node => !node.hidden && node.getAttribute('aria-hidden') !== 'true' && node.getClientRects?.().length !== 0);
}

function bodyChildFor(node) {
  let current = node;
  while (current?.parentElement && current.parentElement !== document.body) current = current.parentElement;
  return current?.parentElement === document.body ? current : node;
}

function rememberBodyChildren() {
  for (const node of Array.from(document.body?.children || [])) {
    if (backgroundSnapshot.has(node)) continue;
    backgroundSnapshot.set(node, { inert:!!node.inert, ariaHidden:node.getAttribute('aria-hidden') });
  }
}

function restoreNode(node, snapshot) {
  if (!node?.isConnected || !snapshot) return;
  try { node.inert = !!snapshot.inert; } catch {}
  if (snapshot.ariaHidden == null) node.removeAttribute('aria-hidden');
  else node.setAttribute('aria-hidden', snapshot.ariaHidden);
}

function syncModalEnvironment() {
  rememberBodyChildren();
  const top = modalStack[modalStack.length - 1] || null;
  const topBodyChild = top ? bodyChildFor(top.overlay) : null;
  if (!top) {
    for (const [node, snapshot] of backgroundSnapshot) restoreNode(node, snapshot);
    backgroundSnapshot = new Map();
    return;
  }
  for (const node of Array.from(document.body?.children || [])) {
    const snapshot = backgroundSnapshot.get(node) || { inert:false, ariaHidden:null };
    if (node === topBodyChild) {
      restoreNode(node, snapshot);
      continue;
    }
    try { node.inert = true; } catch {}
    node.setAttribute('aria-hidden', 'true');
  }
}

function focusRecord(record) {
  if (!record || record.closed) return;
  const target = typeof record.initialFocus === 'function' ? record.initialFocus() : record.initialFocus;
  (target || focusableElements(record.dialog)[0] || record.dialog)?.focus?.({ preventScroll:true });
}

export function getActiveModalCount() {
  return modalStack.filter(record => !record.closed).length;
}

export function activateModalFocus({ overlay, dialog, initialFocus = null, returnFocus = null, onRequestClose = null, accessibleName = '' } = {}) {
  if (!overlay || !dialog) return () => {};
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  if (!dialog.hasAttribute('tabindex')) dialog.setAttribute('tabindex', '-1');
  if (!dialog.hasAttribute('aria-label') && !dialog.hasAttribute('aria-labelledby') && accessibleName) dialog.setAttribute('aria-label', accessibleName);

  if (!modalStack.length) {
    backgroundSnapshot = new Map();
    baseReturnFocus = returnFocus || document.activeElement;
  }
  const record = {
    overlay,
    dialog,
    initialFocus,
    previousFocus:returnFocus || document.activeElement,
    onRequestClose,
    closed:false
  };
  modalStack.push(record);
  syncModalEnvironment();

  const onKeydown = event => {
    if (modalStack[modalStack.length - 1] !== record) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onRequestClose?.();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = focusableElements(dialog);
    if (!focusables.length) {
      event.preventDefault();
      dialog.focus({ preventScroll:true });
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      last.focus({ preventScroll:true });
    } else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
      event.preventDefault();
      first.focus({ preventScroll:true });
    }
  };
  document.addEventListener('keydown', onKeydown, true);
  requestAnimationFrame(() => focusRecord(record));

  return () => {
    if (record.closed) return;
    record.closed = true;
    document.removeEventListener('keydown', onKeydown, true);
    const index = modalStack.lastIndexOf(record);
    const wasTop = index === modalStack.length - 1;
    if (index >= 0) modalStack.splice(index, 1);
    syncModalEnvironment();
    requestAnimationFrame(() => {
      const top = modalStack[modalStack.length - 1] || null;
      if (top) {
        if (wasTop || !top.dialog.contains(document.activeElement)) focusRecord(top);
        return;
      }
      const target = baseReturnFocus?.isConnected ? baseReturnFocus : record.previousFocus;
      baseReturnFocus = null;
      target?.focus?.({ preventScroll:true });
    });
  };
}
