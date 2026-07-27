import { targetTypeLabel } from './library-list-actions.mjs';

export function buildLibraryDeleteConfirmMessage(target) {
  const label = targetTypeLabel(target?.type);
  const title = target?.title || label;
  const detail = target?.type === 'folder'
    ? '폴더 안의 모든 TXT 파일이 삭제됩니다.'
    : target?.type === 'novel' && target?.novel?.isMultiFile
      ? '작품 폴더와 포함된 모든 회차가 삭제됩니다.'
      : 'TXT 파일이 삭제됩니다.';
  return `${label} 삭제: ${title}\n${detail}\n계속할까요?`;
}

export function describeLibraryMutationError(error) {
  const text = String(error && (error.message || error.error || error) || '').trim();
  if (!text) return '작업을 완료하지 못했습니다.';
  if (/EROFS|read-only|READ_ONLY_LIBRARY|읽기 전용/i.test(text)) return '라이브러리 폴더가 읽기 전용입니다. Docker/서버의 라이브러리 볼륨을 쓰기 가능(:rw)으로 마운트해야 이름 변경/이동/삭제를 사용할 수 있습니다.';
  if (/EACCES|EPERM|permission/i.test(text)) return '파일 권한 때문에 작업을 완료하지 못했습니다. 라이브러리 폴더의 쓰기 권한을 확인하세요.';
  if (/exists|EEXIST|already/i.test(text)) return '같은 이름의 파일 또는 폴더가 이미 있습니다.';
  if (/not found|ENOENT|Path not found|Novel not found/i.test(text)) return '대상 파일 또는 폴더를 찾을 수 없습니다. 목록을 새로고침한 뒤 다시 시도하세요.';
  if (/invalid path|Invalid path/i.test(text)) return '허용되지 않는 이동 경로입니다.';
  if (/invalid/i.test(text)) return '입력값이 올바르지 않습니다.';
  if (/csrf|same-origin|forbidden|403/i.test(text)) return '보안 검증에 실패했습니다. 페이지를 새로고침한 뒤 다시 시도하세요.';
  return text;
}
