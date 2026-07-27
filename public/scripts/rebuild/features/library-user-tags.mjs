import { normalizeNovelUserTags, normalizeUserTagList, normalizeUserTagName, persistBookData } from '../state/app-state.mjs';
import { toast } from './ui.mjs';

export const LIBRARY_USER_TAGS_PASS = 'v600-library-user-tags-pass';

function cloneAssignments(input = {}, allowedTags = []) {
  const normalized = normalizeNovelUserTags(input, allowedTags);
  return Object.fromEntries(Object.entries(normalized).map(([novelId, tags]) => [novelId, [...tags]]));
}

function assignmentCount(assignments = {}, tag = '') {
  const key = String(tag || '').toLocaleLowerCase('ko-KR');
  let count = 0;
  for (const tags of Object.values(assignments)) {
    if ((Array.isArray(tags) ? tags : []).some(value => String(value || '').toLocaleLowerCase('ko-KR') === key)) count += 1;
  }
  return count;
}

function assignedTagsForNovel(assignments = {}, novel = null) {
  if (!novel) return [];
  const ids = Array.from(new Set([
    String(novel.id || ''),
    ...(Array.isArray(novel.progressAliases) ? novel.progressAliases.map(String) : []),
    ...(Array.isArray(novel.variantMemberIds) ? novel.variantMemberIds.map(String) : [])
  ].filter(Boolean)));
  const out = [];
  const seen = new Set();
  for (const id of ids) {
    for (const value of (Array.isArray(assignments[id]) ? assignments[id] : [])) {
      const tag = normalizeUserTagName(value);
      const key = tag.toLocaleLowerCase('ko-KR');
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      out.push(tag);
    }
  }
  return out;
}

function assignmentIdsForNovel(novel = null) {
  if (!novel) return [];
  return Array.from(new Set([
    String(novel.id || ''),
    ...(Array.isArray(novel.progressAliases) ? novel.progressAliases.map(String) : []),
    ...(Array.isArray(novel.variantMemberIds) ? novel.variantMemberIds.map(String) : [])
  ].filter(Boolean)));
}

function dialogDraft(app, novel = null) {
  const definitions = normalizeUserTagList(app?.state?.userTags || []);
  const assignments = cloneAssignments(app?.state?.novelUserTags || {}, definitions);
  return {
    definitions,
    assignments,
    novelId:String(novel?.id || ''),
    novelIds:assignmentIdsForNovel(novel),
    novelTitle:String(novel?.title || novel?.fileName || ''),
    assigned:new Set(assignedTagsForNovel(assignments, novel).map(tag => tag.toLocaleLowerCase('ko-KR'))),
    saving:false
  };
}

function closeDialog(app) {
  const overlay = app?.els?.userTagOverlay;
  if (!overlay) return;
  overlay.hidden = true;
  overlay.setAttribute('aria-hidden', 'true');
  app.state.userTagDialogDraft = null;
  app.state.userTagDialogReturnFocus?.focus?.();
  app.state.userTagDialogReturnFocus = null;
}

function setStatus(app, message = '', error = false) {
  const target = app?.els?.userTagStatus;
  if (!target) return;
  target.textContent = String(message || '');
  target.classList.toggle('error', !!error);
}

function renderTagList(app) {
  const draft = app?.state?.userTagDialogDraft;
  const box = app?.els?.userTagList;
  if (!draft || !box) return;
  if (!draft.definitions.length) {
    const empty = document.createElement('div');
    empty.className = 'user-tag-empty';
    empty.textContent = draft.novelId ? '태그를 추가한 뒤 이 작품에 적용할 수 있습니다.' : '아직 만든 사용자 태그가 없습니다.';
    box.replaceChildren(empty);
    return;
  }
  const fragment = document.createDocumentFragment();
  for (const tag of draft.definitions) {
    const key = tag.toLocaleLowerCase('ko-KR');
    const row = document.createElement('div');
    row.className = 'user-tag-row';
    row.dataset.userTagKey = key;
    row.setAttribute('role', 'listitem');

    if (draft.novelId) {
      const label = document.createElement('label');
      label.className = 'user-tag-choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = draft.assigned.has(key);
      input.dataset.userTagAction = 'toggle';
      input.dataset.userTagName = tag;
      const text = document.createElement('span');
      text.textContent = `#${tag}`;
      label.append(input, text);
      row.append(label);
    } else {
      const label = document.createElement('span');
      label.className = 'user-tag-label';
      label.textContent = `#${tag}`;
      row.append(label);
    }

    const meta = document.createElement('span');
    meta.className = 'user-tag-count';
    meta.textContent = `${assignmentCount(draft.assignments, tag)}개 작품`;
    row.append(meta);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'user-tag-remove';
    remove.dataset.userTagAction = 'remove';
    remove.dataset.userTagName = tag;
    remove.textContent = '삭제';
    remove.setAttribute('aria-label', `${tag} 태그 삭제`);
    row.append(remove);
    fragment.append(row);
  }
  box.replaceChildren(fragment);
}

function addTag(app) {
  const draft = app?.state?.userTagDialogDraft;
  const input = app?.els?.userTagInput;
  if (!draft || !input) return;
  const tag = normalizeUserTagName(input.value);
  if (!tag) {
    setStatus(app, '태그 이름을 입력하십시오.', true);
    input.focus();
    return;
  }
  const key = tag.toLocaleLowerCase('ko-KR');
  const existing = draft.definitions.find(value => value.toLocaleLowerCase('ko-KR') === key);
  if (!existing) draft.definitions = normalizeUserTagList([...draft.definitions, tag]);
  if (draft.novelId) draft.assigned.add(key);
  input.value = '';
  setStatus(app, existing ? '기존 태그를 선택했습니다.' : '새 태그를 추가했습니다. 저장 버튼을 눌러 반영하십시오.');
  renderTagList(app);
  input.focus();
}

function removeTag(app, tagName) {
  const draft = app?.state?.userTagDialogDraft;
  const tag = normalizeUserTagName(tagName);
  if (!draft || !tag) return;
  const key = tag.toLocaleLowerCase('ko-KR');
  draft.definitions = draft.definitions.filter(value => value.toLocaleLowerCase('ko-KR') !== key);
  draft.assigned.delete(key);
  for (const [novelId, tags] of Object.entries(draft.assignments)) {
    const next = (Array.isArray(tags) ? tags : []).filter(value => String(value || '').toLocaleLowerCase('ko-KR') !== key);
    if (next.length) draft.assignments[novelId] = next;
    else delete draft.assignments[novelId];
  }
  setStatus(app, `${tag} 태그를 삭제하도록 표시했습니다. 저장 시 모든 작품에서 제거됩니다.`);
  renderTagList(app);
}

function toggleTag(app, tagName, checked) {
  const draft = app?.state?.userTagDialogDraft;
  const tag = normalizeUserTagName(tagName);
  if (!draft || !tag || !draft.novelId) return;
  const key = tag.toLocaleLowerCase('ko-KR');
  if (checked) draft.assigned.add(key);
  else draft.assigned.delete(key);
}

async function refreshLibraryAfterTags(app) {
  app.state.libraryShelfFacetsLoaded = false;
  app.state.libraryShelfFacets = { authors:[], categories:[], tags:[], publicationStatuses:[], groupKinds:[] };
  app.state.libraryShelfFacetNovelTotal = 0;
  app.state.libraryShelfFacetUserTags = normalizeUserTagList(app.state.userTags || []);
  if (app.state.libraryViewMode === 'shelf') {
    await app.library?.loadShelf?.({ reset:true, preserveScroll:true, source:'user-tags-updated' });
    return;
  }
  app.state.libraryFullCatalogLoaded = false;
  const scrollAnchor = app.library?.captureScrollAnchor?.() || null;
  await app.library?.loadFullCatalog?.({ force:true, resetScroll:false, scrollAnchor, source:'user-tags-updated' });
}

async function saveTags(app) {
  const draft = app?.state?.userTagDialogDraft;
  if (!draft || draft.saving) return;
  draft.saving = true;
  if (app.els.userTagSave) app.els.userTagSave.disabled = true;
  const previousDefinitions = normalizeUserTagList(app.state.userTags || []);
  const previousAssignments = cloneAssignments(app.state.novelUserTags || {}, previousDefinitions);
  let syncCommitted = false;
  try {
    const definitions = normalizeUserTagList(draft.definitions);
    const assignments = cloneAssignments(draft.assignments, definitions);
    if (draft.novelId) {
      const canonical = new Map(definitions.map(tag => [tag.toLocaleLowerCase('ko-KR'), tag]));
      const selected = Array.from(draft.assigned).map(key => canonical.get(key)).filter(Boolean).slice(0, 20);
      for (const novelId of (Array.isArray(draft.novelIds) ? draft.novelIds : [draft.novelId])) delete assignments[novelId];
      if (selected.length) assignments[draft.novelId] = selected;
    }
    app.state.userTags = definitions;
    app.state.novelUserTags = normalizeNovelUserTags(assignments, definitions);
    persistBookData(app.state);
    const { persistAndSync } = await import('./bookmarks/model.mjs');
    const synced = await persistAndSync(app);
    if (synced?.synced === false) {
      app.state.userTags = previousDefinitions;
      app.state.novelUserTags = previousAssignments;
      persistBookData(app.state);
      await refreshLibraryAfterTags(app);
      setStatus(app, '서버 동기화에 실패해 변경을 적용하지 않았습니다. 연결 상태를 확인한 뒤 다시 저장하십시오.', true);
      toast(app, 'warn', '사용자 태그 저장 보류', '서버와 일치하지 않는 로컬 변경을 남기지 않았습니다.');
      return;
    }
    syncCommitted = true;
    await refreshLibraryAfterTags(app);
    closeDialog(app);
    toast(app, 'success', '사용자 태그', '태그를 저장하고 서재에 반영했습니다.');
  } catch (error) {
    if (!syncCommitted) {
      app.state.userTags = previousDefinitions;
      app.state.novelUserTags = previousAssignments;
      persistBookData(app.state);
    }
    setStatus(app, syncCommitted
      ? `태그는 서버에 저장됐지만 서재 갱신에 실패했습니다: ${error?.message || String(error)}`
      : `태그 저장을 적용하지 못했습니다: ${error?.message || String(error)}`, true);
  } finally {
    draft.saving = false;
    if (app.els.userTagSave) app.els.userTagSave.disabled = false;
  }
}

function bindDialog(app) {
  const overlay = app?.els?.userTagOverlay;
  if (!overlay || overlay.dataset.userTagDialogBound === '1') return;
  overlay.dataset.userTagDialogBound = '1';
  app.els.userTagDialogClose?.addEventListener('click', () => closeDialog(app));
  app.els.userTagCancel?.addEventListener('click', () => closeDialog(app));
  app.els.userTagAdd?.addEventListener('click', () => addTag(app));
  app.els.userTagSave?.addEventListener('click', () => saveTags(app));
  app.els.userTagInput?.addEventListener('keydown', event => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    addTag(app);
  });
  app.els.userTagList?.addEventListener('change', event => {
    const target = event.target instanceof HTMLInputElement ? event.target : null;
    if (!target || target.dataset.userTagAction !== 'toggle') return;
    toggleTag(app, target.dataset.userTagName || '', target.checked);
  });
  app.els.userTagList?.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('[data-user-tag-action="remove"]') : null;
    if (!target) return;
    removeTag(app, target.dataset.userTagName || '');
  });
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeDialog(app);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !overlay.hidden) closeDialog(app);
  });
}

export function openUserTagDialog(app, novel = null) {
  const overlay = app?.els?.userTagOverlay;
  if (!overlay) throw new Error('사용자 태그 화면을 찾을 수 없습니다.');
  bindDialog(app);
  app.state.userTagDialogReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  app.state.userTagDialogDraft = dialogDraft(app, novel);
  if (app.els.userTagDialogTitle) app.els.userTagDialogTitle.textContent = novel ? '작품 사용자 태그' : '사용자 태그 관리';
  if (app.els.userTagDialogSubtitle) app.els.userTagDialogSubtitle.textContent = novel
    ? `${novel.title || novel.fileName || '작품'}에 적용할 태그를 선택합니다.`
    : '내 서재에서 사용할 태그를 추가하거나 삭제합니다.';
  if (app.els.userTagInput) app.els.userTagInput.value = '';
  setStatus(app, novel ? '선택한 태그는 사용자 계정에 동기화됩니다.' : '태그를 삭제하면 모든 작품의 해당 태그도 함께 제거됩니다.');
  renderTagList(app);
  overlay.hidden = false;
  overlay.setAttribute('aria-hidden', 'false');
  queueMicrotask(() => app.els.userTagInput?.focus?.());
  return { opened:true, novelId:String(novel?.id || ''), pass:LIBRARY_USER_TAGS_PASS };
}
