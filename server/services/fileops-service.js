const fs = require('fs');
const path = require('path');

function createFileopsService({ libraryService, logger = console, onMutation = null } = {}) {
  if (!libraryService) throw new Error('libraryService is required');

  const {
    scanLibrary,
    getLibraryCached,
    invalidateLibraryCache,
    sanitizeNodeName,
    normalizeTxtBaseName,
    safeJoinUnderLibrary,
    ensureExists,
    ensureNotExists,
    ensureDirExists,
    cleanupEmptyParents,
    categoryPathToRelDir,
    sendFsError,
    invalidatePathCaches,
    clearFileCachePath,
    clearAllFileCache,
    isSubPath,
    getNovelStorageInfo,
    getEpisodeStorageInfo,
    clearNovelCachesByInfo
  } = libraryService;

  function notifyMutation(type, payload = {}) {
    if (typeof onMutation !== 'function') return;
    try {
      onMutation({ type, ...payload });
    } catch (error) {
      if (logger && typeof logger.warn === 'function') logger.warn('file mutation hook failed', error && error.message || error);
    }
  }

  function findNovel(novelId) {
    const library = getLibraryCached();
    const novel = library.find(n => n.id === novelId);
    if (!novel) throw new Error('Novel not found');
    return novel;
  }

  function renameFolder({ categoryPath, newName }) {
    const safeName = sanitizeNodeName(newName);
    if (!categoryPath || !safeName) throw new Error('Invalid request');

    const oldRelDir = categoryPathToRelDir(categoryPath);
    const oldAbsDir = safeJoinUnderLibrary(oldRelDir);
    const parentDir = path.dirname(oldAbsDir);
    const newAbsDir = path.join(parentDir, safeName);

    ensureExists(oldAbsDir);
    ensureNotExists(newAbsDir);

    fs.renameSync(oldAbsDir, newAbsDir);
    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('renameFolder', { oldPath: categoryPath, newName: safeName });

    return { success: true, oldPath: categoryPath, newName: safeName };
  }

  function renameNovel({ novelId, title }) {
    const novel = findNovel(novelId);
    const info = getNovelStorageInfo(novel);
    const nextTitle = normalizeTxtBaseName(title);
    if (!nextTitle) throw new Error('Invalid title');

    let destAbsPath;
    if (info.type === 'folder') {
      destAbsPath = path.join(path.dirname(info.absPath), nextTitle);
    } else {
      destAbsPath = path.join(path.dirname(info.absPath), nextTitle + '.txt');
    }

    if (path.resolve(destAbsPath) === path.resolve(info.absPath)) {
      return { success: true, skipped: true, type: 'novel', novelId: novel.id, oldTitle: novel.title, newTitle: nextTitle };
    }

    ensureExists(info.absPath);
    ensureNotExists(destAbsPath);
    clearNovelCachesByInfo(info);
    fs.renameSync(info.absPath, destAbsPath);

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('renameNovel', { novelId: novel.id, oldTitle: novel.title, newTitle: nextTitle });

    return {
      success: true,
      type: 'novel',
      novelId: novel.id,
      oldTitle: novel.title,
      newTitle: nextTitle
    };
  }

  function deleteNovel({ novelId }) {
    const novel = findNovel(novelId);
    const info = getNovelStorageInfo(novel);
    const parentDir = path.dirname(info.absPath);

    ensureExists(info.absPath);
    clearNovelCachesByInfo(info);
    if (info.type === 'folder') fs.rmSync(info.absPath, { recursive: true, force: false });
    else fs.unlinkSync(info.absPath);
    cleanupEmptyParents(parentDir);

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('deleteNovel', { novelId: novel.id, title: novel.title, path: info.absPath });

    return {
      success: true,
      type: 'novel',
      novelId: novel.id,
      deleted: novel.title
    };
  }

  function moveNovel({ novelId, targetCategoryPath = '' }) {
    const novel = findNovel(novelId);
    const info = getNovelStorageInfo(novel);

    const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
    const targetAbsDir = safeJoinUnderLibrary(targetRelDir);

    ensureExists(info.absPath);
    ensureDirExists(targetAbsDir);

    const destAbsPath = path.join(targetAbsDir, info.name);
    if (path.resolve(destAbsPath) === path.resolve(info.absPath)) {
      return { success: true, skipped: true };
    }

    if (info.type === 'folder' && isSubPath(info.absPath, targetAbsDir)) {
      throw new Error('Invalid path');
    }

    ensureNotExists(destAbsPath);

    clearNovelCachesByInfo(info);
    fs.renameSync(info.absPath, destAbsPath);

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('moveNovel', { novelId: novel.id, movedTo: targetCategoryPath || '' });

    return {
      success: true,
      type: 'novel',
      novelId: novel.id,
      movedTo: targetCategoryPath || ''
    };
  }

  function moveEpisode({ novelId, episodeId, targetCategoryPath = '' }) {
    const novel = findNovel(novelId);
    const info = getEpisodeStorageInfo(novel, episodeId);

    const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
    const targetAbsDir = safeJoinUnderLibrary(targetRelDir);

    ensureExists(info.absPath);
    ensureDirExists(targetAbsDir);

    const destAbsPath = path.join(targetAbsDir, info.name);
    if (path.resolve(destAbsPath) === path.resolve(info.absPath)) {
      return { success: true, skipped: true };
    }

    ensureNotExists(destAbsPath);

    clearNovelCachesByInfo(info);
    fs.renameSync(info.absPath, destAbsPath);
    cleanupEmptyParents(path.dirname(info.absPath));

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('moveEpisode', { novelId: novel.id, episodeId, movedTo: targetCategoryPath || '' });

    return {
      success: true,
      type: 'episode',
      novelId: novel.id,
      episodeId,
      movedTo: targetCategoryPath || ''
    };
  }

  function moveFolder({ categoryPath, targetCategoryPath = '' }) {
    if (!categoryPath) throw new Error('Invalid request');

    const srcRelDir = categoryPathToRelDir(categoryPath);
    const srcAbsDir = safeJoinUnderLibrary(srcRelDir);

    const targetRelDir = targetCategoryPath ? categoryPathToRelDir(targetCategoryPath) : '';
    const targetAbsDir = safeJoinUnderLibrary(targetRelDir);

    ensureExists(srcAbsDir);
    ensureDirExists(targetAbsDir);

    if (isSubPath(srcAbsDir, targetAbsDir)) {
      throw new Error('Invalid path');
    }

    const destAbsDir = path.join(targetAbsDir, path.basename(srcAbsDir));
    if (path.resolve(destAbsDir) === path.resolve(srcAbsDir)) {
      return { success: true, skipped: true };
    }

    ensureNotExists(destAbsDir);

    try {
      const files = scanLibrary(srcAbsDir);
      files.forEach(fp => invalidatePathCaches(fp));
    } catch (error) {
      if (logger && typeof logger.warn === 'function') logger.warn('folder cache invalidation failed', error && error.message || error);
    }

    fs.renameSync(srcAbsDir, destAbsDir);

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('moveFolder', { movedFolder: categoryPath, movedTo: targetCategoryPath || '' });

    return {
      success: true,
      type: 'folder',
      movedFolder: categoryPath,
      movedTo: targetCategoryPath || ''
    };
  }

  function renameEpisode({ novelId, episodeId, title }) {
    const novel = findNovel(novelId);
    const episode = (novel.episodes || []).find(e => e.id === episodeId);
    if (!episode) throw new Error('Path not found');

    const nextTitle = normalizeTxtBaseName(title);
    if (!nextTitle) throw new Error('Invalid title');

    const oldAbs = safeJoinUnderLibrary(episode.path);
    const dir = path.dirname(oldAbs);
    const newAbs = path.join(dir, nextTitle + '.txt');

    ensureExists(oldAbs);
    ensureNotExists(newAbs);

    fs.renameSync(oldAbs, newAbs);

    invalidateLibraryCache();
    clearFileCachePath(oldAbs);
    clearFileCachePath(newAbs);
    notifyMutation('renameEpisode', { novelId: novel.id, episodeId, oldPath: oldAbs, newPath: newAbs });

    return {
      success: true,
      type: 'episode',
      novelId: novel.id,
      episodeId,
      oldTitle: episode.title,
      newTitle: nextTitle
    };
  }

  function deleteEpisode({ novelId, episodeId }) {
    const novel = findNovel(novelId);
    const episode = (novel.episodes || []).find(e => e.id === episodeId);
    if (!episode) throw new Error('Path not found');

    const abs = safeJoinUnderLibrary(episode.path);
    const parentDir = path.dirname(abs);

    ensureExists(abs);
    fs.unlinkSync(abs);
    cleanupEmptyParents(parentDir);

    invalidateLibraryCache();
    clearFileCachePath(abs);
    notifyMutation('deleteEpisode', { novelId: novel.id, episodeId, path: abs });

    return {
      success: true,
      type: 'episode',
      novelId: novel.id,
      episodeId,
      deleted: episode.title
    };
  }

  function deleteFolder({ categoryPath }) {
    if (!categoryPath) throw new Error('Invalid request');

    const relDir = categoryPathToRelDir(categoryPath);
    const absDir = safeJoinUnderLibrary(relDir);
    const parentDir = path.dirname(absDir);

    ensureExists(absDir);
    fs.rmSync(absDir, { recursive: true, force: false });
    cleanupEmptyParents(parentDir);

    invalidateLibraryCache();
    clearAllFileCache();
    notifyMutation('deleteFolder', { deleted: categoryPath });

    return { success: true, deleted: categoryPath };
  }

  return {
    renameFolder,
    renameNovel,
    deleteNovel,
    moveNovel,
    moveEpisode,
    moveFolder,
    renameEpisode,
    deleteEpisode,
    deleteFolder,
    sendFsError
  };
}

module.exports = { createFileopsService };
