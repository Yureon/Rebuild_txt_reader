const { requireAllMarkers } = require('./check-utils.js');
const FRONTEND_CHECK_APP_SHELL_GUARDS_PASS = 'v184-frontend-check-app-shell-guards-pass';

function getElementParentChainForIds(html, targetIds) {
  const ids = new Set(targetIds || []);
  const chains = new Map();
  const stack = [];
  const tagRe = /<\/?(?:div|section)\b[^>]*>/gi;
  let match;
  const getAttr = (tag, name) => {
    const found = tag.match(new RegExp("\\b" + name + "=[\\\"']([^\\\"']+)", "i"));
    return found ? found[1] : '';
  };
  while ((match = tagRe.exec(html))) {
    const tag = match[0];
    const tagNameMatch = tag.match(/^<\/?(\w+)/);
    const tagName = tagNameMatch ? tagNameMatch[1].toLowerCase() : '';
    if (!tagName) continue;
    if (!tag.startsWith('</')) {
      const entry = { tagName, id: getAttr(tag, 'id'), className: getAttr(tag, 'class') };
      if (ids.has(entry.id)) chains.set(entry.id, stack.map(item => item.id || item.tagName).concat(entry.id));
      stack.push(entry);
      continue;
    }
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      if (stack[i].tagName === tagName) {
        stack.splice(i);
        break;
      }
    }
  }
  return chains;
}

function runAppShellGuardChecks(ctx) {
  const {
    shellSource,
    siteHtmlSource,
    mobileHtmlSource,
    uiSource,
    librarySource
  } = ctx;

  ['preprocess-preset-select','preprocess-preset-apply','preprocess-preset-save','preprocess-preset-key-remove-noise','theme-custom-select','theme-custom-save','theme-custom-export','offline-download-status-minimize','offline-download-status-close','safe-viewport-auto-toggle','safe-top-extra-slider','safe-bottom-extra-slider','safe-inset-preset-btns','rdm-tabs','rdm-import-preview','rdm-export-btn','rdm-import-file','list-action-overlay','list-action-move','search-nav-remote','search-nav-remote-open','search-nav-remote-close','nsearch-retrybar','nsearch-retry-missing','nsearch-retry-failed','nsearch-coverage-refresh'].forEach((id) => {
    if (!shellSource.includes(`id="${id}"`)) throw new Error(`Missing rebuild UI id: ${id}`);
  });

  ['open-device-management-btn','device-management-overlay','device-management-modal','device-management-close','devdbg-library-virtual-btn'].forEach((id) => {
    if (!shellSource.includes(`id="${id}"`)) throw new Error(`Missing v103 Settings/DevDebug UI id: ${id}`);
  });
  if (!/class="[^"]*shortcut-settings-card/.test(shellSource)) throw new Error('Missing v103 shortcut data-adv-card wrapper');
  if (shellSource.includes('id="library-virtual-settings-card"')) throw new Error('v103 should move large list performance card out of Settings');
  ['library-virtual-settings-card','library-virtual-settings-status','library-virtual-settings-requested','library-virtual-settings-actual','library-virtual-settings-trial','library-virtual-settings-fallback','library-virtual-settings-diff','library-virtual-settings-readiness','library-virtual-settings-blockers','library-virtual-settings-lightweight','library-virtual-settings-final-audit','library-virtual-settings-note','library-virtual-settings-refresh','library-virtual-open-recovery-btn','library-virtual-copy-status-btn'].forEach((id) => {
    if (uiSource.includes(`'${id}'`)) throw new Error(`Stale Settings large-list element collector id must stay removed: ${id}`);
  });
  ['id="settings-panel-body" class="sp-body" data-settings-main-body="tabs" data-settings-tab-panels-owner="general viewer func" data-settings-containment-pass="v231"','data-settings-panel-level="sp-body-child"','data-settings-tab-body="general"','data-settings-tab-body="viewer"','data-settings-tab-body="func"','class="sp-tab-body"'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v229 Settings sp-body tab containment marker: ${marker}`);
  });
  if (shellSource.includes('class="sp-tab-body sp-body"')) throw new Error('Settings tab bodies must not reuse the scroll-owner sp-body class after v229');
  ['tap-nav-details-section','tap-speed-section','swipe-threshold-section'].forEach((id) => {
    if (!shellSource.includes(`id="${id}"`)) throw new Error(`Missing v229 functional control visibility wrapper: ${id}`);
  });
  ['data-control-dependent="tap-nav"','data-control-dependent="tap-anim"','data-control-dependent="swipe-nav"','func-dependent-control'].forEach((marker) => {
    if (!shellSource.includes(marker)) throw new Error(`Missing v230 functional dependent visibility marker: ${marker}`);
  });
  const settingsBodyIndex = shellSource.indexOf('id="settings-panel-body"');
  const generalPanelIndex = shellSource.indexOf('id="general-panel"');
  const viewerPanelIndex = shellSource.indexOf('id="viewer-panel"');
  const funcPanelIndex = shellSource.indexOf('id="func-panel"');
  const settingsCloseIndex = shellSource.indexOf('</section>', settingsBodyIndex);
  if (!(settingsBodyIndex >= 0 && settingsBodyIndex < generalPanelIndex && generalPanelIndex < viewerPanelIndex && viewerPanelIndex < funcPanelIndex && funcPanelIndex < settingsCloseIndex)) {
    throw new Error('Settings sp-body must contain general/viewer/func tab panels as ordered descendants after v230');
  }
  const settingsPanelChains = getElementParentChainForIds(shellSource, ['general-panel', 'viewer-panel', 'func-panel']);
  ['general-panel', 'viewer-panel', 'func-panel'].forEach((id) => {
    const chain = settingsPanelChains.get(id) || [];
    if (!chain.includes('settings-panel-body')) {
      throw new Error('Settings panel ' + id + ' must be nested inside #settings-panel-body.sp-body after v231');
    }
  });

  ['createLibraryDragDropHandlers','library-drag-drop.mjs','moveDraggedLibraryItem','library-root-dropzone','libraryDraggable','formatNovelMeta','closeSidebarAfterLibraryOpen'].forEach((marker) => {
    if (!librarySource.includes(marker)) throw new Error(`Missing library DnD marker: ${marker}`);
  });


  requireAllMarkers(shellSource, ['id="sidebar-close-btn"','aria-label="소설 목록 닫기"','id="menu-btn"','id="overlay"'], 'v211 app-shell interaction DOM');
  requireAllMarkers(uiSource, ['v211-app-shell-interaction-smoke-pass','SITE_SIDEBAR_CLOSE_BINDING_PASS','on(sidebarCloseBtn, "pointerdown"','on(sidebarCloseBtn, "click"','library-collapsed','library-open'], 'v211 app-shell interaction runtime');
  requireAllMarkers(siteHtmlSource, ['reader-site','scripts/rebuild/site.mjs'], 'v211 site shell profile');
  requireAllMarkers(mobileHtmlSource, ['reader-mobile','scripts/rebuild/mobile.mjs'], 'v211 mobile shell profile');
}

module.exports = {
  FRONTEND_CHECK_APP_SHELL_GUARDS_PASS,
  runAppShellGuardChecks
};
