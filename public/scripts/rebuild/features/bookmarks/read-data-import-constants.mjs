export const READ_DATA_IMPORT_TYPES = [
  { id: 'progress', label: '읽기 위치' },
  { id: 'bookmarks', label: '북마크' },
  { id: 'recents', label: '최근 열람' },
  { id: 'favorites', label: '즐겨찾기' }
];

export const READ_DATA_IMPORT_POLICIES = [
  { id: 'merge', label: '병합' },
  { id: 'replace', label: '교체' },
  { id: 'newer', label: '최신값 유지' },
  { id: 'skip', label: '건너뛰기' }
];

export const READ_DATA_IMPORT_FILTER_TYPES = [
  { id: 'all', label: '전체 데이터' },
  ...READ_DATA_IMPORT_TYPES
];

export const READ_DATA_IMPORT_FILTER_STATUSES = [
  { id: 'all', label: '전체 상태' },
  { id: 'conflict', label: '충돌' },
  { id: 'added', label: '신규' },
  { id: 'stale', label: '목록 없음' }
];

export const READ_DATA_IMPORT_PAGE_SIZE = 80;
export const READ_DATA_IMPORT_RESULT_LIMIT = 5000;
export const READ_DATA_ROLLBACK_HISTORY_LIMIT = 5;
