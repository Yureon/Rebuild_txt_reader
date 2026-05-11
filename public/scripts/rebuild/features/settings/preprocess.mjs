import { persistPrefs } from '../../state/app-state.mjs';
import { status, toast } from '../ui.mjs';
import { PREPROCESS_OPTION_LABELS, formatPreprocessPreviewStats, summarizePreprocessOptions } from './preprocess-summary.mjs';

export const PREPROCESS_KEYS = ['removeNoise','chapterSpacing','collapseBreaks','splitDense','dialogueBreak','paragraphOptimize','aggressive'];

const PREPROCESS_LABELS = PREPROCESS_OPTION_LABELS;


const DEFAULT_PREPROCESS_PRESETS = [
  {
    id: 'preset-basic',
    name: '기본 정리',
    builtIn: true,
    options: {
      removeNoise: false,
      chapterSpacing: true,
      collapseBreaks: false,
      splitDense: false,
      dialogueBreak: false,
      paragraphOptimize: false,
      aggressive: false
    }
  },
  {
    id: 'preset-readable',
    name: '가독성 강화',
    builtIn: true,
    options: {
      removeNoise: false,
      chapterSpacing: true,
      collapseBreaks: true,
      splitDense: true,
      dialogueBreak: true,
      paragraphOptimize: true,
      aggressive: false
    }
  },
  {
    id: 'preset-clean',
    name: '광고·공지 제거',
    builtIn: true,
    options: {
      removeNoise: true,
      chapterSpacing: true,
      collapseBreaks: true,
      splitDense: false,
      dialogueBreak: false,
      paragraphOptimize: false,
      aggressive: true
    }
  }
];

export function defaultPreprocessPresets() {
  return DEFAULT_PREPROCESS_PRESETS.map(preset => ({
    id: preset.id,
    name: preset.name,
    builtIn: true,
    options: normalizePreprocessOptions(preset.options),
    updatedAt: 0
  }));
}

export function defaultPreprocessApplyKeys() {
  return PREPROCESS_KEYS.reduce((out, key) => {
    out[key] = true;
    return out;
  }, {});
}

export function normalizePreprocessOptions(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  return PREPROCESS_KEYS.reduce((out, key) => {
    out[key] = !!src[key];
    return out;
  }, {});
}

export function normalizePreprocessApplyKeys(input = {}) {
  const src = input && typeof input === 'object' ? input : {};
  const out = defaultPreprocessApplyKeys();
  PREPROCESS_KEYS.forEach(key => {
    if (Object.prototype.hasOwnProperty.call(src, key)) out[key] = !!src[key];
  });
  if (!PREPROCESS_KEYS.some(key => out[key])) out.chapterSpacing = true;
  return out;
}

export function normalizePreprocessPresets(input = []) {
  const defaults = defaultPreprocessPresets();
  const byId = new Map(defaults.map(preset => [preset.id, preset]));
  const list = Array.isArray(input) ? input : [];
  list.forEach((item, index) => {
    if (!item || typeof item !== 'object') return;
    const rawId = String(item.id || '').trim();
    const id = sanitizePresetId(rawId || `preset-custom-${index + 1}`);
    if (!id) return;
    const name = String(item.name || '').trim().slice(0, 40) || '이름 없는 프리셋';
    const builtIn = !!item.builtIn && byId.has(id);
    byId.set(id, {
      id,
      name: builtIn ? (byId.get(id)?.name || name) : name,
      builtIn,
      options: normalizePreprocessOptions(item.options || item.preprocess || {}),
      updatedAt: Math.max(0, Number(item.updatedAt) || 0)
    });
  });
  const merged = Array.from(byId.values());
  return merged.slice(0, 24);
}

function sanitizePresetId(value) {
  return String(value || '').trim().replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80);
}

function makePresetId() {
  return `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function ensurePreprocessPrefs(app) {
  const prefs = app.state.prefs || (app.state.prefs = {});
  prefs.preprocess = normalizePreprocessOptions(prefs.preprocess || {});
  prefs.preprocessPresets = normalizePreprocessPresets(prefs.preprocessPresets || []);
  prefs.preprocessPresetApplyKeys = normalizePreprocessApplyKeys(prefs.preprocessPresetApplyKeys || {});
  const selected = String(prefs.preprocessPresetId || '').trim();
  prefs.preprocessPresetId = prefs.preprocessPresets.some(preset => preset.id === selected)
    ? selected
    : (prefs.preprocessPresets[0]?.id || 'preset-basic');
  return prefs;
}

export function bindPreprocess(app, { applyPrefs, syncSettingInputs, on } = {}) {
  const listen = typeof on === 'function'
    ? on
    : (target, type, handler, options) => target?.addEventListener(type, handler, options);

  listen(app.els.openPreprocessEditorBtn, 'click', () => {
    ensurePreprocessPrefs(app);
    syncSettingInputs(app);
    renderPreprocessPresets(app);
    refreshPreprocessPreview(app);
    app.openLayer('preprocessEditorOverlay');
  });
  listen(app.els.preprocessEditorClose, 'click', () => app.closeLayer('preprocessEditorOverlay'));
  listen(app.els.preprocessEditorCancel, 'click', () => app.closeLayer('preprocessEditorOverlay'));
  listen(app.els.preprocessPreviewRefresh, 'click', () => refreshPreprocessPreview(app));
  listen(app.els.preprocessEditorApply, 'click', async () => {
    const prefs = ensurePreprocessPrefs(app);
    prefs.preprocess = readPreprocessInputs(app);
    persistPrefs(app.state);
    applyPrefs(app);
    app.closeLayer('preprocessEditorOverlay');
    app.state.preprocessPreviewAbort?.abort?.();
    try { await syncSharedPreprocessPrefs(app); } catch {}
    if (app.state.current) await app.reader.reloadCurrent();
  });

  listen(app.els.preprocessPresetSelect, 'change', ev => {
    const prefs = ensurePreprocessPrefs(app);
    prefs.preprocessPresetId = String(ev.target.value || prefs.preprocessPresetId);
    persistPrefs(app.state);
    renderPreprocessPresets(app);
  });
  listen(app.els.preprocessPresetApply, 'click', async () => applySelectedPreset(app, { applyPrefs, syncSettingInputs, partial: true }));
  listen(app.els.preprocessPresetApplyAll, 'click', async () => applySelectedPreset(app, { applyPrefs, syncSettingInputs, partial: false }));
  listen(app.els.preprocessPresetSave, 'click', () => saveCurrentPreset(app));
  listen(app.els.preprocessPresetRename, 'click', () => renameSelectedPreset(app));
  listen(app.els.preprocessPresetDelete, 'click', () => deleteSelectedPreset(app));
  PREPROCESS_KEYS.forEach(key => {
    listen(app.els[toElementKey(`preprocess-preset-key-${key}`)], 'change', ev => {
      const prefs = ensurePreprocessPrefs(app);
      prefs.preprocessPresetApplyKeys[key] = !!ev.target.checked;
      if (!PREPROCESS_KEYS.some(k => prefs.preprocessPresetApplyKeys[k])) {
        prefs.preprocessPresetApplyKeys[key] = true;
        ev.target.checked = true;
        toast(app, 'info', '부분 적용', '적용할 항목은 최소 1개 이상 필요합니다.');
      }
      persistPrefs(app.state);
      syncSharedPreprocessPrefs(app).catch(() => {});
      renderPreprocessPresets(app);
    });
  });
}

export function readPreprocessInputs(app) {
  return normalizePreprocessOptions({
    removeNoise: !!app.els.preOptRemoveNoise?.checked,
    chapterSpacing: !!app.els.preOptChapterSpacing?.checked,
    collapseBreaks: !!app.els.preOptCollapseBreaks?.checked,
    splitDense: !!app.els.preOptSplitDense?.checked,
    dialogueBreak: !!app.els.preOptDialogueBreak?.checked,
    paragraphOptimize: !!app.els.preOptParagraphOptimize?.checked,
    aggressive: !!app.els.preOptAggressive?.checked
  });
}

export function updatePreprocessSummary(app) {
  const prefs = ensurePreprocessPrefs(app);
  const active = Object.entries(prefs.preprocess).filter(([,v]) => v).map(([k]) => k);
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId);
  const prefix = selected ? `${selected.name} · ` : '';
  if (app.els.preprocessLaunchSummary) {
    const detail = active.length ? `${active.length}개 옵션 활성` : '전처리 없음';
    app.els.preprocessLaunchSummary.textContent = `${prefix}${detail} · 상세 설정에서 미리보기 가능`;
  }
  renderPreprocessPresets(app);
}

function renderPreprocessPresets(app) {
  const prefs = ensurePreprocessPrefs(app);
  const select = app.els.preprocessPresetSelect;
  if (select) {
    const previous = select.value;
    select.innerHTML = '';
    prefs.preprocessPresets.forEach(preset => {
      const option = document.createElement('option');
      option.value = preset.id;
      option.textContent = preset.builtIn ? `${preset.name} · 기본` : preset.name;
      select.append(option);
    });
    select.value = prefs.preprocessPresets.some(preset => preset.id === prefs.preprocessPresetId) ? prefs.preprocessPresetId : previous;
  }
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId) || prefs.preprocessPresets[0];
  if (app.els.preprocessPresetMeta) {
    const count = selected ? PREPROCESS_KEYS.filter(key => selected.options?.[key]).length : 0;
    const applyCount = PREPROCESS_KEYS.filter(key => prefs.preprocessPresetApplyKeys[key] !== false).length;
    const updated = selected?.updatedAt ? ` · 수정 ${formatPresetTime(selected.updatedAt)}` : '';
    app.els.preprocessPresetMeta.textContent = selected
      ? `선택 중: ${selected.name} · ${selected.builtIn ? '기본 프리셋' : '사용자 프리셋'} · 프리셋 내 ${count}개 켜짐 · 부분 적용 ${applyCount}/${PREPROCESS_KEYS.length}개${updated}`
      : '프리셋을 선택하세요. 선택 항목 적용은 체크된 항목만 현재 옵션에 반영합니다.';
  }
  PREPROCESS_KEYS.forEach(key => {
    const checkbox = app.els[toElementKey(`preprocess-preset-key-${key}`)];
    if (checkbox) checkbox.checked = prefs.preprocessPresetApplyKeys[key] !== false;
  });
  if (app.els.preprocessPresetDelete) {
    app.els.preprocessPresetDelete.disabled = !selected || !!selected.builtIn;
    app.els.preprocessPresetDelete.title = selected?.builtIn ? '기본 프리셋은 삭제할 수 없습니다.' : '';
  }
  if (app.els.preprocessPresetRename) {
    app.els.preprocessPresetRename.disabled = !selected || !!selected.builtIn;
    app.els.preprocessPresetRename.title = selected?.builtIn ? '기본 프리셋 이름은 변경하지 않습니다.' : '';
  }
}

async function applySelectedPreset(app, { applyPrefs, syncSettingInputs, partial = true } = {}) {
  const prefs = ensurePreprocessPrefs(app);
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId);
  if (!selected) return;
  const current = readPreprocessInputs(app);
  const keys = partial ? prefs.preprocessPresetApplyKeys : defaultPreprocessApplyKeys();
  const appliedKeys = PREPROCESS_KEYS.filter(key => keys[key] !== false);
  if (partial && !appliedKeys.length) {
    toast(app, 'info', '부분 적용', '적용할 항목을 1개 이상 선택하세요.');
    return;
  }
  const next = { ...current };
  PREPROCESS_KEYS.forEach(key => {
    if (keys[key] !== false) next[key] = !!selected.options?.[key];
  });
  prefs.preprocess = normalizePreprocessOptions(next);
  persistPrefs(app.state);
  try { await syncSharedPreprocessPrefs(app); } catch {}
  syncSettingInputs?.(app);
  renderPreprocessPresets(app);
  if (typeof applyPrefs === 'function') applyPrefs(app);
  refreshPreprocessPreview(app);
  toast(app, 'success', '전처리 프리셋 적용', partial ? `${selected.name} · ${appliedKeys.length}개 선택 항목 적용` : `${selected.name} · 전체 적용`);
  if (app.state.current) await app.reader.reloadCurrent();
}

function saveCurrentPreset(app) {
  const prefs = ensurePreprocessPrefs(app);
  const current = readPreprocessInputs(app);
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId);
  if (selected && !selected.builtIn) {
    selected.options = current;
    selected.updatedAt = Date.now();
    toast(app, 'success', '프리셋 저장', `${selected.name}을 현재 옵션으로 갱신했습니다.`);
  } else {
    const name = prompt('새 전처리 프리셋 이름', selected ? `${selected.name} 복사본` : '새 프리셋');
    if (!name) return;
    const preset = { id: makePresetId(), name: String(name).trim().slice(0, 40) || '새 프리셋', builtIn: false, options: current, updatedAt: Date.now() };
    prefs.preprocessPresets.push(preset);
    prefs.preprocessPresetId = preset.id;
    toast(app, 'success', '프리셋 추가', preset.name);
  }
  prefs.preprocessPresets = normalizePreprocessPresets(prefs.preprocessPresets);
  persistPrefs(app.state);
  syncSharedPreprocessPrefs(app).catch(() => {});
  renderPreprocessPresets(app);
}

function renameSelectedPreset(app) {
  const prefs = ensurePreprocessPrefs(app);
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId);
  if (!selected || selected.builtIn) return;
  const name = prompt('전처리 프리셋 이름 변경', selected.name);
  if (!name) return;
  selected.name = String(name).trim().slice(0, 40) || selected.name;
  selected.updatedAt = Date.now();
  persistPrefs(app.state);
  syncSharedPreprocessPrefs(app).catch(() => {});
  renderPreprocessPresets(app);
  toast(app, 'success', '프리셋 이름 변경', selected.name);
}

function deleteSelectedPreset(app) {
  const prefs = ensurePreprocessPrefs(app);
  const selected = prefs.preprocessPresets.find(preset => preset.id === prefs.preprocessPresetId);
  if (!selected || selected.builtIn) return;
  if (!confirm(`전처리 프리셋 '${selected.name}'을 삭제할까요?`)) return;
  prefs.preprocessPresets = prefs.preprocessPresets.filter(preset => preset.id !== selected.id);
  prefs.preprocessPresetId = prefs.preprocessPresets[0]?.id || 'preset-basic';
  persistPrefs(app.state);
  syncSharedPreprocessPrefs(app).catch(() => {});
  renderPreprocessPresets(app);
  toast(app, 'success', '프리셋 삭제', selected.name);
}

async function syncSharedPreprocessPrefs(app) {
  if (!app || !app.api || typeof app.api.putShared !== 'function') return null;
  const prefs = ensurePreprocessPrefs(app);
  const current = app.state.shared || {};
  const shared = {
    ...current,
    viewerPrefs: {
      ...(current.viewerPrefs || {}),
      preprocess: normalizePreprocessOptions(prefs.preprocess),
      preprocessPresetId: prefs.preprocessPresetId,
      preprocessPresetApplyKeys: normalizePreprocessApplyKeys(prefs.preprocessPresetApplyKeys),
      preprocessPresets: normalizePreprocessPresets(prefs.preprocessPresets)
    },
    updatedAt: Date.now()
  };
  const res = await app.api.putShared(shared);
  if (res && res.shared) app.state.shared = res.shared;
  if (res && res.syncPolicySummary) app.state.syncPolicySummary = res.syncPolicySummary;
  if (Number(res && res.sharedVersion)) app.state.sharedVersion = Number(res.sharedVersion);
  status(app, 'sync', '전처리 프리셋 동기화 완료');
  return res;
}

function toElementKey(id) {
  return String(id).replace(/-([a-z0-9])/g, (_, ch) => ch.toUpperCase());
}

function formatPresetTime(value) {
  const time = Number(value) || 0;
  if (!time) return '';
  try { return new Date(time).toLocaleString(); } catch { return String(time); }
}

function setPreviewText(app, { meta, body, stats } = {}) {
  if (typeof meta === 'string' && app.els.preprocessPreviewMeta) app.els.preprocessPreviewMeta.textContent = meta;
  if (typeof body === 'string' && app.els.preprocessPreviewBody) app.els.preprocessPreviewBody.textContent = body;
  if (typeof stats === 'string' && app.els.preprocessPreviewStats) app.els.preprocessPreviewStats.textContent = stats;
}

async function refreshPreprocessPreview(app) {
  if (!app.els.preprocessPreviewBody) return;
  const current = app.state.current;
  if (!current) {
    setPreviewText(app, {
      meta: '작품을 열면 현재 위치 기준 미리보기를 사용할 수 있습니다.',
      body: '아직 열린 작품이 없습니다. 작품을 연 뒤 전처리 상세 설정을 다시 열거나 새로고침을 누르세요.',
      stats: summarizePreprocessOptions(readPreprocessInputs(app))
    });
    return;
  }
  app.state.preprocessPreviewAbort?.abort?.();
  const controller = new AbortController();
  app.state.preprocessPreviewAbort = controller;
  const token = `${current.novel.id}:${current.episode?.id || 'single'}:${current.chunk}:${Date.now()}`;
  app.state.preprocessPreviewToken = token;
  setPreviewText(app, {
    meta: '미리보기 본문을 불러오는 중…',
    stats: summarizePreprocessOptions(readPreprocessInputs(app))
  });
  try {
    const data = await app.api.content({ novelId: current.novel.id, episodeId: current.episode?.id || null, chunk: current.chunk, preprocess: readPreprocessInputs(app) }, { signal: controller.signal });
    if (controller.signal.aborted || app.state.preprocessPreviewToken !== token) return;
    const sample = String(data.content || '').slice(0, 2400);
    setPreviewText(app, {
      meta: `${data.currentChunk}/${data.totalChunks} 본문 미리보기 · 현재 옵션 기준`,
      body: sample || '전처리 결과가 비어 있습니다. 광고·공지 제거 옵션이 너무 강하게 적용됐을 수 있습니다.',
      stats: formatPreprocessPreviewStats(data.formatStats, readPreprocessInputs(app))
    });
  } catch (e) {
    if (e && e.name === 'AbortError') return;
    const reason = e && e.message ? String(e.message) : '원인을 알 수 없는 오류';
    setPreviewText(app, {
      meta: '미리보기를 불러오지 못했습니다.',
      body: `현재 chunk 미리보기를 가져오지 못했습니다. 네트워크, 권한, 또는 서버 응답을 확인한 뒤 다시 시도하세요.\n\n사유: ${reason}`,
      stats: summarizePreprocessOptions(readPreprocessInputs(app))
    });
  }
}
