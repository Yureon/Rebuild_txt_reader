export const SETTINGS_TAB_SWITCHING_HELPER_PASS = 'v233-settings-tab-switching-helper-pass';

export function getSettingsTabPanelId(tab = null) {
  return String(tab?.dataset?.tab || '');
}

export function activateSettingsTab(targetTab = null, tabs = [], panels = []) {
  const panelId = getSettingsTabPanelId(targetTab);
  if (!targetTab || !panelId) return false;
  const tabList = Array.from(tabs || []).filter(Boolean);
  const panelList = Array.from(panels || []).filter(Boolean);
  tabList.forEach(tab => tab.classList?.toggle?.('active', tab === targetTab));
  panelList.forEach(panel => panel.classList?.toggle?.('active', panel.id === panelId));
  return panelList.some(panel => panel.id === panelId);
}

export function activateSettingsTabById(panelId = '', tabs = [], panels = []) {
  const id = String(panelId || '');
  const tab = Array.from(tabs || []).find(item => getSettingsTabPanelId(item) === id) || null;
  return activateSettingsTab(tab, tabs, panels);
}
