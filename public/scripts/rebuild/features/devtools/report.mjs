export const DEVTOOLS_REPORT_VERSION = 'rebuild-v682';
import { appendSection, bool, buildErrorRows, formatTime, mask, number, pushHeader, row, summarizeConnection, summarizeObject } from './report-formatters.mjs';
export const DEVTOOLS_REPORT_PASS = 'v162-devtools-friendly-report';
export const READER_STABILITY_BASELINE_PASS = 'v489-reader-stability-baseline-devtools-pass';

export const DEVTOOLS_SECTIONS = [
  { id:'app', label:'앱 상태' },
  { id:'ui', label:'UI/테마' },
  { id:'reader', label:'리더 상태' },
  { id:'search', label:'검색 상태' },
  { id:'sync', label:'동기화 상태' },
  { id:'device', label:'기기 상태' },
  { id:'storage', label:'저장소' },
  { id:'dom', label:'DOM 상태' },
  { id:'cache', label:'캐시' },
  { id:'network', label:'네트워크' },
  { id:'errors', label:'오류' },
  { id:'perf', label:'성능' }
];

export const DEVTOOLS_DEFAULT_OPTIONS = DEVTOOLS_SECTIONS.reduce((out, item) => {
  out[item.id] = ['app','ui','reader','search','sync','device','storage','cache','errors','perf'].includes(item.id);
  return out;
}, { enabled:true });

export function normalizeDevtoolsOptions(input = null) {
  const src = input && typeof input === 'object' ? input : {};
  const out = { ...DEVTOOLS_DEFAULT_OPTIONS };
  out.enabled = src.enabled !== false;
  DEVTOOLS_SECTIONS.forEach(item => {
    if (Object.prototype.hasOwnProperty.call(src, item.id)) out[item.id] = !!src[item.id];
  });
  return out;
}

export function applyDevtoolsOptionsToInputs(app, options = DEVTOOLS_DEFAULT_OPTIONS) {
  const normalized = normalizeDevtoolsOptions(options);
  setChecked(app.els.devdbgEnable, normalized.enabled);
  DEVTOOLS_SECTIONS.forEach(item => setChecked(getSectionInput(app, item.id), normalized[item.id]));
}

export function collectDevtoolsOptionsFromInputs(app, fallback = DEVTOOLS_DEFAULT_OPTIONS) {
  const out = normalizeDevtoolsOptions(fallback);
  if (app.els.devdbgEnable) out.enabled = !!app.els.devdbgEnable.checked;
  DEVTOOLS_SECTIONS.forEach(item => {
    const input = getSectionInput(app, item.id);
    if (input) out[item.id] = !!input.checked;
  });
  return normalizeDevtoolsOptions(out);
}

export function summarizeDevtoolsOptions(options = DEVTOOLS_DEFAULT_OPTIONS) {
  const normalized = normalizeDevtoolsOptions(options);
  if (!normalized.enabled) return '디버그 표시 꺼짐';
  const active = DEVTOOLS_SECTIONS.filter(item => normalized[item.id]).map(item => item.label);
  return active.length ? `표시 섹션 ${active.length}개 · ${active.slice(0, 4).join(', ')}${active.length > 4 ? ' …' : ''}` : '표시 섹션 없음';
}

export function formatDevtoolsReport(app, snapshot = {}, options = DEVTOOLS_DEFAULT_OPTIONS) {
  const normalized = normalizeDevtoolsOptions(options);
  const lines = [];
  pushHeader(lines, '개발자 디버그 리포트');
  lines.push(`생성 시각: ${formatTime(Date.now())}`);
  lines.push(`리포트 패스: ${DEVTOOLS_REPORT_PASS}`);
  lines.push(`표시 상태: ${normalized.enabled ? '켜짐' : '꺼짐'}`);
  lines.push('설명: 각 항목의 주석은 값이 의미하는 런타임 상태를 짧게 풀어쓴 것입니다.');

  if (!normalized.enabled) {
    lines.push('');
    lines.push('디버그 표시가 꺼져 있습니다. 왼쪽 토글을 켜면 선택한 섹션만 다시 생성됩니다.');
    return lines.join('\n');
  }

  if (normalized.app) appendSection(lines, '앱 상태', [
    row('version', app.state.version || snapshot.version || '-', '현재 클라이언트 빌드/캐시 버전입니다.'),
    row('currentNovel', app.state.current?.title || '-', '현재 열려 있는 작품명입니다.'),
    row('episodeId', app.state.current?.episodeId || '-', '현재 읽는 에피소드 식별자입니다.'),
    row('chunk', app.state.current ? `${app.state.current.chunk || 1} / ${app.state.current.totalChunks || 1}` : '-', '현재 로드된 청크 위치와 전체 청크 수입니다.'),
    row('errors', String(app.state.errors?.length || 0), '런타임에서 누적한 오류 항목 수입니다.')
  ]);

  if (normalized.ui) appendSection(lines, 'UI/테마', [
    row('themeMode', app.state.prefs.themeMode, 'light/dark 모드입니다.'),
    row('themePresetId', app.state.prefs.themePresetId || 'custom-current', '현재 선택된 테마 프리셋 또는 사용자 테마 ID입니다.'),
    row('readerBg', app.state.prefs.readerBg, '본문 영역 배경색입니다.'),
    row('readerText', app.state.prefs.readerText, '본문 글자색입니다.'),
    row('safeNetworkPos', app.state.prefs.safeNetworkPos || 'auto', 'safe-area 안에서 네트워크 인디케이터를 배치하는 정책입니다.'),
    row('safeViewportAutoFit', bool(app.state.prefs.safeViewportAutoFit), '모바일 safe-area 자동 보정 사용 여부입니다.')
  ]);

  if (normalized.reader) appendSection(lines, '리더 상태', [
    row('readerStabilityBaseline', 'v487 fileChar anchoring baseline · protected by v489 smoke', '사용자가 튐이 사라졌다고 평가한 reader 안정 기준입니다. 최적화 시 docs/reader-anchoring-stability-contract.md를 먼저 확인해야 합니다.'),
    row('loadedChunks', String(app.state.loadedChunks?.size || 0), '현재 DOM/메모리에 열린 청크 수입니다.'),
    row('chunkTextCache', String(app.state.chunkTextCache?.size || 0), '메모리 텍스트 캐시에 남아 있는 청크 수입니다.'),
    row('scrollTop', number(app.els.reader?.scrollTop), '리더 스크롤 컨테이너의 현재 세로 위치입니다.'),
    row('viewportHeight', number(app.els.reader?.clientHeight), '리더 화면에 보이는 높이입니다.'),
    row('sliderProgress', summarizeObject(app.state.lastReaderSliderProgressDiagnostic || snapshot.readerProgressDiagnostics?.sliderProgressDiagnostic), '하단 slider thumb가 사용한 좌표계와 ratio입니다.'),
    row('coordinatePolicy', summarizeObject(app.state.lastReaderCoordinatePolicy || snapshot.readerProgressDiagnostics?.coordinatePolicy), 'safe-area/slider/resume 좌표계 정책입니다.'),
    row('appendScrollTop', summarizeObject(snapshot.virtualDiagnostics?.lastAppendSeamScrollTopDiagnostic), 'append 직후 scrollTop 보정 주체와 delta입니다.'),
    row('prependScrollTop', summarizeObject(snapshot.virtualDiagnostics?.lastPrependSeamScrollTopDiagnostic), 'prepend 직후 scrollTop 보정 주체와 delta입니다.'),
    row('virtualLayout', summarizeObject(snapshot.virtualLayout || snapshot.virtualDiagnostics), '가상 레이아웃/측정 캐시 상태 요약입니다.')
  ]);

  if (normalized.search) appendSection(lines, '검색 상태', [
    row('query', app.state.search?.query || '-', '마지막 검색어입니다.'),
    row('results', String(app.state.search?.results?.length || 0), '현재 검색 결과 개수입니다.'),
    row('activeIndex', String(app.state.search?.activeIndex ?? -1), '선택된 검색 결과 인덱스입니다.'),
    row('mode', app.state.search?.mode || '-', '현재 검색 범위/모드입니다.'),
    row('scanning', bool(app.state.search?.scanning), '전체 검색 스캔이 진행 중인지 여부입니다.')
  ]);

  if (normalized.sync) appendSection(lines, '동기화 상태', [
    row('sharedVersion', String(app.state.sharedVersion || 0), '서버 shared 상태 버전입니다.'),
    row('deviceVersion', String(app.state.deviceVersion || 0), '이 기기 device 상태 버전입니다.'),
    row('syncPolicySummary', summarizeObject(app.state.syncPolicySummary), '서버가 계산한 공유/기기 우선순위 요약입니다.'),
    row('remoteResume', summarizeObject(app.state.remoteResumeOffer), '다른 기기 읽기 위치 제안 상태입니다.')
  ]);

  if (normalized.device) appendSection(lines, '기기 상태', [
    row('deviceName', app.state.deviceName || '-', '현재 브라우저/기기 이름입니다.'),
    row('deviceId', mask(app.state.deviceId), '현재 기기 식별자입니다. 앞뒤 일부만 표시합니다.'),
    row('preferredDevice', app.state.syncPolicySummary?.preferredDeviceName || app.state.syncPolicySummary?.preferredDeviceId || '-', '동기화 충돌 시 우선하는 기기입니다.')
  ]);

  if (normalized.storage) appendSection(lines, '저장소', [
    row('bookmarks', String(app.state.bookmarks?.length || 0), '저장된 북마크 수입니다.'),
    row('recents', String(app.state.recents?.length || 0), '최근 열람 목록 수입니다.'),
    row('favorites', String(app.state.favorites?.size || 0), '즐겨찾기 작품 수입니다.'),
    row('collapsedFolders', String(app.state.collapsedFolders?.size || 0), '접힌 폴더 수입니다.')
  ]);

  if (normalized.dom) appendSection(lines, 'DOM 상태', [
    row('readerMounted', bool(!!app.els.reader), '리더 컨테이너가 DOM에 연결되어 있는지입니다.'),
    row('contentMounted', bool(!!app.els.content), '본문 컨테이너가 DOM에 연결되어 있는지입니다.'),
    row('themeModal', bool(!!app.els.themeEditorModal), '테마 편집 모달 요소가 수집되었는지입니다.'),
    row('safeAreaBar', bool(!!app.els.safeAreaBar), 'safe-area 상단바 요소가 수집되었는지입니다.')
  ]);

  if (normalized.cache) appendSection(lines, '캐시', [
    row('memoryChunkTextCache', String(app.state.chunkTextCache?.size || 0), '메모리상의 청크 텍스트 캐시 수입니다.'),
    row('readerCacheEnabled', bool(app.state.prefs.readerCache), 'IndexedDB 기반 reader cache 사용 여부입니다.'),
    row('measureCache', String(snapshot.virtualLayout?.measureCacheSize ?? '-'), '가상 레이아웃 높이 측정 캐시 개수입니다.')
  ]);

  if (normalized.network) appendSection(lines, '네트워크', [
    row('online', bool(navigator.onLine), '브라우저가 보고하는 온라인 상태입니다.'),
    row('connection', summarizeConnection(), 'Network Information API가 제공하는 연결 품질입니다.'),
    row('serverNotify', bool(app.state.prefs.serverCommNotify), '다른 기기/서버 통신 알림 사용 여부입니다.')
  ]);

  if (normalized.errors) appendSection(lines, '오류', buildErrorRows(app.state.errors));
  if (normalized.perf) {
    const perf = app.performanceMetrics || globalThis.__TXT_READER_PERF__ || {};
    const bootStart = Number(perf.phases?.bootStart?.at) || 0;
    const bootComplete = Number(perf.phases?.bootComplete?.at) || 0;
    appendSection(lines, '성능', [
      row('bootDurationMs', bootStart && bootComplete ? number(bootComplete - bootStart) : '-', '앱 부팅 시작부터 라이브러리와 복원 초기화 완료까지의 시간입니다.'),
      row('appShellMs', number(perf.resources?.appShell?.durationMs), '핵심 앱 셸 HTML을 가져와 DOM에 삽입한 시간입니다.'),
      row('deferredUiMs', number(perf.resources?.deferredUiHtml?.durationMs), '설정·검색·진단 UI를 최초 사용 시 불러온 시간입니다.'),
      row('resourceCount', String(perf.resourceSummary?.count ?? '-'), '부팅 완료 시점까지 브라우저가 기록한 resource entry 수입니다.'),
      row('longTasks', String(perf.longTasks?.length || 0), '최근 기록된 50ms 이상 메인 스레드 long task 수입니다.'),
      row('renderedBlocks', String(app.els.content?.children?.length || 0), '현재 본문 DOM에 남아 있는 직접 자식 블록 수입니다.'),
      row('shelfCards', String(app.els.novelList?.querySelectorAll?.('.library-shelf-card')?.length || 0), '현재 DOM에 유지 중인 서재 카드 수입니다.'),
      row('readerScrollHeight', number(app.els.reader?.scrollHeight), '리더 전체 스크롤 높이입니다.'),
      row('readerClientHeight', number(app.els.reader?.clientHeight), '리더 보이는 높이입니다.'),
      row('timestamp', String(Date.now()), '리포트 생성 시각의 epoch milliseconds입니다.')
    ]);
  }

  lines.push('');
  lines.push('원본 JSON이 필요하면 복구 센터의 JSON 내보내기를 사용하세요. 이 화면은 빠른 상태 판독용으로 요약됩니다.');
  return lines.join('\n');
}

function getSectionInput(app, id) {
  const key = 'devdbg' + id.slice(0, 1).toUpperCase() + id.slice(1);
  return app.els[key] || null;
}

function setChecked(input, value) {
  if (input) input.checked = !!value;
}
