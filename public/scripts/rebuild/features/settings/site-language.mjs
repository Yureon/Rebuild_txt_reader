import {
  SITE_LANGUAGE_PASS,
  SUPPORTED_SITE_LANGUAGES,
  CUSTOM_SITE_LANGUAGE_PREFIX,
  SITE_LANGUAGE_PACK_PREFIX,
  applySiteLanguage,
  customLanguageValue,
  installSiteLanguageRuntime,
  isCustomSiteLanguage,
  isSiteLanguagePack,
  loadSiteLanguagePacks,
  normalizeCustomLanguageId,
  normalizeCustomLanguageMap,
  normalizeSiteCustomLanguages,
  normalizeSiteLanguage,
  normalizeSiteLanguagePacks,
  resolveSiteLanguage,
  siteLanguagePackValue,
  syncSiteLanguageInput,
  t
} from './site-language-runtime.mjs';

export {
  SITE_LANGUAGE_PASS,
  SUPPORTED_SITE_LANGUAGES,
  CUSTOM_SITE_LANGUAGE_PREFIX,
  SITE_LANGUAGE_PACK_PREFIX,
  applySiteLanguage,
  customLanguageValue,
  installSiteLanguageRuntime,
  isCustomSiteLanguage,
  isSiteLanguagePack,
  loadSiteLanguagePacks,
  normalizeCustomLanguageId,
  normalizeCustomLanguageMap,
  normalizeSiteCustomLanguages,
  normalizeSiteLanguage,
  normalizeSiteLanguagePacks,
  resolveSiteLanguage,
  siteLanguagePackValue,
  syncSiteLanguageInput,
  t
};

export const SITE_LANGUAGE_EDITOR_SPLIT_PASS = 'v595-site-language-editor-split-pass';
const MAX_CUSTOM_LANGUAGES = 12;
const MAX_CUSTOM_LANGUAGE_ENTRIES = 600;
let englishTemplatePromise = null;

function getEnglishTemplateMap() {
  if (!englishTemplatePromise) {
    englishTemplatePromise = import('./site-language-en.mjs')
      .then(module => module.EN && typeof module.EN === 'object' ? module.EN : Object.freeze({}))
      .catch(error => {
        englishTemplatePromise = null;
        console.warn?.('[txt-reader] language template load failed', error);
        return Object.freeze({});
      });
  }
  return englishTemplatePromise;
}

function getSiteLanguageEditorLayer() {
  return {
    openBtn: document.getElementById('open-site-custom-language-modal-btn'),
    overlay: document.getElementById('site-language-editor-overlay'),
    modal: document.getElementById('site-language-editor-modal'),
    closeBtn: document.getElementById('site-language-editor-close')
  };
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
  if (!isCustomSiteLanguage(selected)) return null;
  const id = selected.slice(CUSTOM_SITE_LANGUAGE_PREFIX.length);
  return normalizeSiteCustomLanguages(app?.state?.prefs?.siteCustomLanguages || []).find(lang => lang.id === id) || null;
}

function selectedSiteLanguagePack(app) {
  const selected = normalizeSiteLanguage(app?.state?.prefs?.siteLanguage || 'auto');
  if (!isSiteLanguagePack(selected)) return null;
  const id = selected.slice(SITE_LANGUAGE_PACK_PREFIX.length);
  return normalizeSiteLanguagePacks(app?.state?.siteLanguages || globalThis.__txtReaderSiteLanguages || [])
    .find(lang => lang.id === id && lang.enabled !== false) || null;
}

function serializeCustomLanguageMap(map = {}) {
  return Object.entries(normalizeCustomLanguageMap(map))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
}

function parseCustomLanguageMap(raw = '') {
  const text = String(raw || '').trim();
  if (!text) return {};
  if (text.startsWith('{')) return normalizeCustomLanguageMap(JSON.parse(text));
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

function setCustomLanguageStatus(app, message) {
  const status = getEditorElements(app).status;
  if (status) status.textContent = message || '';
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

function openSiteLanguageEditor(app) {
  const { overlay, modal } = getSiteLanguageEditorLayer();
  if (!overlay || !modal) return;
  syncCustomLanguageEditor(app);
  if (typeof app?.openLayer === 'function') app.openLayer('siteLanguageEditorOverlay', 'siteLanguageEditorModal');
  else {
    overlay.classList.add('open');
    modal.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body?.classList.add('settings-submodal-open');
  }
  window.setTimeout?.(() => {
    const els = getEditorElements(app);
    (els.name || els.code || els.map)?.focus?.();
  }, 0);
}

function closeSiteLanguageEditor(app) {
  const { overlay, modal } = getSiteLanguageEditorLayer();
  if (typeof app?.closeLayer === 'function') app.closeLayer('siteLanguageEditorOverlay', 'siteLanguageEditorModal');
  else {
    overlay?.classList.remove('open');
    modal?.classList.remove('open');
    overlay?.setAttribute('aria-hidden', 'true');
    document.body?.classList.remove('settings-submodal-open');
  }
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
  } catch (error) {
    setCustomLanguageStatus(app, `문구 형식을 확인하세요: ${error?.message || error}`);
    return;
  }
  if (!Object.keys(map).length) {
    setCustomLanguageStatus(app, '표시 문구를 1개 이상 입력하세요. 예: 설정=Settings');
    return;
  }
  const existing = normalizeSiteCustomLanguages(app.state.prefs.siteCustomLanguages || []).filter(lang => lang.id !== id);
  app.state.prefs.siteCustomLanguages = [{ id, name: name || id, map, updatedAt: Date.now() }, ...existing].slice(0, MAX_CUSTOM_LANGUAGES);
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

async function fillCustomLanguageTemplate(app) {
  const els = getEditorElements(app);
  if (!els.map) return;
  const selected = selectedCustomLanguage(app);
  const selectedSite = selectedSiteLanguagePack(app);
  if (selected?.map && Object.keys(selected.map).length) {
    els.map.value = serializeCustomLanguageMap(selected.map);
  } else if (selectedSite?.map && Object.keys(selectedSite.map).length) {
    els.map.value = serializeCustomLanguageMap(selectedSite.map);
    if (els.code && !els.code.value) els.code.value = selectedSite.id;
    if (els.name && !els.name.value) els.name.value = `${selectedSite.name} override`;
  } else {
    setCustomLanguageStatus(app, '템플릿 불러오는 중…');
    const english = await getEnglishTemplateMap();
    els.map.value = Object.keys(english).slice(0, 180).map(key => `${key}=${english[key]}`).join('\n');
  }
  if (!els.name?.value) els.name.value = selected?.name || selectedSite?.name || 'Custom';
  setCustomLanguageStatus(app, '템플릿을 채웠습니다. 오른쪽 값을 원하는 표시 문구로 바꾼 뒤 저장하세요.');
}

export function bindSiteLanguageControl(app, { applyPrefs = null, on = null } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const select = app?.els?.siteLanguageSelect || document.getElementById('site-language-select');
  const combo = app?.els?.siteLanguageCombobox || document.getElementById('site-language-combobox');
  const trigger = app?.els?.siteLanguageTrigger || document.getElementById('site-language-trigger');
  const list = app?.els?.siteLanguageList || document.getElementById('site-language-list');
  const apply = () => {
    if (typeof applyPrefs === 'function') applyPrefs(app);
    else applySiteLanguage(app);
  };
  const setOpen = open => {
    const next = Boolean(open && combo && trigger && list);
    if (combo) combo.dataset.open = next ? 'true' : 'false';
    if (trigger) trigger.setAttribute('aria-expanded', next ? 'true' : 'false');
    if (list) list.hidden = !next;
    if (next) {
      window.requestAnimationFrame?.(() => {
        const active = list?.querySelector('[role="option"][aria-selected="true"]') || list?.querySelector('[role="option"]');
        active?.focus?.({ preventScroll:true });
        active?.scrollIntoView?.({ block:'nearest' });
      });
    }
  };
  const choose = value => {
    if (!select) return;
    const next = normalizeSiteLanguage(value || 'auto');
    if (select.value !== next) select.value = next;
    select.dispatchEvent(new Event('change', { bubbles:true }));
  };
  const moveOptionFocus = delta => {
    const items = Array.from(list?.querySelectorAll?.('[role="option"]') || []);
    if (!items.length) return;
    const index = Math.max(0, items.indexOf(document.activeElement));
    const next = items[(index + delta + items.length) % items.length];
    items.forEach(item => { item.tabIndex = item === next ? 0 : -1; });
    next.focus();
  };
  listen(select, 'change', event => {
    const next = normalizeSiteLanguage(event?.target?.value || 'auto');
    if (!app?.state?.prefs) return;
    app.state.prefs.siteLanguage = next;
    setOpen(false);
    syncCustomLanguageEditor(app);
    apply();
  });
  listen(trigger, 'click', () => setOpen(combo?.dataset.open !== 'true'));
  listen(trigger, 'keydown', event => {
    if (!['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    setOpen(true);
  });
  listen(list, 'click', event => {
    const option = event.target?.closest?.('[data-site-language-value]');
    if (option) choose(option.dataset.siteLanguageValue);
  });
  listen(list, 'keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      moveOptionFocus(event.key === 'ArrowDown' ? 1 : -1);
      return;
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const items = Array.from(list?.querySelectorAll?.('[role="option"]') || []);
      const next = event.key === 'Home' ? items[0] : items.at(-1);
      next?.focus?.();
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(document.activeElement?.dataset?.siteLanguageValue);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      trigger?.focus?.();
    }
  });
  listen(document, 'pointerdown', event => {
    if (combo?.dataset.open === 'true' && !combo.contains(event.target)) setOpen(false);
  }, true);
  listen(app?.els?.siteCustomLanguageSave || document.getElementById('site-custom-language-save'), 'click', () => saveCustomLanguageFromEditor(app, { applyPrefs: apply }));
  listen(app?.els?.siteCustomLanguageUse || document.getElementById('site-custom-language-use'), 'click', () => saveCustomLanguageFromEditor(app, { applyPrefs: apply, useAfterSave: true }));
  listen(app?.els?.siteCustomLanguageDelete || document.getElementById('site-custom-language-delete'), 'click', () => deleteSelectedCustomLanguage(app, { applyPrefs: apply }));
  listen(app?.els?.siteCustomLanguageTemplate || document.getElementById('site-custom-language-template'), 'click', () => { void fillCustomLanguageTemplate(app); });
  const editorLayer = getSiteLanguageEditorLayer();
  listen(editorLayer.openBtn, 'click', () => openSiteLanguageEditor(app));
  listen(editorLayer.closeBtn, 'click', () => closeSiteLanguageEditor(app));
  listen(editorLayer.overlay, 'click', () => closeSiteLanguageEditor(app));
  loadSiteLanguagePacks(app, { applyAfterLoad: true });
}
