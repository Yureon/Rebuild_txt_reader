import { byId, createEl, REBUILD_VERSION } from '../core/utils.mjs';
import { collectElements } from './ui/elements.mjs';
import { formatClockForPrefs } from './settings/clock-format.mjs';
import { installViewportFit, scheduleSafeAreaCollisionFit } from './ui/viewport-fit.mjs';
import { buildLibraryPageUrlForReader } from './library-navigation-context.mjs';
import { activateSettingsTab, activateSettingsTabById, applySettingsMobilePageState, handleSettingsTabKeydown, restoreRememberedSettingsTab } from './settings/tab-switching.mjs';

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
  const pageLabel = app.isLibraryProfile ? '서재 페이지' : app.isMobileProfile ? '모바일 리더' : 'PC 리더';
  try {
    const seenKey = 'txt_reader_ui_build_seen';
    if (localStorage.getItem(seenKey) !== REBUILD_VERSION) {
      localStorage.setItem(seenKey, REBUILD_VERSION);
      toast(app, 'info', pageLabel, `업데이트 적용 · ${REBUILD_VERSION}`);
    }
  } catch {}

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
  dock.querySelectorAll('.ui-status-pill:not([data-status-pill-role="bars-visibility"])').forEach(existing => existing.remove());
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

function applyModeBadge(element, mode, label, title = '') {
  if (!element) return;
  element.classList.remove('fast','normal','degraded','slow','offline');
  element.classList.add(mode || 'normal');
  const labelEl = element.querySelector('.label');
  if (labelEl) labelEl.textContent = label || '보통';
  if (title) element.title = title;
}

export function setNetworkBadge(app, mode, label, title = '') {
  applyModeBadge(app.els.toolbarNetworkMode, mode, label, title);
}

export function setSearchModeBadge(app, mode, label, title = '') {
  applyModeBadge(app.els.nsearchNetworkMode, mode, label, title);
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
    const overlayMode = app.profile !== 'library' && !!(app.isMobileProfile || narrow || coarse);
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
  if (app.profile === 'library') {
    sidebar?.classList.add('open');
    sidebar?.setAttribute('aria-hidden', 'false');
    if (sidebarCloseBtn) sidebarCloseBtn.hidden = true;
    if (menuBtn) menuBtn.hidden = true;
    app.closeSidebar = () => false;
    app.openSidebar = () => true;
    app.toggleSidebar = () => true;
    return;
  }
  if (app.separateLibraryReaderPages) {
    sidebar?.classList.remove('open');
    sidebar?.setAttribute('aria-hidden', 'true');
    if (overlay) overlay.hidden = true;
    if (sidebarCloseBtn) sidebarCloseBtn.hidden = true;
    if (menuBtn) {
      menuBtn.textContent = '←';
      menuBtn.title = '서재로 돌아가기';
      menuBtn.setAttribute('aria-label', '서재로 돌아가기');
      on(menuBtn, 'click', event => {
        event.preventDefault();
        event.stopPropagation();
        window.location.assign(buildLibraryPageUrlForReader(app, { view:'shelf' }));
      });
    }
    app.closeSidebar = () => false;
    app.openSidebar = () => { window.location.assign(buildLibraryPageUrlForReader(app, { view:'shelf' })); return true; };
    app.toggleSidebar = app.openSidebar;
    return;
  }
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
    ['deviceManagementOverlay', 'deviceManagementModal'],
    ['siteLanguageEditorOverlay', 'siteLanguageEditorModal'],
    ['accountPasswordOverlay', 'accountPasswordModal']
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
    'deviceManagementOverlay',
    'siteLanguageEditorOverlay',
    'accountPasswordOverlay'
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
    if (overlayKey === 'settingsOverlay' && app.els[resolvedPanelKey]?.dataset?.settingsPresentation === 'page') {
      return !!app.els[resolvedPanelKey]?.classList.contains('open');
    }
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
  const assignNestedModalStack = (overlay, panel, overlayKey) => {
    const openElements = [];
    layerPairs.forEach(({ overlayKey:openOverlayKey, panelKey:openPanelKey }) => {
      if (openOverlayKey === overlayKey || !isLayerOpen(openOverlayKey, openPanelKey)) return;
      const openOverlay = app.els[openOverlayKey];
      const openPanel = app.els[resolvePanelKey(openOverlayKey, openPanelKey)];
      if (openOverlay) openElements.push(openOverlay);
      if (openPanel) openElements.push(openPanel);
    });
    if (!openElements.length) return;
    let maximum = 0;
    for (const element of openElements) {
      const parsed = Number.parseInt(window.getComputedStyle?.(element)?.zIndex || '', 10);
      if (Number.isFinite(parsed)) maximum = Math.max(maximum, parsed);
    }
    const overlayZ = Math.max(200, maximum + 10);
    const panelZ = overlayZ + 1;
    if (overlay) {
      overlay.style.setProperty('z-index', String(overlayZ), 'important');
      overlay.dataset.modalStackOverlay = 'v577';
      overlay.style.setProperty('--modal-stack-overlay-z', String(overlayZ));
    }
    if (panel) {
      panel.style.setProperty('z-index', String(panelZ), 'important');
      panel.dataset.modalStackPanel = 'v577';
      panel.style.setProperty('--modal-stack-panel-z', String(panelZ));
    }
  };
  const clearNestedModalStack = (overlay, panel) => {
    if (overlay?.dataset?.modalStackOverlay === 'v577') {
      overlay.style.removeProperty('z-index');
      overlay.style.removeProperty('--modal-stack-overlay-z');
      delete overlay.dataset.modalStackOverlay;
    }
    if (panel?.dataset?.modalStackPanel === 'v577') {
      panel.style.removeProperty('z-index');
      panel.style.removeProperty('--modal-stack-panel-z');
      delete panel.dataset.modalStackPanel;
    }
  };
  app.openLayer = (overlayKey, panelKey = null) => {
    const resolvedPanelKey = resolvePanelKey(overlayKey, panelKey);
    const overlay = app.els[overlayKey];
    const panel = app.els[resolvedPanelKey];
    const wasOpen = isLayerOpen(overlayKey, panelKey);
    if (!wasOpen) assignNestedModalStack(overlay, panel, overlayKey);
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
    clearNestedModalStack(overlay, panel);
    if (overlay) delete overlay.dataset.layerOpen;
    refreshLayerState();
    restoreModalFocus(overlayKey);
  };
  const closeSettingsChildLayers = () => {
    [...layerPairs].reverse().forEach(({ overlayKey, panelKey }) => {
      if (settingsChildLayerKeys.has(overlayKey) && isLayerOpen(overlayKey, panelKey)) app.closeLayer(overlayKey, panelKey);
    });
  };

  const SETTINGS_PAGE_HISTORY_KEY = 'txtReaderSettingsPageV654';
  const SETTINGS_PAGE_VIEW_KEY = 'txtReaderSettingsViewV654';
  const SETTINGS_CONTEXT_STORAGE_PREFIX = 'txt-reader.settings.active-tab.';
  const SETTINGS_MOBILE_MEDIA = '(max-width: 980px)';
  let settingsPagePreviousFocus = null;
  let settingsPageHistoryArmed = false;
  let settingsPageHistoryToken = '';
  let settingsPageAppA11yState = null;
  let settingsPageClosePending = false;
  const settingsPageMobileMedia = window.matchMedia?.(SETTINGS_MOBILE_MEDIA) || { matches:false };
  // Deferred settings markup is loaded after installUi(), so resolve every node lazily.
  const getSettingsPageLayout = () => app.els?.settingsPageLayout || document.getElementById('settings-page-layout');
  const getSettingsMobileBack = () => app.els?.settingsMobileBack || document.getElementById('settings-mobile-back');
  const getSettingsMobileTitle = () => app.els?.settingsMobileDetailTitle || document.getElementById('settings-mobile-detail-title');
  const getSettingsMobileDescription = () => app.els?.settingsMobileDetailDescription || document.getElementById('settings-mobile-detail-description');
  const getSettingsMobileScope = () => app.els?.settingsMobileScope || document.getElementById('settings-mobile-scope');
  const getSettingsPanelBody = () => app.els?.settingsPanelBody || document.getElementById('settings-panel-body');
  const SETTINGS_PANEL_META = {
    'general-panel':{ title:'일반', description:'앱 모양과 사이트 언어를 조정합니다.', scope:'계정 설정' },
    'viewer-panel':{ title:'읽기 화면', description:'글꼴, 색상과 본문 표시를 조정합니다.', scope:'공유 · 기기' },
    'func-panel':{ title:'조작 · 표시', description:'리더 동작과 상태 표시를 조정합니다.', scope:'공유 · 기기' },
    'data-panel':{ title:'데이터 · 계정', description:'기기, 백업과 계정 기능을 관리합니다.', scope:'계정 데이터' },
    'debug-panel':{ title:'고급', description:'기기, 독서 데이터, 사용자 CSS와 진단 도구를 관리합니다.', scope:'고급 설정' }
  };

  const isLibrarySettingsMobile = () => settingsPageMobileMedia.matches === true;
  const updateSettingsMobileHeader = panelId => {
    const meta = SETTINGS_PANEL_META[String(panelId || '')] || SETTINGS_PANEL_META['general-panel'];
    const title = getSettingsMobileTitle();
    const description = getSettingsMobileDescription();
    const scope = getSettingsMobileScope();
    if (title) title.textContent = meta.title;
    if (description) description.textContent = meta.description;
    if (scope) scope.textContent = meta.scope;
  };
  const setSettingsMobileView = (view, { tab = null } = {}) => {
    const layout = getSettingsPageLayout();
    if (!layout) return false;
    const normalized = view === 'detail' ? 'detail' : 'index';
    applySettingsMobilePageState(layout, normalized, { mobile:isLibrarySettingsMobile() });
    const panelId = tab?.dataset?.tab || settingsTabsForContext('library').find(item => item.classList.contains('active'))?.dataset?.tab || 'general-panel';
    updateSettingsMobileHeader(panelId);
    const body = getSettingsPanelBody();
    if (normalized === 'detail') {
      const activePanel = document.getElementById(panelId);
      activePanel?.removeAttribute?.('hidden');
      try { if (activePanel) activePanel.hidden = false; } catch {}
      body?.scrollTo?.({ top:0, behavior:'auto' });
      window.requestAnimationFrame?.(() => {
        try { (activePanel || body)?.focus?.({ preventScroll:true }); } catch {}
      });
    } else {
      window.requestAnimationFrame?.(() => {
        const activeTab = settingsTabsForContext('library').find(item => item.classList.contains('active')) || settingsTabsForContext('library')[0];
        try { activeTab?.focus?.({ preventScroll:true }); } catch {}
      });
    }
    return true;
  };

  const settingsContextIncludes = (node, context) => {
    const declared = String(node?.dataset?.settingsContexts || '').trim();
    if (!declared) return true;
    return declared.split(/\s+/).filter(Boolean).includes(context);
  };
  const settingsTabsForContext = context => Array.from(app.els.tabs || []).filter(tab => settingsContextIncludes(tab, context));
  const settingsPanelsForContext = context => Array.from(app.els.tabPanels || []).filter(panel => settingsContextIncludes(panel, context));
  const rememberSettingsContextTab = (context, panelId) => {
    try {
      if (context && panelId) window.sessionStorage?.setItem?.(`${SETTINGS_CONTEXT_STORAGE_PREFIX}${context}`, panelId);
    } catch {}
  };
  const restoreSettingsContextTab = context => {
    const tabs = settingsTabsForContext(context);
    const panels = settingsPanelsForContext(context);
    let panelId = '';
    try { panelId = String(window.sessionStorage?.getItem?.(`${SETTINGS_CONTEXT_STORAGE_PREFIX}${context}`) || ''); } catch {}
    const fallback = context === 'reader' ? 'viewer-panel' : 'general-panel';
    const target = tabs.find(tab => tab.dataset.tab === panelId) || tabs.find(tab => tab.dataset.tab === fallback) || tabs[0] || null;
    if (target) activateSettingsTab(target, tabs, panels, { remember:false, resetScroll:false });
    return target;
  };
  const setSettingsContext = context => {
    const normalized = context === 'reader' ? 'reader' : 'library';
    const panel = app.els.settingsPanel;
    if (!panel) return normalized;
    panel.dataset.settingsContext = normalized;
    Array.from(app.els.tabs || []).forEach(tab => {
      const available = settingsContextIncludes(tab, normalized);
      if (available) tab.removeAttribute?.('hidden');
      else tab.setAttribute?.('hidden', '');
      tab.hidden = !available;
      tab.setAttribute('aria-hidden', available ? 'false' : 'true');
      if (!available) {
        tab.classList.remove('active');
        tab.setAttribute('aria-selected', 'false');
        tab.setAttribute('tabindex', '-1');
      }
    });
    Array.from(app.els.tabPanels || []).forEach(tabPanel => {
      const available = settingsContextIncludes(tabPanel, normalized);
      if (available) tabPanel.removeAttribute?.('hidden');
      else tabPanel.setAttribute?.('hidden', '');
      tabPanel.hidden = !available;
      tabPanel.setAttribute('aria-hidden', available ? 'false' : 'true');
      if (!available) tabPanel.classList.remove('active');
    });
    const title = document.getElementById('settings-panel-title');
    const desc = document.getElementById('settings-panel-desc');
    const close = app.els.settingsClose;
    if (normalized === 'reader') {
      if (title) title.textContent = '리더 환경설정';
      if (desc) desc.textContent = '읽기 화면, 리더 조작과 표시, 개발자 디버그 설정을 조정합니다.';
      if (close) {
        close.textContent = '✕';
        close.classList.remove('settings-page-back');
        close.setAttribute('aria-label', '리더 환경설정 닫기');
        close.title = '닫기';
      }
    } else {
      if (title) title.textContent = '환경설정';
      if (desc) desc.textContent = '앱 모양, 읽기 화면, 조작과 표시, 데이터 및 계정 설정을 조정합니다.';
      if (close) {
        close.textContent = '← 서재';
        close.classList.add('settings-page-back');
        close.setAttribute('aria-label', '환경설정을 닫고 서재로 돌아가기');
        close.title = '서재로 돌아가기';
      }
    }
    restoreSettingsContextTab(normalized);
    return normalized;
  };
  const restoreSettingsPageAppA11y = () => {
    const root = app.els.app;
    if (!root || !settingsPageAppA11yState) return;
    if (settingsPageAppA11yState.ariaHidden == null) root.removeAttribute('aria-hidden');
    else root.setAttribute('aria-hidden', settingsPageAppA11yState.ariaHidden);
    if (!settingsPageAppA11yState.inert) root.removeAttribute('inert');
    settingsPageAppA11yState = null;
  };
  const finalizeSettingsPageClose = ({ restoreFocus = true } = {}) => {
    const panel = app.els.settingsPanel;
    const overlay = app.els.settingsOverlay;
    closeSettingsChildLayers();
    document.body?.classList.remove('settings-page-active');
    document.documentElement?.classList.remove('settings-page-active');
    overlay?.classList.remove('open');
    if (overlay) {
      overlay.setAttribute('aria-hidden', 'true');
      delete overlay.dataset.layerOpen;
    }
    panel?.classList.remove('open', 'settings-page');
    if (panel) {
      delete panel.dataset.settingsPresentation;
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'true');
      panel.setAttribute('aria-hidden', 'true');
      delete panel.dataset.layerVisible;
    }
    restoreSettingsPageAppA11y();
    refreshLayerState();
    settingsPageHistoryArmed = false;
    settingsPageHistoryToken = '';
    settingsPageClosePending = false;
    applySettingsMobilePageState(getSettingsPageLayout(), 'index', { mobile:isLibrarySettingsMobile() });
    const focusTarget = settingsPagePreviousFocus?.isConnected ? settingsPagePreviousFocus : app.els.librarySettingsPageBtn;
    settingsPagePreviousFocus = null;
    if (restoreFocus && focusTarget) window.setTimeout(() => {
      try { focusTarget.focus({ preventScroll:true }); } catch {}
    }, 0);
  };
  const closeLibrarySettingsPage = ({ fromPopState = false } = {}) => {
    if (!document.body?.classList.contains('settings-page-active')) return false;
    if (fromPopState) {
      finalizeSettingsPageClose();
      return true;
    }
    if (settingsPageHistoryArmed && settingsPageHistoryToken && history.state?.[SETTINGS_PAGE_HISTORY_KEY] === settingsPageHistoryToken) {
      settingsPageClosePending = true;
      try { history.back(); } catch { finalizeSettingsPageClose(); }
      return true;
    }
    finalizeSettingsPageClose();
    return true;
  };
  const openLibrarySettingsPage = () => {
    const panel = app.els.settingsPanel;
    const overlay = app.els.settingsOverlay;
    if (!panel) return false;
    if (document.body?.classList.contains('settings-page-active')) return true;
    if (overlay?.classList.contains('open')) app.closeLayer('settingsOverlay', 'settingsPanel');
    settingsPagePreviousFocus = document.activeElement;
    setSettingsContext('library');
    panel.dataset.settingsPresentation = 'page';
    panel.classList.add('open', 'settings-page');
    panel.setAttribute('role', 'main');
    panel.setAttribute('aria-modal', 'false');
    panel.setAttribute('aria-hidden', 'false');
    panel.dataset.layerVisible = 'true';
    overlay?.classList.remove('open');
    if (overlay) overlay.setAttribute('aria-hidden', 'true');
    document.body?.classList.add('settings-page-active');
    document.documentElement?.classList.add('settings-page-active');
    const root = app.els.app;
    if (root) {
      settingsPageAppA11yState = { ariaHidden:root.getAttribute('aria-hidden'), inert:root.hasAttribute('inert') };
      root.setAttribute('aria-hidden', 'true');
      root.setAttribute('inert', '');
    }
    try {
      settingsPageHistoryToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      history.pushState({
        ...(history.state || {}),
        [SETTINGS_PAGE_HISTORY_KEY]:settingsPageHistoryToken,
        [SETTINGS_PAGE_VIEW_KEY]:isLibrarySettingsMobile() ? 'index' : 'detail'
      }, '', location.href);
      settingsPageHistoryArmed = true;
    } catch {
      settingsPageHistoryToken = '';
      settingsPageHistoryArmed = false;
    }
    refreshLayerState();
    const activeTab = settingsTabsForContext('library').find(tab => tab.classList.contains('active')) || settingsTabsForContext('library')[0];
    if (isLibrarySettingsMobile()) setSettingsMobileView('index', { tab:activeTab });
    else {
      applySettingsMobilePageState(getSettingsPageLayout(), 'detail', { mobile:false });
      updateSettingsMobileHeader(activeTab?.dataset?.tab);
      window.setTimeout(() => {
        try { (activeTab || panel).focus({ preventScroll:true }); } catch {}
      }, 0);
    }
    return true;
  };
  const openReaderSettings = () => {
    if (document.body?.classList.contains('settings-page-active')) finalizeSettingsPageClose({ restoreFocus:false });
    const panel = app.els.settingsPanel;
    if (!panel) return false;
    panel.classList.remove('settings-page');
    delete panel.dataset.settingsPresentation;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    setSettingsContext('reader');
    app.openLayer('settingsOverlay', 'settingsPanel');
    return true;
  };
  app.openLibrarySettingsPage = openLibrarySettingsPage;
  app.closeLibrarySettingsPage = closeLibrarySettingsPage;
  app.openReaderSettings = openReaderSettings;
  on(window, 'popstate', () => {
    if (!document.body?.classList.contains('settings-page-active')) return;
    if (settingsPageClosePending) {
      finalizeSettingsPageClose();
      return;
    }
    closeLibrarySettingsPage({ fromPopState:true });
  });
  settingsPageMobileMedia.addEventListener?.('change', () => {
    if (!document.body?.classList.contains('settings-page-active')) return;
    const activeTab = settingsTabsForContext('library').find(item => item.classList.contains('active')) || settingsTabsForContext('library')[0];
    setSettingsMobileView(isLibrarySettingsMobile() ? 'index' : 'detail', { tab:activeTab });
  });

  const deferredBindings = new WeakMap();
  const onDeferred = (target, key, type, handler, options) => {
    if (!target) return;
    let keys = deferredBindings.get(target);
    if (!keys) {
      keys = new Set();
      deferredBindings.set(target, keys);
    }
    if (keys.has(key)) return;
    keys.add(key);
    on(target, type, handler, options);
  };
  const bindDeferredUi = () => {
    pairs.forEach(([o, p]) => {
      const overlay = app.els[o];
      const panel = app.els[resolvePanelKey(o, p)];
      updateLayerA11y(overlay, panel, false);
      onDeferred(overlay, `overlay-close:${o}`, 'click', ev => {
        if (ev.target !== app.els[o]) return;
        const top = getTopOpenLayer();
        if (!top || top.overlayKey !== o) return;
        app.closeLayer(o, p);
      });
    });

    onDeferred(app.els.settingsBtn, 'settings-open', 'click', () => app.openReaderSettings());
    onDeferred(app.els.librarySettingsPageBtn, 'library-settings-page-open', 'click', () => app.openLibrarySettingsPage());
    onDeferred(app.els.settingsClose, 'settings-close', 'click', () => {
      if (document.body?.classList.contains('settings-page-active')) {
        app.closeLibrarySettingsPage();
        return;
      }
      closeSettingsChildLayers();
      app.closeLayer('settingsOverlay', 'settingsPanel');
    });
    onDeferred(getSettingsMobileBack(), 'settings-mobile-back', 'click', () => {
      if (!document.body?.classList.contains('settings-page-active')) return;
      if (isLibrarySettingsMobile() && getSettingsPageLayout()?.dataset?.mobileView === 'detail') {
        setSettingsMobileView('index');
        return;
      }
      closeLibrarySettingsPage();
    });
    const openDeviceManagement = () => app.openLayer('deviceManagementOverlay', 'deviceManagementModal');
    onDeferred(app.els.openDeviceManagementBtn, 'device-open', 'click', openDeviceManagement);
    onDeferred(app.els.openDeviceManagementAdvancedBtn, 'device-open-advanced', 'click', openDeviceManagement);
    onDeferred(app.els.deviceManagementClose, 'device-close', 'click', () => app.closeLayer('deviceManagementOverlay', 'deviceManagementModal'));
    restoreRememberedSettingsTab(app.els.tabs || [], app.els.tabPanels || []);
    (app.els.tabs || []).forEach(tab => {
      onDeferred(tab, `settings-tab-click:${tab.id}`, 'click', () => {
        if (tab.hidden) return;
        const context = app.els.settingsPanel?.dataset?.settingsContext || 'library';
        const contextTabs = settingsTabsForContext(context);
        if (activateSettingsTab(tab, contextTabs, settingsPanelsForContext(context))) {
          rememberSettingsContextTab(context, tab.dataset.tab);
          if (context === 'library' && document.body?.classList.contains('settings-page-active') && isLibrarySettingsMobile()) {
            setSettingsMobileView('detail', { tab });
          } else if (context === 'library') updateSettingsMobileHeader(tab.dataset.tab);
        }
      });
      onDeferred(tab, `settings-tab-key:${tab.id}`, 'keydown', event => {
        const context = app.els.settingsPanel?.dataset?.settingsContext || 'library';
        handleSettingsTabKeydown(event, tab, settingsTabsForContext(context), settingsPanelsForContext(context));
      });
    });

    Array.from(document.querySelectorAll('.vsp-tab')).forEach(tab => onDeferred(tab, `vsp-tab:${tab.dataset.ftab || tab.id}`, 'click', () => {
      const panelRoot = tab.closest('.sp-tab-panel') || document;
      const id = tab.dataset.ftab;
      if (!id) return;
      panelRoot.querySelectorAll('.vsp-tab').forEach(x => x.classList.toggle('active', x === tab));
      panelRoot.querySelectorAll('.vsp-panel').forEach(panel => panel.classList.toggle('active', panel.id === id));
    }));

    onDeferred(app.els.openSafeAreaSettingsBtn, 'safe-area-open', 'click', () => openSafeAreaSettingsSection(app));
  };
  app.refreshDeferredUiBindings = bindDeferredUi;
  bindDeferredUi();
}

function openSafeAreaSettingsSection(app) {
  if (!document.body?.classList.contains('settings-page-active')) app.openReaderSettings?.();
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
