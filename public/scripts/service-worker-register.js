(function registerTxtReaderServiceWorker() {
  'use strict';
  var PASS = 'v638-service-worker-update-coordination-pass';
  var BUILD = 'rebuild-v682';
  var WORKER_URL = '/sw-rebuild-v682.js';
  var scriptNode = document.currentScript;
  var SILENT_UPDATE_UI = !!(scriptNode && scriptNode.dataset && scriptNode.dataset.updateUi === 'silent');
  if (SILENT_UPDATE_UI) document.documentElement.dataset.serviceWorkerUi = 'silent';
  if (!('serviceWorker' in navigator)) return;

  var registrationRef = null;
  var registrationPromise = null;
  var pendingWorker = null;
  var activationAttempt = null;
  var applyButtonRef = null;
  var banner = null;
  var bannerMessageRef = null;
  var reloadScheduled = false;
  var reloadRequired = false;
  var authorizationPromise = null;
  var authorizationCache = null;
  var authorizationAt = 0;
  var applyAuthorizationInFlight = false;

  function parseAuthorization(response) {
    return response.text().then(function (text) {
      var data = {};
      try { data = text ? JSON.parse(text) : {}; } catch (_) {}
      return { ok:response.ok, status:response.status, data:data || {} };
    });
  }

  function authorizeSystemUpdate(force) {
    if (!force && authorizationCache && Date.now() - authorizationAt < 30000) return Promise.resolve(authorizationCache);
    if (authorizationPromise) return authorizationPromise;
    authorizationPromise = fetch('/api/system-update/authorization', { method:'GET', credentials:'same-origin', cache:'no-store' })
      .then(parseAuthorization)
      .then(function (result) {
        authorizationCache = {
          allowed:!!(result.ok && result.data && result.data.allowed === true),
          transient:false,
          reason:String(result.data && result.data.reason || (result.status === 401 ? 'login_required' : 'permission_required')),
          libraryAccessAllowed:!!(result.data && result.data.libraryAccessAllowed),
          metadataAccessAllowed:!!(result.data && result.data.metadataAccessAllowed)
        };
        authorizationAt = Date.now();
        document.documentElement.dataset.systemUpdateAllowed = authorizationCache.allowed ? '1' : '0';
        return authorizationCache;
      })
      .catch(function () {
        authorizationCache = { allowed:false, transient:true, reason:'authorization_unavailable', libraryAccessAllowed:false, metadataAccessAllowed:false };
        authorizationAt = Date.now();
        document.documentElement.dataset.systemUpdateAllowed = 'unknown';
        return authorizationCache;
      })
      .finally(function () { authorizationPromise = null; });
    return authorizationPromise;
  }

  function dispatchUpdateRequired(detail) {
    document.documentElement.dataset.serviceWorkerUpdate = 'ready';
    try {
      document.dispatchEvent(new CustomEvent('txt-reader:service-worker-updated', {
        detail: Object.assign({ pass:PASS, build:BUILD, at:Date.now() }, detail || {})
      }));
    } catch {}
  }

  function removeBanner() {
    if (applyButtonRef) applyButtonRef.onclick = null;
    if (banner) banner.remove();
    banner = null;
    bannerMessageRef = null;
    applyButtonRef = null;
  }

  function clearAttempt() {
    if (activationAttempt && activationAttempt.timer) window.clearTimeout(activationAttempt.timer);
    activationAttempt = null;
    applyAuthorizationInFlight = false;
  }

  function setButtonReady(label) {
    if (!applyButtonRef || !applyButtonRef.isConnected) return;
    applyButtonRef.disabled = false;
    applyButtonRef.textContent = label || '업데이트 적용';
  }

  function setButtonBusy(label) {
    if (!applyButtonRef || !applyButtonRef.isConnected) return;
    applyButtonRef.disabled = true;
    applyButtonRef.textContent = label || '적용 중…';
  }

  function scheduleReload() {
    if (reloadScheduled) return;
    reloadScheduled = true;
    clearAttempt();
    location.reload();
  }

  function createBanner(message, primaryLabel, primaryHandler, allowDismiss) {
    if (SILENT_UPDATE_UI) return null;
    if (banner && banner.isConnected) {
      if (bannerMessageRef) bannerMessageRef.textContent = message;
      if (applyButtonRef) {
        applyButtonRef.disabled = false;
        applyButtonRef.textContent = primaryLabel;
        applyButtonRef.onclick = primaryHandler;
      }
      return banner;
    }
    banner = document.createElement('div');
    banner.id = 'txt-reader-update-banner';
    banner.className = 'txt-reader-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    var copy = document.createElement('span');
    copy.textContent = message;
    bannerMessageRef = copy;
    var primary = document.createElement('button');
    primary.type = 'button';
    primary.textContent = primaryLabel;
    applyButtonRef = primary;
    // Use one DOM event path only. Rebinding updates this property instead of
    // stacking listeners when the same banner is reused.
    primary.onclick = function (event) {
      if (primary.disabled) return;
      return primaryHandler(event);
    };
    banner.append(copy, primary);
    if (allowDismiss !== false) {
      var dismiss = document.createElement('button');
      dismiss.type = 'button';
      dismiss.className = 'secondary';
      dismiss.textContent = '나중에';
      dismiss.addEventListener('click', removeBanner);
      banner.append(dismiss);
    }
    (document.body || document.documentElement).append(banner);
    return banner;
  }

  function announceClientBuild(messageType) {
    var controller = navigator.serviceWorker.controller;
    if (!controller || typeof controller.postMessage !== 'function') return false;
    try {
      controller.postMessage({ type:messageType || 'TXT_READER_CLIENT_BUILD_READY', build:BUILD, pass:PASS, at:Date.now() });
      return true;
    } catch (_) { return false; }
  }

  function showReloadRequiredNotice(detail) {
    reloadRequired = true;
    if (SILENT_UPDATE_UI) {
      scheduleReload();
      return;
    }
    document.documentElement.dataset.serviceWorkerUpdate = 'reload-required';
    announceClientBuild('TXT_READER_RELOAD_DEFERRED');
    dispatchUpdateRequired(Object.assign({ source:'active-worker-reload-required' }, detail || {}));
    createBanner(
      '새 버전이 활성화되었습니다. 현재 읽기 위치를 저장한 뒤 새 버전으로 전환하십시오.',
      '새 버전으로 전환',
      function () { scheduleReload(); },
      true
    );
  }

  function beginAttempt() {
    if (activationAttempt) return activationAttempt;
    activationAttempt = { id:'upd_'+Date.now()+'_'+Math.random().toString(16).slice(2), startedAt:Date.now(), timer:0, skipWaitingWorker:null, skipWaitingSent:false };
    return activationAttempt;
  }

  function postSkipWaiting(worker) {
    if (!worker || typeof worker.postMessage !== 'function' || worker.state === 'redundant') {
      if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '설치된 업데이트 worker를 사용할 수 없습니다. 다시 확인하십시오.';
      setButtonReady('다시 확인');
      return false;
    }
    pendingWorker = worker;
    var attempt = beginAttempt();
    setButtonBusy('업데이트 활성화 중…');
    if (!attempt.skipWaitingSent || attempt.skipWaitingWorker !== worker) {
      attempt.skipWaitingWorker = worker;
      attempt.skipWaitingSent = true;
      worker.postMessage({ type:'TXT_READER_SKIP_WAITING', pass:PASS, build:BUILD, requestId:attempt.id });
    }
    if (!attempt.timer) {
      attempt.timer = window.setTimeout(function () {
        if (!activationAttempt || activationAttempt.id !== attempt.id || reloadScheduled) return;
        if (bannerMessageRef && bannerMessageRef.isConnected) {
          bannerMessageRef.textContent = '업데이트 활성화가 계속 진행 중입니다. 완료되면 자동으로 새로고침됩니다.';
        }
        setButtonReady('상태 다시 확인');
      }, 15000);
    }
    return true;
  }

  function installedWorker(registration) {
    var worker = registration && registration.waiting;
    if (worker && worker.state !== 'redundant') return worker;
    worker = pendingWorker || registration && registration.installing;
    return worker && worker.state === 'installed' ? worker : null;
  }

  function waitForInstalledWorker(registration, timeoutMs) {
    return new Promise(function (resolve) {
      var settled = false;
      var timer = 0;
      var observed = new Set();
      function finish(worker) {
        if (settled) return;
        settled = true;
        if (timer) window.clearTimeout(timer);
        resolve(worker || null);
      }
      function observe(worker) {
        if (!worker || observed.has(worker)) return;
        observed.add(worker);
        pendingWorker = worker;
        if (worker.state === 'installed') return finish(worker);
        if (worker.state === 'redundant') return;
        worker.addEventListener('statechange', function () {
          if (worker.state === 'installed') finish(worker);
          else if (worker.state === 'redundant' && observed.size === 1) finish(null);
        });
      }
      var ready = installedWorker(registration);
      if (ready) return finish(ready);
      observe(registration && registration.installing);
      if (registration && typeof registration.addEventListener === 'function') {
        registration.addEventListener('updatefound', function () { observe(registration.installing); }, { once:true });
      }
      timer = window.setTimeout(function () { finish(installedWorker(registration)); }, Math.max(1000, Number(timeoutMs) || 12000));
      Promise.resolve(registration && typeof registration.update === 'function' ? registration.update() : null)
        .then(function () {
          var after = installedWorker(registration);
          if (after) finish(after);
          else observe(registration && registration.installing);
        })
        .catch(function () { finish(installedWorker(registration)); });
    });
  }

  function requestWorkerActivation() {
    function useRegistration(registration) {
      registrationRef = registration || registrationRef;
      if (!registrationRef) {
        if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '업데이트 등록 정보를 찾을 수 없습니다.';
        return setButtonReady('다시 확인');
      }
      var ready = installedWorker(registrationRef);
      if (ready) return postSkipWaiting(ready);
      setButtonBusy('업데이트 확인 중…');
      waitForInstalledWorker(registrationRef, 12000).then(function (worker) {
        if (!activationAttempt || reloadScheduled) return;
        if (worker) return postSkipWaiting(worker);
        if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '설치할 새 버전을 찾지 못했습니다. 페이지를 새로고침한 뒤 다시 확인하십시오.';
        clearAttempt();
        setButtonReady('다시 확인');
      });
    }
    if (registrationRef) return useRegistration(registrationRef);
    startRegistration().then(useRegistration).catch(function () {
      if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '업데이트 확인에 실패했습니다. 네트워크 상태를 확인하십시오.';
      setButtonReady('다시 확인');
    });
  }

  function applyUpdate() {
    if (activationAttempt) {
      requestWorkerActivation();
      return;
    }
    if (applyAuthorizationInFlight) return;
    applyAuthorizationInFlight = true;
    setButtonBusy('권한 확인 중…');
    authorizeSystemUpdate(true).then(function (fresh) {
      applyAuthorizationInFlight = false;
      if (!fresh.allowed) {
        clearAttempt();
        if (fresh.transient || fresh.reason === 'authorization_unavailable') {
          if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '업데이트 권한 확인에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하십시오.';
          setButtonReady('권한 다시 확인');
          return;
        }
        removeBanner();
        return;
      }
      beginAttempt();
      setButtonBusy('적용 중…');
      requestWorkerActivation();
    }).catch(function () {
      applyAuthorizationInFlight = false;
      clearAttempt();
      if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '업데이트 권한 확인에 실패했습니다. 네트워크 상태를 확인한 뒤 다시 시도하십시오.';
      setButtonReady('권한 다시 확인');
    });
  }

  function startRegistration() {
    if (registrationPromise) return registrationPromise;
    registrationPromise = navigator.serviceWorker.register(WORKER_URL, {
      scope: '/',
      updateViaCache: 'none'
    }).then(function (registration) {
      registrationRef = registration;
      document.documentElement.dataset.serviceWorkerPass = PASS;
      announceClientBuild();
      if (registration.waiting) {
        pendingWorker = registration.waiting;
        if (activationAttempt) postSkipWaiting(registration.waiting);
        else showUpdateNotice({ source:'waiting-worker', worker:registration.waiting });
      }
      registration.addEventListener('updatefound', function () {
        var worker = registration.installing;
        if (!worker) return;
        pendingWorker = worker;
        worker.addEventListener('statechange', function () {
          if (worker.state !== 'installed' || !navigator.serviceWorker.controller) return;
          if (activationAttempt) postSkipWaiting(worker);
          else showUpdateNotice({ source:'update-installed', worker:worker });
        });
      });
      registration.update().catch(function () {});
      return registration;
    }).catch(function (error) {
      registrationPromise = null;
      document.documentElement.dataset.serviceWorkerPass = 'unavailable';
      throw error;
    });
    return registrationPromise;
  }

  function showUpdateNotice(detail) {
    var info = detail && typeof detail === 'object' ? detail : {};
    if (SILENT_UPDATE_UI) {
      dispatchUpdateRequired(info);
      return Promise.resolve(null);
    }
    if (info.worker) pendingWorker = info.worker;
    dispatchUpdateRequired(info);
    return authorizeSystemUpdate(false).then(function (authorization) {
      if (!authorization.allowed) {
        if (authorization.transient || authorization.reason === 'authorization_unavailable') {
          return createBanner(
            '새 버전이 감지됐지만 업데이트 권한을 확인하지 못했습니다. 네트워크 상태를 확인하십시오.',
            '권한 다시 확인',
            applyUpdate,
            true
          );
        }
        removeBanner();
        return null;
      }
      return createBanner(
        '새 버전이 준비되었습니다. 현재 작업을 저장한 뒤 적용하십시오.',
        '업데이트 적용',
        applyUpdate,
        true
      );
    });
  }

  globalThis.__TXT_READER_REQUIRE_UPDATE__ = function (detail) {
    return showUpdateNotice(detail || { source:'build-mismatch' });
  };
  window.addEventListener('txt-reader:build-update-required', function (event) {
    showUpdateNotice(event && event.detail || { source:'build-mismatch-event' });
  });
  navigator.serviceWorker.addEventListener('message', function (event) {
    if (!event || !event.data) return;
    if (event.data.type === 'TXT_READER_BUILD_MISMATCH') showUpdateNotice({ source:'service-worker-message', activeBuild:event.data.activeBuild, requestedBuild:event.data.requestedBuild });
    if (event.data.type === 'TXT_READER_RELOAD_REQUIRED') {
      if (activationAttempt) scheduleReload();
      else showReloadRequiredNotice({ activeBuild:event.data.activeBuild || event.data.build || '' });
    }
    if (event.data.type === 'TXT_READER_SYSTEM_UPDATE_DENIED') {
      var reason = String(event.data.reason || 'permission_required');
      clearAttempt();
      if (reason === 'authorization_unavailable') {
        authorizationCache = { allowed:false, transient:true, reason:reason, libraryAccessAllowed:false, metadataAccessAllowed:false };
        authorizationAt = Date.now();
        if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '업데이트 권한 확인에 실패했습니다. 네트워크 상태를 확인하십시오.';
        setButtonReady('권한 다시 확인');
        return;
      }
      authorizationCache = { allowed:false, transient:false, reason:reason, libraryAccessAllowed:false, metadataAccessAllowed:false };
      authorizationAt = Date.now();
      if (bannerMessageRef && bannerMessageRef.isConnected) bannerMessageRef.textContent = '이 계정에는 시스템 업데이트 권한이 없습니다.';
      setButtonReady('업데이트 적용');
    }
  });
  navigator.serviceWorker.addEventListener('controllerchange', function () {
    pendingWorker = null;
    if (activationAttempt) {
      scheduleReload();
      return;
    }
    if (reloadRequired) return;
    announceClientBuild();
  });

  var protocol = String(location.protocol || '').toLowerCase();
  var host = String(location.hostname || '').toLowerCase();
  if (protocol !== 'https:' && host !== 'localhost' && host !== '127.0.0.1' && host !== '::1') return;

  // Announce synchronously so a freshly reloaded page is removed from the
  // active worker's stale-client gate before transitive ESM imports begin.
  announceClientBuild();
  startRegistration().catch(function () {});
})();
