import { createEl } from '../core/utils.mjs';
import { collectFolderKeys } from './library-model.mjs';
import { closeListActionSheet, targetTypeLabel } from './library-list-actions.mjs';

export const LIBRARY_MOVE_PICKER_TARGET_POLICY_PASS = 'v493-library-move-picker-target-policy-pass';

export function chooseLibraryMoveTarget(app, target, {
  formatFolderPath,
  getCurrentLibraryPath,
  normalizePromptCategory,
  validateLibraryMoveTarget
} = {}) {
  return new Promise(resolve => {
    closeListActionSheet(app);
    const overlay = createEl('div', { class:'library-move-picker-overlay open', role:'dialog', 'aria-modal':'true' });
    const panel = createEl('div', { class:'library-move-picker' });
    const title = createEl('div', { class:'library-move-picker-title', text: `${targetTypeLabel(target.type)} 이동` });
    const sub = createEl('div', { class:'library-move-picker-sub', text: target.title || targetTypeLabel(target.type) });
    const search = createEl('input', { class:'library-move-picker-search', type:'search', placeholder:'대상 폴더 검색 또는 직접 입력' });
    const current = createEl('div', { class:'library-move-picker-current', text:`현재 위치: ${getCurrentLibraryPath?.(target) || '루트'}` });
    const list = createEl('div', { class:'library-move-picker-list' });
    const footer = createEl('div', { class:'library-move-picker-footer' });
    const direct = createEl('button', { class:'library-move-picker-secondary', type:'button', text:'직접 입력' });
    const cancel = createEl('button', { class:'library-move-picker-cancel', type:'button', text:'취소' });
    footer.append(direct, cancel);
    panel.append(title, sub, search, current, list, footer);
    overlay.append(panel);
    document.body.append(overlay);

    const onKey = ev => {
      if (ev.key === 'Escape') close(null);
    };
    const close = value => {
      overlay.remove();
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };
    document.addEventListener('keydown', onKey);
    overlay.addEventListener('click', ev => {
      if (ev.target === overlay) close(null);
    });
    cancel.addEventListener('click', () => close(null));
    direct.addEventListener('click', () => {
      const answer = window.prompt('이동 대상 폴더\n예: 장르 > 작품명\n루트로 이동하려면 비워두세요.', search.value || getCurrentLibraryPath?.(target) || '');
      if (answer == null) return;
      const next = normalizePromptCategory?.(answer) || '';
      const validation = validateLibraryMoveTarget?.(target, next, app);
      if (validation && !validation.valid) return window.alert?.(validation.reason || '선택한 위치로 이동할 수 없습니다.');
      close(next);
    });

    const render = () => {
      const query = String(search.value || '').trim().toLowerCase();
      const options = collectLibraryMoveTargets(app, { formatFolderPath }).filter(item => !query || item.label.toLowerCase().includes(query));
      list.replaceChildren();
      if (!options.length) {
        list.append(createEl('div', { class:'library-move-picker-empty', text:'일치하는 폴더가 없습니다. 직접 입력을 사용할 수 있습니다.' }));
        return;
      }
      options.forEach(item => {
        const validation = validateLibraryMoveTarget?.(target, item.path, app) || { valid:false, reason:'이동 검증을 사용할 수 없습니다.' };
        const btn = createEl('button', {
          class:'library-move-picker-option' + (validation.valid ? '' : ' invalid'),
          type:'button',
          disabled: validation.valid ? null : 'disabled',
          title: validation.valid ? (validation.reason || item.label) : (validation.reason || '이동할 수 없음')
        }, [
          createEl('span', { class:'library-move-picker-option-title', text:item.label }),
          createEl('span', { class:'library-move-picker-option-meta', text: validation.valid ? (validation.reason || '') : (validation.reason || '이동 불가') })
        ]);
        btn.addEventListener('click', () => close(item.path));
        list.append(btn);
      });
    };
    search.addEventListener('input', render);
    render();
    window.setTimeout(() => search.focus(), 60);
  });
}

export function collectLibraryMoveTargets(app, { formatFolderPath } = {}) {
  const normalizeFolder = typeof formatFolderPath === 'function' ? formatFolderPath : value => String(value || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
  const seen = new Set(['']);
  const items = [{ path:'', label:'루트' }];
  collectFolderKeys(app?.state?.novels || []).forEach(key => {
    const path = normalizeFolder(key);
    if (!path || seen.has(path)) return;
    seen.add(path);
    items.push({ path, label:path });
  });
  items.sort((a, b) => {
    if (!a.path) return -1;
    if (!b.path) return 1;
    return a.label.localeCompare(b.label, 'ko', { numeric:true });
  });
  return items;
}
