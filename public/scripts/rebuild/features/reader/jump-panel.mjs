import { clamp, createEl } from '../../core/utils.mjs';
import { toast } from '../ui.mjs';
import { getViewportAddress } from './virtual-layout.mjs';
import { addressToDocumentRatio, estimateTotalBlocks } from './coordinates.mjs';

export function installJumpPanel(app, { goBlock, goPercent, goEpisode } = {}) {
  const overlay = document.getElementById('chunk-jumper-overlay');
  const panel = document.getElementById('chunk-jumper-panel');
  const slider = document.getElementById('chunk-slider');
  const percentInput = document.getElementById('chunk-input');
  const cancel = document.getElementById('chunk-cancel');
  const go = document.getElementById('chunk-go');
  if (!overlay || !panel || !slider || !percentInput || !cancel || !go || typeof goBlock !== 'function' || typeof goPercent !== 'function') return;
  app.jumpPanelCleanup?.();
  const disposers = [];
  const on = (target, type, handler, options) => {
    if (!target) return;
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  };
  app.jumpPanelCleanup = () => { disposers.splice(0).forEach(dispose => dispose()); };

  normalizePanel(panel, percentInput);
  const blockInput = document.getElementById('block-input');
  const episodeSelect = document.getElementById('episode-jump-select');
  let blockDirty = false;
  let percentDirty = false;
  let percentComposing = false;
  let episodeDirty = false;
  let episodeChangeNavigating = false;

  const close = () => { overlay.classList.remove('open'); panel.classList.remove('open'); };
  const open = () => {
    if (!app.state.current) return toast(app, 'info', '위치 이동', '먼저 작품을 열어주세요.');
    const address = getViewportAddress(app);
    const ratio = addressToDocumentRatio(app, address);
    const totalBlocks = estimateTotalBlocks(app);
    slider.min = '0'; slider.max = '1000'; slider.step = '1'; slider.value = String(Math.round(ratio * 1000));
    percentInput.value = formatPercentValue(ratio * 100);
    syncEpisodeSelect(app, episodeSelect);
    if (blockInput) {
      blockInput.min = '1';
      blockInput.max = String(totalBlocks);
      blockInput.value = address.globalBlockIndex >= 0 ? String(Number(address.globalBlockIndex) + 1) : '';
      blockInput.placeholder = `1-${totalBlocks}`;
      blockInput.title = `현재 화 예상 전체 블럭: ${totalBlocks}`;
      blockInput.disabled = false;
    }
    blockDirty = false;
    percentDirty = false;
    episodeDirty = false;
    overlay.classList.add('open'); panel.classList.add('open');
    percentInput.focus(); percentInput.select?.();
  };
  const syncPercentFromSlider = value => {
    const ratio = clamp((Number(value) || 0) / 100, 0, 1);
    slider.value = String(Math.round(ratio * 1000));
    percentInput.value = formatPercentValue(ratio * 100);
    percentDirty = false;
    blockDirty = false;
  };
  const syncSliderFromPercentInput = () => {
    const parsed = parsePercentValue(percentInput.value);
    if (parsed == null) return;
    slider.value = String(Math.round(clamp(parsed / 100, 0, 1) * 1000));
    blockDirty = false;
  };
  const normalizePercentInput = () => {
    const parsed = parsePercentValue(percentInput.value);
    const fallback = clamp((Number(slider.value) || 0) / 10, 0, 100);
    const normalized = parsed == null ? fallback : clamp(parsed, 0, 100);
    percentInput.value = formatPercentValue(normalized);
    slider.value = String(Math.round(normalized * 10));
    percentDirty = false;
    return normalized;
  };
  const resetPositionInputsForEpisode = () => {
    slider.value = '0';
    percentInput.value = '0';
    if (blockInput) {
      blockInput.value = '1';
      blockInput.placeholder = '선택한 화 기준';
      blockInput.title = '선택한 화의 블럭 번호. 비워두면 선택한 위치(%)로 이동합니다.';
    }
    blockDirty = false;
    percentDirty = false;
  };
  on(slider, 'input', ev => syncPercentFromSlider((Number(ev.target.value) || 0) / 10));
  on(percentInput, 'compositionstart', () => { percentComposing = true; });
  on(percentInput, 'compositionend', () => { percentComposing = false; percentDirty = true; syncSliderFromPercentInput(); });
  on(percentInput, 'input', () => {
    percentDirty = true;
    if (!percentComposing) syncSliderFromPercentInput();
  });
  on(percentInput, 'focus', () => { percentDirty = true; });
  on(percentInput, 'blur', () => { if (!percentComposing) normalizePercentInput(); });
  on(blockInput, 'input', () => { blockDirty = true; });
  on(blockInput, 'focus', () => { blockDirty = true; });
  on(episodeSelect, 'change', async () => {
    if (!episodeSelect || episodeSelect.disabled || episodeChangeNavigating) return;
    const selectedEpisodeId = getSelectedEpisodeId(app, episodeSelect);
    const currentEpisodeId = app.state.current?.episode?.id || '';
    episodeDirty = true;
    resetPositionInputsForEpisode();
    if (!selectedEpisodeId || selectedEpisodeId === currentEpisodeId) return;
    if (typeof goEpisode !== 'function') return;
    episodeChangeNavigating = true;
    close();
    try {
      await goEpisode(selectedEpisodeId, { ratio: 0, align:'start', source:'episode-select-change' });
    } finally {
      episodeChangeNavigating = false;
    }
  });
  on(cancel, 'click', close);
  on(overlay, 'click', close);
  on(go, 'click', async () => {
    const totalBlocks = estimateTotalBlocks(app);
    const blockValue = Math.round(Number(blockInput?.value) || 0);
    const percentValue = normalizePercentInput();
    const ratio = clamp(percentValue / 100, 0, 1);
    const selectedEpisodeId = getSelectedEpisodeId(app, episodeSelect);
    const currentEpisodeId = app.state.current?.episode?.id || '';
    const episodeChanged = !!selectedEpisodeId && selectedEpisodeId !== currentEpisodeId;
    close();
    if (episodeChanged || episodeDirty) {
      if (typeof goEpisode !== 'function') return;
      await goEpisode(selectedEpisodeId, blockDirty && blockValue > 0
        ? { globalBlockIndex: Math.max(0, blockValue - 1), align:'start' }
        : { ratio, align:'start' });
      return;
    }
    if (blockDirty && blockValue > 0) {
      await goBlock(clamp(blockValue - 1, 0, Math.max(0, totalBlocks - 1)), { align:'start' });
      return;
    }
    await goPercent(ratio, { align:'start' });
  });
  on(panel, 'keydown', ev => {
    if (ev.key === 'Escape') close();
    if (ev.key === 'Enter') go.click();
  });
  on(app.els.navInfo, 'click', open);
}

function normalizePanel(panel, percentInput) {
  const title = panel.querySelector('h3');
  if (title) title.textContent = '위치 이동';
  percentInput.type = 'text';
  percentInput.inputMode = 'decimal';
  percentInput.autocomplete = 'off';
  percentInput.title = '현재 화 위치(%)';
  percentInput.setAttribute('aria-label', '현재 화 위치 퍼센트');
  let blockInput = document.getElementById('block-input');
  if (!blockInput) {
    const row = createEl('div', { class:'reader-jump-block-row' }, [
      createEl('label', { class:'reader-jump-label', for:'block-input', text:'블럭' }),
      createEl('input', { id:'block-input', type:'number', min:'1', value:'1', class:'reader-jump-block-input', title:'전체 블럭 번호' })
    ]);
    const actions = panel.querySelector('div:last-child');
    panel.insertBefore(row, actions || null);
    blockInput = row.querySelector('#block-input');
  }
  const firstRow = percentInput.closest('div');
  if (firstRow && !firstRow.querySelector('.reader-jump-percent-label')) {
    firstRow.prepend(createEl('span', { class:'reader-jump-percent-label', text:'%' }));
  }
  let episodeSelect = document.getElementById('episode-jump-select');
  if (!episodeSelect) {
    const row = createEl('div', { class:'reader-jump-block-row reader-jump-episode-row' }, [
      createEl('label', { class:'reader-jump-label', for:'episode-jump-select', text:'화' }),
      createEl('select', { id:'episode-jump-select', class:'reader-jump-block-input reader-jump-episode-select', title:'이동할 화 선택' })
    ]);
    const percentRow = panel.querySelector('.reader-jump-percent-row') || percentInput.closest('div');
    panel.insertBefore(row, percentRow || panel.firstChild?.nextSibling || null);
    episodeSelect = row.querySelector('#episode-jump-select');
  }
}

function parsePercentValue(rawValue) {
  const raw = String(rawValue ?? '').trim().replace(',', '.');
  if (!raw || raw === '.' || raw === '+' || raw === '-') return null;
  if (!/^(?:\d{0,3})(?:\.\d*)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function formatPercentValue(value) {
  const normalized = clamp(Number(value) || 0, 0, 100);
  if (Number.isInteger(normalized)) return String(normalized);
  return normalized.toFixed(1).replace(/\.0$/, '');
}

function syncEpisodeSelect(app, select) {
  if (!select) return;
  const current = app?.state?.current || null;
  const episodes = Array.isArray(current?.novel?.episodes) ? current.novel.episodes : [];
  const isMulti = !!current?.episode && episodes.length > 0;
  select.disabled = !isMulti;
  select.innerHTML = '';
  if (!isMulti) {
    select.append(createEl('option', { value:'', text:'단일 파일' }));
    return;
  }
  episodes.forEach((episode, index) => {
    const title = formatEpisodeJumpTitle(episode, index);
    const option = createEl('option', { value:String(episode?.id || ''), text:title });
    if (episode?.id === current.episode?.id) option.selected = true;
    select.append(option);
  });
}

function getSelectedEpisodeId(app, select) {
  if (!select || select.disabled) return app?.state?.current?.episode?.id || '';
  return String(select.value || '').trim();
}


function formatEpisodeJumpTitle(episode, index = 0) {
  const rawTitle = String(episode?.title || episode?.filename || '').trim();
  const title = rawTitle || `제 ${Number(index) + 1}화`;
  return /^\d+$/.test(title) ? `${title}화` : title;
}
