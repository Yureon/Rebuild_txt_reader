const { runModuleSmokeScript } = require('./smoke-child-runner.js');

const UI_RUNTIME_SMOKE_PASS = 'v236-ui-runtime-smoke-pass';
const UI_SAFE_AREA_SHORTCUT_SMOKE_PASS = 'v237-ui-safe-area-shortcut-smoke-pass';
const UI_RUNTIME_CHILD_ISOLATION_PASS = 'v261-ui-runtime-child-isolation-pass';

async function runUiRuntimeSmoke(projectRoot) {
  if (!projectRoot) throw new Error('runUiRuntimeSmoke requires projectRoot');
  const script = String.raw`
    Object.defineProperty(globalThis, 'navigator', { value:{ userAgent:'Chrome UiRuntimeSmoke' }, configurable:true });
    const nativeSetTimeout = globalThis.setTimeout?.bind(globalThis);
    const store = new Map();
    const makeClassList = () => {
      const values = new Set();
      return {
        add(...items){ items.forEach(item => values.add(item)); },
        remove(...items){ items.forEach(item => values.delete(item)); },
        contains(item){ return values.has(item); },
        toggle(item, force){ const next = force === undefined ? !values.has(item) : !!force; if (next) values.add(item); else values.delete(item); return next; },
        toString(){ return Array.from(values).join(' '); }
      };
    };
    const makeEl = (tag = 'div', id = '') => {
      const listeners = new Map();
      const el = {
        tagName:String(tag).toUpperCase(), id, value:'', checked:false, disabled:false, hidden:false, textContent:'', innerHTML:'', dataset:{}, children:[], parentElement:null, isConnected:true, offsetParent:{},
        style:{ display:'', setProperty(key, value){ this[key] = String(value); } },
        classList:makeClassList(),
        append(...items){ items.flat().filter(Boolean).forEach(item => { if (typeof item === 'object') item.parentElement = el; this.children.push(item); }); },
        appendChild(item){ if (item && typeof item === 'object') item.parentElement = el; this.children.push(item); return item; },
        remove(){ this.removed = true; },
        setAttribute(key, value){ this[key] = String(value); },
        getAttribute(key){ return this[key] || ''; },
        hasAttribute(key){ return Object.prototype.hasOwnProperty.call(this, key); },
        addEventListener(type, handler){ if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
        removeEventListener(type, handler){ listeners.set(type, (listeners.get(type) || []).filter(fn => fn !== handler)); },
        dispatch(type, extra = {}){ (listeners.get(type) || []).forEach(fn => fn({ target:el, preventDefault(){}, stopPropagation(){}, ...extra })); },
        focus(){ document.activeElement = el; },
        contains(node){ return node === el || this.children.includes(node); },
        closest(){ return null; },
        scrollIntoView(){ this.scrolled = true; },
        querySelectorAll(selector){ if (selector === '.vsp-tab' || selector === '.vsp-panel') return []; return []; },
        querySelector(){ return null; },
        getClientRects(){ return [1]; }
      };
      return el;
    };
    globalThis.Node = Object;
    const getEl = (id) => {
      if (!store.has(id)) store.set(id, makeEl('div', id));
      return store.get(id);
    };
    const tabs = ['general-panel', 'viewer-panel', 'func-panel'].map(id => { const tab = makeEl('button'); tab.dataset.tab = id; return tab; });
    const panels = ['general-panel', 'viewer-panel', 'func-panel'].map(id => makeEl('div', id));
    panels.forEach(panel => store.set(panel.id, panel));
    const statusTab = makeEl('button');
    statusTab.dataset.ftab = 'fstatusbar-panel';
    const statusPanel = makeEl('div', 'fstatusbar-panel');
    const safeAreaFitCard = makeEl('section', 'safe-area-fit-card');
    store.set('fstatusbar-panel', statusPanel);
    store.set('safe-area-fit-card', safeAreaFitCard);
    const funcPanel = panels.find(panel => panel.id === 'func-panel');
    funcPanel.querySelectorAll = (selector) => selector === '.vsp-tab' ? [statusTab] : selector === '.vsp-panel' ? [statusPanel] : [];
    funcPanel.querySelector = () => null;
    globalThis.localStorage = { getItem(){ return null; }, setItem(){}, removeItem(){} };
    globalThis.requestAnimationFrame = fn => { if (typeof fn === 'function') fn(); return 0; };
    globalThis.cancelAnimationFrame = () => {};
    globalThis.window = {
      innerWidth:1280, innerHeight:720, visualViewport:null,
      requestAnimationFrame:globalThis.requestAnimationFrame,
      cancelAnimationFrame:globalThis.cancelAnimationFrame,
      setTimeout(fn){ return nativeSetTimeout && typeof fn === 'function' ? nativeSetTimeout(fn, 0) : 0; }, clearTimeout(id){ try { globalThis.clearTimeout?.(id); } catch (_) {} },
      setInterval(){ return 1; }, clearInterval(){},
      matchMedia(){ return { matches:false, addEventListener(){}, removeEventListener(){} }; },
      addEventListener(){}, removeEventListener(){}, dispatchEvent(){}
    };
    globalThis.document = {
      body:getEl('body'), documentElement:getEl('html'), head:getEl('head'), activeElement:null, fullscreenElement:null,
      getElementById(id){ return getEl(id); },
      createElement(tag){ return makeEl(tag); },
      createTextNode(text){ return { nodeType:3, textContent:String(text) }; },
      addEventListener(){}, removeEventListener(){},
      querySelectorAll(selector){ if (selector === '.sp-tab') return tabs; if (selector === '.sp-tab-panel') return panels; if (selector === '.vsp-tab') return [statusTab]; if (selector === '.vsp-panel') return [statusPanel]; return []; },
      querySelector(selector){ if (selector === '.vsp-tab[data-ftab="fstatusbar-panel"]') return statusTab; return null; }
    };
    document.body.dataset = {};
    document.documentElement.style = { setProperty(key, value){ this[key] = String(value); } };
    document.documentElement.dataset = {};
    const { createState } = await import('./public/scripts/rebuild/state/app-state.mjs');
    const { installUi } = await import('./public/scripts/rebuild/features/ui.mjs');
    const app = { state:createState({ profile:'site' }), isMobileProfile:false, els:{}, uiCleanup:null };
    installUi(app);
    if (typeof app.uiCleanup !== 'function') throw new Error('installUi did not register cleanup');
    getEl('settings-btn').dispatch('click');
    if (!getEl('settings-overlay').classList.contains('open') || !getEl('settings-panel').classList.contains('open')) throw new Error('settings button did not open settings layer');
    tabs[2].dispatch('click');
    if (!tabs[2].classList.contains('active') || !panels[2].classList.contains('active')) throw new Error('settings tab click did not activate func panel through installUi');
    // v367 removed the General-tab safe-area shortcut card; direct safe-area modal smoke is no longer required here.
    getEl('settings-close').dispatch('click');
    if (getEl('settings-overlay').classList.contains('open') || getEl('settings-panel').classList.contains('open')) throw new Error('settings close did not close settings layer');
    app.uiCleanup();
  `;
  await runModuleSmokeScript(projectRoot, script, { label: 'ui runtime smoke', timeoutMs: 8000, forceChild: true })
  return { pass: UI_RUNTIME_SMOKE_PASS, safeAreaShortcutPass: UI_SAFE_AREA_SHORTCUT_SMOKE_PASS, childIsolationPass: UI_RUNTIME_CHILD_ISOLATION_PASS };
}

module.exports = {
  UI_RUNTIME_SMOKE_PASS,
  UI_SAFE_AREA_SHORTCUT_SMOKE_PASS,
  UI_RUNTIME_CHILD_ISOLATION_PASS,
  runUiRuntimeSmoke
};
