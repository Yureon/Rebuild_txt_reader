export const READER_OFFLINE_STATUS_FORMATTERS_PASS = 'v215-reader-offline-status-formatters-pass';

export function buildOfflineButtonTitle({ profile = {}, prefetch = {}, coverage = null } = {}) {
  const coverageText = coverage?.total ? `캐시 ${coverage.cached}/${coverage.total}` : '캐시 상태 미확인';
  const queueText = prefetch?.pending ? `대기 ${prefetch.pending}개` : '대기 없음';
  return [
    '현재 작품 오프라인 준비',
    profile.detail,
    coverageText,
    queueText
  ].filter(Boolean).join(' · ');
}

export function normalizeOfflineFailedChunks(value) {
  const out = [];
  const seen = new Set();
  (Array.isArray(value) ? value : []).forEach(item => {
    const chunk = Math.max(1, Math.round(Number(item) || 0));
    if (!chunk || seen.has(chunk)) return;
    seen.add(chunk);
    out.push(chunk);
  });
  return out.sort((a, b) => a - b);
}

export function buildOfflinePanelViewModel({ profile = {}, prefetch = {}, coverage = null, download = null } = {}) {
  const failedChunks = normalizeOfflineFailedChunks(download?.failedChunks || []);
  if (download?.running) {
    const done = Math.max(0, Number(download.done) || 0);
    const total = Math.max(1, Number(download.total) || 1);
    const failed = Math.max(0, Number(download.failed) || failedChunks.length || 0);
    return {
      title: '오프라인 저장 중',
      fillPercent: Math.round((done / total) * 100),
      meta: download.currentChunk ? `${download.label || '선택 구간'} · ${download.currentChunk}번 구간 저장 중` : `${download.label || '선택 구간'} · 저장 준비 중…`,
      stats: `진행 ${done}/${total} · 캐시 ${download.cached || 0} · 네트워크 ${download.fetched || 0} · 실패 ${failed}`,
      failedChunks,
      cancelVisible: true,
      retryVisible: false
    };
  }
  if (failedChunks.length) {
    const done = Math.max(0, Number(download?.done) || 0);
    const total = Math.max(1, Number(download?.total) || failedChunks.length);
    return {
      title: '오프라인 캐시 상태',
      fillPercent: Math.round((done / total) * 100),
      meta: `${download?.label || '선택 구간'} · 실패 ${failedChunks.length}개 재시도 가능`,
      stats: `완료 ${Math.max(0, done - failedChunks.length)}/${total} · 최근 오류 ${download?.lastError || download?.error || '-'}`,
      failedChunks,
      cancelVisible: false,
      retryVisible: true
    };
  }
  if (coverage?.total) {
    return {
      title: '오프라인 캐시 상태',
      fillPercent: Math.round((coverage.cached / coverage.total) * 100),
      meta: `현재 주변 ${coverage.start}-${coverage.end} 구간`,
      stats: `준비됨 ${coverage.cached}/${coverage.total} · ${profile.label} · 반경 ${coverage.radius}`,
      failedChunks,
      cancelVisible: false,
      retryVisible: false
    };
  }
  return {
    title: '오프라인 캐시 상태',
    fillPercent: 0,
    meta: '작품을 열면 주변 캐시 상태를 표시합니다.',
    stats: `${profile.label} · ${profile.detail}`,
    failedChunks,
    cancelVisible: false,
    retryVisible: false
  };
}
