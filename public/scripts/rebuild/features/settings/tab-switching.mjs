export const SETTINGS_TAB_SWITCHING_HELPER_PASS = 'v233-settings-tab-switching-helper-pass';
export const SETTINGS_TAB_ACCESSIBILITY_PASS = 'v653-settings-tab-visibility-pass';
export const SETTINGS_MOBILE_PAGE_STATE_PASS = 'v656-settings-mobile-detail-state-pass';
const SETTINGS_TAB_STORAGE_KEY = 'txt-reader.settings.active-tab';


export function applySettingsMobilePageState(layout = null, view = 'index', options = {}) {
  if (!layout) return { applied:false, view:'index', mobile:false };
  const normalized = view === 'detail' ? 'detail' : 'index';
  const mobile = options?.mobile !== false;
  const nav = layout.querySelector?.('.settings-workspace-nav') || null;
  const main = layout.querySelector?.('.settings-workspace-main') || null;
  layout.dataset.mobileView = normalized;
  layout.classList?.toggle?.('is-mobile-detail', mobile && normalized === 'detail');
  layout.classList?.toggle?.('is-mobile-index', mobile && normalized !== 'detail');
  const setRegionState = (node, visible) => {
    if (!node) return;
    node.classList?.toggle?.('settings-mobile-hidden', mobile && !visible);
    node.setAttribute?.('aria-hidden', mobile && !visible ? 'true' : 'false');
    if (mobile && !visible) node.setAttribute?.('inert', '');
    else node.removeAttribute?.('inert');
  };
  if (mobile) {
    setRegionState(nav, normalized !== 'detail');
    setRegionState(main, normalized === 'detail');
  } else {
    setRegionState(nav, true);
    setRegionState(main, true);
  }
  return { applied:true, view:normalized, mobile, navVisible:!mobile || normalized !== 'detail', detailVisible:!mobile || normalized === 'detail' };
}

export function getSettingsTabPanelId(tab = null) {
  return String(tab?.dataset?.tab || '');
}

function rememberSettingsTab(panelId = '') {
  try {
    if (panelId) window.sessionStorage?.setItem?.(SETTINGS_TAB_STORAGE_KEY, panelId);
  } catch {}
}

export function activateSettingsTab(targetTab = null, tabs = [], panels = [], options = {}) {
  const panelId = getSettingsTabPanelId(targetTab);
  if (!targetTab || !panelId) return false;
  const tabList = Array.from(tabs || []).filter(Boolean);
  const panelList = Array.from(panels || []).filter(Boolean);
  const panelExists = panelList.some(panel => panel.id === panelId);
  if (!panelExists) return false;
  tabList.forEach(tab => {
    const active = tab === targetTab;
    tab.classList?.toggle?.('active', active);
    tab.setAttribute?.('aria-selected', active ? 'true' : 'false');
    tab.setAttribute?.('tabindex', active ? '0' : '-1');
  });
  panelList.forEach(panel => {
    const active = panel.id === panelId;
    panel.classList?.toggle?.('active', active);
    panel.setAttribute?.('aria-hidden', active ? 'false' : 'true');
    if (active) {
      panel.removeAttribute?.('hidden');
      try { panel.hidden = false; } catch {}
    } else if (options?.hideInactive !== false) {
      panel.setAttribute?.('hidden', '');
      try { panel.hidden = true; } catch {}
    }
    if (active && options?.resetScroll !== false) {
      panel.scrollTop = 0;
      const scrollOwner = panel.closest?.('.sp-body');
      if (scrollOwner) scrollOwner.scrollTop = 0;
    }
  });
  if (options?.remember !== false) rememberSettingsTab(panelId);
  return true;
}

export function activateSettingsTabById(panelId = '', tabs = [], panels = [], options = {}) {
  const id = String(panelId || '');
  const tab = Array.from(tabs || []).find(item => getSettingsTabPanelId(item) === id) || null;
  return activateSettingsTab(tab, tabs, panels, options);
}

export function restoreRememberedSettingsTab(tabs = [], panels = []) {
  let panelId = '';
  try { panelId = String(window.sessionStorage?.getItem?.(SETTINGS_TAB_STORAGE_KEY) || ''); } catch {}
  if (!panelId) return false;
  return activateSettingsTabById(panelId, tabs, panels, { remember: false, resetScroll: false });
}

export function handleSettingsTabKeydown(event, targetTab = null, tabs = [], panels = []) {
  const tabList = Array.from(tabs || []).filter(Boolean);
  const currentIndex = tabList.indexOf(targetTab);
  if (currentIndex < 0) return false;
  let nextIndex = currentIndex;
  if (event?.key === 'ArrowRight' || event?.key === 'ArrowDown') nextIndex = (currentIndex + 1) % tabList.length;
  else if (event?.key === 'ArrowLeft' || event?.key === 'ArrowUp') nextIndex = (currentIndex - 1 + tabList.length) % tabList.length;
  else if (event?.key === 'Home') nextIndex = 0;
  else if (event?.key === 'End') nextIndex = tabList.length - 1;
  else return false;
  event.preventDefault?.();
  const nextTab = tabList[nextIndex];
  activateSettingsTab(nextTab, tabList, panels);
  nextTab?.focus?.({ preventScroll: true });
  return true;
}
