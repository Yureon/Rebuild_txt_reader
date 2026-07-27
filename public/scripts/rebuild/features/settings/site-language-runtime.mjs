export const SITE_LANGUAGE_PASS = 'v560-shared-site-language-packs-pass';
export const SITE_LANGUAGE_RUNTIME_SPLIT_PASS = 'v595-site-language-runtime-split-pass';

export const SUPPORTED_SITE_LANGUAGES = ['auto', 'ko', 'en'];
export const CUSTOM_SITE_LANGUAGE_PREFIX = 'custom:';
export const SITE_LANGUAGE_PACK_PREFIX = 'site:';

const STORAGE_KEY = 'txtReaderSiteLanguageResolved';
const TEXT_ORIGINALS = new WeakMap();
const ATTR_ORIGINALS = new WeakMap();
const MAX_CUSTOM_LANGUAGES = 12;
const MAX_CUSTOM_LANGUAGE_ENTRIES = 600;
let observer = null;
let observerApp = null;
let applying = false;
let activeCustomLanguageMap = null;
let activeCustomLanguageLabel = '';
let activeSiteLanguageMap = null;
let activeSiteLanguageLabel = '';
let siteLanguageLoadPromise = null;

const EXCLUDED_TRANSLATION_SELECTOR = [
  '#content',
  '#novel-list',
  '#library-quick-list',
  '#bookmark-list',
  '#read-data-modal',
  '#devdbg-output',
  '#custom-css-editor',
  '#site-custom-language-map',
  '#preprocess-preview-body',
  '#preprocess-preview-meta',
  '#preprocess-preview-stats',
  'textarea',
  'code',
  'pre',
  '[data-i18n-skip]'
].join(',');

export function normalizeCustomLanguageId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^custom:/, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

export function customLanguageValue(id = '') {
  const normalized = normalizeCustomLanguageId(id);
  return normalized ? `${CUSTOM_SITE_LANGUAGE_PREFIX}${normalized}` : '';
}

export function siteLanguagePackValue(id = '') {
  const normalized = normalizeCustomLanguageId(id);
  return normalized ? `${SITE_LANGUAGE_PACK_PREFIX}${normalized}` : '';
}

export function isSiteLanguagePack(value = '') {
  return String(value || '').trim().toLowerCase().startsWith(SITE_LANGUAGE_PACK_PREFIX);
}

export function isCustomSiteLanguage(value = '') {
  return String(value || '').trim().toLowerCase().startsWith(CUSTOM_SITE_LANGUAGE_PREFIX);
}

export function normalizeSiteLanguage(value = 'auto') {
  const raw = String(value || 'auto').trim().toLowerCase();
  if (raw === 'system' || raw === 'browser') return 'auto';
  if (raw === 'en' || raw === 'english') return 'en';
  if (raw === 'ko' || raw === 'kr' || raw === 'korean') return 'ko';
  if (raw.startsWith(CUSTOM_SITE_LANGUAGE_PREFIX)) return customLanguageValue(raw.slice(CUSTOM_SITE_LANGUAGE_PREFIX.length)) || 'auto';
  if (raw.startsWith(SITE_LANGUAGE_PACK_PREFIX)) return siteLanguagePackValue(raw.slice(SITE_LANGUAGE_PACK_PREFIX.length)) || 'auto';
  return 'auto';
}

export function normalizeCustomLanguageMap(input = {}) {
  const out = {};
  if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
  for (const [rawKey, rawValue] of Object.entries(input)) {
    if (Object.keys(out).length >= MAX_CUSTOM_LANGUAGE_ENTRIES) break;
    const key = String(rawKey || '').trim().replace(/\s+/g, ' ').slice(0, 260);
    const value = String(rawValue ?? '').trim().replace(/\r\n/g, '\n').slice(0, 800);
    if (!key || !value) continue;
    out[key] = value;
  }
  return out;
}

export function normalizeSiteLanguagePacks(input = []) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const id = normalizeCustomLanguageId(item.id || item.code || item.value || '');
    if (!id || seen.has(id)) continue;
    const map = normalizeCustomLanguageMap(item.map || item.translations || item.entries || {});
    if (!Object.keys(map).length) continue;
    const rawName = String(item.name || item.label || id).trim().slice(0, 60);
    seen.add(id);
    out.push({
      id,
      name: rawName || id,
      description: String(item.description || '').trim().slice(0, 240),
      enabled: item.enabled !== false,
      map,
      updatedAt: String(item.updatedAt || '')
    });
    if (out.length >= 80) break;
  }
  return out;
}

export function normalizeSiteCustomLanguages(input = []) {
  const list = Array.isArray(input) ? input : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const id = normalizeCustomLanguageId(item.id || item.code || item.value || '');
    if (!id || seen.has(id)) continue;
    const map = normalizeCustomLanguageMap(item.map || item.translations || item.entries || {});
    if (!Object.keys(map).length) continue;
    const rawName = String(item.name || item.label || id).trim().slice(0, 40);
    seen.add(id);
    out.push({
      id,
      name: rawName || id,
      map,
      updatedAt: Math.max(0, Number(item.updatedAt) || Date.now())
    });
    if (out.length >= MAX_CUSTOM_LANGUAGES) break;
  }
  return out;
}

export function resolveSiteLanguage(value = 'auto', nav = globalThis.navigator) {
  const normalized = normalizeSiteLanguage(value);
  if (normalized === 'ko' || normalized === 'en' || isCustomSiteLanguage(normalized) || isSiteLanguagePack(normalized)) return normalized;
  const langs = Array.isArray(nav?.languages) && nav.languages.length
    ? nav.languages
    : [nav?.language || 'ko'];
  const first = String(langs[0] || 'ko').toLowerCase();
  return first.startsWith('ko') ? 'ko' : 'en';
}

export function languageLabel(value = 'auto', customLanguages = []) {
  const normalized = normalizeSiteLanguage(value);
  if (normalized === 'ko') return '한국어';
  if (normalized === 'en') return 'English';
  if (isCustomSiteLanguage(normalized)) {
    const id = normalized.slice(CUSTOM_SITE_LANGUAGE_PREFIX.length);
    const found = normalizeSiteCustomLanguages(customLanguages).find(lang => lang.id === id);
    return found?.name || id;
  }
  if (isSiteLanguagePack(normalized)) {
    const id = normalized.slice(SITE_LANGUAGE_PACK_PREFIX.length);
    const found = normalizeSiteLanguagePacks(globalThis.__txtReaderSiteLanguages || []).find(lang => lang.id === id);
    return found?.name || id;
  }
  return '시스템 기본';
}

function getSiteLanguagePacks(app) {
  const packs = normalizeSiteLanguagePacks(app?.state?.siteLanguages || globalThis.__txtReaderSiteLanguages || []);
  globalThis.__txtReaderSiteLanguages = packs;
  return packs;
}

function getCustomLanguage(app, value = '') {
  const normalized = normalizeSiteLanguage(value);
  let id = '';
  if (isCustomSiteLanguage(normalized)) id = normalized.slice(CUSTOM_SITE_LANGUAGE_PREFIX.length);
  else if (isSiteLanguagePack(normalized)) id = normalized.slice(SITE_LANGUAGE_PACK_PREFIX.length);
  if (!id) return null;
  return normalizeSiteCustomLanguages(app?.state?.prefs?.siteCustomLanguages || []).find(lang => lang.id === id) || null;
}

function getSiteLanguagePack(app, value = '') {
  const normalized = normalizeSiteLanguage(value);
  if (!isSiteLanguagePack(normalized)) return null;
  const id = normalized.slice(SITE_LANGUAGE_PACK_PREFIX.length);
  return getSiteLanguagePacks(app).find(lang => lang.id === id && lang.enabled !== false) || null;
}

function resolveLanguageForApp(app) {
  const pref = normalizeSiteLanguage(app?.state?.prefs?.siteLanguage || 'auto');
  if (isCustomSiteLanguage(pref) && !getCustomLanguage(app, pref)) return 'auto';
  if (isSiteLanguagePack(pref) && !getSiteLanguagePack(app, pref)) return 'auto';
  return resolveSiteLanguage(pref);
}

export function applySiteLanguage(app) {
  const rawPref = normalizeSiteLanguage(app?.state?.prefs?.siteLanguage || 'auto');
  const sitePack = getSiteLanguagePack(app, rawPref);
  const custom = getCustomLanguage(app, rawPref);
  const sitePacksLoaded = !!(app?.state?.siteLanguagesLoaded || globalThis.__txtReaderSiteLanguagesLoaded);
  const pref = (isCustomSiteLanguage(rawPref) && !custom) || (isSiteLanguagePack(rawPref) && !sitePack && sitePacksLoaded) ? 'auto' : rawPref;
  if (app?.state?.prefs && app.state.prefs.siteLanguage !== pref) app.state.prefs.siteLanguage = pref;
  const lang = resolveSiteLanguage(pref);
  if (lang !== 'ko' && !englishMapLoaded) ensureEnglishMap(app);
  activeSiteLanguageMap = sitePack?.map || null;
  activeSiteLanguageLabel = sitePack?.name || '';
  activeCustomLanguageMap = custom?.map || null;
  activeCustomLanguageLabel = custom?.name || '';
  document.documentElement.lang = lang === 'en' ? 'en' : lang === 'ko' ? 'ko' : (sitePack?.id || custom?.id || 'custom');
  document.documentElement.dataset.siteLanguage = lang;
  document.documentElement.dataset.siteLanguagePref = pref;
  if (sitePack) document.documentElement.dataset.siteLanguagePack = sitePack.id;
  else delete document.documentElement.dataset.siteLanguagePack;
  if (custom) document.documentElement.dataset.siteLanguageCustom = custom.id;
  else delete document.documentElement.dataset.siteLanguageCustom;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch {}
  syncSiteLanguageInput(app, pref);
  translateDocument(lang);
}

export function syncSiteLanguageInput(app, pref = null) {
  const value = normalizeSiteLanguage(pref || app?.state?.prefs?.siteLanguage || 'auto');
  const customLanguages = normalizeSiteCustomLanguages(app?.state?.prefs?.siteCustomLanguages || []);
  const siteLanguages = getSiteLanguagePacks(app);
  const select = app?.els?.siteLanguageSelect || document.getElementById('site-language-select');
  if (select) {
    renderSiteLanguageOptions(select, siteLanguages, customLanguages, value);
    if (select.value !== value) {
      const hasCustom = customLanguages.some(lang => customLanguageValue(lang.id) === value);
      const hasSite = siteLanguages.some(lang => siteLanguagePackValue(lang.id) === value);
      select.value = hasCustom || hasSite || (!isCustomSiteLanguage(value) && !isSiteLanguagePack(value)) ? value : 'auto';
    }
  }
  const status = document.getElementById('site-language-status');
  if (status) {
    const resolved = resolveLanguageForApp(app);
    const label = value === 'auto'
      ? `${t('시스템 기본', resolved)} · ${t(resolved === 'ko' ? '한국어' : resolved === 'en' ? '영어' : languageLabel(resolved, customLanguages), resolved)}`
      : t(languageLabel(value, customLanguages), resolved);
    status.textContent = resolved === 'ko'
      ? `현재: ${label}`
      : resolved === 'en'
        ? `Current: ${label}`
        : `${t('현재', resolved)}: ${label}`;
  }
}

function renderSiteLanguageOptions(select, siteLanguages = [], customLanguages = [], selected = 'auto') {
  if (!select) return;
  const desired = [
    ['auto', '시스템 기본'],
    ['ko', '한국어'],
    ['en', 'English'],
    ...normalizeSiteLanguagePacks(siteLanguages).filter(lang => lang.enabled !== false).map(lang => [siteLanguagePackValue(lang.id), lang.name + ' · 공통']),
    ...customLanguages.map(lang => [customLanguageValue(lang.id), lang.name + ' · 개인'])
  ];
  const signature = desired.map(([value, label]) => `${value}:${label}`).join('|');
  if (select.dataset.siteLanguageOptionsSignature !== signature) {
    select.dataset.siteLanguageOptionsSignature = signature;
    select.innerHTML = '';
    desired.forEach(([value, label]) => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label;
      select.append(opt);
    });
  }
  const available = new Set(desired.map(([value]) => value));
  select.value = available.has(selected) ? selected : 'auto';
  syncThemedSiteLanguageList(select);
}

function syncThemedSiteLanguageList(select) {
  const root = document.getElementById('site-language-combobox');
  const trigger = document.getElementById('site-language-trigger');
  const label = document.getElementById('site-language-trigger-label');
  const list = document.getElementById('site-language-list');
  if (!root || !trigger || !label || !list || !select) return;
  const selected = select.selectedOptions?.[0] || select.options?.[0] || null;
  label.textContent = selected?.textContent || '시스템 기본';
  list.innerHTML = '';
  Array.from(select.options || []).forEach(option => {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'site-language-option';
    item.dataset.siteLanguageValue = option.value;
    item.setAttribute('role', 'option');
    item.setAttribute('aria-selected', option.value === select.value ? 'true' : 'false');
    item.tabIndex = option.value === select.value ? 0 : -1;
    const text = document.createElement('span');
    text.className = 'site-language-option-label';
    text.textContent = option.textContent || option.value;
    item.append(text);
    if (option.value === select.value) {
      const mark = document.createElement('span');
      mark.className = 'site-language-option-check';
      mark.setAttribute('aria-hidden', 'true');
      mark.textContent = '✓';
      item.append(mark);
    }
    list.append(item);
  });
  root.dataset.value = select.value || 'auto';
}


export function loadSiteLanguagePacks(app, { applyAfterLoad = true } = {}) {
  if (siteLanguageLoadPromise) return siteLanguageLoadPromise;
  siteLanguageLoadPromise = fetch('/api/site-languages', { credentials: 'same-origin', cache: 'no-store' })
    .then(res => res.ok ? res.json() : Promise.reject(new Error('site language pack load failed: ' + res.status)))
    .then(data => {
      const packs = normalizeSiteLanguagePacks(data?.languages || []);
      if (app?.state) { app.state.siteLanguages = packs; app.state.siteLanguagesLoaded = true; }
      globalThis.__txtReaderSiteLanguages = packs;
      globalThis.__txtReaderSiteLanguagesLoaded = true;
      if (applyAfterLoad) applySiteLanguage(app);
      return packs;
    })
    .catch(err => {
      if (app?.state) { if (!Array.isArray(app.state.siteLanguages)) app.state.siteLanguages = []; app.state.siteLanguagesLoaded = true; }
      globalThis.__txtReaderSiteLanguagesLoaded = true;
      console.warn?.('[txt-reader] site language pack load failed', err);
      return [];
    })
    .finally(() => { siteLanguageLoadPromise = null; });
  return siteLanguageLoadPromise;
}


export function installSiteLanguageRuntime(app) {
  loadSiteLanguagePacks(app, { applyAfterLoad: true });
  if (observer && observerApp === app) return;
  if (observer) observer.disconnect();
  observerApp = app;
  observer = new MutationObserver(records => {
    if (applying) return;
    const hasRelevantMutation = records.some(record => {
      if (record.type === 'characterData') return !isExcluded(record.target?.parentElement);
      return Array.from(record.addedNodes || []).some(node => node?.nodeType === Node.ELEMENT_NODE && !isExcluded(node));
    });
    if (!hasRelevantMutation) return;
    window.requestAnimationFrame?.(() => applySiteLanguage(app));
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

export function t(text, lang = resolveSiteLanguage()) {
  const raw = String(text || '');
  const compact = raw.trim().replace(/\s+/g, ' ');
  if (lang === 'ko') return raw;
  if (isCustomSiteLanguage(lang) || isSiteLanguagePack(lang)) return activeCustomLanguageMap?.[compact] || activeSiteLanguageMap?.[compact] || EN[compact] || raw;
  return EN[compact] || raw;
}

function translateDocument(lang = 'ko') {
  applying = true;
  try {
    translateAttributes(document.body, lang);
    translateTextNodes(document.body, lang);
  } finally {
    applying = false;
  }
}

function translateAttributes(root, lang) {
  if (!root) return;
  const attrs = ['placeholder', 'title', 'aria-label'];
  const nodes = [root, ...Array.from(root.querySelectorAll?.('*') || [])];
  nodes.forEach(el => {
    if (!el || el.nodeType !== Node.ELEMENT_NODE || isExcluded(el)) return;
    attrs.forEach(attr => {
      if (!el.hasAttribute?.(attr)) return;
      let originals = ATTR_ORIGINALS.get(el);
      if (!originals) {
        originals = {};
        ATTR_ORIGINALS.set(el, originals);
      }
      if (!Object.prototype.hasOwnProperty.call(originals, attr)) originals[attr] = el.getAttribute(attr);
      const original = originals[attr];
      const next = lang === 'ko' ? original : translatePreserveWhitespace(original, lang);
      if (el.getAttribute(attr) !== next) el.setAttribute(attr, next);
    });
  });
}

function translateTextNodes(root, lang) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node || !node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (isExcluded(node.parentElement)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(node => {
    if (!TEXT_ORIGINALS.has(node)) TEXT_ORIGINALS.set(node, node.nodeValue);
    const original = TEXT_ORIGINALS.get(node);
    const next = lang === 'ko' ? original : translatePreserveWhitespace(original, lang);
    if (node.nodeValue !== next) node.nodeValue = next;
  });
}

function translatePreserveWhitespace(value, lang = 'en') {
  const raw = String(value ?? '');
  const compact = raw.trim().replace(/\s+/g, ' ');
  if (!compact) return raw;
  const translated = (isCustomSiteLanguage(lang) || isSiteLanguagePack(lang))
    ? (activeCustomLanguageMap?.[compact] || activeSiteLanguageMap?.[compact] || EN[compact])
    : lang === 'ko'
      ? compact
      : EN[compact];
  if (!translated) return raw;
  const lead = raw.match(/^\s*/)?.[0] || '';
  const trail = raw.match(/\s*$/)?.[0] || '';
  return `${lead}${translated}${trail}`;
}

function isExcluded(node) {
  if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
  return !!node.closest?.(EXCLUDED_TRANSLATION_SELECTOR);
}


let EN = Object.freeze({});
let englishMapLoaded = false;
let englishMapPromise = null;

function ensureEnglishMap(app) {
  if (englishMapLoaded) return Promise.resolve(EN);
  if (englishMapPromise) return englishMapPromise;
  englishMapPromise = import('./site-language-en.mjs')
    .then(module => {
      EN = module.EN && typeof module.EN === 'object' ? module.EN : Object.freeze({});
      englishMapLoaded = true;
      if (app) applySiteLanguage(app);
      return EN;
    })
    .catch(error => {
      englishMapLoaded = true;
      console.warn?.('[txt-reader] English language map load failed', error);
      return EN;
    })
    .finally(() => { englishMapPromise = null; });
  return englishMapPromise;
}
