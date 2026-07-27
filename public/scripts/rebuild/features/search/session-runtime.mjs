import { setButtonBusy } from '../../core/utils.mjs';
import { updateSearchModeControls, resetSearchPerformanceCaches } from './filter-controls.mjs';
import { syncSearchNavigationButtons } from './navigation-ui.mjs';
import { applySearchSessionCoreReset, buildSearchContextResetRecord, buildSearchSessionResetSnapshot } from './session-reset.mjs';

export const SEARCH_SESSION_RUNTIME_BOUNDARY_PASS = 'v246-search-session-runtime-boundary-pass';

export function resetSearchRuntimeSession(app, reason = 'reset', options = {}, deps = {}) {
  if (!app?.state?.search) return false;
  const passes = deps.passes || {};
  const search = app.state.search;
  const previous = buildSearchSessionResetSnapshot(search, app.els?.nsearchInput?.value || '');
  applySearchSessionCoreReset(search, { remoteDismissed: options.remoteDismissed !== false });
  resetSearchPerformanceCaches(app);
  deps.resetRuntimeState?.(app, reason);
  search.lastSearchContextReset = buildSearchContextResetRecord({
    contextResetPass: passes.contextResetPass,
    triggerPass: options.triggerPass,
    reason,
    previous
  });
  if (app.els?.nsearchInput) app.els.nsearchInput.value = '';
  if (app.els?.nsearchCount) app.els.nsearchCount.textContent = '';
  if (app.els?.nsearchStatus) app.els.nsearchStatus.textContent = '검색어를 입력하세요.';
  setButtonBusy(app.els?.nsearchNextBtn, false);
  setButtonBusy(app.els?.nsearchRetryFailed, false);
  setButtonBusy(app.els?.nsearchRetryMissing, false);
  updateSearchModeControls(app);
  deps.renderResults?.(app);
  syncSearchNavigationButtons(app);
  return true;
}

export function resetSearchRuntimeForReaderChange(app, nextIdentity = {}, prevCurrent = null, deps = {}) {
  const passes = deps.passes || {};
  const prevNovelId = String(prevCurrent?.novel?.id || '');
  const nextNovelId = String(nextIdentity?.novel?.id || '');
  const prevEpisodeId = prevCurrent?.episode?.id == null ? '' : String(prevCurrent.episode.id);
  const nextEpisodeId = nextIdentity?.episode?.id == null ? '' : String(nextIdentity.episode.id);
  const changed = !!prevNovelId && !!nextNovelId && (prevNovelId !== nextNovelId || prevEpisodeId !== nextEpisodeId);
  if (!changed) return false;
  resetSearchRuntimeSession(app, 'reader-context-change', { triggerPass: passes.readerChangePass, remoteDismissed: true }, deps);
  app.state.search.lastSearchContextReset = {
    ...(app.state.search.lastSearchContextReset || {}),
    pass: passes.contextResetPass,
    triggerPass: passes.readerChangePass,
    reason: 'reader-context-change',
    previousReader: { novelId: prevNovelId, episodeId: prevEpisodeId },
    nextReader: { novelId: nextNovelId, episodeId: nextEpisodeId },
    at: Date.now()
  };
  return true;
}
