import { getVisibleSearchResultIndexes } from './filter-controls.mjs';

export const SEARCH_NAVIGATION_UI_SPLIT_PASS = 'v204-search-navigation-ui-split-pass';

export function syncSearchNavigationButtons(app) {
  const hasResults = getVisibleSearchResultIndexes(app).length > 0;
  [app.els.nsearchPrevBtn, app.els.searchNavRemotePrev, app.els.searchNavRemoteNext, app.els.searchNavRemoteOpen].forEach(button => {
    if (button) button.disabled = !hasResults;
  });
  if (app.els.nsearchNextBtn && !app.state.search.running) app.els.nsearchNextBtn.disabled = !hasResults;
}

export function ensureActiveSearchResultVisible(app) {
  const box = app.els.nsearchResults;
  const active = box?.querySelector?.('.nsr-item.active');
  if (!active) return;
  active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
