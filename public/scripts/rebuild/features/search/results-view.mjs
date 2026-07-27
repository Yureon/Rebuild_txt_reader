import { createEl, formatPercent, highlightEscapedText } from '../../core/utils.mjs';
import { SEARCH_PERFORMANCE_PASS, getSearchResultFilterSnapshot, formatSearchProgress } from './matcher.mjs';
import { buildSearchCountSummary, buildSearchEmptyFilterText, buildSearchFilterButtonLabel, buildSearchRemoteCountLabel, buildSearchRemoteText, buildSearchResultWindowStatus, buildSearchResultsStatusText, getSearchSourceLabel } from './filter-summary.mjs';

const SEARCH_REMOCON_OVERLAY_PASS = 'v140';
const SMALL_RESULT_LIMIT = 160;
const RESULT_WINDOW_SIZE = 96;
const RESULT_WINDOW_OVERSCAN = 16;
const RESULT_ROW_ESTIMATE = 74;
const RESULT_SCROLL_RERENDER_THRESHOLD = 10;
const SEARCH_RESULT_RENDER_SKIP_PASS = 'v145-search-result-render-skip-pass';
const SEARCH_CONTINUE_DURING_NAVIGATION_PASS = 'v365-search-continue-during-navigation-pass';
const SEARCH_SKELETON_UI_PASS = 'v417-search-skeleton-ui-pass';
const SEARCH_MODAL_MOBILE_LAYOUT_PASS = 'v647-search-modal-mobile-layout-pass';

export function renderResults(app, { jumpToResult, closeSearch, isSearchOpen } = {}) {
  const box = app.els.nsearchResults;
  const results = app.state.search.results || [];
  const filter = app.state.search.sourceFilter || 'all';
  const snapshot = getSearchResultFilterSnapshot(app, results, filter);
  const entries = snapshot.entries;
  const activeIndex = Number(app.state.search.activeIndex);
  const activePos = entries.findIndex(entry => entry.index === activeIndex);
  const activeLabel = activePos >= 0 ? activePos + 1 : (entries.length ? 1 : 0);
  const sourceCounts = snapshot.sourceCounts;
  const hasQuery = !!String(app.state.search.query || app.els?.nsearchInput?.value || '').trim();
  const layoutState = app.state.search.running
    ? 'running'
    : (results.length ? 'results' : (hasQuery ? 'empty' : 'idle'));
  if (app.els.nsearchPanel) {
    app.els.nsearchPanel.dataset.searchLayoutState = layoutState;
    app.els.nsearchPanel.dataset.searchModalMobileLayoutPass = SEARCH_MODAL_MOBILE_LAYOUT_PASS;
  }

  updateFilterBar(app, sourceCounts, filter);

  if (app.els.nsearchCount) {
    app.els.nsearchCount.textContent = buildSearchCountSummary(results.length, entries.length, filter);
  }
  if (app.els.nsearchStatus) {
    const shouldShowStatus = !!app.state.search.running || hasQuery || results.length > 0;
    if (shouldShowStatus) {
      const statsText = formatSearchProgress(app.state.search.stats, results.length, !app.state.search.running);
      app.els.nsearchStatus.textContent = buildSearchResultsStatusText({
        running: !!app.state.search.running,
        query: app.state.search.query,
        statsText,
        totalResults: results.length,
        visibleResults: entries.length,
        activeLabel,
        filter,
        windowed: entries.length > SMALL_RESULT_LIMIT
      });
      app.els.nsearchStatus.style.display = 'block';
    } else {
      app.els.nsearchStatus.textContent = '';
      app.els.nsearchStatus.style.display = 'none';
    }
  }
  updateRemoteDock(app, entries, activeLabel, filter, results.length);
  if (!box) return;
  if (!box.hasAttribute('tabindex')) box.tabIndex = 0;

  installResultDelegation(app, box, { jumpToResult, closeSearch, isSearchOpen });
  const previousScrollTop = Number(box.scrollTop) || 0;
  if (app.state.search.running && !results.length) {
    app.state.search.resultWindowStart = 0;
    delete box.dataset.searchVirtualized;
    box.dataset.searchSkeletonUiPass = SEARCH_SKELETON_UI_PASS;
    box.replaceChildren(createSearchSkeletonNode(app));
    return;
  }
  delete box.dataset.searchSkeletonUiPass;
  if (!results.length) {
    app.state.search.resultWindowStart = 0;
    delete box.dataset.searchVirtualized;
    delete box.dataset.searchRenderSignature;
    box.replaceChildren();
    box.append(createEl('div', { class:'nsr-empty', text: app.state.search.query ? '일치하는 결과가 없습니다.' : '검색어를 입력하면 결과가 표시됩니다.' }));
    return;
  }
  if (!entries.length) {
    app.state.search.resultWindowStart = 0;
    delete box.dataset.searchVirtualized;
    delete box.dataset.searchRenderSignature;
    box.replaceChildren();
    box.append(createEl('div', { class:'nsr-empty', text: buildSearchEmptyFilterText(filter) }));
    return;
  }

  const windowState = resolveResultWindow(app, entries.length, activePos, box);
  const { start, end, virtualized, targetScrollTop } = windowState;
  if (virtualized) box.dataset.searchVirtualized = '1';
  else delete box.dataset.searchVirtualized;

  const renderSignature = buildResultRenderSignature({ snapshot, filter, activeIndex, start, end, virtualized, running: !!app.state.search.running, query: app.state.search.query });
  if (box.dataset.searchRenderSignature === renderSignature) {
    if (virtualized && Number.isFinite(targetScrollTop)) setProgrammaticScroll(box, targetScrollTop);
    return;
  }
  box.dataset.searchRenderSignature = renderSignature;
  box.dataset.searchRenderSkipPass = SEARCH_RESULT_RENDER_SKIP_PASS;

  const fragment = document.createDocumentFragment();
  if (virtualized) {
    fragment.append(createEl('div', {
      class:'nsr-window-status',
      text:buildSearchResultWindowStatus({ start, end, visibleResults:entries.length, renderedCount:end - start, activeLabel })
    }));
    if (start > 0) fragment.append(createEl('div', { class:'nsr-virtual-spacer', style:`height:${start * RESULT_ROW_ESTIMATE}px` }));
  }
  for (let pos = start; pos < end; pos += 1) {
    fragment.append(renderResultItem(app, entries[pos]));
  }
  if (virtualized && end < entries.length) {
    fragment.append(createEl('div', { class:'nsr-virtual-spacer', style:`height:${Math.max(0, entries.length - end) * RESULT_ROW_ESTIMATE}px` }));
  }
  box.replaceChildren();
  box.append(fragment);

  if (virtualized) {
    const nextScrollTop = Number.isFinite(targetScrollTop) ? targetScrollTop : previousScrollTop;
    setProgrammaticScroll(box, nextScrollTop);
  } else if (typeof isSearchOpen !== 'function' || isSearchOpen()) {
    ensureActiveResultVisible(box);
  }
}

function createSearchSkeletonNode(app) {
  const mode = app?.state?.search?.cacheOnly ? '표시중/캐시 범위를 검색 중입니다' : '서버 전체검색을 진행 중입니다';
  return createEl('div', { class:'search-skeleton', dataset:{ skeletonUiPass:SEARCH_SKELETON_UI_PASS }, 'aria-live':'polite' }, [
    createEl('div', { class:'search-skeleton-title', text:mode }),
    createEl('div', { class:'skeleton-line wide', 'aria-hidden':'true' }),
    createEl('div', { class:'skeleton-line', 'aria-hidden':'true' }),
    createEl('div', { class:'skeleton-line mid', 'aria-hidden':'true' }),
    createEl('div', { class:'skeleton-line wide', 'aria-hidden':'true' })
  ]);
}

function renderResultItem(app, entry) {
  const r = entry.result;
  const idx = entry.index;
  return createEl('div', {
    class:`nsr-item${idx === app.state.search.activeIndex ? ' active' : ''}`,
    role:'button',
    tabindex:'0',
    title:`검색 결과 ${idx + 1}번으로 이동`,
    dataset:{ index:idx }
  }, [
    createEl('div', { class:'nsr-meta' }, [
      createEl('span', { text:`#${idx + 1}` }),
      createEl('span', { text:`위치 ${formatPercent(r.documentRatio || 0, 1)}` }),
      createEl('span', { class:'nsr-source', text:getSearchSourceLabel(r.source) }),
      createEl('span', { text:r.title || '' })
    ]),
    createEl('div', { class:'nsr-excerpt', safeHtml: markExcerpt(r.excerpt, r.query) })
  ]);
}

function installResultDelegation(app, box, callbacks) {
  app.state.search.resultCallbacks = callbacks;
  if (box.dataset.delegatedSearchResults === '1') return;
  box.dataset.delegatedSearchResults = '1';
  const onClick = async ev => {
    const target = ev.target instanceof Element ? ev.target : null;
    if (!target) return;
    const item = target.closest('.nsr-item');
    if (!item || !box.contains(item)) return;
    await activateClickedResult(app, item, callbacks);
  };
  const onKeyDown = async ev => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    const target = ev.target instanceof Element ? ev.target.closest('.nsr-item') : null;
    if (!target || !box.contains(target)) return;
    ev.preventDefault();
    await activateClickedResult(app, target, app.state.search.resultCallbacks || callbacks || {});
  };
  const onScroll = () => {
    if (box.dataset.searchVirtualized !== '1' || box.dataset.programmaticSearchScroll === '1') return;
    if (app.state.search.resultScrollRaf) return;
    app.state.search.resultScrollRaf = window.requestAnimationFrame(() => {
      app.state.search.resultScrollRaf = 0;
      if (box.dataset.searchVirtualized !== '1' || box.dataset.programmaticSearchScroll === '1') return;
      const snapshot = getSearchResultFilterSnapshot(app, app.state.search.results || [], app.state.search.sourceFilter || 'all');
      const len = snapshot.entries.length;
      const nextStart = estimateWindowStartFromScroll(box.scrollTop, len);
      const currentStart = Number(app.state.search.resultWindowStart) || 0;
      if (Math.abs(nextStart - currentStart) < RESULT_SCROLL_RERENDER_THRESHOLD) return;
      app.state.search.resultWindowStart = nextStart;
      renderResults(app, app.state.search.resultCallbacks || callbacks || {});
    });
  };
  box.addEventListener('click', onClick);
  box.addEventListener('keydown', onKeyDown);
  box.addEventListener('scroll', onScroll, { passive:true });
  app.searchResultCleanup = () => {
    box.removeEventListener('click', onClick);
    box.removeEventListener('keydown', onKeyDown);
    box.removeEventListener('scroll', onScroll);
    if (app.state.search?.resultScrollRaf) window.cancelAnimationFrame(app.state.search.resultScrollRaf);
    delete box.dataset.delegatedSearchResults;
    delete box.dataset.searchVirtualized;
    delete box.dataset.programmaticSearchScroll;
    delete box.dataset.searchRenderSignature;
    delete box.dataset.searchRenderSkipPass;
    if (app.state.search) {
      app.state.search.resultCallbacks = null;
      app.state.search.resultScrollRaf = 0;
    }
    app.searchResultCleanup = null;
  };
}

async function activateClickedResult(app, item, callbacks) {
  const idx = Number(item.dataset.index);
  if (!Number.isFinite(idx)) return;
  const { jumpToResult, closeSearch } = callbacks || app.state.search.resultCallbacks || {};
  app.state.search.activeIndex = idx;
  app.state.search.remoteDismissed = false;
  app.state.search.lastJumpAt = Date.now();
  renderResults(app, app.state.search.resultCallbacks || callbacks || {});
  if (typeof closeSearch === 'function') closeSearch({ abort:false, reason:'result-navigation' });
  app.state.search.continueDuringNavigationPass = SEARCH_CONTINUE_DURING_NAVIGATION_PASS;
  if (typeof jumpToResult === 'function') {
    try { await jumpToResult(idx); }
    catch (error) {
      app.state.errors?.push?.({ ts: Date.now(), message:'검색 결과 이동 실패', detail: error && (error.stack || error.message || String(error)) });
    }
  }
}

function updateRemoteDock(app, entries, activeLabel, filter, totalResults) {
  const remote = app.els.searchNavRemote;
  if (!remote) {
    document.body?.classList?.remove?.('search-remocon-open');
    return;
  }
  const visible = entries.length > 0 && !app.state.search.remoteDismissed;
  remote.dataset.readerOverlayPass = SEARCH_REMOCON_OVERLAY_PASS;
  remote.dataset.readerOverlayState = visible ? 'open' : 'closed';
  document.body?.classList?.toggle?.('search-remocon-open', visible);
  remote.classList.toggle('open', visible);
  remote.setAttribute('aria-hidden', visible ? 'false' : 'true');
  if (app.els.searchNavRemoteCount) {
    app.els.searchNavRemoteCount.textContent = buildSearchRemoteCountLabel(activeLabel, entries.length, filter);
  }
  if (app.els.searchNavRemoteText) {
    app.els.searchNavRemoteText.textContent = buildSearchRemoteText(app.state.search.query, filter, totalResults);
    app.els.searchNavRemoteText.title = app.els.searchNavRemoteText.textContent;
  }
}

function updateFilterBar(app, counts, filter) {
  const bar = app.els.nsearchFilterbar;
  if (!bar) return;
  const total = Number(counts.all) || 0;
  bar.hidden = total <= 0;
  bar.querySelectorAll('.nsearch-filter-btn').forEach(button => {
    const value = button.dataset.nsearchFilter || 'all';
    const count = Number(counts[value]) || 0;
    button.classList.toggle('active', value === filter);
    button.disabled = value !== 'all' && count <= 0;
    button.textContent = buildSearchFilterButtonLabel(value, count, total);
  });
}

function buildResultRenderSignature({ snapshot, filter, activeIndex, start, end, virtualized, running, query }) {
  return [
    SEARCH_PERFORMANCE_PASS,
    SEARCH_RESULT_RENDER_SKIP_PASS,
    Number(snapshot?.serial) || 0,
    String(filter || 'all'),
    Number.isFinite(Number(activeIndex)) ? Number(activeIndex) : -1,
    Number(start) || 0,
    Number(end) || 0,
    virtualized ? 'v' : 'f',
    running ? 'run' : 'idle',
    String(query || '')
  ].join('|');
}


function ensureActiveResultVisible(box) {
  const active = box?.querySelector?.('.nsr-item.active');
  if (!active) return;
  active.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function resolveResultWindow(app, length, activePos, box) {
  if (length <= SMALL_RESULT_LIMIT) {
    app.state.search.resultWindowStart = 0;
    return { start: 0, end: length, virtualized:false, targetScrollTop:null };
  }
  const followActive = shouldFollowActive(app, activePos);
  const startFromScroll = estimateWindowStartFromScroll(box?.scrollTop || 0, length);
  let start = followActive
    ? clampWindowStart(activePos - Math.floor(RESULT_WINDOW_SIZE / 3), length)
    : clampWindowStart(Number(app.state.search.resultWindowStart ?? startFromScroll) || startFromScroll, length);
  if (!followActive) start = startFromScroll;
  const end = Math.min(length, start + RESULT_WINDOW_SIZE);
  app.state.search.resultWindowStart = start;
  const targetScrollTop = followActive ? Math.max(0, activePos * RESULT_ROW_ESTIMATE - Math.round((box?.clientHeight || 360) * 0.38)) : null;
  return { start, end, virtualized:true, targetScrollTop };
}

function shouldFollowActive(app, activePos) {
  if (!Number.isFinite(activePos) || activePos < 0) return false;
  const lastJumpAt = Number(app.state.search.lastJumpAt) || 0;
  if (!lastJumpAt) return false;
  return Date.now() - lastJumpAt < 1800;
}

function estimateWindowStartFromScroll(scrollTop, length) {
  const rowStart = Math.floor(Math.max(0, Number(scrollTop) || 0) / RESULT_ROW_ESTIMATE);
  return clampWindowStart(rowStart - RESULT_WINDOW_OVERSCAN, length);
}

function clampWindowStart(value, length) {
  const maxStart = Math.max(0, length - RESULT_WINDOW_SIZE);
  return Math.max(0, Math.min(maxStart, Math.round(Number(value) || 0)));
}

function setProgrammaticScroll(box, value) {
  if (!box) return;
  box.dataset.programmaticSearchScroll = '1';
  box.scrollTop = Math.max(0, Number(value) || 0);
  window.requestAnimationFrame(() => { delete box.dataset.programmaticSearchScroll; });
}

function markExcerpt(text, q) {
  return highlightEscapedText(text, q, false);
}
