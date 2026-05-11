export const SITE_LANGUAGE_PASS = 'v560-shared-site-language-packs-pass';

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
  syncCustomLanguageEditor(app);
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
  if (select.dataset.siteLanguageOptionsSignature === signature) return;
  select.dataset.siteLanguageOptionsSignature = signature;
  select.innerHTML = '';
  desired.forEach(([value, label]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = label;
    select.append(opt);
  });
  select.value = selected;
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

function getSiteLanguageEditorLayer() {
  return {
    openBtn: document.getElementById('open-site-custom-language-modal-btn'),
    overlay: document.getElementById('site-language-editor-overlay'),
    modal: document.getElementById('site-language-editor-modal'),
    closeBtn: document.getElementById('site-language-editor-close')
  };
}

function openSiteLanguageEditor(app) {
  const { overlay, modal } = getSiteLanguageEditorLayer();
  if (!overlay || !modal) return;
  syncCustomLanguageEditor(app);
  overlay.classList.add('open');
  modal.classList.add('open');
  overlay.setAttribute('aria-hidden', 'false');
  document.body?.classList.add('settings-submodal-open');
  window.setTimeout?.(() => (getEditorElements(app).name || getEditorElements(app).code || getEditorElements(app).map)?.focus?.(), 0);
}

function closeSiteLanguageEditor() {
  const { overlay, modal } = getSiteLanguageEditorLayer();
  overlay?.classList.remove('open');
  modal?.classList.remove('open');
  overlay?.setAttribute('aria-hidden', 'true');
  document.body?.classList.remove('settings-submodal-open');
}

export function bindSiteLanguageControl(app, { applyPrefs = null, on = null } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const apply = () => {
    if (typeof applyPrefs === 'function') applyPrefs(app);
    else applySiteLanguage(app);
  };
  listen(app?.els?.siteLanguageSelect || document.getElementById('site-language-select'), 'change', ev => {
    const next = normalizeSiteLanguage(ev?.target?.value || 'auto');
    if (!app?.state?.prefs) return;
    app.state.prefs.siteLanguage = next;
    syncCustomLanguageEditor(app);
    apply();
  });
  listen(app?.els?.siteCustomLanguageSave || document.getElementById('site-custom-language-save'), 'click', () => saveCustomLanguageFromEditor(app, { applyPrefs: apply }));
  listen(app?.els?.siteCustomLanguageUse || document.getElementById('site-custom-language-use'), 'click', () => saveCustomLanguageFromEditor(app, { applyPrefs: apply, useAfterSave: true }));
  listen(app?.els?.siteCustomLanguageDelete || document.getElementById('site-custom-language-delete'), 'click', () => deleteSelectedCustomLanguage(app, { applyPrefs: apply }));
  listen(app?.els?.siteCustomLanguageTemplate || document.getElementById('site-custom-language-template'), 'click', () => fillCustomLanguageTemplate(app));
  const editorLayer = getSiteLanguageEditorLayer();
  listen(editorLayer.openBtn, 'click', () => openSiteLanguageEditor(app));
  listen(editorLayer.closeBtn, 'click', closeSiteLanguageEditor);
  listen(editorLayer.overlay, 'click', closeSiteLanguageEditor);
  loadSiteLanguagePacks(app, { applyAfterLoad: true });
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

function parseCustomLanguageMap(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return {};
  if (text.startsWith('{')) {
    const parsed = JSON.parse(text);
    return normalizeCustomLanguageMap(parsed);
  }
  const out = {};
  text.split(/\r?\n/).forEach(line => {
    if (Object.keys(out).length >= MAX_CUSTOM_LANGUAGE_ENTRIES) return;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const separator = trimmed.includes('=>') ? '=>' : trimmed.includes('\t') ? '\t' : '=';
    const index = trimmed.indexOf(separator);
    if (index <= 0) return;
    const key = trimmed.slice(0, index).trim().replace(/\s+/g, ' ').slice(0, 260);
    const value = trimmed.slice(index + separator.length).trim().slice(0, 800);
    if (key && value) out[key] = value;
  });
  return normalizeCustomLanguageMap(out);
}

function serializeCustomLanguageMap(map = {}) {
  return Object.entries(normalizeCustomLanguageMap(map))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function getEditorElements(app) {
  return {
    name: app?.els?.siteCustomLanguageName || document.getElementById('site-custom-language-name'),
    code: app?.els?.siteCustomLanguageCode || document.getElementById('site-custom-language-code'),
    map: app?.els?.siteCustomLanguageMap || document.getElementById('site-custom-language-map'),
    status: app?.els?.siteCustomLanguageStatus || document.getElementById('site-custom-language-status'),
    deleteBtn: app?.els?.siteCustomLanguageDelete || document.getElementById('site-custom-language-delete')
  };
}

function selectedCustomLanguage(app) {
  const selected = normalizeSiteLanguage(app?.state?.prefs?.siteLanguage || 'auto');
  return getCustomLanguage(app, selected);
}

function syncCustomLanguageEditor(app) {
  const els = getEditorElements(app);
  if (!els.name || !els.code || !els.map) return;
  const selected = selectedCustomLanguage(app);
  if (selected) {
    els.name.value = selected.name || '';
    els.code.value = selected.id || '';
    els.map.value = serializeCustomLanguageMap(selected.map || {});
    if (els.deleteBtn) els.deleteBtn.disabled = false;
    setCustomLanguageStatus(app, `편집 중: ${selected.name}`);
    return;
  }
  if (!els.name.value && !els.code.value && !els.map.value) {
    els.name.value = '';
    els.code.value = '';
    els.map.value = '';
  }
  if (els.deleteBtn) els.deleteBtn.disabled = true;
}

function setCustomLanguageStatus(app, message) {
  const status = getEditorElements(app).status;
  if (status) status.textContent = message || '';
}

function saveCustomLanguageFromEditor(app, { applyPrefs = null, useAfterSave = false } = {}) {
  if (!app?.state?.prefs) return;
  const els = getEditorElements(app);
  const id = normalizeCustomLanguageId(els.code?.value || '');
  const name = String(els.name?.value || '').trim().slice(0, 40);
  if (!id) {
    setCustomLanguageStatus(app, '언어 코드를 입력하세요. 예: es, ja-custom');
    return;
  }
  let map;
  try {
    map = parseCustomLanguageMap(els.map?.value || '');
  } catch (err) {
    setCustomLanguageStatus(app, `문구 형식을 확인하세요: ${err?.message || err}`);
    return;
  }
  if (!Object.keys(map).length) {
    setCustomLanguageStatus(app, '표시 문구를 1개 이상 입력하세요. 예: 설정=Settings');
    return;
  }
  const existing = normalizeSiteCustomLanguages(app.state.prefs.siteCustomLanguages || []).filter(lang => lang.id !== id);
  const next = [{ id, name: name || id, map, updatedAt: Date.now() }, ...existing].slice(0, MAX_CUSTOM_LANGUAGES);
  app.state.prefs.siteCustomLanguages = next;
  if (useAfterSave) app.state.prefs.siteLanguage = customLanguageValue(id);
  setCustomLanguageStatus(app, `저장됨: ${name || id}`);
  if (typeof applyPrefs === 'function') applyPrefs(app);
  else applySiteLanguage(app);
}

function deleteSelectedCustomLanguage(app, { applyPrefs = null } = {}) {
  if (!app?.state?.prefs) return;
  const selected = selectedCustomLanguage(app);
  const id = selected?.id || normalizeCustomLanguageId(getEditorElements(app).code?.value || '');
  if (!id) return;
  app.state.prefs.siteCustomLanguages = normalizeSiteCustomLanguages(app.state.prefs.siteCustomLanguages || []).filter(lang => lang.id !== id);
  if (normalizeSiteLanguage(app.state.prefs.siteLanguage) === customLanguageValue(id)) app.state.prefs.siteLanguage = 'auto';
  const els = getEditorElements(app);
  if (els.name) els.name.value = '';
  if (els.code) els.code.value = '';
  if (els.map) els.map.value = '';
  setCustomLanguageStatus(app, `삭제됨: ${id}`);
  if (typeof applyPrefs === 'function') applyPrefs(app);
  else applySiteLanguage(app);
}

function fillCustomLanguageTemplate(app) {
  const els = getEditorElements(app);
  if (!els.map) return;
  const selected = selectedCustomLanguage(app);
  const selectedSite = getSiteLanguagePack(app, app?.state?.prefs?.siteLanguage || '');
  if (selected?.map && Object.keys(selected.map).length) {
    els.map.value = serializeCustomLanguageMap(selected.map);
  } else if (selectedSite?.map && Object.keys(selectedSite.map).length) {
    els.map.value = serializeCustomLanguageMap(selectedSite.map);
    if (els.code && !els.code.value) els.code.value = selectedSite.id;
    if (els.name && !els.name.value) els.name.value = selectedSite.name + ' override';
  } else {
    const keys = Object.keys(EN).slice(0, 180);
    els.map.value = keys.map(key => `${key}=${EN[key]}`).join('\n');
  }
  if (!els.name?.value) els.name.value = activeCustomLanguageLabel || activeSiteLanguageLabel || 'Custom';
  setCustomLanguageStatus(app, '템플릿을 채웠습니다. 오른쪽 값을 원하는 표시 문구로 바꾼 뒤 저장하세요.');
}

const EN = {
  '한국어': 'Korean',
  '영어': 'English',
  '시스템 기본': 'System default',
  '사이트 언어': 'Site language',
  '브라우저 언어를 기준으로 인터페이스 언어를 선택합니다. 현재 버전은 한국어와 영어를 지원합니다.': 'Choose the interface language based on the browser language. This version supports Korean and English.',
  '브라우저 언어를 기준으로 인터페이스 언어를 선택하거나, 직접 입력한 사용자 정의 언어를 사용할 수 있습니다.': 'Choose the interface language from the browser language, or use a custom language you entered manually.',
  '브라우저 언어, owner가 배포한 공통 언어팩, 직접 입력한 사용자 정의 언어를 선택할 수 있습니다.': 'Choose the interface language from the browser language, an owner-provided shared language pack, or a custom language you entered manually.',
  '언어 이름과 코드를 만들고, 표시할 문구를 직접 입력합니다. 공통 언어팩과 같은 코드를 쓰면 개인 문구가 우선 적용됩니다.': 'Create a language name and code, then enter display strings. If the code matches a shared language pack, your personal strings take precedence.',
  '현재: 시스템 기본 · 한국어': 'Current: System default · Korean',
  '현재: 시스템 기본 · 영어': 'Current: System default · English',
  '소설 목록': 'Novel list',
  '소설 목록 닫기': 'Close novel list',
  '검색...': 'Search...',
  '모두 펼치기': 'Expand all',
  '모두 접기': 'Collapse all',
  '상단 안전영역 표시줄': 'Top safe-area status bar',
  '상단 안전영역 시계': 'Top safe-area clock',
  '상단 안전영역 네트워크 상태': 'Top safe-area network status',
  '상단 안전영역 독서 진행률': 'Top safe-area reading progress',
  '보통': 'Normal',
  '소설을 선택하세요': 'Select a novel',
  '소설 내용 검색': 'Search novel text',
  '현재 작품 오프라인 준비': 'Prepare current work offline',
  '북마크': 'Bookmarks',
  '테마 색상 변경': 'Change theme colors',
  '본문을 준비하는 중입니다': 'Preparing the text',
  '왼쪽에서 소설을 선택하세요': 'Select a novel from the left',
  '다음 내용 불러오는 중...': 'Loading next content...',
  '오프라인 저장 중': 'Saving offline',
  '준비 중…': 'Preparing…',
  '오프라인 저장 창 최소화': 'Minimize offline save panel',
  '오프라인 저장 창 닫기': 'Close offline save panel',
  '최소화': 'Minimize',
  '닫기': 'Close',
  '실패 재시도': 'Retry failed',
  '중단': 'Cancel',
  '오프라인 저장 진행 다시 열기': 'Reopen offline save progress',
  '오프라인 저장 진행 보기': 'Show offline save progress',
  '← 이전': '← Previous',
  '다음 →': 'Next →',
  '현재 작품의 저장된 북마크를 확인하고 현재 위치 저장, 이전/다음 이동, 전체 삭제를 실행합니다.': 'View bookmarks for the current work, save the current position, move to previous/next, or delete all.',
  '현재 위치 저장': 'Save current position',
  '이전 북마크': 'Previous bookmark',
  '다음 북마크': 'Next bookmark',
  '전체 삭제': 'Delete all',
  '설정': 'Settings',
  '앱 모양, 뷰어, 기능, 데이터 및 고급 설정을 탭별로 조정합니다.': 'Adjust appearance, viewer, features, data, and advanced settings by tab.',
  '설정 닫기': 'Close settings',
  '일반': 'General',
  '뷰어': 'Viewer',
  '기능': 'Features',
  '읽기 위치·북마크·최근 열람은 기기 간 공유됩니다. 기기별 옵션은 각 항목의 설명과 관리 모달에서 따로 확인합니다.': 'Reading position, bookmarks, and recent items are shared across devices. Device-specific options are described per item and in management dialogs.',
  '앱 모양': 'App appearance',
  '테마 색상': 'Theme colors',
  '앱 전체 패널과 본문 색 조합을 한 번에 바꿉니다.': 'Change the app panels and reader color set at once.',
  '색 조합 변경': 'Change color set',
  '프리셋 선택 또는 직접 색상 지정': 'Choose a preset or set colors manually',
  'UI 글자 크기': 'UI font size',
  '메뉴, 버튼, 설정창 같은 인터페이스 글자 크기를 조절합니다.': 'Adjust the font size of menus, buttons, and settings panels.',
  '작게': 'Smaller',
  '크게': 'Larger',
  'UI 전환 속도': 'UI transition speed',
  '패널 열림, 닫힘, 강조 효과처럼 앱 전환이 느껴지는 속도를 정합니다.': 'Set how fast panels, closing, and highlight transitions feel.',
  '데이터 · 고급': 'Data · Advanced',
  '관리': 'Manage',
  '기기, 독서 기록, 사용자 CSS처럼 자주 여는 관리 화면을 모았습니다.': 'Common management screens such as devices, reading records, and custom CSS.',
  '기기 관리': 'Device management',
  '기기 이름, 우선 기기, 원격 위치를 관리합니다.': 'Manage device name, preferred device, and remote position.',
  '기기 관리 열기': 'Open device management',
  '독서 데이터': 'Reading data',
  '읽기 위치·북마크·최근 열람을 확인하고 정리합니다.': 'Review and clean reading positions, bookmarks, and recent items.',
  '독서 데이터 관리': 'Manage reading data',
  '사용자 CSS': 'Custom CSS',
  '기본 옵션으로 부족한 화면 스타일을 직접 보정합니다.': 'Manually adjust styles that the standard options do not cover.',
  'CSS 수정': 'Edit CSS',
  '백업 · 복원': 'Backup · Restore',
  '화면·조작·동기화 설정만 내보내거나 다시 불러옵니다.': 'Export or import only appearance, controls, and sync settings.',
  '설정 내보내기': 'Export settings',
  '설정 가져오기': 'Import settings',
  '독서 위치와 북마크는 독서 데이터 관리에서 따로 다룹니다. 라이브러리 이동의 폴더 자동 펼침 지연은 650ms로 고정됩니다.': 'Reading positions and bookmarks are handled in Reading Data. The folder auto-open delay for library moves is fixed at 650ms.',
  '설정 초기화': 'Reset settings',
  '필요한 경우만 펼치기': 'Open only when needed',
  '화면 설정 초기화': 'Reset appearance settings',
  '조작 설정 초기화': 'Reset control settings',
  '기기 · 동기화 초기화': 'Reset device · sync',
  '공유 설정만 초기화': 'Reset shared settings only',
  '이 기기 설정만 초기화': 'Reset this device only',
  '전처리 설정 초기화': 'Reset preprocessing settings',
  '전체 설정 초기화': 'Reset all settings',
  '독서 데이터는 유지되고 설정만 되돌립니다.': 'Reading data is kept; only settings are reset.',
  '계정 비밀번호': 'Account password',
  '현재 로그인한 일반 사용자 계정의 비밀번호를 변경합니다. 변경 후 현재 세션은 유지하고, 다른 기기의 기존 세션은 만료합니다.': 'Change the password for the currently signed-in user. The current session is kept, while existing sessions on other devices expire.',
  '비밀번호 변경': 'Change password',
  '현재 계정의 비밀번호를 변경할 수 있습니다.': 'You can change the current account password.',
  '비밀번호 변경 창을 열어 현재 계정 비밀번호를 변경합니다.': 'Open the password dialog to change the current account password.',
  '비밀번호 변경 열기': 'Open password change',
  '계정 비밀번호 변경': 'Change account password',
  '로그아웃': 'Log out',
  '현재 브라우저의 로그인 세션을 종료하고 로그인 화면으로 이동합니다.': 'End this browser session and go to the login screen.',
  '공용 기기에서는 사용 후 로그아웃하세요.': 'On shared devices, log out after use.',
  '단축키': 'Shortcuts',
  '단축키 설정': 'Shortcut settings',
  '리더와 앱 조작 단축키를 확인하고 수정합니다. 모바일 사이트에서는 표시하지 않습니다.': 'View and edit reader and app shortcuts. Hidden on the mobile site.',
  '개발자 디버그': 'Developer debug',
  '문제 분석용 상태값과 복구 도구를 확인합니다. 일반 사용 중에는 열지 않아도 됩니다.': 'View diagnostic state and recovery tools. Usually not needed during normal use.',
  '디버그 창 열기': 'Open debug panel',
  '적용 범위': 'Scope',
  '이 탭의 설정은 항목마다 적용 범위가 다릅니다. 배지와 상태 문구가 현재 저장 위치와 동기화 방식을 함께 설명합니다.': 'Settings in this tab may use different scopes. Badges and status messages explain the current storage and sync method.',
  '뷰어 설정': 'Viewer settings',
  '글자, 색상, 전처리 옵션을 실제 읽기 화면 기준으로 조정합니다.': 'Adjust text, colors, and preprocessing based on the actual reader.',
  '뷰어 미리보기': 'Viewer preview',
  '색상과 글자 느낌을 빠르게 확인합니다.': 'Quickly check colors and typography.',
  '프롤로그': 'Prologue',
  '밤바람이 창문 사이로 스며들고, 페이지를 넘기는 소리만 남았다.': 'Night air slipped through the window, leaving only the sound of pages turning.',
  '지금 설정한 글자와 색상': 'The current text and colors',
  '이 실제 읽기 화면에서 어떤 느낌인지 짧게 확인할 수 있다.': 'show how the real reading screen will feel.',
  '글꼴': 'Font',
  '본문 기본 글꼴을 선택합니다.': 'Choose the default reader font.',
  '현재:': 'Current:',
  'Noto 명조': 'Noto Serif',
  '글자 크기': 'Font size',
  '본문 글자 크기를 조절합니다.': 'Adjust reader font size.',
  '행간': 'Line height',
  '줄 사이 간격을 조절합니다.': 'Adjust line spacing.',
  '줄 길이': 'Line width',
  '한 줄의 최대 길이를 조절합니다.': 'Adjust the maximum line length.',
  '화면 맞춤': 'Fit screen',
  '여백': 'Margins',
  '본문 바깥 여백을 조절합니다.': 'Adjust reader outer margins.',
  '텍스트 전처리': 'Text preprocessing',
  '줄바꿈·잡음 제거 같은 전처리를 조정합니다.': 'Adjust preprocessing such as line breaks and noise removal.',
  '전처리 상세 설정': 'Detailed preprocessing settings',
  '현재 작품 본문에 적용할 전처리 옵션을 조절합니다.': 'Adjust preprocessing options for the current work.',
  '색상': 'Colors',
  '밝기': 'Brightness',
  '현재 기기 화면에서 읽기 편한 체감 밝기로 조정합니다.': 'Adjust perceived brightness for comfortable reading on this device.',
  '배경색 · 글자색': 'Background · Text color',
  '본문 배경과 글자색을 직접 맞춰 눈의 피로를 줄입니다.': 'Set reader background and text colors to reduce eye strain.',
  '배경': 'Background',
  '글자': 'Text',
  '직접 선택': 'Choose manually',
  '미리보기는 현재 글자 크기, 글꼴, 행간, 줄 길이, 여백, 배경색, 글자색, 밝기를 함께 반영합니다.': 'The preview reflects current font size, font, line height, line width, margins, background, text color, and brightness.',
  '읽기 조작': 'Reading controls',
  '상단 표시': 'Top display',
  '탭 내비게이션': 'Tap navigation',
  '화면을 탭해서 위아래 또는 좌우로 이동합니다.': 'Tap the screen to move vertically or horizontally.',
  '핵심': 'Core',
  '탭 기능 사용': 'Use tap controls',
  '탭 방향 · 이동 거리': 'Tap direction · distance',
  '탭 이동 방향과 거리를 정합니다.': 'Set tap movement direction and distance.',
  '상하': 'Vertical',
  '좌우': 'Horizontal',
  '이동 거리': 'Move distance',
  '스크롤 애니메이션': 'Scroll animation',
  '탭 이동을 즉시 또는 부드럽게 처리합니다.': 'Make tap movement instant or smooth.',
  '애니메이션 사용': 'Use animation',
  '빠름': 'Fast',
  '느림': 'Slow',
  '스와이프 내비게이션': 'Swipe navigation',
  '모바일에서 스와이프로 이동합니다.': 'Move by swiping on mobile.',
  '모바일': 'Mobile',
  '스와이프 기능 사용': 'Use swipe controls',
  '스와이프 감도': 'Swipe sensitivity',
  '화 경계 이동': 'Episode boundary movement',
  '폴더형 작품에서 현재 화의 실제 100% 바닥 이후 동작을 선택합니다.': 'Choose what happens after the true 100% bottom of the current episode in folder works.',
  '폴더형': 'Folder work',
  '수동': 'Manual',
  '자동': 'Auto',
  ': 다음 화는 하단 다음 버튼이나 단축키로만 이동합니다.': ': move to the next episode only with the bottom Next button or shortcut.',
  ': 현재 화가 실제 100% 바닥에 있을 때 한 번 더 아래로 스크롤하면 다음 화로 이동합니다.': ': when at the true 100% bottom, scroll down once more to move to the next episode.',
  '현재: 수동 — 다음 화는 하단 다음 버튼이나 단축키로만 이동합니다.': 'Current: Manual — move to the next episode only with the bottom Next button or shortcut.',
  '상단 safe-area 표시': 'Top safe-area display',
  '시계 · 독서 진행률 · 네트워크 상태는 상단 안전영역 내부 슬롯에 배치됩니다. 네트워크 상태의 자동 배치는 시계와 진행률 위치를 피해 안쪽 슬롯으로 이동합니다.': 'Clock, reading progress, and network status are placed in top safe-area slots. Automatic network placement avoids the clock and progress slots.',
  '시계': 'Clock',
  '상단 safe-area 내부 슬롯에 현재 시간을 표시합니다.': 'Show the current time in the top safe-area slot.',
  '시간': 'Time',
  '시계 기능 사용': 'Use clock',
  '표시 위치': 'Display position',
  '왼쪽 외곽 슬롯': 'Left outer slot',
  '가운데 슬롯': 'Center slot',
  '오른쪽 외곽 슬롯': 'Right outer slot',
  '시계 형식': 'Clock format',
  '24시간 (14:30)': '24-hour (14:30)',
  '12시간 (2:30)': '12-hour (2:30)',
  '오전/오후 표기': 'Show AM/PM',
  '타임존': 'Time zone',
  '기타 (직접 입력)': 'Other (manual input)',
  'UTC 오프셋 (분 단위, 예: 540 = UTC+9)': 'UTC offset in minutes, e.g. 540 = UTC+9',
  '독서 진행률': 'Reading progress',
  '상단 safe-area 내부 슬롯에 현재 읽기 위치를 퍼센트로 표시합니다.': 'Show the current reading position as a percentage in the top safe-area slot.',
  '진행률': 'Progress',
  '독서 진행률 사용': 'Show reading progress',
  '네트워크 상태': 'Network status',
  '네트워크와 프리패치 모드를 상단 safe-area 내부 배지로 표시합니다.': 'Show network and prefetch mode as a top safe-area badge.',
  '상태': 'Status',
  '네트워크 상태 표시': 'Show network status',
  '자동 배치 (시계/진행률 겹침 회피)': 'Auto placement (avoid clock/progress overlap)',
  '왼쪽 안쪽 슬롯': 'Left inner slot',
  '가운데 보조 슬롯': 'Center auxiliary slot',
  '오른쪽 안쪽 슬롯': 'Right inner slot',
  '남은 시간': 'Remaining time',
  '현재 읽기 속도를 기준으로 남은 예상 시간을 함께 보여줍니다.': 'Show estimated remaining time based on current reading speed.',
  '보조': 'Auxiliary',
  '독서율 옆에 남은 시간 표시': 'Show remaining time next to progress',
  '브라우저 전체화면 보정': 'Browser fullscreen correction',
  '브라우저마다 전체화면 viewport가 다르게 잡힐 수 있어 기본은 수동 보정 중심으로 둡니다.': 'Browsers can report fullscreen viewport differently, so manual correction is the default.',
  '보정': 'Correction',
  '자동 보정 사용(선택)': 'Use auto correction (optional)',
  '상단 추가 보정': 'Top extra correction',
  '하단 추가 보정': 'Bottom extra correction',
  '기본': 'Default',
  '약하게': 'Light',
  '강하게': 'Strong',
  '사용자 프리셋 / 고급 보정': 'User presets / advanced correction',
  '현재 화면 모드 확인 중': 'Checking current screen mode',
  '열기': 'Open',
  '브라우저별 사용자 프리셋': 'Browser-specific user presets',
  '기본 보정값으로 부족할 때만 열어 브라우저/PWA별 값을 저장합니다.': 'Open only when default correction is insufficient, then save browser/PWA-specific values.',
  '현재값 저장': 'Save current values',
  '새 프리셋': 'New preset',
  '이름 변경': 'Rename',
  '삭제': 'Delete',
  '권장 템플릿': 'Recommended templates',
  '복사': 'Copy',
  '측정 대기 중': 'Waiting for measurement',
  '저장 범위': 'Storage scope',
  '동기화 범위': 'Sync scope',
  '서버 상태 확인 중': 'Checking server status',
  '원격 위치': 'Remote position',
  '현재 기기': 'Current device',
  '우선 기기': 'Preferred device',
  '기기 이름': 'Device name',
  '이름 저장': 'Save name',
  'ID 복사': 'Copy ID',
  '우선 기기 선택': 'Select preferred device',
  '우선 기기 저장': 'Save preferred device',
  '상태 새로고침': 'Refresh status',
  '다른 기기 알림': 'Other device alerts',
  '다른 기기 위치 알림': 'Other-device position alerts',
  '다른 기기 접속 알림': 'Other-device connection alerts',
  '그 위치로 이동': 'Move to that position',
  '등록된 기기': 'Registered devices',
  '독서 위치, 북마크, 최근 열람, 즐겨찾기 데이터를 내보내고 가져오거나 삭제합니다.': 'Export, import, or delete reading positions, bookmarks, recent items, and favorites.',
  '📖 독서 데이터 관리': '📖 Reading data management',
  '내보내기': 'Export',
  '가져오기': 'Import',
  '현재 탭 전체 삭제': 'Delete all in current tab',
  '항목': 'Item',
  '선택한 항목 작업': 'Selected item actions',
  '즐겨찾기': 'Favorite',
  '저장 중...': 'Saving...',
  '위치 이동': 'Move position',
  '사용자 CSS 편집': 'Custom CSS editor',
  '공유 CSS와 기기 전용 CSS를 분리해 편집합니다. 전체 탭은 합산 미리보기입니다.': 'Edit shared CSS and device-only CSS separately. The All tab is a combined preview.',
  '초기화': 'Reset',
  '적용': 'Apply',
  '범위': 'Scope',
  '공유': 'Shared',
  '기기': 'Device',
  '전체': 'All',
  '편집기': 'Editor',
  '가이드': 'Guide',
  '핵심 예시': 'Core example',
  '저장 규칙': 'Save rules',
  '모든 기기 공통': 'Common to all devices',
  '이 기기만': 'This device only',
  '공유+기기 합산, 보기 전용': 'Shared + device combined, read-only',
  '주요 변수': 'Key variables',
  '강조색': 'Accent color',
  '앱 배경': 'App background',
  '테두리': 'Border',
  '뷰어 배경': 'Viewer background',
  '뷰어 글자': 'Viewer text',
  'UI 크기': 'UI size',
  '상하 여백': 'Vertical margin',
  '좌우 여백': 'Horizontal margin',
  '사이드바': 'Sidebar',
  '안전영역': 'Safe area',
  '메인 글자': 'Main text',
  '보조 글자': 'Secondary text',
  '약한 글자': 'Muted text',
  '패널 배경': 'Panel background',
  '서브 배경': 'Sub background',
  '모달 표면': 'Modal surface',
  '전환속도': 'Transition speed',
  'UI 폰트': 'UI font',
  '뷰어 폰트': 'Viewer font',
  '코드 폰트': 'Code font',
  '키를 클릭한 뒤 원하는 키를 누르세요. Esc는 취소, Backspace는 단축키 해제입니다.': 'Click a key, then press the desired key. Esc cancels, Backspace clears the shortcut.',
  '소설 내용 검색': 'Search novel text',
  '기본값은 표시중/캐시 chunk 검색이며, 전체검색을 켜면 서버 content API를 사용해 작품 전체를 검색합니다.': 'By default, search visible/cached chunks. Turn on full search to search the whole work through the server content API.',
  '전체검색': 'Full search',
  'OFF: 표시중/캐시만 · ON: 서버 전체 검색': 'OFF: visible/cache only · ON: full server search',
  '▲ 이전': '▲ Previous',
  '▼ 다음': '▼ Next',
  '캐시': 'Cache',
  '네트워크': 'Network',
  '검색 가능 범위를 확인하세요.': 'Check the searchable range.',
  '범위 확인': 'Check range',
  '누락 재검색': 'Retry missing',
  '검색 결과 0 / 0': 'Search results 0 / 0',
  '검색 결과 이동 리모컨': 'Search result navigation remote',
  '텍스트 전처리 설정': 'Text preprocessing settings',
  '프리셋 적용과 세부 옵션 변경은 명시적인 버튼 동작으로만 반영됩니다.': 'Preset and detailed option changes are applied only by explicit button actions.',
  '1. 프리셋': '1. Preset',
  '명시적 적용': 'Explicit apply',
  '선택 항목 적용': 'Apply selected items',
  '전체 적용': 'Apply all',
  '프리셋을 선택하세요.': 'Select a preset.',
  '부분 적용 항목': 'Partial apply items',
  '체크된 항목만 덮어쓰기': 'Overwrite checked items only',
  '광고·링크': 'Ads · links',
  '장 제목': 'Chapter title',
  '줄바꿈': 'Line breaks',
  '문장 띄우기': 'Sentence spacing',
  '대화문': 'Dialogue',
  '문단 밀도': 'Paragraph density',
  '후기·공지': 'Afterword · notices',
  '2. 세부 옵션': '2. Details',
  '광고·링크성 줄 제거': 'Remove ad/link-like lines',
  '장·화 제목 앞 여백 정리': 'Clean spacing around chapter titles',
  '과도한 줄바꿈 보정': 'Correct excessive line breaks',
  '붙어 있는 문장 사이 띄우기': 'Add spacing between joined sentences',
  '대화문 기준 줄바꿈': 'Break lines by dialogue',
  '문단 밀도 자동 최적화': 'Auto-optimize paragraph density',
  '후기·공지 제거 강화': 'Stronger afterword/notice removal',
  '3. 미리보기': '3. Preview',
  '미리보기 새로고침': 'Refresh preview',
  '작품을 열면 현재 위치 기준 미리보기가 표시됩니다.': 'Open a work to show a preview based on the current position.',
  '적용 예정 옵션 요약이 여기에 표시됩니다.': 'The pending option summary appears here.',
  '취소': 'Cancel',
  '글꼴 선택': 'Choose font',
  '적용 중': 'Applying',
  '내 계정 기본': 'Account default',
  '이 기기 전용 해제': 'Clear device-only font',
  '시스템 글꼴': 'System fonts',
  '내장': 'Built-in',
  '내 계정 전용 글꼴': 'Account-only fonts',
  '계정 전용': 'Account-only',
  '내 계정에 업로드된 글꼴이 없습니다.': 'No fonts uploaded to this account.',
  '+ 내 계정 글꼴 추가 (.ttf · .otf · .woff · .woff2)': '+ Add account font (.ttf · .otf · .woff · .woff2)',
  '복구 센터': 'Recovery center',
  '점검 권장': 'Check recommended',
  '저장 재시도': 'Retry save',
  '새로고침': 'Refresh',
  '백업 · 위험 작업': 'Backup · dangerous actions',
  '복구 JSON 내보내기': 'Export recovery JSON',
  '복구 JSON 가져오기': 'Import recovery JSON',
  '프리패치 정리': 'Clear prefetch',
  '캐시 전체 정리': 'Clear all cache',
  '사용자 데이터 초기화': 'Reset user data',
  '회귀 체크리스트 복사': 'Copy regression checklist',
  '요약': 'Summary',
  '검색': 'Search',
  '개발자 진단': 'Developer diagnostics',
  '원본 진단': 'Raw diagnostics',
  '수동 진단': 'Manual diagnostics',
  '정책': 'Policy',
  '상세 상태': 'Detailed status',
  '마지막 체크포인트': 'Last checkpoint',
  '고아 데이터': 'Orphan data',
  '수동 스크롤 진단': 'Manual scroll diagnostics',
  'PC 드래그 부드러움': 'PC drag smoothness',
  '모바일 스크롤 부드러움': 'Mobile scroll smoothness',
  '스크롤 진단 기록': 'Scroll diagnostics log',
  '진단 기록 내보내기': 'Export diagnostics log',
  '진단 기록 가져오기': 'Import diagnostics log',
  '진단 기록 비우기': 'Clear diagnostics log',
  '최근 수동 스크롤 진단 기록 없음': 'No recent manual scroll diagnostics.',
  '프리셋': 'Presets',
  '사용자 테마': 'User themes',
  '저장된 사용자 테마가 없습니다.': 'No saved user themes.',
  '직접 지정': 'Manual colors',
  '패널': 'Panel',
  '강조': 'Accent',
  '본문 배경': 'Reader background',
  '본문 글자': 'Reader text',
  '현재 색상': 'Current colors',
  '소설 뷰어 · 미리보기': 'Novel viewer · preview',
  '현재 테마 다시 읽기': 'Reload current theme',
  '앱/리더/검색/동기화/기기/스토리지/DOM/캐시/오류/성능 상태': 'App/reader/search/sync/device/storage/DOM/cache/error/performance status',
  '캐시 관리': 'Cache management',
  '검색 진단': 'Search diagnostics',
  '디버그 표시': 'Show debug',
  '앱 상태': 'App state',
  'UI/테마': 'UI/theme',
  '리더 상태': 'Reader state',
  '검색 상태': 'Search state',
  '동기화 상태': 'Sync state',
  '기기/공유 상태': 'Device/shared state',
  '스토리지': 'Storage',
  'DOM/목록': 'DOM/list',
  '네트워크/API': 'Network/API',
  '오류 로그': 'Error log',
  '성능': 'Performance',
  '테마': 'Theme',
  '현재 작품': 'Current work',
  '검색 결과': 'Search results',
  '로드 단위 수': 'Loaded units',
  '최근 오류': 'Recent errors',
  '마지막 갱신': 'Last updated',
  '검색 캐시': 'Search cache',
  '대기 중': 'Waiting',
  '현재': 'Current',
  '사용자 정의 언어': 'Custom language',
  '공통': 'shared',
  '개인': 'personal',
  '언어 이름': 'Language name',
  '언어 코드': 'Language code',
  '템플릿 채우기': 'Fill template',
  '언어 저장': 'Save language',
  '저장 후 사용': 'Save and use',
  '삭제': 'Delete',
  '언어 이름과 코드를 만들고, 표시할 문구를 직접 입력합니다. 한 줄에 원문=표시문구 형식으로 작성하세요.': 'Create a language name and code, then type the display strings directly. Use one source=display string per line.',
  '예: 설정=Settings 또는 JSON {"설정":"Settings"}. 입력하지 않은 문구는 기본 한국어/영어 fallback을 사용합니다.': 'Example: 설정=Settings or JSON {"설정":"Settings"}. Unspecified strings fall back to the built-in Korean/English text.',
  '사용자 정의 언어 표시 문구': 'Custom language display strings'
};
