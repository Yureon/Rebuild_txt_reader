import { clamp, createEl } from '../../core/utils.mjs';
import { persistPrefs } from '../../state/app-state.mjs';
import { displayFontName, ensureFontStylesheetForFamily, isDeviceFontOverrideActive, resolveActiveFontFamily, resolveSharedFontFamily } from './font-resources.mjs';
import { updatePreprocessSummary } from './preprocess.mjs';
import { applyCustomCssRules } from './custom-css.mjs';
import { applyFunctionalPrefs } from './controls.mjs';
import { applySiteLanguage } from './site-language.mjs';

export function applyPrefs(app) {
  const p = app.state.prefs;
  document.body.dataset.theme = p.themeMode === 'dark' ? 'dark' : 'light';
  document.body.classList.toggle('light', p.themeMode !== 'dark');
  document.documentElement.style.setProperty('--ui-fs', `${clamp(p.uiFontSize, 12, 22)}px`);
  document.documentElement.style.setProperty('--brightness', String(clamp(p.brightness, 50, 130)));
  document.documentElement.style.setProperty('--rd-pad-h', String(clamp(p.padH, 0, 120)));
  document.documentElement.style.setProperty('--rd-pad-v', String(clamp(p.padV, 0, 160)));
  if (p.readerBg) document.documentElement.style.setProperty('--reader-bg', p.readerBg);
  if (p.readerText) document.documentElement.style.setProperty('--reader-text', p.readerText);
  if (p.themeColors) applyThemeColors(p.themeColors);
  applyCustomCssRules(app);
  applyFunctionalPrefs(app);
  const activeFontFamily = resolveActiveFontFamily(p);
  ensureFontStylesheetForFamily(activeFontFamily);
  if (app.els.content) {
    app.els.content.style.fontSize = `${clamp(p.readerFontSize, 10, 40)}px`;
    app.els.content.style.lineHeight = String(clamp(p.lineHeight, 1.2, 3.5));
    const readerWidth = Number(p.width) || 680;
    app.els.content.style.maxWidth = readerWidth >= 9999 ? 'none' : `${clamp(readerWidth, 320, 1400)}px`;
    app.els.content.style.fontFamily = activeFontFamily;
  }
  if (app.els.reader) {
    app.els.reader.style.background = 'var(--reader-bg)';
    app.els.reader.style.color = 'var(--reader-text)';
  }
  app.reader?.invalidateLayout?.();
  syncSettingInputs(app);
  applySiteLanguage(app);
  persistPrefs(app.state);
}

export function applyThemeColors(colors) {
  if (!colors) return;
  const targets = [document.documentElement, document.body].filter(Boolean);
  const setVar = (name, value) => {
    if (!value) return;
    targets.forEach(target => target.style.setProperty(name, value));
  };
  const bg = colors.bg;
  const surface = colors.surface;
  const text = colors.text;
  const accent = colors.accent;

  setVar('--bg', bg);
  setVar('--surface', surface);
  setVar('--text', text);
  if (accent) {
    setVar('--accent', accent);
    setVar('--accent2', `color-mix(in srgb, ${accent} 78%, #fff 22%)`);
  }
  setVar('--reader-bg', colors.readerBg);
  setVar('--reader-text', colors.readerText);

  if (bg && text) {
    setVar('--bg2', `color-mix(in srgb, ${bg} 88%, ${text} 12%)`);
    setVar('--bg3', `color-mix(in srgb, ${bg} 78%, ${text} 22%)`);
    setVar('--text2', `color-mix(in srgb, ${text} 72%, ${bg} 28%)`);
    setVar('--text3', `color-mix(in srgb, ${text} 48%, ${bg} 52%)`);
    setVar('--border', `color-mix(in srgb, ${text} 16%, transparent)`);
  }
  if (surface && accent) setVar('--cat-bg', `color-mix(in srgb, ${surface} 72%, ${accent} 28%)`);
  if (text && accent) setVar('--cat-text', `color-mix(in srgb, ${text} 82%, ${accent} 18%)`);
}

export function syncSettingInputs(app) {
  const p = app.state.prefs;
  const pairs = [
    ['uiFsVal', `${p.uiFontSize}px`], ['uiFsSlider', p.uiFontSize], ['animVal', `${p.animationsMs}ms`], ['animRange', p.animationsMs],
    ['fsVal', `${p.readerFontSize}px`], ['lhValue', Number(p.lineHeight).toFixed(1)], ['lhSlider', clamp(p.lineHeight, 1.2, 3.5)], ['lwValue', formatReaderWidthValue(p.width)], ['lwSlider', sliderReaderWidthValue(p.width)],
    ['padHVal', `${p.padH}px`], ['padHSlider', p.padH], ['padVVal', `${p.padV}px`], ['padVSlider', p.padV], ['brightnessVal', `${p.brightness}%`], ['brightnessRange', p.brightness],
    ['customBg', p.readerBg], ['customText', p.readerText], ['currentFontName', `${displayFontName(resolveActiveFontFamily(p))}${isDeviceFontOverrideActive(p) ? ' · 이 기기' : ''}`]
  ];
  pairs.forEach(([key, value]) => {
    const el = app.els[key];
    if (!el) return;
    if ('value' in el) el.value = value;
    else el.textContent = value;
  });
  if (app.els.fontActiveName) app.els.fontActiveName.textContent = displayFontName(resolveActiveFontFamily(p));
  if (app.els.fontActiveScope) app.els.fontActiveScope.textContent = isDeviceFontOverrideActive(p) ? '이 기기 전용' : '내 계정 기본';
  if (app.els.clearDeviceFontBtn) app.els.clearDeviceFontBtn.disabled = !isDeviceFontOverrideActive(p);
  if (app.els.fontModalBtn) app.els.fontModalBtn.dataset.fontScope = isDeviceFontOverrideActive(p) ? 'device' : 'shared';
  if (app.els.fontModalBtn) app.els.fontModalBtn.title = isDeviceFontOverrideActive(p)
    ? `내 계정 기본 글꼴: ${displayFontName(resolveSharedFontFamily(p))}`
    : '내 계정 기본 글꼴을 사용 중입니다.';
  syncReaderPresetButtons(p);
  const checks = {
    preOptRemoveNoise: p.preprocess.removeNoise,
    preOptChapterSpacing: p.preprocess.chapterSpacing,
    preOptCollapseBreaks: p.preprocess.collapseBreaks,
    preOptSplitDense: p.preprocess.splitDense,
    preOptDialogueBreak: p.preprocess.dialogueBreak,
    preOptParagraphOptimize: p.preprocess.paragraphOptimize,
    preOptAggressive: p.preprocess.aggressive
  };
  Object.entries(checks).forEach(([k, v]) => { if (app.els[k]) app.els[k].checked = !!v; });
  updatePreprocessSummary(app);
}

export function bindAppearanceControls(app, { on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);
  const set = (patch) => { Object.assign(app.state.prefs, patch); applyPrefs(app); };
  const prefs = () => app.state.prefs;
  listen(app.els.themeToggleBtn, 'click', () => {
    app.els.openThemeEditorBtn?.click?.();
    if (!app.els.openThemeEditorBtn && typeof app.openLayer === 'function') app.openLayer('themeEditorOverlay');
  });
  listen(app.els.uiFsMinus, 'click', () => set({ uiFontSize: clamp(prefs().uiFontSize - 1, 12, 22) }));
  listen(app.els.uiFsPlus, 'click', () => set({ uiFontSize: clamp(prefs().uiFontSize + 1, 12, 22) }));
  listen(app.els.uiFsSlider, 'input', ev => set({ uiFontSize: clamp(ev.target.value, 12, 22) }));
  listen(app.els.animRange, 'input', ev => set({ animationsMs: clamp(ev.target.value, 0, 600) }));
  listen(app.els.fsMinus, 'click', () => set({ readerFontSize: clamp(prefs().readerFontSize - 1, 10, 40) }));
  listen(app.els.fsPlus, 'click', () => set({ readerFontSize: clamp(prefs().readerFontSize + 1, 10, 40) }));
  listen(app.els.lhSlider, 'input', ev => set({ lineHeight: clamp(ev.target.value, 1.2, 3.5) }));
  listen(app.els.lwSlider, 'input', ev => set({ width: clamp(ev.target.value, 320, 1400) }));
  document.querySelectorAll('button[data-lh]').forEach(button => {
    listen(button, 'click', () => set({ lineHeight: clamp(button.dataset.lh, 1.2, 3.5) }));
  });
  document.querySelectorAll('button[data-lw]').forEach(button => {
    listen(button, 'click', () => {
      const value = Number(button.dataset.lw);
      set({ width: value >= 9999 ? 9999 : clamp(value, 320, 1400) });
    });
  });
  listen(app.els.padHSlider, 'input', ev => set({ padH: clamp(ev.target.value, 0, 120) }));
  listen(app.els.padVSlider, 'input', ev => set({ padV: clamp(ev.target.value, 0, 160) }));
  listen(app.els.brightnessRange, 'input', ev => set({ brightness: clamp(ev.target.value, 50, 130) }));
  listen(app.els.customBg, 'input', ev => set({ readerBg: ev.target.value }));
  listen(app.els.customText, 'input', ev => set({ readerText: ev.target.value }));

  renderSwatches(app.els.bgSwatches, ['#faf7f2','#f5f4f0','#f4f3ea','#18191c','#151812','#111111'], color => set({ readerBg: color }));
  renderSwatches(app.els.textSwatches, ['#2a2118','#202120','#24251f','#d8d5cf','#d9d7cc','#eeeeea'], color => set({ readerText: color }));
}


function formatReaderWidthValue(width) {
  const value = Number(width) || 680;
  return value >= 9999 ? '화면 맞춤' : `${Math.round(clamp(value, 320, 1400))}px`;
}

function sliderReaderWidthValue(width) {
  const value = Number(width) || 680;
  return value >= 9999 ? 1400 : clamp(value, 320, 1400);
}

function syncReaderPresetButtons(prefs = {}) {
  const lineHeight = Number(prefs.lineHeight) || 2.1;
  const width = Number(prefs.width) || 680;
  syncPresetButtonGroup('button[data-lh]', lineHeight, 0.05);
  syncPresetButtonGroup('button[data-lw]', width, 8, value => value >= 9999 && width >= 9999);
}

function syncPresetButtonGroup(selector, currentValue, tolerance = 0.01, specialMatcher = null) {
  document.querySelectorAll(selector).forEach(button => {
    const value = Number(button.dataset.lh ?? button.dataset.lw);
    const matched = typeof specialMatcher === 'function' && specialMatcher(value)
      ? true
      : Math.abs(value - currentValue) <= tolerance;
    button.classList.toggle('active', matched);
    button.setAttribute('aria-pressed', matched ? 'true' : 'false');
  });
}

function renderSwatches(box, colors, onPick) {
  if (!box) return;
  box.innerHTML = '';
  colors.forEach(color => {
    box.append(createEl('button', { class: 'swatch', type: 'button', title: color, style: `background:${color}` , onclick: () => onPick(color)}));
  });
}
