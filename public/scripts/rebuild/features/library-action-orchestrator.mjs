export const LIBRARY_ACTION_ORCHESTRATOR_PASS = 'v294-library-action-orchestrator-pass';

function requireDep(deps, name) {
  const fn = deps?.[name];
  if (typeof fn !== 'function') throw new Error('library action orchestrator missing dependency: ' + name);
  return fn;
}

export async function runLibraryListActionRuntime(app, action, deps = {}) {
  const target = app?.state?.libraryActionTarget;
  if (!target) return;
  if (action === 'open') {
    deps.closeListActionSheet?.(app);
    openLibraryActionTarget(app, target, deps);
    return;
  }
  if (action === 'favorite') {
    deps.closeListActionSheet?.(app);
    if (target.type === 'novel') deps.toggleFavorite?.(app, target.novel.id);
    return;
  }

  try {
    if (action === 'rename') await renameLibraryActionTargetRuntime(app, target, deps);
    else if (action === 'move') await moveLibraryActionTargetRuntime(app, target, deps);
    else if (action === 'delete') await deleteLibraryActionTargetRuntime(app, target, deps);
  } catch (error) {
    console.warn('library action failed', error);
  }
}

export function openLibraryActionTarget(app, target, deps = {}) {
  if (target.type === 'folder') {
    const anchor = deps.getLibraryScrollAnchor?.(app) || null;
    if (app.state.collapsedFolders.has(target.folderKey)) app.state.collapsedFolders.delete(target.folderKey);
    else app.state.collapsedFolders.add(target.folderKey);
    deps.persistLibraryUi?.(app.state);
    deps.renderLibrary?.(app, { source:'action-folder-toggle', scrollAnchor:anchor, followActive:false });
    return;
  }
  if (target.type === 'episode') {
    app.reader.openNovel(target.novel, deps.openOptionsFromSnapshot?.({ episodeId: target.episode.id }, app.state.progress.readMeta?.[`${target.novel.id}-${target.episode.id}`]));
    deps.closeSidebarAfterLibraryOpen?.(app);
    return;
  }
  if (target.type === 'novel') {
    const fake = { dataset:{ novelId: target.novel.id } };
    deps.openNovelFromElement?.(app, fake);
  }
}

export async function renameLibraryActionTargetRuntime(app, target, deps = {}) {
  const promptLibraryRename = requireDep(deps, 'promptLibraryRename');
  const rename = promptLibraryRename(target, { targetTypeLabel: deps.targetTypeLabel });
  if (!rename) return;
  await withLibraryMutationRuntime(app, '이름 변경 중…', () => deps.runLibraryRenameRequest?.(app, target, rename.next, { formatFolderPath: deps.formatFolderPath }), '이름을 변경했습니다.', deps);
}

export async function moveLibraryActionTargetRuntime(app, target, deps = {}) {
  const chooseLibraryMoveTarget = requireDep(deps, 'chooseLibraryMoveTarget');
  const validateLibraryMoveTarget = requireDep(deps, 'validateLibraryMoveTarget');
  const targetPath = await chooseLibraryMoveTarget(app, target, deps.getLibraryMoveDeps?.() || {});
  if (targetPath == null) return;
  const validation = validateLibraryMoveTarget(target, targetPath, { ...(deps.getLibraryDragDropDeps?.() || {}), app });
  if (!validation.valid) {
    deps.toast?.(app, 'warn', '이동 불가', validation.reason || '선택한 위치로 이동할 수 없습니다.');
    return;
  }
  await withLibraryMutationRuntime(app, '이동 중…', () => deps.runLibraryMoveRequest?.(app, target, validation, { formatFolderPath: deps.formatFolderPath }), `${validation.targetPath || '루트'}로 이동했습니다.`, deps);
}

export async function deleteLibraryActionTargetRuntime(app, target, deps = {}) {
  const confirmLibraryDelete = requireDep(deps, 'confirmLibraryDelete');
  if (!confirmLibraryDelete(target)) return;
  await withLibraryMutationRuntime(app, '삭제 중…', () => deps.runLibraryDeleteRequest?.(app, target, { formatFolderPath: deps.formatFolderPath }), '삭제했습니다.', deps);
  clearCurrentIfDeletedRuntime(app, target, deps);
}

export async function withLibraryMutationRuntime(app, busyMessage, work, successMessage, deps = {}) {
  deps.closeListActionSheet?.(app);
  deps.showLoading?.(app, true);
  deps.status?.(app, 'sync', busyMessage);
  try {
    const result = await work();
    await deps.loadLibrary?.(app);
    relinkCurrentAfterLibraryReloadRuntime(app, deps);
    if (result && result.skipped) {
      deps.toast?.(app, 'info', '목록 작업', '이미 같은 위치입니다.');
    } else {
      deps.toast?.(app, 'success', '목록 작업', successMessage);
    }
    return result;
  } catch (error) {
    const message = deps.describeLibraryMutationError?.(error) || error?.message || String(error);
    deps.status?.(app, 'sync', '목록 작업 실패');
    deps.toast?.(app, 'error', '목록 작업 실패', message);
    throw error;
  } finally {
    deps.showLoading?.(app, false);
  }
}

export function relinkCurrentAfterLibraryReloadRuntime(app, deps = {}) {
  const current = app?.state?.current;
  if (!current?.novel?.id) return false;
  const nextNovel = app.state.novelById?.get?.(current.novel.id);
  if (!nextNovel) return false;
  current.novel = nextNovel;
  if (current.episode?.id) {
    const nextEpisode = (nextNovel.episodes || []).find(ep => ep.id === current.episode.id);
    if (nextEpisode) current.episode = nextEpisode;
  }
  if (app.els.toolbarTitle) {
    const epTitle = current.episode ? ' · ' + (current.episode.title || current.episode.fileName || '') : '';
    app.els.toolbarTitle.textContent = (nextNovel.title || nextNovel.fileName || 'Untitled') + epTitle;
  }
  return true;
}

export function clearCurrentIfDeletedRuntime(app, target, deps = {}) {
  const isCurrentDeletedByTarget = requireDep(deps, 'isCurrentDeletedByTarget');
  if (!isCurrentDeletedByTarget(app.state.current, target)) return false;
  app.state.current = null;
  if (app.els.reader) app.els.reader.style.display = 'none';
  if (app.els.empty) app.els.empty.style.display = '';
  if (app.els.toolbarTitle) app.els.toolbarTitle.textContent = '소설을 선택하세요';
  return true;
}

export async function moveDraggedLibraryItemRuntime(app, source, targetPath, deps = {}) {
  const validateLibraryMoveTarget = requireDep(deps, 'validateLibraryMoveTarget');
  const validation = validateLibraryMoveTarget(source, targetPath, { ...(deps.getLibraryDragDropDeps?.() || {}), app });
  if (!validation.valid) {
    deps.toast?.(app, 'warn', '이동 불가', validation.reason || '선택한 위치로 이동할 수 없습니다.');
    return;
  }
  const destination = validation.targetPath || '루트';
  const confirmLibraryMove = requireDep(deps, 'confirmLibraryMove');
  if (!confirmLibraryMove(source, destination, { targetTypeLabel: deps.targetTypeLabel })) return;
  await withLibraryMutationRuntime(app, '드래그 이동 중…', () => deps.runLibraryMoveRequest?.(app, source, validation, { formatFolderPath: deps.formatFolderPath }), `${destination}로 이동했습니다.`, deps);
}

export function getLibraryActionOrchestratorContract() {
  return {
    pass: LIBRARY_ACTION_ORCHESTRATOR_PASS,
    owns: ['list-action-dispatch', 'rename-action', 'move-action', 'delete-action', 'mutation-loading-status', 'current-relink-after-reload'],
    injectedBoundaries: ['prompts', 'mutation-api', 'toast-status', 'render-reset', 'drag-drop-validation'],
    nonGoals: ['event-delegation', 'row-dom-rendering', 'reader-open-implementation']
  };
}
