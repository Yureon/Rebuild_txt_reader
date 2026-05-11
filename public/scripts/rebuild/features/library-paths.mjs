export function formatFolderPath(folderKey) {
  return String(folderKey || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
}

export function parentFolderPath(folderKey) {
  const parts = String(folderKey || '').split('>').map(x => x.trim()).filter(Boolean);
  parts.pop();
  return parts.join(' > ');
}

export function normalizePromptCategory(value) {
  return String(value || '').split('>').map(x => x.trim()).filter(Boolean).join(' > ');
}

export function categoryFromStoragePath(storagePath) {
  const parts = String(storagePath || '').split(/[\\/]+/).map(x => x.trim()).filter(Boolean);
  parts.pop();
  return normalizePromptCategory(parts.join(' > '));
}

export function getCurrentLibraryPath(target) {
  if (!target) return '';
  if (target.type === 'folder') return parentFolderPath(target.folderKey);
  if (target.type === 'episode') return categoryFromStoragePath(target.episode?.path || '');
  return normalizePromptCategory(target.novel?.categoryPath || '');
}

export const MULTIFILE_RESUME_COORDINATE_POLICY_PASS = 'v470-multifile-resume-coordinate-policy-pass';

export function resolveSnapshotResumeRatio(snap) {
  const chunkRatio = Number(snap?.ratio);
  if (Number.isFinite(chunkRatio)) return Math.min(1, Math.max(0, chunkRatio));
  const episodeRatio = Number(snap?.episodeDocumentRatio);
  if (Number.isFinite(episodeRatio)) return Math.min(1, Math.max(0, episodeRatio));
  const documentRatio = Number(snap?.documentRatio);
  return Number.isFinite(documentRatio) ? Math.min(1, Math.max(0, documentRatio)) : 0;
}

export function openOptionsFromSnapshot(base, snap) {
  const ratio = resolveSnapshotResumeRatio(snap);
  return {
    ...base,
    coordinatePolicyPass: MULTIFILE_RESUME_COORDINATE_POLICY_PASS,
    chunk: snap?.chunk || 1,
    totalChunks: snap?.totalChunks,
    ratio,
    episodeDocumentRatio: snap?.episodeDocumentRatio,
    documentRatio: snap?.documentRatio,
    globalBlockIndex: snap?.globalBlockIndex,
    blockIndex: snap?.blockIndex,
    charIndex: snap?.charIndex
  };
}
