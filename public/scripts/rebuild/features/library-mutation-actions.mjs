export async function runLibraryRenameRequest(app, target, nextTitle, deps = {}) {
  const formatFolderPath = typeof deps.formatFolderPath === 'function' ? deps.formatFolderPath : value => String(value || '');
  if (target?.type === 'folder') return app.api.renameFolder(formatFolderPath(target.folderKey), nextTitle);
  if (target?.type === 'episode') return app.api.renameEpisode(target.novel.id, target.episode.id, nextTitle);
  return app.api.renameNovel(target.novel.id, nextTitle);
}

export async function runLibraryMoveRequest(app, target, validation, deps = {}) {
  const formatFolderPath = typeof deps.formatFolderPath === 'function' ? deps.formatFolderPath : value => String(value || '');
  const targetPath = validation?.targetPath || '';
  if (target?.type === 'folder') return app.api.moveFolder(formatFolderPath(target.folderKey), targetPath);
  if (target?.type === 'episode') return app.api.moveEpisode(target.novel.id, target.episode.id, targetPath);
  return app.api.moveNovel(target.novel.id, targetPath);
}

export async function runLibraryDeleteRequest(app, target, deps = {}) {
  const formatFolderPath = typeof deps.formatFolderPath === 'function' ? deps.formatFolderPath : value => String(value || '');
  if (target?.type === 'folder') { const categoryPath = formatFolderPath(target.folderKey); const confirmText = app?.state?.userAccessSnapshot?.userId ? `DELETE:${categoryPath}` : 'DELETE'; return app.api.deleteFolder(categoryPath, { confirmText }); }
  if (target?.type === 'episode') return app.api.deleteEpisode(target.novel.id, target.episode.id);
  return app.api.deleteNovel(target.novel.id);
}

export function isCurrentDeletedByTarget(current, target) {
  if (!current || !target) return false;
  const sameNovel = target.type === 'novel' && current.novel?.id === target.novel?.id;
  const sameEpisode = target.type === 'episode' && current.novel?.id === target.novel?.id && current.episode?.id === target.episode?.id;
  return !!(sameNovel || sameEpisode);
}
