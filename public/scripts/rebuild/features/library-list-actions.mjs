import { isNovelFavoriteForState } from './library-model.mjs';

function defaultFormatFolderPath(folderKey) {
  return String(folderKey || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
}

export const LIBRARY_ACTION_PERMISSION_UI_PASS = 'v493-library-action-policy-ui-pass';

function normalizePermissionPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s*>\s*/g, '/').split('/').map(x => x.trim()).filter(Boolean).join('/');
}

function targetPermissionPath(target) {
  if (!target || target.type !== 'folder') return '';
  return normalizePermissionPath(target.folderKey || target.subtitle || '');
}

function folderPermissionAllowed(folders, targetPath) {
  const target = normalizePermissionPath(targetPath);
  if (!target) return false;
  return (Array.isArray(folders) ? folders : []).some(value => {
    const allowed = normalizePermissionPath(value);
    return !!allowed && (target === allowed || target.startsWith(allowed + '/'));
  });
}

export function isUserLibraryPathAllowed(app, targetPath) {
  const snapshot = app?.state?.userAccessSnapshot;
  if (!snapshot || !snapshot.userId) return true;
  const access = snapshot.libraryAccess || { mode:'none', folders:[] };
  const target = normalizePermissionPath(targetPath);
  if (!target) return access.mode === 'all';
  if (access.mode === 'all') return true;
  if (access.mode !== 'folders') return false;
  return folderPermissionAllowed(access.folders, target);
}

export function canUseLibraryAction(app, actionTarget, action) {
  if (action === 'open') return true;
  if (action === 'favorite' || action === 'tags') return actionTarget?.type === 'novel';
  if (action === 'metadata') {
    if (actionTarget?.type !== 'novel') return false;
    const snapshot = app?.state?.userAccessSnapshot;
    if (!snapshot || !snapshot.userId) return false;
    return snapshot.metadataAccessAllowed === true || snapshot.appPermissions?.metadataAccess === true;
  }
  if (actionTarget?.type === 'novel' && actionTarget?.novel?.isVirtualEpisodeGroup) return false;
  const snapshot = app?.state?.userAccessSnapshot;
  if (!snapshot || !snapshot.userId) return true;
  if (actionTarget?.type !== 'folder') return false;
  const targetPath = targetPermissionPath(actionTarget);
  if (action === 'move') return isUserLibraryPathAllowed(app, targetPath) && folderPermissionAllowed(snapshot.folderMutationAccess?.moveFolders, targetPath);
  if (action === 'delete') return isUserLibraryPathAllowed(app, targetPath) && folderPermissionAllowed(snapshot.folderMutationAccess?.deleteFolders, targetPath);
  if (action === 'rename') return false;
  return false;
}

export function installListActionSheet(app, on, { runAction } = {}) {
  const invoke = action => {
    if (typeof runAction === 'function') return runAction(action);
    return null;
  };
  on(app?.els?.listActionOverlay, 'click', ev => {
    if (ev.target === app?.els?.listActionOverlay) closeListActionSheet(app);
  });
  on(app?.els?.listActionCancel, 'click', () => closeListActionSheet(app));
  on(app?.els?.listActionOpen, 'click', () => invoke('open'));
  on(app?.els?.listActionFavorite, 'click', () => invoke('favorite'));
  on(app?.els?.listActionTags, 'click', () => invoke('tags'));
  on(app?.els?.listActionMetadata, 'click', () => invoke('metadata'));
  on(app?.els?.listActionRename, 'click', () => invoke('rename'));
  on(app?.els?.listActionMove, 'click', () => invoke('move'));
  on(app?.els?.listActionDelete, 'click', () => invoke('delete'));
  on(document, 'keydown', ev => {
    if (ev.key === 'Escape' && app?.els?.listActionOverlay?.classList.contains('open')) closeListActionSheet(app);
  });
}

export function getLibraryActionTargetFromElement(app, target, { formatFolderPath = defaultFormatFolderPath } = {}) {
  if (!target) return null;
  const folder = target.closest?.('.cat-header');
  const epItem = target.closest?.('.ep-item');
  const novelItem = target.closest?.('.novel-item');

  if (epItem && app?.els?.novelList?.contains(epItem)) {
    const novel = app.state.novelById.get(epItem.dataset.novelId || '');
    const episode = (novel?.episodes || []).find(ep => ep.id === epItem.dataset.episodeId);
    if (!novel || !episode) return null;
    return { type:'episode', novel, episode, title:episode.title || episode.fileName || '회차', subtitle:novel.title || novel.id };
  }
  if (novelItem && app?.els?.novelList?.contains(novelItem)) {
    const novel = app.state.novelById.get(novelItem.dataset.novelId || '');
    if (!novel) return null;
    const variantNote = Number(novel.hiddenVariantCount) > 0 ? ` · 중복·이전 판본 ${Number(novel.hiddenVariantCount)}개 묶음` : '';
    return { type:'novel', novel, title:novel.title || novel.fileName || '작품', subtitle:`${novel.categoryPath || '루트'}${variantNote}` };
  }
  if (folder && app?.els?.novelList?.contains(folder)) {
    const folderKey = folder.dataset.folderKey || '';
    if (!folderKey) return null;
    const parts = folderKey.split('>').map(x => x.trim()).filter(Boolean);
    return { type:'folder', folderKey, title:parts[parts.length - 1] || folderKey, subtitle:formatFolderPath(folderKey) || '루트' };
  }
  return null;
}

export function openListActionSheet(app, actionTarget) {
  if (!actionTarget || !app?.els?.listActionOverlay) return;
  app.state.libraryActionTarget = actionTarget;
  if (app.els.listActionTitle) app.els.listActionTitle.textContent = actionTarget.title || '항목';
  if (app.els.listActionSub) app.els.listActionSub.textContent = actionTarget.subtitle || targetTypeLabel(actionTarget.type);
  if (app.els.listActionOpen) app.els.listActionOpen.textContent = actionTarget.type === 'folder' ? '펼치기/접기' : '열기';
  if (app.els.listActionFavorite) {
    app.els.listActionFavorite.hidden = !canUseLibraryAction(app, actionTarget, 'favorite');
    if (actionTarget.type === 'novel') app.els.listActionFavorite.textContent = isNovelFavoriteForState(app.state, actionTarget.novel) ? '즐겨찾기 해제' : '즐겨찾기 추가';
  }
  if (app.els.listActionTags) app.els.listActionTags.hidden = !canUseLibraryAction(app, actionTarget, 'tags');
  if (app.els.listActionMetadata) app.els.listActionMetadata.hidden = !canUseLibraryAction(app, actionTarget, 'metadata');
  if (app.els.listActionRename) app.els.listActionRename.hidden = !canUseLibraryAction(app, actionTarget, 'rename');
  if (app.els.listActionMove) app.els.listActionMove.hidden = !canUseLibraryAction(app, actionTarget, 'move');
  if (app.els.listActionDelete) app.els.listActionDelete.hidden = !canUseLibraryAction(app, actionTarget, 'delete');
  app.els.listActionOverlay.classList.add('open');
}

export function closeListActionSheet(app) {
  app?.els?.listActionOverlay?.classList.remove('open');
  if (app?.state) app.state.libraryActionTarget = null;
}

export function targetTypeLabel(type) {
  if (type === 'folder') return '폴더';
  if (type === 'episode') return '회차';
  return '작품';
}
