import { byId, createEl, REBUILD_VERSION } from '../core/utils.mjs';
import { collectElements } from './ui/elements.mjs';
import { formatClockForPrefs } from './settings/controls.mjs';
import { installViewportFit, scheduleSafeAreaCollisionFit } from './ui/viewport-fit.mjs';
import { activateSettingsTab, activateSettingsTabById } from './settings/tab-switching.mjs';

const READER_OVERLAY_PASS = 'v140';
const MOBILE_LIBRARY_STABILITY_PASS = 'v146-mobile-library-sidebar-stability-pass';
const SITE_SIDEBAR_CLOSE_BINDING_PASS = 'v209-site-sidebar-close-binding-pass';
const PC_SITE_SIDEBAR_CLOSE_TOGGLE_PASS = 'v382-pc-site-sidebar-close-toggle-pass';
const APP_SHELL_INTERACTION_SMOKE_PASS = 'v211-app-shell-interaction-smoke-pass';
const TOAST_MODAL_VISIBILITY_PASS = 'v163-toast-modal-visibility-pass';
const SKELETON_UI_PASS = 'v417-skeleton-ui-pass';
const SKELETON_TIMING_PASS = 'v417-skeleton-timing-polish-pass';
const SKELETON_EMPTY_STATE_GUARD_PASS = 'v417-skeleton-empty-state-guard-pass';
const STATUS_PILL_FULLSCREEN_COMPACT_PASS = 'v462-status-pill-fullscreen-height-lock-pass';
const PILL_TOAST_FULLSCREEN_HEIGHT_LOCK_PASS = 'v464-pill-toast-fullscreen-height-lock-pass';
const PILL_STATUS_FULLSCREEN_STRICT_LOCK_PASS = 'v465-pill-status-fullscreen-strict-lock-pass';
const PILL_STATUS_FULLSCREEN_DOM_LOCK_PASS = 'v471-pill-status-fullscreen-dom-lock-pass';
const STATUS_PILL_BARS_VISIBILITY_ROLE_PASS = 'v478-status-pill-bars-visibility-role-pass';

export function installUi(app) {
  app.uiCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };

  app.els = collectElements();
  clearBootSkeleton();
  clearResolvedLazySkeletons(app);
  installViewportFit(app, { on });
  ensureStatusDock();
  const stopClock = startClock(app);
  if (typeof stopClock === 'function') disposers.push(stopClock);
  installGlobalErrorCapture(app, on);
  installMobileLibraryOverlayMode(app, on);
  installSidebar(app, on);
  installModalBasics(app, on);
  setNetworkBadge(app, 'normal', '보통');
  toast(app, 'info', app.isMobileProfile ? '모바일 페이지' : '사이트 페이지', `UI 유지 · ${REBUILD_VERSION}`);

  app.uiCleanup = () => {
    disposers.splice(0).forEach(dispose => {
      try { dispose(); } catch {}
    });
  };
}


function ensureStatusDock() {
  const existing = byId('ui-status-dock');
  if (existing) {
    markReaderOverlayNode(existing, 'status-dock');
    existing.dataset.pillStatusFullscreenDomLockPass = PILL_STATUS_FULLSCREEN_DOM_LOCK_PASS;
    existing.setAttribute('aria-live', 'polite');
    existing.setAttribute('aria-atomic', 'false');
    return existing;
  }
  const dock = createEl('div', { id: 'ui-status-dock' });
  markReaderOverlayNode(dock, 'status-dock');
  dock.dataset.pillStatusFullscreenDomLockPass = PILL_STATUS_FULLSCREEN_DOM_LOCK_PASS;
  dock.setAttribute('aria-live', 'polite');
  dock.setAttribute('aria-atomic', 'false');
  document.body.append(dock);
  return dock;
}

function markReaderOverlayNode(node, role) {
  if (!node) return;
  node.dataset.readerOverlayPass = READER_OVERLAY_PASS;
  if (role) node.dataset.readerOverlayRole = role;
}

export function toast(app, type, title, message, timeout = 2600) {
  let wrap = byId('toast-wrap');
  if (!wrap) {
    wrap = createEl('div', { id: 'toast-wrap' });
    document.body.append(wrap);
  }
  markReaderOverlayNode(wrap, 'toast-stack');
  wrap.dataset.toastLayerPass = 'v163';
  wrap.dataset.toastModalVisibilityPass = TOAST_MODAL_VISIBILITY_PASS;
  wrap.dataset.pillToastFullscreenHeightLockPass = PILL_TOAST_FULLSCREEN_HEIGHT_LOCK_PASS;
  wrap.dataset.pillStatusFullscreenStrictLockPass = PILL_STATUS_FULLSCREEN_STRICT_LOCK_PASS;
  wrap.dataset.pillStatusFullscreenDomLockPass = PILL_STATUS_FULLSCREEN_DOM_LOCK_PASS;
  wrap.setAttribute('aria-live', 'polite');
  wrap.setAttribute('aria-atomic', 'false');
  const el = createEl('div', { class: `toast toast-${type || 'info'}`, dataset: { pillToastCompactPass: PILL_TOAST_FULLSCREEN_HEIGHT_LOCK_PASS, pillStatusFullscreenStrictLockPass: PILL_STATUS_FULLSCREEN_STRICT_LOCK_PASS } }, [
    createEl('div', { class: 'toast-title', text: title || '' }),
    createEl('div', { class: 'toast-msg', text: message || '' })
  ]);
  wrap.append(el);
  requestAnimationFrame(() => el.classList.add('show'));
  window.setTimeout(() => {
    el.classList.remove('show');
    window.setTimeout(() => el.remove(), 260);
  }, timeout);
}

export function status(app, kind, message, timeout = 1800) {
  const dock = ensureStatusDock() || byId('ui-status-dock') || document.body.appendChild(createEl('div', { id: 'ui-status-dock' }));
  markReaderOverlayNode(dock, 'status-dock');
  const pill = createEl('div', { class: `ui-status-pill ${kind || ''}` }, [
    createEl('span', { class: 'dot' }),
    createEl('span', { class: 'txt', text: message || '' })
  ]);
  const isBarsVisibilityStatus =
    kind === 'reader' &&
    /상단\/하단바 (숨김|표시)/.test(String(message || ''));
  if (isBarsVisibilityStatus) {
    pill.dataset.statusPillRole = 'bars-visibility';
    pill.dataset.statusPillBarsVisibilityRolePass = STATUS_PILL_BARS_VISIBILITY_ROLE_PASS;
  }
  pill.dataset.statusPillCompactPass = STATUS_PILL_FULLSCREEN_COMPACT_PASS;
  pill.dataset.pillToastCompactPass = PILL_TOAST_FULLSCREEN_HEIGHT_LOCK_PASS;
  pill.dataset.pillStatusFullscreenStrictLockPass = PILL_STATUS_FULLSCREEN_STRICT_LOCK_PASS;
  pill.dataset.pillStatusFullscreenDomLockPass = PILL_STATUS_FULLSCREEN_DOM_LOCK_PASS;
  markReaderOverlayNode(pill, `status-pill-${kind || 'info'}`);
  dock.append(pill);
  requestAnimationFrame(() => pill.classList.add('show'));
  window.setTimeout(() => {
    pill.classList.remove('show');
    window.setTimeout(() => pill.remove(), 220);
  }, timeout);
}



export function showLoading(app, on) {
  const { loading, empty, reader, novelList } = app.els;
  if (loading) {
    loading.style.display = on ? 'flex' : 'none';
    loading.dataset.skeletonUiPass = SKELETON_UI_PASS;
  }
  if (novelList && on && !novelList.children.length) {
    novelList.replaceChildren(createLibrarySkeletonNode());
  }
  if (on) {
    if (empty) empty.style.display = 'none';
    if (reader) reader.style.display = 'none';
  }
}

function createLibrarySkeletonNode() {
  return createEl('div', { class:'library-skeleton', dataset:{ skeletonUiPass:SKELETON_UI_PASS }, 'aria-hidden':'true' }, [
    createEl('div', { class:'skeleton-line wide' }),
    createEl('div', { class:'skeleton-row' }),
    createEl('div', { class:'skeleton-row short' }),
    createEl('div', { class:'skeleton-line' }),
    createEl('div', { class:'skeleton-row' }),
    createEl('div', { class:'skeleton-row mid' })
  ]);
}

export function showReader(app, mode) {
  const { loading, empty, reader, navBar } = app.els;
  if (loading) loading.style.display = 'none';
  if (empty) empty.style.display = mode === 'empty' ? 'flex' : 'none';
  if (reader) reader.style.display = mode === 'reader' ? 'block' : 'none';
  if (navBar) navBar.classList.toggle('is-hidden', mode !== 'reader');
  clearResolvedLazySkeletons(app);
}


export function setToolbarTitle(app, text) {
  if (app.els.toolbarTitle) app.els.toolbarTitle.textContent = text || '소설을 선택하세요';
}

export function setNetworkBadge(app, mode, label) {
  const targets = [app.els.toolbarNetworkMode, app.els.nsearchNetworkMode].filter(Boolean);
  if (!targets.length) return;
  targets.forEach(el => {
    el.classList.remove('fast','normal','degraded','slow','offline');
    el.classList.add(mode || 'normal');
    const labelEl = el.querySelector('.label');
    if (labelEl) labelEl.textContent = label || '보통';
  });
}

function startClock(app) {
  const tick = () => {
    const now = new Date();
    if (app.els.safeClock) app.els.safeClock.textContent = formatClockForPrefs(app.state.prefs, now);
    if (app.els.safeClock) app.els.safeClock.style.display = app.state.prefs.showClock !== false ? 'inline-flex' : 'none';
    if (app.els.safeProgress) app.els.safeProgress.style.display = app.state.prefs.showProgress !== false ? 'inline-flex' : 'none';
    if (app.els.toolbarNetworkMode) app.els.toolbarNetworkMode.style.display = app.state.prefs.showNetwork !== false ? 'inline-flex' : 'none';
    scheduleSafeAreaCollisionFit(app, 'clock-tick');
  };
  tick();
  const timerId = window.setInterval(tick, 30_000);
  return () => window.clearInterval(timerId);
}

function installGlobalErrorCapture(app, on) {
  const push = (message, detail) => {
    app.state.errors.push({ ts: Date.now(), message, detail });
    if (app.state.errors.length > 80) app.state.errors.shift();
    console.error('[txt-reader:rebuild]', message, detail || '');
  };
  on(window, 'error', ev => push(ev.message || 'error', ev.error && ev.error.stack));
  on(window, 'unhandledrejection', ev => push('unhandled rejection', ev.reason && (ev.reason.stack || ev.reason.message || ev.reason)));
}

function installMobileLibraryOverlayMode(app, on) {
  const update = () => {
    let narrow = false;
    let coarse = false;
    try { narrow = window.matchMedia?.('(max-width: 820px)').matches; } catch {}
    try { coarse = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches; } catch {}
    const overlayMode = !!(app.isMobileProfile || narrow || coarse);
    document.body?.classList.toggle('mobile-library-overlay', overlayMode);
    if (document.body?.dataset) document.body.dataset.mobileLibraryStabilityPass = MOBILE_LIBRARY_STABILITY_PASS;
    if (!overlayMode) document.body?.classList.remove('library-open');
  };
  update();
  const queries = ['(max-width: 820px)', '(hover: none) and (pointer: coarse)']
    .map(q => { try { return window.matchMedia?.(q); } catch { return null; } })
    .filter(Boolean);
  queries.forEach(mq => on(mq, 'change', update));
  on(window, 'resize', update, { passive:true });
  on(window, 'orientationchange', update, { passive:true });
}

function installSidebar(app, on) {
  const { sidebar, overlay, menuBtn, sidebarCloseBtn } = app.els;
  const appRoot = () => app.els?.app || byId('app');
  if (sidebar?.dataset) {
    sidebar.dataset.mobileLibraryStabilityPass = MOBILE_LIBRARY_STABILITY_PASS;
    sidebar.dataset.appShellInteractionSmokePass = APP_SHELL_INTERACTION_SMOKE_PASS;
  }
  if (overlay?.dataset) overlay.dataset.mobileLibraryStabilityPass = MOBILE_LIBRARY_STABILITY_PASS;
  if (sidebarCloseBtn?.dataset) {
    sidebarCloseBtn.dataset.siteSidebarCloseBindingPass = SITE_SIDEBAR_CLOSE_BINDING_PASS;
    sidebarCloseBtn.dataset.appShellInteractionSmokePass = APP_SHELL_INTERACTION_SMOKE_PASS;
    sidebarCloseBtn.dataset.pcSiteSidebarCloseTogglePass = PC_SITE_SIDEBAR_CLOSE_TOGGLE_PASS;
  }
  let sidebarSwipe = null;
  const isOverlayMode = () => !!(app.isMobileProfile || document.body?.classList.contains("mobile-library-overlay"));
  const syncA11y = (open) => {
    const expanded = open ? "true" : "false";
    if (menuBtn) menuBtn.setAttribute("aria-expanded", expanded);
    if (sidebar) sidebar.setAttribute("aria-hidden", open || !isOverlayMode() ? "false" : "true");
  };
  const setSiteSidebarCollapsed = (collapsed) => {
    const next = !!collapsed;
    document.body?.classList.toggle("library-collapsed", next);
    appRoot()?.classList.toggle("sidebar-hidden", next);
    if (sidebar?.dataset) sidebar.dataset.siteSidebarCollapsed = next ? "true" : "false";
  };
  const isSiteSidebarCollapsed = () => !!(
    document.body?.classList.contains("library-collapsed")
    || appRoot()?.classList.contains("sidebar-hidden")
  );
  const open = (ev = null) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    setSiteSidebarCollapsed(false);
    if (sidebar) sidebar.classList.add("open");
    if (overlay && isOverlayMode()) overlay.classList.add("open");
    if (isOverlayMode()) document.body?.classList.add("library-open");
    else document.body?.classList.remove("library-open");
    syncA11y(true);
  };
  const close = (ev = null, meta = {}) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    if (sidebarCloseBtn?.dataset) sidebarCloseBtn.dataset.lastSidebarCloseSource = meta.source || 'programmatic';
    if (sidebar) sidebar.classList.remove("open");
    if (overlay) overlay.classList.remove("open");
    if (isOverlayMode()) {
      document.body?.classList.remove("library-open");
      setSiteSidebarCollapsed(false);
    } else {
      setSiteSidebarCollapsed(true);
    }
    syncA11y(false);
  };
  const toggle = (ev = null) => {
    ev?.preventDefault?.();
    ev?.stopPropagation?.();
    if (isOverlayMode()) {
      if (sidebar?.classList.contains("open")) close();
      else open();
      return;
    }
    if (isSiteSidebarCollapsed()) open();
    else close();
  };
  if (isOverlayMode()) setSiteSidebarCollapsed(false);
  syncA11y(!isOverlayMode() && !isSiteSidebarCollapsed());
  const closeFromSidebarButton = ev => close(ev, { source:'sidebar-close-button' });
  on(menuBtn, "click", toggle);
  on(sidebarCloseBtn, "pointerdown", closeFromSidebarButton, { capture:true });
  on(sidebarCloseBtn, "click", closeFromSidebarButton);
  on(sidebarCloseBtn, "pointerup", closeFromSidebarButton);
  on(overlay, "click", close);
  on(window, "keydown", ev => {
    if (ev.key !== 'Escape' || !isOverlayMode() || !sidebar?.classList.contains('open')) return;
    close(ev);
  });
  on(sidebar, 'pointerdown', ev => {
    if (!isOverlayMode() || !sidebar?.classList.contains('open') || ev.pointerType === 'mouse') return;
    sidebarSwipe = { id: ev.pointerId, x: ev.clientX, y: ev.clientY, moved: false };
  }, { passive:true });
  on(sidebar, 'pointermove', ev => {
    if (!sidebarSwipe || sidebarSwipe.id !== ev.pointerId) return;
    const dx = ev.clientX - sidebarSwipe.x;
    const dy = ev.clientY - sidebarSwipe.y;
    if (Math.abs(dx) + Math.abs(dy) > 8) sidebarSwipe.moved = true;
    if (dx < -58 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      close();
      sidebarSwipe = null;
    }
  }, { passive:true });
  on(sidebar, 'pointerup', ev => {
    if (sidebarSwipe?.id === ev.pointerId) sidebarSwipe = null;
  }, { passive:true });
  on(sidebar, 'pointercancel', ev => {
    if (sidebarSwipe?.id === ev.pointerId) sidebarSwipe = null;
  }, { passive:true });
  on(window, "resize", () => {
    if (isOverlayMode()) setSiteSidebarCollapsed(false);
    syncA11y(isOverlayMode() ? sidebar?.classList.contains("open") : !isSiteSidebarCollapsed());
  }, { passive:true });
  app.closeSidebar = close;
  app.openSidebar = open;
  app.toggleSidebar = toggle;
}

function installModalBasics(app, on) {
  const pairs = [
    ['settingsOverlay','settingsPanel'],
    ['bookmarkOverlay', 'bookmarkModal'],
    ['nsearchOverlay', 'nsearchPanel'],
    ['themeEditorOverlay', 'themeEditorModal'],
    ['preprocessEditorOverlay', 'preprocessEditorModal'],
    ['fontModalOverlay','fontModal'],
    ['readDataOverlay', 'readDataModal'],
    ['customCssOverlay', 'customCssPanel'],
    ['devdbgModalOverlay', 'devdbgModal'],
    ['recoveryCenterOverlay', 'recoveryCenterModal'],
    ['shortcutOverlay', 'shortcutPanel'],
    ['deviceManagementOverlay', 'deviceManagementModal']
  ];
  const defaultPanels = new Map(pairs.filter(([, panelKey]) => panelKey));
  const layerPairs = pairs.map(([overlayKey, panelKey]) => ({ overlayKey, panelKey }));
  const settingsChildLayerKeys = new Set([
    'themeEditorOverlay',
    'preprocessEditorOverlay',
    'fontModalOverlay',
    'readDataOverlay',
    'customCssOverlay',
    'devdbgModalOverlay',
    'recoveryCenterOverlay',
    'shortcutOverlay',
    'deviceManagementOverlay'
  ]);
  const modalFocusStack = [];
  const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ].join(',');
  const resolvePanelKey = (overlayKey, panelKey) => panelKey || defaultPanels.get(overlayKey) || null;
  const isLayerOpen = (overlayKey, panelKey = null) => {
    const resolvedPanelKey = resolvePanelKey(overlayKey, panelKey);
    return !!(app.els[overlayKey]?.classList.contains('open') || app.els[resolvedPanelKey]?.classList.contains('open'));
  };
  const getTopOpenLayer = () => [...layerPairs].reverse().find(({ overlayKey, panelKey }) => isLayerOpen(overlayKey, panelKey));
  const getFocusableElements = (panel) => Array.from(panel?.querySelectorAll?.(focusableSelector) || [])
    .filter(el => !el.hasAttribute('disabled') && el.getAttribute('aria-hidden') !== 'true')
    .filter(el => el.offsetParent !== null || el.getClientRects().length > 0 || el === document.activeElement);
  const refreshLayerState = () => {
    const openLayers = layerPairs
      .filter(({ overlayKey, panelKey }) => isLayerOpen(overlayKey, panelKey))
      .map(({ overlayKey }) => overlayKey);
    const settingsSubmodalOpen = openLayers.some(key => settingsChildLayerKeys.has(key));
    document.body?.classList.toggle('settings-submodal-open', settingsSubmodalOpen);
    document.body?.classList.toggle('modal-layer-open', openLayers.length > 0);
    document.body?.classList.toggle('modal-layer-scroll-locked', openLayers.length > 0);
    document.documentElement?.classList.toggle('modal-layer-scroll-locked', openLayers.length > 0);
    if (document.body?.dataset) {
      document.body.dataset.activeModalLayer = openLayers.at(-1) || '';
      document.body.dataset.modalLayerDepth = String(openLayers.length);
      document.body.dataset.modalA11yPass = 'v140';
    }
  };
  const updateLayerA11y = (overlay, panel, open) => {
    if (overlay) {
      overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
      overlay.dataset.modalA11yPass = 'v140';
    }
    if (!panel) return;
    panel.setAttribute('role', panel.getAttribute('role') || 'dialog');
    panel.dataset.modalA11yPass = 'v140';
    if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
    if (open) {
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-hidden', 'false');
      panel.dataset.layerVisible = 'true';
    } else {
      panel.setAttribute('aria-hidden', 'true');
      delete panel.dataset.layerVisible;
    }
  };
  const focusModalInitialElement = (panel) => {
    if (!panel) return;
    const explicit = panel.querySelector('[data-modal-initial-focus], [autofocus]');
    const focusables = getFocusableElements(panel);
    const target = explicit || focusables[0] || panel;
    try { target.focus({ preventScroll:true }); } catch {}
  };
  const restoreModalFocus = (overlayKey) => {
    const index = modalFocusStack.map(item => item.overlayKey).lastIndexOf(overlayKey);
    if (index < 0) return;
    const [{ previousFocus }] = modalFocusStack.splice(index, 1);
    if (!previousFocus || !previousFocus.isConnected) return;
    window.setTimeout(() => {
      const top = getTopOpenLayer();
      const topPanel = top && app.els[resolvePanelKey(top.overlayKey, top.panelKey)];
      if (topPanel && !topPanel.contains(previousFocus)) return;
      try { previousFocus.focus({ preventScroll:true }); } catch {}
    }, 0);
  };
  const trapFocusWithinPanel = (panel, ev) => {
    if (!panel) return;
    const focusables = getFocusableElements(panel);
    if (!focusables.length) {
      ev.preventDefault();
      try { panel.focus({ preventScroll:true }); } catch {}
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (!panel.contains(active)) {
      ev.preventDefault();
      try { (ev.shiftKey ? last : first).focus({ preventScroll:true }); } catch {}
      return;
    }
    if (ev.shiftKey && active === first) {
      ev.preventDefault();
      try { last.focus({ preventScroll:true }); } catch {}
    } else if (!ev.shiftKey && active === last) {
      ev.preventDefault();
      try { first.focus({ preventScroll:true }); } catch {}
    }
  };
  app.openLayer = (overlayKey, panelKey = null) => {
    const resolvedPanelKey = resolvePanelKey(overlayKey, panelKey);
    const overlay = app.els[overlayKey];
    const panel = app.els[resolvedPanelKey];
    const wasOpen = isLayerOpen(overlayKey, panelKey);
    if (!wasOpen) modalFocusStack.push({ overlayKey, panelKey: resolvedPanelKey, previousFocus: document.activeElement });
    overlay?.classList.add('open');
    panel?.classList.add('open');
    updateLayerA11y(overlay, panel, true);
    if (overlay) overlay.dataset.layerOpen = 'true';
    refreshLayerState();
    if (panel) window.setTimeout(() => {
      if (!panel.classList.contains('open')) return;
      focusModalInitialElement(panel);
    }, 0);
  };
  app.closeLayer = (overlayKey, panelKey = null) => {
    const resolvedPanelKey = resolvePanelKey(overlayKey, panelKey);
    const overlay = app.els[overlayKey];
    const panel = app.els[resolvedPanelKey];
    overlay?.classList.remove('open');
    panel?.classList.remove('open');
    updateLayerA11y(overlay, panel, false);
    if (overlay) delete overlay.dataset.layerOpen;
    refreshLayerState();
    restoreModalFocus(overlayKey);
  };
  const closeSettingsChildLayers = () => {
    [...layerPairs].reverse().forEach(({ overlayKey, panelKey }) => {
      if (settingsChildLayerKeys.has(overlayKey)) app.closeLayer(overlayKey, panelKey);
    });
  };
  pairs.forEach(([o, p]) => {
    updateLayerA11y(app.els[o], app.els[resolvePanelKey(o, p)], false);
    on(app.els[o], 'click', ev => {
      if (ev.target !== app.els[o]) return;
      const top = getTopOpenLayer();
      if (!top || top.overlayKey !== o) return;
      app.closeLayer(o, p);
    });
  });
  on(document, 'keydown', ev => {
    const top = getTopOpenLayer();
    if (!top) return;
    const topPanel = app.els[resolvePanelKey(top.overlayKey, top.panelKey)];
    if (ev.key === 'Tab') {
      trapFocusWithinPanel(topPanel, ev);
      return;
    }
    if (ev.key !== 'Escape') return;
    if (ev.defaultPrevented) return;
    ev.preventDefault();
    app.closeLayer(top.overlayKey, top.panelKey);
  });

  on(app.els.settingsBtn, 'click', () => app.openLayer('settingsOverlay', 'settingsPanel'));
  on(app.els.settingsClose, 'click', () => {
    closeSettingsChildLayers();
    app.closeLayer('settingsOverlay', 'settingsPanel');
  });
  on(app.els.openDeviceManagementBtn, 'click', () => app.openLayer('deviceManagementOverlay', 'deviceManagementModal'));
  on(app.els.deviceManagementClose, 'click', () => app.closeLayer('deviceManagementOverlay', 'deviceManagementModal'));
  app.els.tabs.forEach(tab => on(tab, 'click', () => {
    activateSettingsTab(tab, app.els.tabs, app.els.tabPanels);
  }));

  Array.from(document.querySelectorAll('.vsp-tab')).forEach(tab => on(tab, 'click', () => {
    const panelRoot = tab.closest('.sp-tab-panel') || document;
    const id = tab.dataset.ftab;
    if (!id) return;
    panelRoot.querySelectorAll('.vsp-tab').forEach(x => x.classList.toggle('active', x === tab));
    panelRoot.querySelectorAll('.vsp-panel').forEach(panel => panel.classList.toggle('active', panel.id === id));
  }));

  on(app.els.openSafeAreaSettingsBtn, 'click', () => openSafeAreaSettingsSection(app));
}

function openSafeAreaSettingsSection(app) {
  app.openLayer?.('settingsOverlay', 'settingsPanel');
  const tabs = Array.from(document.querySelectorAll('.sp-tab'));
  const panels = Array.from(document.querySelectorAll('.sp-tab-panel'));
  activateSettingsTabById('func-panel', tabs, panels);

  const statusTab = document.querySelector('.vsp-tab[data-ftab="fstatusbar-panel"]');
  const funcPanel = document.getElementById('func-panel');
  if (statusTab && funcPanel) {
    funcPanel.querySelectorAll('.vsp-tab').forEach(tab => tab.classList.toggle('active', tab === statusTab));
    funcPanel.querySelectorAll('.vsp-panel').forEach(panel => panel.classList.toggle('active', panel.id === 'fstatusbar-panel'));
  }

  window.setTimeout(() => {
    const target = document.getElementById('safe-area-fit-card') || document.getElementById('fstatusbar-panel');
    target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, 60);
}


function clearBootSkeleton() {
  const boot = byId('boot-skeleton');
  if (!boot) return;
  boot.dataset.skeletonTimingPolishPass = SKELETON_TIMING_PASS;
  requestAnimationFrame(() => boot.remove());
}

function clearResolvedLazySkeletons(app) {
  if (document.body?.dataset) {
    document.body.dataset.skeletonTimingPolishPass = SKELETON_TIMING_PASS;
    document.body.dataset.skeletonEmptyStateGuardPass = SKELETON_EMPTY_STATE_GUARD_PASS;
  }
  const list = app?.els?.syncDeviceList || byId('sync-device-list');
  if (list && list.children.length > 1) list.querySelectorAll('.settings-lazy-skeleton').forEach(node => node.remove());
  const summary = app?.els?.rdmSummary || byId('rdm-summary');
  if (summary && summary.children.length > 1) summary.querySelectorAll('.settings-lazy-skeleton').forEach(node => node.remove());
  const body = app?.els?.rdmBody || byId('rdm-body');
  if (body && body.children.length > 1) body.querySelectorAll('.settings-lazy-skeleton').forEach(node => node.remove());
  const preview = app?.els?.rdmImportPreview || byId('rdm-import-preview');
  if (preview?.dataset) preview.dataset.skeletonEmptyStateGuardPass = SKELETON_EMPTY_STATE_GUARD_PASS;
}
