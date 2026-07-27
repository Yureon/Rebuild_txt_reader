(function installScrollToTopControl() {
  'use strict';
  var PASS = 'v645-scroll-to-top-reader-suppression-pass';
  var SHOW_THRESHOLD = 360;
  var activeRoot = null;
  var button = null;
  var frame = 0;
  var observer = null;
  var lastScrolledRoot = null;

  function documentRoot() {
    return document.scrollingElement || document.documentElement || document.body;
  }

  function isElement(value) {
    return !!(value && value.nodeType === 1);
  }

  function isVisibleElement(node) {
    if (!isElement(node) || !node.isConnected || node.hidden) return false;
    var current = node;
    while (current && current !== document.documentElement) {
      if (current.hidden || current.getAttribute && current.getAttribute('aria-hidden') === 'true') return false;
      current = current.parentElement;
    }
    try {
      if (typeof window.getComputedStyle === 'function') {
        var style = window.getComputedStyle(node);
        if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
      }
    } catch (_) {}
    return true;
  }

  function isScrollable(root) {
    if (!root) return false;
    if (root === documentRoot()) return true;
    return isVisibleElement(root) && Number(root.scrollHeight || 0) - Number(root.clientHeight || 0) > 8;
  }


  function isReaderScrollRoot(root) {
    if (!root || !isElement(root)) return false;
    if (root.id === 'reader' || root.classList?.contains?.('reader')) return true;
    return !!root.closest?.('.reader');
  }

  function scrollTopOf(root) {
    if (!root) return 0;
    if (root === document || root === window) root = documentRoot();
    return Math.max(0, Number(root.scrollTop || 0));
  }

  function resolveScrollRoot(target) {
    if (!target || target === document || target === window) return documentRoot();
    if (isScrollable(target)) return target;
    var current = isElement(target) ? target.parentElement : null;
    while (current && current !== document.body) {
      if (isScrollable(current)) return current;
      current = current.parentElement;
    }
    return documentRoot();
  }

  function visibleOverlayRoot() {
    var selectors = [
      '.library-metadata-overlay:not([hidden]) .library-metadata-body',
      '.library-metadata-overlay:not([hidden])',
      '.metadata-browser-login-modal.open .metadata-browser-screen-wrap',
      '.metadata-browser-login-modal.open .metadata-browser-login-card',
      '.settings-submodal.open .settings-submodal-body',
      '.modal.open .modal-body',
      '[role="dialog"][aria-modal="true"]:not([hidden]) .modal-body',
      '[role="dialog"][aria-modal="true"]:not([hidden]) [data-scroll-to-top-root]'
    ];
    var roots = [];
    for (var index = 0; index < selectors.length; index += 1) {
      var nodes = document.querySelectorAll(selectors[index]);
      for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
        if (isVisibleElement(nodes[nodeIndex]) && roots.indexOf(nodes[nodeIndex]) < 0) roots.push(nodes[nodeIndex]);
      }
    }
    roots.sort(function (left, right) {
      return scrollTopOf(right) - scrollTopOf(left)
        || Number(isScrollable(right)) - Number(isScrollable(left));
    });
    return roots[0] || null;
  }

  function bestVisibleRoot() {
    var overlayRoot = visibleOverlayRoot();
    if (overlayRoot) return overlayRoot;
    var roots = [documentRoot()];
    var selectors = [
      '[data-scroll-to-top-root]', '.sidebar', '#novel-list', '.metadata-work-list', '.metadata-work-detail',
      '.library-metadata-body', '.admin-users-main', '.modal-body', '.settings-body', '.settings-submodal-body'
    ];
    for (var index = 0; index < selectors.length; index += 1) {
      var nodes = document.querySelectorAll(selectors[index]);
      for (var nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
        if (isScrollable(nodes[nodeIndex])) roots.push(nodes[nodeIndex]);
      }
    }
    roots.sort(function (left, right) { return scrollTopOf(right) - scrollTopOf(left); });
    return roots[0] || documentRoot();
  }

  function updateStackingMode(root) {
    if (!button || !document.body) return;
    var overlay = visibleOverlayRoot();
    document.body.classList.toggle('scroll-top-overlay-active', !!overlay && root === overlay);
    var fullscreen = false;
    try { fullscreen = !!document.fullscreenElement || document.body.classList.contains('fullscreen-fallback'); } catch (_) {}
    document.body.classList.toggle('scroll-top-fullscreen-active', fullscreen);
  }

  function updateButton(root) {
    var overlayRoot = visibleOverlayRoot();
    if (overlayRoot) activeRoot = overlayRoot;
    else if (root && isScrollable(root)) activeRoot = root;
    if (!activeRoot || (isElement(activeRoot) && (!activeRoot.isConnected || !isVisibleElement(activeRoot)))) activeRoot = null;
    if (!activeRoot && lastScrolledRoot && isScrollable(lastScrolledRoot) && scrollTopOf(lastScrolledRoot) > 0) activeRoot = lastScrolledRoot;
    if (!activeRoot) activeRoot = bestVisibleRoot();
    var visible = !isReaderScrollRoot(activeRoot) && isScrollable(activeRoot) && scrollTopOf(activeRoot) >= SHOW_THRESHOLD;
    if (!button) return;
    button.hidden = !visible;
    button.setAttribute('aria-hidden', visible ? 'false' : 'true');
    document.documentElement.dataset.scrollToTopVisible = visible ? '1' : '0';
    updateStackingMode(activeRoot);
  }

  function scheduleUpdate(root) {
    if (root && isScrollable(root)) { activeRoot = root; if (scrollTopOf(root) > 0) lastScrolledRoot = root; }
    if (frame) return;
    frame = window.requestAnimationFrame(function () {
      frame = 0;
      updateButton(activeRoot || bestVisibleRoot());
    });
  }

  function scrollActiveRootToTop() {
    var overlayRoot = visibleOverlayRoot();
    var root = overlayRoot || (activeRoot && isScrollable(activeRoot) ? activeRoot : bestVisibleRoot());
    var reduceMotion = false;
    try { reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (_) {}
    try {
      if (root && typeof root.scrollTo === 'function') root.scrollTo({ top:0, left:0, behavior:reduceMotion ? 'auto' : 'smooth' });
      else if (root) root.scrollTop = 0;
    } catch (_) {
      if (root) root.scrollTop = 0;
    }
    activeRoot = root;
    window.setTimeout(function () { scheduleUpdate(root); }, reduceMotion ? 0 : 260);
  }

  function init() {
    if (document.getElementById('txt-reader-scroll-top')) return;
    button = document.createElement('button');
    button.id = 'txt-reader-scroll-top';
    button.className = 'txt-reader-scroll-top';
    button.type = 'button';
    button.hidden = true;
    button.setAttribute('aria-label', '맨 위로 이동');
    button.setAttribute('title', '맨 위로 이동');
    button.setAttribute('aria-hidden', 'true');
    button.textContent = '↑';
    button.addEventListener('click', scrollActiveRootToTop);
    (document.body || document.documentElement).appendChild(button);
    document.documentElement.dataset.scrollToTopPass = PASS;
    if (document.querySelector('.nav-bar')) document.body.classList.add('scroll-top-reader-nav');

    document.addEventListener('scroll', function (event) {
      scheduleUpdate(resolveScrollRoot(event.target));
    }, { capture:true, passive:true });
    window.addEventListener('scroll', function () { scheduleUpdate(documentRoot()); }, { passive:true });
    window.addEventListener('resize', function () { scheduleUpdate(bestVisibleRoot()); }, { passive:true });
    document.addEventListener('fullscreenchange', function () { scheduleUpdate(bestVisibleRoot()); });
    if (typeof MutationObserver === 'function') {
      observer = new MutationObserver(function () {
        var overlay = visibleOverlayRoot();
        if (overlay) activeRoot = overlay;
        else if (!activeRoot || (isElement(activeRoot) && (!activeRoot.isConnected || !isVisibleElement(activeRoot)))) activeRoot = lastScrolledRoot && isScrollable(lastScrolledRoot) ? lastScrolledRoot : bestVisibleRoot();
        scheduleUpdate(activeRoot);
      });
      observer.observe(document.body || document.documentElement, { subtree:true, childList:true, attributes:true, attributeFilter:['hidden','class','aria-hidden','open'] });
    }
    scheduleUpdate(bestVisibleRoot());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();
