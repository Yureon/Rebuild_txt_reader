import { createEl, downloadTextFile } from '../../core/utils.mjs';
import { status, toast } from '../ui.mjs';
import { THEME_PRESETS } from './theme-presets.mjs';
import { THEME_COLOR_INPUTS, DEFAULT_COLORS, safeThemeColor, normalizeThemeColors, normalizeCustomThemes, colorsEqual } from './theme-color-utils.mjs';
import { buildImportedThemeRecord, buildThemeExportFilename, buildThemeExportPayload } from './theme-file-utils.mjs';

import { putSharedPatch } from '../sync/shared-state-write.mjs';
const THEME_EDITOR_QUALITY_PASS = 'v162-theme-apply-pass';
function ensureThemePrefs(app) {
  const prefs = app.state.prefs;
  prefs.themeCustomThemes = normalizeCustomThemes(prefs.themeCustomThemes || []);
  prefs.themeColors = prefs.themeColors ? normalizeThemeColors(prefs.themeColors) : null;
  prefs.themePresetId = String(prefs.themePresetId || '').trim() || (prefs.themeColors ? 'custom-current' : THEME_PRESETS[0]?.id || 'paper');
  return prefs;
}

function getSelectedTheme(app) {
  const prefs = ensureThemePrefs(app);
  const selectedId = String(prefs.themePresetId || '');
  const builtin = THEME_PRESETS.find(preset => preset.id === selectedId);
  if (builtin) return { id: builtin.id, name: builtin.name, source: 'preset', colors: normalizeThemeColors(builtin.colors) };
  const custom = prefs.themeCustomThemes.find(theme => theme.id === selectedId);
  if (custom) return { id: custom.id, name: custom.name, source: 'custom', colors: normalizeThemeColors(custom.colors) };
  if (prefs.themeColors) return { id: 'custom-current', name: '현재 직접 지정', source: 'current', colors: normalizeThemeColors(prefs.themeColors) };
  const first = THEME_PRESETS[0];
  return { id: first.id, name: first.name, source: 'preset', colors: normalizeThemeColors(first.colors) };
}

export function renderThemePresets(app) {
  const grid = app.els.themePresetGrid;
  if (!grid) return;
  grid.innerHTML = '';
  ensureThemePrefs(app);
  THEME_PRESETS.forEach(preset => {
    const dots = createEl('span', { class: 'tem-preset-swatches' }, Object.values(preset.colors).slice(0,4).map(c => createEl('span', { style: `background:${c}` })));
    const btn = createEl('button', { class: 'tem-preset-btn', type:'button', dataset:{ id: preset.id } }, [
      dots,
      createEl('span', { class:'tem-preset-name', text:preset.name }),
      createEl('span', { class:'tem-preset-sub', text:preset.sub })
    ]);
    btn.addEventListener('click', () => selectTheme(app, { id: preset.id, name: preset.name, source: 'preset', colors: preset.colors }));
    grid.append(btn);
  });
  renderCustomThemeList(app);
}

function renderCustomThemeList(app) {
  const select = app.els.themeCustomSelect;
  const empty = app.els.themeCustomEmpty;
  if (!select) return;
  const prefs = ensureThemePrefs(app);
  select.innerHTML = '';
  if (!prefs.themeCustomThemes.length) {
    select.append(createEl('option', { value: '', text: '저장된 사용자 테마 없음' }));
    select.disabled = true;
    if (empty) empty.textContent = '현재 색상을 사용자 테마로 저장하면 여기에 표시됩니다.';
    syncCustomButtons(app);
    return;
  }
  prefs.themeCustomThemes.forEach(theme => {
    select.append(createEl('option', { value: theme.id, text: theme.name }));
  });
  select.disabled = false;
  select.value = prefs.themeCustomThemes.some(theme => theme.id === prefs.themePresetId) ? prefs.themePresetId : prefs.themeCustomThemes[0].id;
  if (empty) empty.textContent = `${prefs.themeCustomThemes.length}개 저장됨`;
  syncCustomButtons(app);
}

function selectTheme(app, theme) {
  if (app.els.themeEditorModal) app.els.themeEditorModal.dataset.themeSelectionSource = theme.source || 'current';
  const colors = normalizeThemeColors(theme.colors);
  app.state.pendingThemeColors = { ...colors };
  app.state.pendingThemeId = theme.id || 'custom-current';
  app.state.pendingThemeSource = theme.source || 'current';
  app.state.pendingThemeName = theme.name || '현재 색상';
  writeThemeInputs(app, colors);
  updateThemePreview(app, colors);
  updateSelectedPresetUi(app);
  syncCustomButtons(app);
}

function writeThemeInputs(app, colors) {
  Object.entries(THEME_COLOR_INPUTS).forEach(([key, inputKey]) => {
    if (app.els[inputKey]) app.els[inputKey].value = colors[key];
  });
  updateColorCodes(app, colors);
}

export function bindThemeEditor(app, { applyPrefs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  listen(app.els.openThemeEditorBtn, 'click', () => {
    if (app.els.themeEditorModal) app.els.themeEditorModal.dataset.themeQualityPass = THEME_EDITOR_QUALITY_PASS;
    const theme = getSelectedTheme(app);
    selectTheme(app, theme);
    app.openLayer('themeEditorOverlay');
  });
  listen(app.els.themeEditorClose, 'click', () => app.closeLayer('themeEditorOverlay'));
  listen(app.els.themeEditorOverlay, 'click', ev => { if (ev.target === app.els.themeEditorOverlay) app.closeLayer('themeEditorOverlay'); });

  Object.values(THEME_COLOR_INPUTS).forEach(key => {
    listen(app.els[key], 'input', () => updatePendingThemeFromInputs(app));
  });
  listen(app.els.themeCustomSelect, 'change', ev => {
    const custom = ensureThemePrefs(app).themeCustomThemes.find(theme => theme.id === ev.target.value);
    if (custom) selectTheme(app, { ...custom, source: 'custom' });
  });
  listen(app.els.themeCustomSave, 'click', () => saveCurrentTheme(app, applyPrefs));
  listen(app.els.themeCustomRename, 'click', () => renameCurrentTheme(app, applyPrefs));
  listen(app.els.themeCustomDelete, 'click', () => deleteCurrentTheme(app, applyPrefs));
  listen(app.els.themeCustomExport, 'click', () => exportCurrentTheme(app));
  listen(app.els.themeCustomImport, 'click', () => app.els.themeCustomImportFile?.click());
  listen(app.els.themeCustomImportFile, 'change', ev => importThemeFile(app, ev, applyPrefs));
  listen(app.els.themeEditorApply, 'click', () => applyCurrentTheme(app, applyPrefs));
  listen(app.els.themeEditorReset, 'click', () => {
    const theme = getSelectedTheme(app);
    selectTheme(app, theme);
    status(app, 'sync', '현재 저장된 테마를 다시 불러왔습니다.');
  });
}

function updatePendingThemeFromInputs(app) {
  const c = readThemeInputs(app);
  app.state.pendingThemeColors = c;
  app.state.pendingThemeId = 'custom-current';
  app.state.pendingThemeSource = 'current';
  app.state.pendingThemeName = '현재 직접 지정';
  updateThemePreview(app, c);
  updateSelectedPresetUi(app);
  syncCustomButtons(app);
}

function readThemeInputs(app) {
  const c = {};
  Object.entries(THEME_COLOR_INPUTS).forEach(([key, inputKey]) => {
    c[key] = safeThemeColor(app.els[inputKey]?.value, DEFAULT_COLORS[key]);
  });
  return c;
}

function applyCurrentTheme(app, applyPrefs) {
  const typedColors = readThemeInputs(app);
  const selectedBeforeApply = getPendingThemeDescriptor(app);
  const shouldKeepSelection = !!selectedBeforeApply && colorsEqual(typedColors, selectedBeforeApply.colors);

  app.state.pendingThemeColors = { ...typedColors };
  if (!shouldKeepSelection) {
    app.state.pendingThemeId = 'custom-current';
    app.state.pendingThemeSource = 'current';
    app.state.pendingThemeName = '현재 직접 지정';
  }

  const prefs = ensureThemePrefs(app);
  prefs.themeColors = { ...app.state.pendingThemeColors };
  prefs.themePresetId = shouldKeepSelection ? selectedBeforeApply.id : 'custom-current';
  prefs.readerBg = prefs.themeColors.readerBg;
  prefs.readerText = prefs.themeColors.readerText;
  applyPrefs(app);
  updateThemePreview(app, prefs.themeColors);
  updateSelectedPresetUi(app);
  syncSharedThemePrefs(app).catch(error => status(app, 'sync', `테마 공유 저장 실패: ${error.message || error}`));
  app.closeLayer('themeEditorOverlay');
  status(app, 'sync', '테마를 적용했습니다.');
}

function getPendingThemeDescriptor(app) {
  const colors = normalizeThemeColors(app.state.pendingThemeColors || readThemeInputs(app));
  const id = String(app.state.pendingThemeId || '').trim();
  if (!id || id === 'custom-current') return null;
  const preset = THEME_PRESETS.find(item => item.id === id);
  if (preset) return { id:preset.id, source:'preset', name:preset.name, colors:normalizeThemeColors(preset.colors) };
  const custom = ensureThemePrefs(app).themeCustomThemes.find(item => item.id === id);
  if (custom) return { id:custom.id, source:'custom', name:custom.name, colors:normalizeThemeColors(custom.colors) };
  return { id, source:app.state.pendingThemeSource || 'current', name:app.state.pendingThemeName || '현재 색상', colors };
}

function saveCurrentTheme(app, applyPrefs) {
  updatePendingThemeFromInputs(app);
  const prefs = ensureThemePrefs(app);
  const name = window.prompt('저장할 테마 이름을 입력하세요.', app.state.pendingThemeName && app.state.pendingThemeName !== '현재 직접 지정' ? app.state.pendingThemeName : '내 테마');
  if (name == null) return;
  const safeName = String(name).trim().slice(0, 40) || '내 테마';
  const id = `custom-theme-${Date.now().toString(36)}`;
  prefs.themeCustomThemes.unshift({ id, name: safeName, colors: { ...app.state.pendingThemeColors }, updatedAt: Date.now() });
  prefs.themeCustomThemes = normalizeCustomThemes(prefs.themeCustomThemes);
  prefs.themePresetId = id;
  prefs.themeColors = { ...app.state.pendingThemeColors };
  prefs.readerBg = prefs.themeColors.readerBg;
  prefs.readerText = prefs.themeColors.readerText;
  applyPrefs(app);
  renderCustomThemeList(app);
  selectTheme(app, { id, name: safeName, source: 'custom', colors: prefs.themeColors });
  syncSharedThemePrefs(app).catch(error => status(app, 'sync', `테마 공유 저장 실패: ${error.message || error}`));
  toast(app, 'success', '테마 저장 완료', safeName);
}

function renameCurrentTheme(app, applyPrefs) {
  const prefs = ensureThemePrefs(app);
  const id = app.state.pendingThemeId || prefs.themePresetId;
  const theme = prefs.themeCustomThemes.find(item => item.id === id);
  if (!theme) return toast(app, 'info', '이름 변경 불가', '기본 프리셋은 이름을 바꿀 수 없습니다.');
  const name = window.prompt('새 테마 이름을 입력하세요.', theme.name);
  if (name == null) return;
  theme.name = String(name).trim().slice(0, 40) || theme.name;
  theme.updatedAt = Date.now();
  prefs.themeCustomThemes = normalizeCustomThemes(prefs.themeCustomThemes);
  applyPrefs(app);
  renderCustomThemeList(app);
  selectTheme(app, { ...theme, source: 'custom' });
  syncSharedThemePrefs(app).catch(error => status(app, 'sync', `테마 공유 저장 실패: ${error.message || error}`));
  toast(app, 'success', '테마 이름 변경', theme.name);
}

function deleteCurrentTheme(app, applyPrefs) {
  const prefs = ensureThemePrefs(app);
  const id = app.state.pendingThemeId || prefs.themePresetId;
  const theme = prefs.themeCustomThemes.find(item => item.id === id);
  if (!theme) return toast(app, 'info', '삭제 불가', '기본 프리셋은 삭제할 수 없습니다.');
  if (!window.confirm(`사용자 테마 '${theme.name}'을 삭제할까요?`)) return;
  prefs.themeCustomThemes = prefs.themeCustomThemes.filter(item => item.id !== id);
  if (prefs.themePresetId === id) {
    const fallback = THEME_PRESETS[0];
    prefs.themePresetId = fallback.id;
    prefs.themeColors = { ...fallback.colors };
    prefs.readerBg = prefs.themeColors.readerBg;
    prefs.readerText = prefs.themeColors.readerText;
  }
  applyPrefs(app);
  renderCustomThemeList(app);
  selectTheme(app, getSelectedTheme(app));
  syncSharedThemePrefs(app).catch(error => status(app, 'sync', `테마 공유 저장 실패: ${error.message || error}`));
  toast(app, 'success', '테마 삭제 완료', theme.name);
}

function exportCurrentTheme(app) {
  const colors = normalizeThemeColors(app.state.pendingThemeColors || getSelectedTheme(app).colors);
  const name = String(app.state.pendingThemeName || 'txt-reader-theme').trim() || 'txt-reader-theme';
  const payload = buildThemeExportPayload({ id: app.state.pendingThemeId || 'custom-current', name, colors });
  downloadTextFile(buildThemeExportFilename(name), JSON.stringify(payload, null, 2));
}

function importThemeFile(app, ev, applyPrefs) {
  const file = ev.target.files && ev.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result || '{}');
      const raw = data.theme || data;
      const colors = normalizeThemeColors(raw.colors || raw.themeColors || raw);
      const prefs = ensureThemePrefs(app);
      const theme = buildImportedThemeRecord({ raw, fileName: file.name, colors, existingThemes: prefs.themeCustomThemes });
      const name = theme.name;
      const uniqueId = theme.id;
      prefs.themeCustomThemes.unshift(theme);
      prefs.themeCustomThemes = normalizeCustomThemes(prefs.themeCustomThemes);
      prefs.themePresetId = uniqueId;
      prefs.themeColors = { ...colors };
      prefs.readerBg = colors.readerBg;
      prefs.readerText = colors.readerText;
      applyPrefs(app);
      renderCustomThemeList(app);
      selectTheme(app, { ...theme, source: 'custom' });
      syncSharedThemePrefs(app).catch(error => status(app, 'sync', `테마 공유 저장 실패: ${error.message || error}`));
      toast(app, 'success', '테마 가져오기 완료', name);
    } catch (error) {
      toast(app, 'error', '테마 가져오기 실패', error.message || String(error));
    } finally {
      ev.target.value = '';
    }
  };
  reader.readAsText(file);
}

function updateThemePreview(app, c) {
  const card = app.els.themePreviewCard;
  if (card) {
    card.style.background = c.surface;
    card.style.color = c.text;
    card.style.borderColor = c.accent;
  }
  if (app.els.themePreviewToolbar) app.els.themePreviewToolbar.style.background = c.bg;
  if (app.els.themePreviewPill) app.els.themePreviewPill.style.background = c.accent;
  if (app.els.themePreviewReader) {
    app.els.themePreviewReader.style.background = c.readerBg;
    app.els.themePreviewReader.style.color = c.readerText;
  }
  updateColorCodes(app, c);
  updateLaunchPreview(app, c);
}

function updateColorCodes(app, c) {
  Object.entries(THEME_COLOR_INPUTS).forEach(([key, inputKey]) => {
    const inputId = app.els[inputKey]?.id || inputKey;
    const code = document.querySelector(`[data-color-code="${inputId}"]`);
    if (code) code.textContent = c[key];
  });
}

function updateLaunchPreview(app, c) {
  const root = app.els.themeLaunchPreview;
  if (!root) return;
  const values = [c.bg, c.surface, c.accent, c.readerBg];
  Array.from(root.querySelectorAll('.theme-launch-dot')).forEach((dot, index) => { dot.style.background = values[index] || c.accent; });
}

function updateSelectedPresetUi(app) {
  const id = app.state.pendingThemeId || '';
  app.els.themePresetGrid?.querySelectorAll?.('.tem-preset-btn')?.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.id === id);
  });
  if (app.els.themeCustomSelect && ensureThemePrefs(app).themeCustomThemes.some(theme => theme.id === id)) {
    app.els.themeCustomSelect.value = id;
  }
  if (app.els.themeCurrentName) app.els.themeCurrentName.textContent = app.state.pendingThemeName || '현재 색상';
}

function syncCustomButtons(app) {
  const prefs = ensureThemePrefs(app);
  const id = app.state.pendingThemeId || prefs.themePresetId;
  const isCustom = prefs.themeCustomThemes.some(theme => theme.id === id);
  if (app.els.themeCustomRename) app.els.themeCustomRename.disabled = !isCustom;
  if (app.els.themeCustomDelete) app.els.themeCustomDelete.disabled = !isCustom;
  if (app.els.themeCustomExport) app.els.themeCustomExport.disabled = !app.state.pendingThemeColors;
}

async function syncSharedThemePrefs(app) {
  const prefs = ensureThemePrefs(app);
  if (!app.api?.putShared) return;
  await putSharedPatch(app, { viewerPrefs:{
    themeColors: prefs.themeColors ? { ...prefs.themeColors } : null,
    themePresetId: prefs.themePresetId || '',
    themeCustomThemes: normalizeCustomThemes(prefs.themeCustomThemes || [])
  } });
}
