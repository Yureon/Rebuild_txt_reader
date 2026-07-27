'use strict';

const TXT_READER_SERVICE_WORKER_PASS = 'v590-service-worker-offline-shell-pass';
const TXT_READER_SYSTEM_UPDATE_PERMISSION_PASS = 'v627-system-update-dual-permission-pass';
const STATIC_CACHE_KEY_NORMALIZATION_PASS = 'v592-service-worker-cache-key-normalization-pass';
const TXT_READER_MULTI_TAB_UPDATE_PASS = 'v638-service-worker-bounded-client-state-pass';
const TXT_READER_NAVIGATION_STATE_BEST_EFFORT_PASS = 'v674-service-worker-navigation-state-best-effort-pass';
const BUILD = 'rebuild-v682';
const CACHE_PREFIX = 'txt-reader-static-';
const STATIC_CACHE = `${CACHE_PREFIX}${BUILD}`;
const CLIENT_STATE_CACHE = 'txt-reader-client-build-state-v1';
const CLIENT_STATE_RECORD_URL = '/__txt_reader_client_build_state_v1__.json';
const CLIENT_STATE_SCHEMA_VERSION = 1;
const CLIENT_STATE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const CLIENT_STATE_MAX_RECORDS = 256;
const CLIENT_STATE_CLEANUP_INTERVAL = 32;
const CLIENT_BUILD_HANDSHAKE_WAIT_MS = 1500;
const OFFLINE_URL = '/offline.html';
const V675_OFFLINE_DUAL_FAILURE_PASS = 'v675-offline-dual-failure-pass';
const STATIC_CACHE_MAX_ENTRIES = 512;
const LEGACY_CLIENT_RELOAD_GRACE_MS = 3000;
const clientBuildStates = new Map();
const clientStateWaiters = new Map();
let clientStatesLoaded = false;
let clientStateLoadPromise = null;
let clientStateWriteTail = Promise.resolve();
let navigationStateWrites = 0;
const PRECACHE_URLS = Object.freeze([
  OFFLINE_URL,
  `/styles/login.css?v=${BUILD}`,
  `/styles/update-banner.css?v=${BUILD}`,
  `/styles/deferred-ui.css?v=${BUILD}`,
  `/styles/non-auth-autofill-guard.css?v=${BUILD}`,
  `/scripts/non-auth-autofill-guard.js?v=${BUILD}`,
  `/fragments/deferred-ui.html?v=${BUILD}`,
  '/icon/icon-192.png?v=rebuild-v682',
  '/icon/icon-512.png?v=rebuild-v682',
  `/manifest.json?v=${BUILD}`
]);

function now() { return Date.now(); }
function stateRecordRequest() {
  return new Request(new URL(CLIENT_STATE_RECORD_URL, self.location.origin).toString(), { method:'GET', credentials:'same-origin' });
}
function normalizeClientState(value = {}) {
  const status = ['current','stale','deferred','unknown'].includes(String(value.status || '')) ? String(value.status) : 'unknown';
  return {
    status,
    build:String(value.build || ''),
    updatedAt:Number(value.updatedAt) || now()
  };
}
function clientStateSnapshot() {
  const clients = {};
  for (const [clientId, state] of clientBuildStates) clients[clientId] = normalizeClientState(state);
  return { schemaVersion:CLIENT_STATE_SCHEMA_VERSION, activeBuild:BUILD, updatedAt:new Date().toISOString(), clients };
}
async function loadClientBuildStates() {
  if (clientStatesLoaded) return clientBuildStates;
  if (clientStateLoadPromise) return clientStateLoadPromise;
  clientStateLoadPromise = (async () => {
    try {
      const cache = await caches.open(CLIENT_STATE_CACHE);
      const response = await cache.match(stateRecordRequest());
      if (response) {
        const payload = await response.json().catch(() => null);
        if (payload && Number(payload.schemaVersion) === CLIENT_STATE_SCHEMA_VERSION && payload.clients && typeof payload.clients === 'object') {
          for (const [clientId, rawState] of Object.entries(payload.clients)) {
            const id = String(clientId || '');
            if (id && !clientBuildStates.has(id)) clientBuildStates.set(id, normalizeClientState(rawState));
          }
        }
      }
    } catch (_error) {
      // Unknown remains fail-closed when the state record cannot be read.
    }
    clientStatesLoaded = true;
    return clientBuildStates;
  })().finally(() => { clientStateLoadPromise = null; });
  return clientStateLoadPromise;
}
function persistClientBuildStates() {
  const write = async () => {
    await loadClientBuildStates();
    const cache = await caches.open(CLIENT_STATE_CACHE);
    const payload = JSON.stringify(clientStateSnapshot());
    await cache.put(stateRecordRequest(), new Response(payload, {
      status:200,
      headers:{ 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }
    }));
  };
  clientStateWriteTail = clientStateWriteTail.catch(() => {}).then(write);
  return clientStateWriteTail;
}
function setClientBuildStateNow(clientId, state = {}) {
  const id = String(clientId || '');
  if (!id) return false;
  const normalized = normalizeClientState(state);
  clientBuildStates.set(id, normalized);
  const waiters = clientStateWaiters.get(id);
  if (waiters && waiters.size) {
    for (const notify of Array.from(waiters)) {
      try { notify(normalized); } catch (_error) {}
    }
  }
  return true;
}
function waitForCurrentClientBuild(clientId, timeoutMs = CLIENT_BUILD_HANDSHAKE_WAIT_MS) {
  const id = String(clientId || '');
  if (!id) return Promise.resolve(null);
  const immediate = clientBuildStates.get(id);
  if (immediate && immediate.status === 'current' && immediate.build === BUILD) return Promise.resolve(immediate);
  return new Promise(resolve => {
    let settled = false;
    const waiters = clientStateWaiters.get(id) || new Set();
    const finish = state => {
      if (settled) return;
      if (state && (state.status !== 'current' || state.build !== BUILD)) return;
      settled = true;
      clearTimeout(timer);
      waiters.delete(finish);
      if (!waiters.size) clientStateWaiters.delete(id);
      resolve(state || null);
    };
    waiters.add(finish);
    clientStateWaiters.set(id, waiters);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      waiters.delete(finish);
      if (!waiters.size) clientStateWaiters.delete(id);
      resolve(null);
    }, Math.max(0, Number(timeoutMs) || 0));
    const latest = clientBuildStates.get(id);
    if (latest && latest.status === 'current' && latest.build === BUILD) finish(latest);
  });
}
async function setClientBuildState(clientId, state = {}) {
  if (!setClientBuildStateNow(clientId, state)) return false;
  await loadClientBuildStates();
  await persistClientBuildStates();
  return true;
}
async function getClientBuildState(clientId) {
  await loadClientBuildStates();
  return clientBuildStates.get(String(clientId || '')) || null;
}
async function cleanupClientBuildStates(activeClients = null) {
  await loadClientBuildStates();
  const list = Array.isArray(activeClients)
    ? activeClients
    : await self.clients.matchAll({ type:'window', includeUncontrolled:true }).catch(() => []);
  const activeIds = new Set(list.map(client => String(client && client.id || '')).filter(Boolean));
  const cutoff = now() - CLIENT_STATE_RETENTION_MS;
  let changed = false;
  for (const [clientId, state] of clientBuildStates) {
    if (!activeIds.has(clientId) && Number(state.updatedAt || 0) < cutoff) {
      clientBuildStates.delete(clientId);
      changed = true;
    }
  }
  if (clientBuildStates.size > CLIENT_STATE_MAX_RECORDS) {
    const removable = Array.from(clientBuildStates.entries())
      .filter(([clientId]) => !activeIds.has(clientId))
      .sort((left,right) => Number(left[1] && left[1].updatedAt || 0) - Number(right[1] && right[1].updatedAt || 0));
    while (clientBuildStates.size > CLIENT_STATE_MAX_RECORDS && removable.length) {
      const [clientId] = removable.shift();
      clientBuildStates.delete(clientId);
      changed = true;
    }
  }
  if (changed) await persistClientBuildStates();
  return changed;
}

async function removeReplacedClientState(replacesClientId, nextClientId) {
  const previousId = String(replacesClientId || '');
  const currentId = String(nextClientId || '');
  if (!previousId || previousId === currentId) return false;
  await loadClientBuildStates();
  const removed = clientBuildStates.delete(previousId);
  const waiters = clientStateWaiters.get(previousId);
  if (waiters) {
    for (const notify of Array.from(waiters)) {
      try { notify(null); } catch (_error) {}
    }
    clientStateWaiters.delete(previousId);
  }
  return removed;
}

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    for (const url of PRECACHE_URLS) {
      const request = new Request(url, { method:'GET', credentials:'same-origin', cache:'reload' });
      const response = await fetch(request);
      if (!response || !response.ok || response.type !== 'basic' || response.redirected) throw new Error(`precache failed: ${url}`);
      await cache.put(normalizedStaticCacheRequest(request), response.clone());
    }
    await trimStaticCache(cache);
    await loadClientBuildStates();
  })());
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function markStaleClient(clientId, options = {}) {
  return setClientBuildState(clientId, {
    status:options.deferred ? 'deferred' : 'stale',
    build:String(options.build || 'unknown'),
    updatedAt:now()
  });
}

async function notifyReloadRequired(client, source = 'service-worker-activated') {
  if (!client) return;
  try {
    client.postMessage({
      type:'TXT_READER_RELOAD_REQUIRED',
      source,
      activeBuild:BUILD,
      pass:TXT_READER_MULTI_TAB_UPDATE_PASS
    });
  } catch (_error) {}
}

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await loadClientBuildStates();
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== STATIC_CACHE)
      .map(name => caches.delete(name)));

    const existing = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of existing) setClientBuildStateNow(client.id, { status:'stale', build:'unknown', updatedAt:now() });
    await persistClientBuildStates();
    await cleanupClientBuildStates(existing);
    await self.clients.claim();
    for (const client of existing) await notifyReloadRequired(client);

    // Current coordinators reply with READY or DEFERRED. Older coordinators do
    // not understand the protocol and are navigated after a short grace period.
    await sleep(LEGACY_CLIENT_RELOAD_GRACE_MS);
    const current = await self.clients.matchAll({ type:'window', includeUncontrolled:true });
    for (const client of current) {
      const state = await getClientBuildState(client.id);
      if (!state || state.status === 'deferred') continue;
      if (state.status !== 'current' || state.build !== BUILD) {
        try { await client.navigate(client.url); } catch (_error) {}
      }
    }
  })());
});

function isStaticAsset(url) {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname.startsWith('/api/')) return false;
  if (url.pathname === '/sw.js' || /^\/sw-rebuild-v\d+\.js$/.test(url.pathname)) return false;
  if (url.pathname.endsWith('.html') && !url.pathname.startsWith('/fragments/')) return false;
  return url.pathname.startsWith('/scripts/')
    || url.pathname.startsWith('/styles/')
    || url.pathname.startsWith('/fragments/')
    || url.pathname.startsWith('/icon/')
    || url.pathname.startsWith('/workers/')
    || url.pathname === '/manifest.json';
}

function isExecutableStaticAsset(url) {
  return url.pathname.startsWith('/scripts/')
    || url.pathname.startsWith('/fragments/')
    || url.pathname.startsWith('/workers/')
    || /\.(?:m?js|cjs|wasm|html)$/i.test(url.pathname);
}

function updateClientStateFromNavigation(response, clientId) {
  const id = String(clientId || '');
  if (!id) return false;
  const responseBuild = String(response && response.headers && response.headers.get('X-TXT-Reader-Build') || '');
  if (responseBuild === BUILD) {
    // A current navigation proves which HTML build was returned, not that the
    // page coordinator actually executed. Keep the client fail-closed until
    // TXT_READER_CLIENT_BUILD_READY completes the explicit handshake.
    return setClientBuildStateNow(id, { status:'unknown', build:BUILD, updatedAt:now() });
  } else if (/^rebuild-v\d+$/.test(responseBuild)) {
    return setClientBuildStateNow(id, { status:'stale', build:responseBuild, updatedAt:now() });
  } else {
    return setClientBuildStateNow(id, { status:'unknown', build:'', updatedAt:now() });
  }
}


async function getOfflineNavigationResponse() {
  try {
    const cached = await caches.match(OFFLINE_URL, { cacheName: STATIC_CACHE });
    if (cached) return cached;
  } catch (_error) {}
  return new Response('오프라인 상태입니다.', {
    status:503,
    headers:{
      'Content-Type':'text/plain; charset=utf-8',
      'Cache-Control':'no-store',
      'X-TXT-Reader-Offline-Fallback':V675_OFFLINE_DUAL_FAILURE_PASS
    }
  });
}

async function networkFirstNavigation(request, clientId = '', replacesClientId = '') {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException('navigation timeout', 'TimeoutError')), 8000);
  let response;
  try {
    response = await fetch(request, { signal:controller.signal });
  } catch (_error) {
    response = await getOfflineNavigationResponse();
  } finally {
    clearTimeout(timeout);
  }
  // The in-memory state must be fail-closed before executable requests from
  // this navigation arrive. Durable bookkeeping is auxiliary and must never
  // turn an otherwise valid online/offline navigation into a network error.
  const stateChanged = updateClientStateFromNavigation(response, clientId);
  const stateTask = (async () => {
    const removedReplacedState = await removeReplacedClientState(replacesClientId, clientId);
    navigationStateWrites += 1;
    if (stateChanged || removedReplacedState) await persistClientBuildStates();
    if (removedReplacedState || navigationStateWrites % CLIENT_STATE_CLEANUP_INTERVAL === 0 || clientBuildStates.size > CLIENT_STATE_MAX_RECORDS) {
      await cleanupClientBuildStates();
    }
    return { ok:true, pass:TXT_READER_NAVIGATION_STATE_BEST_EFFORT_PASS };
  })().catch(error => ({
    ok:false,
    pass:TXT_READER_NAVIGATION_STATE_BEST_EFFORT_PASS,
    error:String(error && error.message || error || 'client state persistence failed')
  }));
  return { response, stateTask };
}

self.addEventListener('message', event => {
  const data = event && event.data || {};
  if (data.type === 'TXT_READER_CLIENT_BUILD_READY') {
    const clientId = String(event.source && event.source.id || '');
    const task = (async () => {
      if (String(data.build || '') === BUILD) {
        await setClientBuildState(clientId, { status:'current', build:BUILD, updatedAt:now() });
        try { event.source && event.source.postMessage && event.source.postMessage({ type:'TXT_READER_CLIENT_BUILD_ACCEPTED', build:BUILD, pass:TXT_READER_MULTI_TAB_UPDATE_PASS }); } catch (_error) {}
      } else {
        await markStaleClient(clientId, { build:data.build || 'unknown' });
        await notifyReloadRequired(event.source, 'client-build-mismatch');
      }
    })();
    event.waitUntil && event.waitUntil(task);
    return;
  }
  if (data.type === 'TXT_READER_RELOAD_DEFERRED') {
    const clientId = String(event.source && event.source.id || '');
    const task = markStaleClient(clientId, { deferred:true, build:data.build || 'unknown' });
    event.waitUntil && event.waitUntil(task);
    return;
  }
  if (data.type !== 'TXT_READER_SKIP_WAITING') return;
  event.waitUntil((async () => {
    let authorization = null;
    try {
      const response = await fetch('/api/system-update/authorization', { method:'GET', credentials:'include', cache:'no-store' });
      authorization = await response.json().catch(() => null);
      if (response.ok && authorization && authorization.allowed === true && authorization.pass === TXT_READER_SYSTEM_UPDATE_PERMISSION_PASS) {
        try { event.source && event.source.postMessage && event.source.postMessage({ type:'TXT_READER_SYSTEM_UPDATE_ACCEPTED', requestId:String(data.requestId || ''), pass:TXT_READER_SYSTEM_UPDATE_PERMISSION_PASS }); } catch (_error) {}
        await self.skipWaiting();
        return;
      }
    } catch (_error) {}
    try {
      event.source && event.source.postMessage && event.source.postMessage({ type:'TXT_READER_SYSTEM_UPDATE_DENIED', reason:String(authorization && authorization.reason || 'authorization_unavailable'), pass:TXT_READER_SYSTEM_UPDATE_PERMISSION_PASS });
    } catch (_error) {}
  })());
});

function requestedBuild(url) {
  const version = String(url.searchParams.get('v') || '');
  return /^rebuild-v\d+$/.test(version) ? version : '';
}

function normalizedStaticCacheRequest(request) {
  const url = new URL(request.url);
  url.search = '';
  url.hash = '';
  return new Request(url.toString(), { method:'GET', credentials:'same-origin' });
}

async function trimStaticCache(cache) {
  const keys = await cache.keys();
  const excess = Math.max(0, keys.length - STATIC_CACHE_MAX_ENTRIES);
  for (let index = 0; index < excess; index += 1) await cache.delete(keys[index]);
}

async function blockExecutableRequest(clientId, reason, requested = '') {
  try {
    const client = await self.clients.get(String(clientId || ''));
    await notifyReloadRequired(client, reason || 'client-build-unconfirmed');
  } catch (_error) {}
  return new Response(JSON.stringify({ ok:false, error:'reload_required', activeBuild:BUILD, requestedBuild:requested || undefined }), {
    status:409,
    statusText:'Reload Required',
    headers:{
      'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'no-store',
      'X-TXT-Reader-Reload-Required':'1',
      'X-TXT-Reader-Build':BUILD
    }
  });
}

async function cacheFirstStatic(request, clientId = '') {
  const requestUrl = new URL(request.url);
  const requestBuild = requestedBuild(requestUrl);
  const executable = isExecutableStaticAsset(requestUrl);
  if (executable) {
    let state = await getClientBuildState(clientId);
    if (!state || state.status !== 'current' || state.build !== BUILD) {
      // The parser-blocking, unintercepted coordinator is loaded before page
      // executables. Briefly hold the request so its READY message can be
      // durably recorded; never infer freshness from the navigation alone.
      state = await waitForCurrentClientBuild(clientId);
    }
    if (!state || state.status !== 'current' || state.build !== BUILD) {
      return blockExecutableRequest(clientId, state ? `client-build-${state.status}` : 'client-build-unknown', requestBuild);
    }
    if (requestBuild && requestBuild !== BUILD) {
      return blockExecutableRequest(clientId, 'requested-build-mismatch', requestBuild);
    }
  }

  // Non-executable assets may be forwarded with no-store during a transition.
  if (!executable && requestBuild && requestBuild !== BUILD) return fetch(request, { cache:'no-store' });

  const cache = await caches.open(STATIC_CACHE);
  const cacheRequest = normalizedStaticCacheRequest(request);
  const cached = await cache.match(cacheRequest);
  if (cached) return cached;
  const response = await fetch(request);
  const responseUrl = response && response.url ? new URL(response.url) : null;
  const sameResource = !!(responseUrl && responseUrl.origin === self.location.origin && responseUrl.pathname === requestUrl.pathname);
  if (response && response.ok && response.type === 'basic' && !response.redirected && sameResource) {
    await cache.put(cacheRequest, response.clone());
    await trimStaticCache(cache);
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (!request || request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    const navigation = networkFirstNavigation(request, event.resultingClientId || event.clientId || '', event.replacesClientId || '');
    event.respondWith(navigation.then(result => result.response));
    if (typeof event.waitUntil === 'function') {
      event.waitUntil(navigation.then(result => result.stateTask).catch(() => null));
    }
    return;
  }
  if (isStaticAsset(url)) event.respondWith(cacheFirstStatic(request, event.clientId || event.resultingClientId || ''));
});
