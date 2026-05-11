import { buildLibraryDeleteConfirmMessage } from './library-mutation-formatters.mjs';

export function getLibraryRenameCurrentTitle(target) {
  if (target?.type === 'folder') return String(target.title || '');
  if (target?.type === 'episode') return String(target.episode?.title || target.episode?.fileName || '');
  return String(target?.novel?.title || target?.novel?.fileName || '');
}

export function normalizeLibraryRenameInput(value) {
  return String(value || '').trim();
}

export function promptLibraryRename(target, deps = {}) {
  const promptFn = deps.prompt || globalThis.window?.prompt;
  if (typeof promptFn !== 'function') return null;
  const targetTypeLabel = typeof deps.targetTypeLabel === 'function' ? deps.targetTypeLabel : type => String(type || '항목');
  const current = getLibraryRenameCurrentTitle(target);
  const label = targetTypeLabel(target?.type);
  const raw = promptFn(`${label} 이름 변경`, current || '');
  if (raw == null) return null;
  const next = normalizeLibraryRenameInput(raw);
  if (!next || next === current) return null;
  return { current, next, label };
}

export function confirmLibraryDelete(target, deps = {}) {
  const confirmFn = deps.confirm || globalThis.window?.confirm;
  if (typeof confirmFn !== 'function') return false;
  return !!confirmFn(buildLibraryDeleteConfirmMessage(target));
}

export function buildLibraryMoveConfirmMessage(source, destination, deps = {}) {
  const targetTypeLabel = typeof deps.targetTypeLabel === 'function' ? deps.targetTypeLabel : type => String(type || '항목');
  const label = targetTypeLabel(source?.type);
  const title = source?.title || source?.novel?.title || source?.episode?.title || label;
  return `${label} 이동: ${title}\n대상: ${destination || '루트'}\n계속할까요?`;
}

export function confirmLibraryMove(source, destination, deps = {}) {
  const confirmFn = deps.confirm || globalThis.window?.confirm;
  if (typeof confirmFn !== 'function') return false;
  return !!confirmFn(buildLibraryMoveConfirmMessage(source, destination, deps));
}
