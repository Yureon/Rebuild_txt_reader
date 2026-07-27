export const REBUILD_VERSION = 'rebuild-v682';
export const CREATE_EL_SAFE_HTML_PASS = 'v531-create-el-safe-html-allowlist-pass';

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function byId(id) {
  return document.getElementById(id);
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function debounce(fn, wait = 200) {
  let timer = 0;
  const wrapped = (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      timer = 0;
      fn(...args);
    }, wait);
  };
  wrapped.cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  return wrapped;
}

export function throttle(fn, wait = 120) {
  let last = 0;
  let timer = 0;
  let lastArgs = null;
  const wrapped = (...args) => {
    const now = Date.now();
    const run = () => {
      last = Date.now();
      timer = 0;
      fn(...(lastArgs || args));
      lastArgs = null;
    };
    if (now - last >= wait) {
      last = now;
      fn(...args);
      return;
    }
    lastArgs = args;
    if (!timer) timer = window.setTimeout(run, wait - (now - last));
  };
  wrapped.cancel = () => {
    window.clearTimeout(timer);
    timer = 0;
    lastArgs = null;
  };
  return wrapped;
}

export function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function stableDeviceId() {
  const key = 'txt-reader.rebuild.deviceId';
  try {
    const existing = localStorage.getItem(key);
    if (existing && /^[a-zA-Z0-9_-]{8,120}$/.test(existing)) return existing;
  } catch {}
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const id = 'dev_' + Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  try { localStorage.setItem(key, id); } catch {}
  return id;
}

export function deviceName() {
  try {
    const cached = localStorage.getItem('txt-reader.rebuild.deviceName');
    if (cached) return cached;
  } catch {}
  const ua = navigator.userAgent || '';
  const name = /Android/i.test(ua) ? 'Android' : /iPhone|iPad/i.test(ua) ? 'iOS' : /Windows/i.test(ua) ? 'Windows' : /Mac/i.test(ua) ? 'Mac' : 'Browser';
  try { localStorage.setItem('txt-reader.rebuild.deviceName', name); } catch {}
  return name;
}

export function setDeviceName(value) {
  const cleaned = String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const name = cleaned || deviceName();
  try { localStorage.setItem('txt-reader.rebuild.deviceName', name); } catch {}
  return name;
}

export function formatPercent(value, digits = 2) {
  const n = clamp(value, 0, 1) * 100;
  return `${n.toFixed(digits)}%`;
}

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function applyStyleObject(el, styleValue) {
  if (!el || styleValue == null || styleValue === false) return;
  if (styleValue && typeof styleValue === 'object') {
    Object.entries(styleValue).forEach(([prop, value]) => {
      if (value == null || value === false) return;
      const name = String(prop).replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
      el.style.setProperty(name, String(value));
    });
    return;
  }
  String(styleValue).split(';').forEach(part => {
    const idx = part.indexOf(':');
    if (idx < 0) return;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!name || !value) return;
    el.style.setProperty(name, value);
  });
}

export function createEl(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value == null || value === false) return;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'safeHtml') el.innerHTML = String(value);
    else if (key === 'html') throw new Error('createEl html attribute is disabled; use safeHtml only for reviewed escaped/trusted markup');
    else if (key === 'style') applyStyleObject(el, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'dataset' && value && typeof value === 'object') Object.entries(value).forEach(([k, v]) => { el.dataset[k] = String(v); });
    else el.setAttribute(key, String(value));
  });
  const list = Array.isArray(children) ? children : [children];
  list.forEach(child => {
    if (child == null) return;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return el;
}


const reportedImageAssetFailures = new Set();

export function installImageFallback(image, fallbackFactory, options = {}) {
  if (!image || typeof image.addEventListener !== 'function') return image;
  let settled = false;
  const fail = () => {
    if (settled) return;
    settled = true;
    const rawUrl = String(options.url || image.currentSrc || image.src || '');
    const reportKey = rawUrl || String(options.label || 'image');
    if (reportKey && !reportedImageAssetFailures.has(reportKey)) {
      reportedImageAssetFailures.add(reportKey);
      if (reportedImageAssetFailures.size > 100) reportedImageAssetFailures.delete(reportedImageAssetFailures.values().next().value);
      console.warn('[txt-reader] image asset load failed', { label:String(options.label || 'image'), url:rawUrl });
    }
    image.dataset.assetLoad = 'failed';
    const replacement = typeof fallbackFactory === 'function' ? fallbackFactory(image) : null;
    const NodeCtor = globalThis.Node;
    if (NodeCtor && replacement instanceof NodeCtor && image.isConnected) image.replaceWith(replacement);
    else image.hidden = true;
  };
  image.addEventListener('load', () => { settled = true; image.dataset.assetLoad = 'loaded'; }, { once:true });
  image.addEventListener('error', fail, { once:true });
  queueMicrotask(() => {
    if (!settled && image.complete && Number(image.naturalWidth) === 0) fail();
  });
  return image;
}

export function limitMapSize(map, maxSize = 200, keepKeys = []) {
  if (!map || typeof map.size !== 'number' || map.size <= maxSize) return;
  const keep = new Set((Array.isArray(keepKeys) ? keepKeys : []).map(String));
  for (const key of Array.from(map.keys())) {
    if (map.size <= maxSize) break;
    if (keep.has(String(key))) continue;
    map.delete(key);
  }
}

export function highlightEscapedText(text, query, caseSensitive = false, markClass = '') {
  const source = String(text ?? '');
  const needle = String(query ?? '');
  if (!needle) return escapeHtml(source);
  const haystack = caseSensitive ? source : source.toLowerCase();
  const target = caseSensitive ? needle : needle.toLowerCase();
  let pos = 0;
  let out = '';
  while (target) {
    const idx = haystack.indexOf(target, pos);
    if (idx < 0) break;
    out += escapeHtml(source.slice(pos, idx));
    const cls = markClass ? ` class="${escapeHtml(markClass)}"` : '';
    out += `<mark${cls}>${escapeHtml(source.slice(idx, idx + needle.length))}</mark>`;
    pos = idx + needle.length;
  }
  out += escapeHtml(source.slice(pos));
  return out;
}

export function downloadTextFile(filename, text, mime = 'application/json') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function setButtonBusy(button, busy, label) {
  if (!button) return;
  if (busy) {
    if (!button.dataset.oldText) button.dataset.oldText = button.textContent || '';
    button.disabled = true;
    if (label) button.textContent = label;
  } else {
    button.disabled = false;
    if (button.dataset.oldText) button.textContent = button.dataset.oldText;
    delete button.dataset.oldText;
  }
}
