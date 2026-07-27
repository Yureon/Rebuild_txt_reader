import { collectElements } from '../features/ui/elements.mjs';

const DEFERRED_UI_FRAGMENT_URL = '/fragments/deferred-ui.html?v=rebuild-v682';
const DEFERRED_UI_STYLE_URL = '/styles/deferred-ui.css?v=rebuild-v682';
export const DEFERRED_UI_FRAGMENT_PASS = 'v569-deferred-ui-fragment-pass';
export const DEFERRED_UI_STYLE_PASS = 'v645-deferred-ui-style-recovery-pass';
export const DEFERRED_UI_EDGE_RECOVERY_PASS = 'v662-deferred-ui-edge-recovery-pass';

const REQUIRED_DEFERRED_UI_IDS = Object.freeze([
  'shared-font-file', 'recovery-import-file', 'bookmark-overlay', 'settings-overlay', 'settings-panel',
  'device-management-overlay', 'device-management-modal', 'read-data-overlay', 'custom-css-overlay', 'custom-css-panel',
  'site-language-editor-overlay', 'site-language-editor-modal', 'shortcut-overlay', 'account-password-overlay',
  'account-password-modal', 'shortcut-panel', 'nsearch-overlay', 'nsearch-panel', 'search-nav-remote',
  'preprocess-editor-overlay', 'preprocess-editor-modal', 'font-modal-overlay', 'font-modal',
  'recovery-center-overlay', 'recovery-center-modal', 'theme-editor-overlay', 'theme-editor-modal',
  'devdbg-modal-overlay', 'devdbg-modal'
]);

function hasCompleteDeferredUi() {
  return REQUIRED_DEFERRED_UI_IDS.every(id => !!document.getElementById(id));
}

let deferredUiPromise = null;
let deferredStylePromise = null;

function assertCurrentBuildResponse(r){if(r?.headers?.get?.('X-TXT-Reader-Reload-Required')!=='1')return;globalThis.__TXT_READER_REQUIRE_UPDATE__?.({source:'deferred-ui-build-mismatch'});globalThis.dispatchEvent?.(new CustomEvent('txt-reader:build-update-required',{detail:{source:'deferred-ui-build-mismatch'}}));throw Error('TXT_READER_BUILD_MISMATCH')}

function perfStore() {
  if (!globalThis.__TXT_READER_PERF__ || typeof globalThis.__TXT_READER_PERF__ !== 'object') {
    globalThis.__TXT_READER_PERF__ = { version:'rebuild-v682', phases:{}, resources:{}, longTasks:[] };
  }
  return globalThis.__TXT_READER_PERF__;
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now();
}

const DEFERRED_ASSET_RETRYABLE_STATUS = new Set([502,503,504,520,521,522,523,524,525,526,530]);
const DEFERRED_ASSET_RETRY_DELAYS_MS = Object.freeze([0, 900, 2200]);

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

function deferredRetryUrl(url, attempt) {
  return attempt === 0 ? url : `${url}&edge_retry=${attempt}-${Date.now()}`;
}

function parseRetryAfterMs(response) {
  const raw = String(response?.headers?.get?.('Retry-After') || '').trim();
  if (!raw) return 0;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) return Math.min(10000, Math.max(0, seconds * 1000));
  const date = Date.parse(raw);
  return Number.isFinite(date) ? Math.min(10000, Math.max(0, date - Date.now())) : 0;
}

function cloudflareErrorCode(body = '') {
  const text = String(body || '');
  const match = text.match(/(?:Error\s*|error[_ -]?code[^0-9]*|<span[^>]*class=["']code["'][^>]*>\s*)(10\d{2})\b/i);
  return match ? match[1] : '';
}

function deferredAssetError(url, response, body = '') {
  const statusCode = Number(response?.status) || 0;
  const cfCode = cloudflareErrorCode(body);
  const ray = String(response?.headers?.get?.('cf-ray') || '').trim();
  const details = [statusCode ? `HTTP ${statusCode}` : '네트워크 오류'];
  if (cfCode) details.push(`Cloudflare ${cfCode}`);
  if (ray) details.push(`Ray ${ray}`);
  const error = new Error(`지연 UI 리소스를 불러오지 못했습니다: ${details.join(' · ')}`);
  error.status = statusCode;
  error.cloudflareCode = cfCode;
  error.cfRay = ray;
  error.resourceUrl = url;
  return error;
}

async function fetchDeferredAsset(url, { accept, asText = false } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < DEFERRED_ASSET_RETRY_DELAYS_MS.length; attempt += 1) {
    const baseDelay = DEFERRED_ASSET_RETRY_DELAYS_MS[attempt];
    if (baseDelay) await sleep(baseDelay);
    const requestUrl = deferredRetryUrl(url, attempt);
    let response = null;
    try {
      response = await fetch(requestUrl, {
        credentials:'same-origin',
        cache:attempt === 0 ? 'force-cache' : 'no-store',
        headers:{ Accept:accept || '*/*' }
      });
      assertCurrentBuildResponse(response);
      const body = asText || !response.ok ? await response.text() : '';
      if (response.ok) return asText ? body : true;
      lastError = deferredAssetError(url, response, body);
      if (!DEFERRED_ASSET_RETRYABLE_STATUS.has(Number(response.status))) throw lastError;
      const retryAfter = parseRetryAfterMs(response);
      if (retryAfter) await sleep(retryAfter);
    } catch (error) {
      if (error?.message === 'TXT_READER_BUILD_MISMATCH') throw error;
      lastError = error?.status ? error : deferredAssetError(url, response, '');
      const status = Number(lastError?.status) || 0;
      if (status && !DEFERRED_ASSET_RETRYABLE_STATUS.has(status)) throw lastError;
    }
  }
  throw lastError || new Error('지연 UI 리소스를 불러오지 못했습니다.');
}

function ensureDeferredStyle() {
  const existing = document.querySelector(`link[data-deferred-ui-style-pass="${DEFERRED_UI_STYLE_PASS}"]`);
  if (existing?.dataset?.deferredUiStyleLoaded === '1') return Promise.resolve(true);
  if (existing) existing.remove();
  if (deferredStylePromise) return deferredStylePromise;
  const startedAt = now();
  deferredStylePromise = (async () => {
    let lastError = null;
    for (let attempt = 0; attempt < DEFERRED_ASSET_RETRY_DELAYS_MS.length; attempt += 1) {
      const baseDelay = DEFERRED_ASSET_RETRY_DELAYS_MS[attempt];
      if (baseDelay) await sleep(baseDelay);
      const href = deferredRetryUrl(DEFERRED_UI_STYLE_URL, attempt);
      try {
        await new Promise((resolve, reject) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = href;
          link.dataset.deferredUiStylePass = DEFERRED_UI_STYLE_PASS;
          link.dataset.deferredUiStyleAttempt = String(attempt);
          link.onload = () => {
            link.dataset.deferredUiStyleLoaded = '1';
            resolve(true);
          };
          link.onerror = () => {
            link.remove();
            reject(deferredAssetError(DEFERRED_UI_STYLE_URL, null, ''));
          };
          document.head.append(link);
        });
        perfStore().resources.deferredUiCss = {
          durationMs:Math.max(0, now() - startedAt),
          href,
          attempts:attempt + 1
        };
        return true;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError || new Error('지연 UI 스타일 적용 실패');
  })().catch(error => {
    deferredStylePromise = null;
    throw error;
  });
  return deferredStylePromise;
}

function refreshElements(app) {
  const fresh = collectElements();
  app.els = Object.assign(app.els || {}, fresh);
  app.refreshDeferredUiBindings?.();
  return app.els;
}

export async function ensureDeferredUi(app) {
  if (hasCompleteDeferredUi()) {
    await ensureDeferredStyle();
    refreshElements(app);
    document.documentElement.dataset.deferredUiStyleRecoveryPass = DEFERRED_UI_STYLE_PASS;
    document.documentElement.dataset.deferredUiEdgeRecoveryPass = DEFERRED_UI_EDGE_RECOVERY_PASS;
    return true;
  }
  if (deferredUiPromise) return deferredUiPromise;
  const startedAt = now();
  deferredUiPromise = Promise.all([
    ensureDeferredStyle(),
    fetchDeferredAsset(DEFERRED_UI_FRAGMENT_URL, { accept:'text/html', asText:true }).then(html => {
      const missingIds = REQUIRED_DEFERRED_UI_IDS.filter(id => !html.includes(`id="${id}"`));
      if (missingIds.length) throw new Error(`지연 UI 조각이 올바르지 않습니다: ${missingIds.join(', ')}`);
      return html;
    })
  ]).then(([, html]) => {
    const template = document.createElement('template');
    template.innerHTML = html;
    for (const node of Array.from(template.content.children)) {
      const id = node.id || '';
      if (id && document.getElementById(id)) continue;
      document.body.append(node.cloneNode(true));
    }
    if (!hasCompleteDeferredUi()) throw new Error('지연 UI 조각 복구가 완료되지 않았습니다.');
    refreshElements(app);
    const metrics = perfStore();
    metrics.resources.deferredUiHtml = {
      durationMs:Math.max(0, now() - startedAt),
      bytes:new Blob([html]).size,
      href:DEFERRED_UI_FRAGMENT_URL
    };
    document.documentElement.dataset.deferredUiFragmentPass = DEFERRED_UI_FRAGMENT_PASS;
    window.dispatchEvent?.(new CustomEvent('txt-reader:deferred-ui-ready', { detail:{ pass:DEFERRED_UI_FRAGMENT_PASS } }));
    deferredUiPromise = null;
    return true;
  }).catch(error => {
    deferredUiPromise = null;
    throw error;
  });
  return deferredUiPromise;
}
