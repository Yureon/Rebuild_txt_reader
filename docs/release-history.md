## v682 · Windows PowerShell 5.1 라이브러리 정리 스크립트 호환성

Owner 관리 페이지에서 생성한 라이브러리 정리/재배치 `.ps1`이 Windows PowerShell 5.1의 .NET Framework에 없는 `System.IO.Path.GetRelativePath` 때문에 실행되지 않던 문제를 수정했다. 상대경로는 정규화된 root prefix를 검증 후 제거하는 방식으로 계산하며 기존 경로 탈출·reparse-point 방어를 유지한다.

<!-- v682-release-history-pass -->

# 릴리스 이력

## v681 · Metadata 수동 입력 출처 필터

Metadata 관리 작품 목록에서 직접 입력으로 저장한 적용 결과를 별도로 조회할 수 있도록 `manual` 출처 옵션과 서버 판정 helper를 추가했다. 기존 applied record의 `providerId: manual`을 그대로 사용하므로 migration은 없다.

<!-- v681-release-history-pass -->

# 릴리스 이력

## v680 · 로그인 Owner 팔레트와 사용자별 테마 bootstrap

로그인 페이지를 Owner 콘솔 팔레트로 통일하고, 인증 후 사용자 ID별 scoped theme를 서재·Metadata·Reader에 적용했다. theme-only bootstrap API와 로그인 redirect 전 prime, Metadata 독립 진입 bootstrap을 추가했다.

<!-- v680-release-history-pass -->


## v679 · 폴더 필터 접기/펼치기

- 메타데이터 작품 목록의 폴더 선택·검색·더 보기 controls를 native `details/summary` disclosure로 묶었다.
- 선택 폴더나 검색어가 있으면 요약에 현재 필터를 표시하고 자동으로 펼친다.
- 사용자가 접거나 펼친 상태는 같은 탭의 `sessionStorage`에 유지한다.
- 모바일에서는 panel을 단일 열로 전환하며 키보드 focus와 native disclosure semantics를 유지한다.
# v678

Metadata folder search theme ownership, v678 static cache namespace, Metadata Helper 380px fixed popup width. Public API/storage schema unchanged.

<!-- v678-release-history-pass -->

# v677 — 대형 catalog·Metadata hard bound와 release gate

- applied 참조까지 포함하는 candidate hard cap과 compact provenance snapshot을 적용했다.
- cap 이후 전체 sort를 indexed min-heap eviction으로 교체했다.
- tree/explorer와 folder facet을 cursor paging으로 바꾸고 favorite/recent revision을 분리했다.
- Metadata cover와 audit log를 no-follow 열린 handle로 처리한다.
- package 전체 format parser와 runtime dependency install gate를 추가했다.

<!-- v677-release-history-pass -->

# v674 — 대규모 Reader·서재 안전 경계와 저장 내구성

- Reader 진행도 로컬 fallback을 사용자 scope별 증분 bounded snapshot으로 전환했다.
- prefetch abort/재예약 controller 경쟁을 실행별 identity로 차단했다.
- 가상 서재 실패 fallback을 500작품·300회차 DOM으로 제한하고 bookmark index·collapsed lazy render를 적용했다.
- Service Worker의 navigation client-state 영속화를 응답과 분리한 best-effort 작업으로 바꿨다.
- JSON/gzip 원자 저장과 library file operation의 directory sync 실패가 성공으로 축소되지 않게 했다.
- device profile·sync metadata를 하나의 bounded recent set으로 유지한다.
- Playwright metadata 경로의 DNS rebinding/TOCTOU를 fail-closed로 보강했다.
- Windows 경로와 ESM/선택적 도구 환경을 검증 gate가 정확히 분류한다.

<!-- v674-release-history-pass -->

# v673 — 적용 metadata·서재·캐시 증폭 제거

- applied 증분 index와 candidate-reference 역인덱스
- applied 32-shard durable 저장 및 legacy lazy migration
- candidate/applied sparse init과 dirty-version 경쟁 보호
- shelf 최종 page 태그 장식·tree early 304
- 변형 coarse bucket 강화
- disk janitor bounded top-k 후보 보관

<!-- v673-release-history-pass -->

# v672

- metadata candidate 저장의 전체 index rebuild를 증분 갱신으로 교체했다.
- 공개·정적 provider 요청은 HTTP transport를 우선하고 browser-required 요청만 Playwright를 사용한다.
- Playwright collection context에서 무거운 자산을 차단하고 rendered page를 작업별로 닫는다.
- collector idle TTL을 90초로 줄이고 환경변수를 추가했다.
- adapter normalization cache와 JSON parse/traversal 예산을 추가했다.

<!-- v672-release-history-pass -->

# v671

- 진행도 포화 시 새 locator가 성공 응답 뒤 유실되던 결함을 수정했다.
- metadata durable enqueue를 commit-before-publish로 변경했다.
- custom selector parser에 CPU·stack·HTML/DOM 예산을 추가했다.
- metadata candidates를 32개 gzip shard로 분리하고 dirty shard만 저장한다.
- queue checkpoint, candidate compaction, cleanup preview, library journal과 audit log의 event-loop·write amplification을 줄였다.
- worker가 없는 대용량 TXT는 main thread 처리하지 않고 503으로 fail-closed한다.

<!-- v671-release-history-pass -->

# v670

- 서재 사이트 언어 선택을 Whale/Chromium의 네이티브 팝업에서 앱 테마 기반 listbox로 교체했다.
- UI 글자 크기 `− / +` 제어를 둥근 버튼과 중앙 수치 표시로 개선했다.
- Reader 환경설정의 개발자 탭을 고급으로 변경했다.
- 고급 탭 상단에 기기 관리, 독서 데이터 관리, 사용자 CSS를 배치하고 개발자 디버그를 하단으로 분리했다.

<!-- v670-release-history-pass -->

# v669

- metadata provider 쿨타임을 개별 HTTP 요청 시작 기준에서 한 작품 수집 완료 기준으로 변경했다.
- provider별 tail과 next-allowed timestamp를 분리해 A의 쿨타임이 B에 영향을 주지 않도록 했다.
- 같은 작품 내부 search/detail 요청에 쿨타임을 중복 부과하지 않는다.
- direct 수집·provider probe와 Owner UI·문서·회귀를 새 완료 기반 계약에 맞췄다.

<!-- v669-release-history-pass -->

# v667

- 서재 초기 Reader skeleton을 제거하고 metadata 관리 새로고침을 완료 추적형 async 작업으로 수정했다.
- Whale/Chromium 지연 credential autofill을 post-unlock scrub과 input/change 차단으로 보강했다.
- 개발자 복구센터, Reader 설정 modal 크기, 본문 검색 범위 footer를 정리했다.
- Owner metadata 설정을 기본·고급·정리 subtab으로 분리했다.
- custom HTTPS selector 공급자와 기본 공급자 URL/selector override를 추가했다.
- 공급자 정의를 durable 저장하고 기존 SSRF·속도 제한·queue 경계에 연결했다.

<!-- v667-release-history-pass -->

# v666

- 서재·Reader·metadata·Owner 콘솔의 로그인 무관 입력에 공통 autofill guard를 추가했다.
- 주요 비밀번호 관리자 무시 속성, parser-start readonly 방어, Chromium native autofill 제거를 적용했다.
- 실제 로그인·회원가입·계정 비밀번호 변경은 표준 credential autocomplete로 예외 처리했다.
- guard 자산을 Service Worker precache와 로그인 전 exact public allowlist에 연결했다.

<!-- v666-release-history-pass -->

# v664

- 서재에서 Reader로 이동할 때 작품 제목과 저장 위치를 표시하는 이어보기 선택창을 추가했다.
- 처음부터와 이어보기 선택을 실제 Reader 좌표 복원 경로에 연결했다.
- 카드형에서 탐색기형·파일 트리형으로 전환해도 최근 항목과 즐겨찾기가 유지되도록 수정했다.
- standalone 서재 빠른 목록이 숨겨진 Reader DOM을 열지 않고 Reader 페이지로 이동하도록 수정했다.

<!-- v664-release-history-pass -->

# v663

- Cloudflare Web Analytics/Browser Insights CSP opt-in에 외부 beacon source와 현재 관찰된 inline loader hash를 추가했다.
- 사용자 글꼴 등록을 `<style>` 삽입에서 `FontFace`/constructable stylesheet로 변경했다.
- metadata 표지와 사용자 글꼴 파일을 직접 stream하고 응답 크기·ETag·진단 header를 명시했다.
- 서재·metadata 표지 실패 fallback과 HTML/CSS/ESM/manifest/Service Worker 자산 검사를 추가했다.
- Cloudflare Tunnel→NPM HTTP 경로에서 NPM Force SSL을 끄도록 배포 문서를 수정했다.

<!-- v663-release-history-pass -->

# v661

- 파일 변경 작업의 대기열 상한, 대기 시간 제한, 요청 취소, watchdog 상태를 추가했다.
- 파일 작업 오류의 HTTP 상태·`Retry-After`·복구 필요 여부를 보존하고 journal commit/abort 실패를 성공으로 처리하지 않는다.
- Owner 파일 변경 감사 로그, metadata 작업의 durable enqueue, 관리자 정리 후보 plan cache/status API를 추가했다.
- 로그인 시 계정 본문 전체를 동기 저장하던 경로를 비동기 telemetry sidecar로 분리했다.
- 독서 데이터 modal을 80개 단위 점진 렌더링으로 변경했다.
- `.env.example`과 현재 개발 문서를 운영 중심으로 정리하고 과거 release 산출물의 패키지 혼입을 차단했다.

<!-- v661-release-history-pass -->

# v660

- 독서 데이터 modal과 import preview에서 opaque hash/UUID를 제목 또는 전체 식별자로 표시하지 않도록 수정.
- 현재 catalog와 progress/recent/bookmark 기록을 교차 참조해 사람이 읽을 수 있는 제목을 복구하고 새 snapshot에 작품·회차 제목을 저장.
- Reader 설정의 읽기 화면·조작/표시·개발자 탭을 viewport-safe 3열 grid로 재구성하고 hidden 탭 cascade 퇴행 방지.
- 개인 state·snapshot·font·browser storage·Reader/search cache·ACL 격리 감사 및 실행형 회귀 추가.

<!-- v660-release-history-pass -->

# v659

- 서재 환경설정의 강제 2열 비율을 제거하고 desktop 상세 폭을 최대 900px로 정리했다.
- 뷰어 미리보기와 공유/기기 초기화 action을 실제 preference 및 sync API에 연결했다.
- 독서 데이터 modal의 page 뒤 가림, library mobile full-screen 누락, desktop 과밀 폭을 수정했다.
- actual module harness와 5개 Chromium viewport 검증을 추가했다.

<!-- v659-release-history-pass -->

# v658

- Reader modal의 ID specificity가 서재 page 설정 scroll을 차단하던 cascade 결함 수정.
- 서재 설정에서 개발자 debug 탭 제거; Reader modal에는 유지.
- 모든 서재 보기 제목을 `서재`로 통일하고 `윈도우형`을 `탐색기형`으로 변경.
- 모바일 metadata unbounded work list의 nested scroll containment 제거.
- 중앙 touch drag, edge drag, desktop wheel을 포함한 viewport 검증 추가.

<!-- v658-release-history-pass -->

# v657

- 관리자 정리 후보 카드가 mobile에서 얇은 빈 행으로 보이던 stale marker selector를 제거했다.
- 서재 환경설정의 상충하는 100% height chain을 통합하고 detail body를 유일한 수직 scroll owner로 지정했다.
- 423개 후보 fixture와 7개 viewport 실행형 회귀를 추가했다.

<!-- v657-release-history-pass -->

# v656

- 모바일 Windows형 서재를 current-folder drawer와 단일 content scroller로 재구성.
- deferred 환경설정 DOM의 조기 null capture를 제거하고 모바일 분류→상세 전환 및 뒤로가기를 복구.

<!-- v656-release-history-pass -->

# v655

- 트리·Windows형 최근/즐겨찾기 빠른 목록 폭을 본문과 일치시켰다.
- Windows형 좌측 폴더 탐색에 접기·펼치기와 상태 저장을 추가했다.
- 카드형 최근·즐겨찾기 제거 버튼이 본문을 덮지 않도록 재배치했다.
- 환경설정 상세 scroll height chain과 사이트 언어 control 겹침을 수정했다.
- 관리자 검토 후보의 비교 전용 상태와 동작 결과를 명확히 표시했다.

<!-- v655-release-history-pass -->

# v654

- 서재 환경설정 상세의 높이 연쇄와 단일 스크롤 소유권을 수정했다.
- 설정 세부 UI를 page형 card와 desktop/mobile 전용 배치로 재구성했다.
- 명시적 서재 복귀가 브라우저 외부 이전 페이지로 이동하는 history 오류를 수정했다.
- 카드형 최근·즐겨찾기에서 해당 범위 제거 동작을 추가했다.
- Windows형 보기의 최근·즐겨찾기 `목록` 동작이 작품 폴더로 이동하도록 수정했다.

<!-- v654-release-history-pass -->

# v653

- 서재 환경설정 분류 선택 시 상세 panel이 hidden 상태에 남는 문제 수정.
- 모바일 서재에서 위로 스크롤·당길 때 로그아웃·metadata·환경설정 명령행 복원.
- Shelf/Explorer의 compact header를 공통 방향 인식 제어기로 통합하고 layout compensation 재축소 방어 추가.

<!-- v653-release-history-pass -->

# v652

- 서재 환경설정을 고정 분류 탐색 + 상세 본문 workspace로 재구성.
- 모바일 설정 목록/상세 2단계 전환과 본문 단일 scroll owner 추가.
- 관리자 중복 후보를 custom disclosure로 교체해 summary가 가로선으로 축소되는 문제 수정.
- Reader 블럭 점프 퍼센트 입력의 자유 편집·IME·commit 정규화 수정.

<!-- v652-release-history-pass -->

# v651

- 관리자 중복검사 native summary grid 붕괴를 block summary + 내부 grid wrapper로 수정.
- 모바일 초기 결과 DOM을 batch 단위로 제한.
- 로그인 후 업데이트 알림에 독립 critical stylesheet, public allowlist, Service Worker precache 추가.
- 서재 설정 page history/layer state 결함 수정.

<!-- v651-release-history-pass -->

# v650 릴리스

- 서재 헤더에서 전체 페이지형 환경설정 진입을 추가했다.
- Reader 설정 modal은 읽기 화면·조작/표시·개발자 탭만 노출한다.
- 개발자 디버그를 전용 탭으로 유지한다.
- 설정 page의 browser back, focus 격리와 responsive layout을 추가했다.
- Reader fullscreen toolbar와 safe-area의 검정 배경 오류를 수정했다.
- `rebuild-v650`, package `6.50.0`.

<!-- v650-release-history-pass -->

# v649 릴리스

- v648 전체 감사의 9개 결함을 모두 수정했다.
- durable mutation 선기록과 무제한 compact tombstone을 적용했다.
- 1,000개 동일본 fast path, alias 비절단, 검색 profile snapshot을 적용했다.
- release verifier timeout/process tree와 static-only 분류를 강화했다.
- 관리자 권한 picker와 중복검사 UI를 스마트폰·태블릿·데스크톱 반응형으로 수정했다.
- `rebuild-v649`, package `6.49.0`.

<!-- v649-release-history-pass -->

# v647 릴리스

- 설정 진단 bridge의 누락 import와 실패 격리를 수정했다.
- Reader 본문 검색 modal의 모바일 높이·테마·중복 안내를 수정했다.
- `rebuild-v647`, package `6.47.0`.

<!-- v647-release-history-pass -->

# 릴리스 이력

## v647 — 설정 진단·Reader 검색 modal 안정화

- `getLibraryCurrentWindowRows` 누락 참조로 설정 로드가 실패하던 오류 수정.
- 진단 실패를 설정 전체 실패로 전파하지 않는 fail-soft guard 추가.
- 모바일 본문 검색 modal의 idle/empty 높이와 테마 색상 수정.
- 초기 검색 안내 중복 제거.

기준: `6.47.0` / `rebuild-v647`.

<!-- v647-release-history-pass -->

# TXT Reader Multi release history

## v646 — 서재 진입·metadata cache invalidation 안정화

- metadata revision을 applied/candidate/settings로 분리해 후보 churn이 전체 서재 presentation을 재계산하지 않게 했다.
- fingerprint 단순 verification이 semantic revision을 올리던 경로를 제거했다.
- gzip write의 중복 JSON 직렬화와 매 write 전체 gunzip/parse를 줄이고 SHA-256 trusted backup 검증을 추가했다.
- cold catalog 단일 build 공유, bounded wait, presentation queue backpressure를 추가했다.
- client reset 요청 병합, 제한 retry, 기존 목록 보존을 추가했다.

기준: `6.46.0` / `rebuild-v646`.

<!-- v646-release-history-pass -->

# TXT Reader Multi release history

## v645 — Reader·본문 검색·서재 범위 UI 안정화

- 모바일 서재 `전체`·`최근`·`즐겨찾기`를 가로 배열과 전체 폭 행으로 수정했다.
- 공용 맨 위 이동 버튼을 Reader에서 숨겼다.
- 실제 network 상태와 cache/search 범위 표시를 분리했다.
- 본문 검색 modal의 잘못된 selector와 deferred stylesheet 누락 복구를 수정하고 검색 버튼·IME-safe 실행을 추가했다.
- Reader 좌표계는 변경하지 않고 전용·Reader·Search·Quick·Full 회귀로 보호한다.

기준: `6.45.0` / `rebuild-v645`.

<!-- v645-release-history-pass -->

# TXT Reader Multi release history

## v644 — 모바일 서재 헤더·초기 부하 안정화

- 모바일 헤더 제목·검색 영역이 절반 폭만 사용하던 invalid CSS grid를 수정했다.
- 초기 render에서 자동으로 모든 shelf cursor를 소비할 수 있던 pagination chain을 제거했다.
- 제한 사용자 상세 ACL 목록과 fingerprint sample I/O를 초기 shelf request에서 분리했다.
- `LIBRARY_FINGERPRINT_ENTRY_DELAY_MS` 기본값 15초를 추가했다.

<!-- v644-release-history-pass -->

## v643 · Owner 정리·권한·언어·provider 관리

- 파일 정리를 중복 정리/라이브러리 정리 subtab으로 분리하고 cleanup 후보 표시를 복구했다.
- metadata 제목·작가를 이용한 안전한 PowerShell library organization script를 추가했다.
- 라이브러리 권한 dropdown을 세그먼트 UI로 개선하고 폴더 picker의 desktop/mobile grid를 수정했다.
- Owner 콘솔과 23개 언어팩을 연결했다.
- 비한국어 site language에서 한국 metadata provider 6개를 숨기고 API를 차단했다.
- provider별 활성화, 우선순위, 자동 적용 기준, 요청 간격, 검색 제한을 Owner가 직접 설정하도록 확장했다.

기준: `6.43.0` / `rebuild-v643`.

<!-- v643-release-history-pass -->


## v642

- 소개글·본문 sample 기반 작품 동일성 판정과 MinHash background fingerprint.
- 관계 분류, 대표 파일 품질 점수, 수동 override/제외 복구, progress alias 보존.
- metadata store와 fingerprint cache gzip migration.
- Owner metadata storage 통계·preview·일괄 정리·rewrite.
- package `6.42.0`, runtime `rebuild-v642`.

<!-- v642-release-history-pass -->

# TXT Reader Multi release history

## v641

- v640 전수 감사 38개 항목 수정·gate 반영.
- Owner Windows형 권한 선택기, 서재 빠른 목록 접기, 카드형 태그 버튼, 지속형 맨 위 버튼.
- 소설넷 Metadata Helper 상세 판정과 두 번 실행 workflow.
- package `6.41.0`, runtime `rebuild-v641`.

<!-- v641-release-history-pass -->

이 문서는 최근 배포만 유지합니다. v640 이하 전체 원문은 소스 작업공간의 `docs/archive/release-history-through-v640.md.gz`에 보관하며 production ZIP에서는 제외합니다.


### Archived validation marker index

과거 원문은 압축 archive로 이동했지만, 현재 자동 회귀가 참조하는 계약 marker는 아래 index에 유지합니다.

- Builds: rebuild-v380 rebuild-v379 rebuild-v378 rebuild-v377 rebuild-v376 rebuild-v375 rebuild-v374 rebuild-v373 rebuild-v372 rebuild-v371 rebuild-v370 rebuild-v369 rebuild-v368 rebuild-v367 rebuild-v365 rebuild-v364 rebuild-v363 rebuild-v362 rebuild-v361 rebuild-v360 rebuild-v359 rebuild-v358 rebuild-v352
- Search/library: v349-search-remote-pill-compaction-pass v348-library-deep-signature-cache-smoke-pass v352-content-cache-rawtext-smoke-pass v365-search-continue-during-navigation-smoke-pass v363-search-multi-episode-full-scan-smoke-pass v366-search-compact-status-smoke-pass v369-settings-connectivity-smoke-pass v368-settings-connectivity-smoke-pass v369-multi-file-progress-recent-smoke-pass v369-library-readonly-mutation-error-smoke-pass v534-search-coverage-preview-schedule-smoke-pass v539-search-content-cache-limit-smoke-pass v296-library-stale-bridge-cleanup-smoke-pass
- Reader: v355-reader-multi-episode-append-anchor-smoke-pass v356-reader-episode-boundary-mode-smoke-pass v357-reader-episode-boundary-scroll-beyond-smoke-pass v358-reader-scroll-buffer-patch-anchor-smoke-pass v359-reader-bottom-ratio-boundary-lock-smoke-pass v360-reader-episode-bottom-anchor-smoke-pass v362-reader-jump-panel-episode-select-smoke-pass v361-reader-jump-panel-episode-select-smoke-pass v375-reader-append-correction-guard-smoke-pass v376-reader-prune-exact-anchor-smoke-pass v377-reader-native-scroll-retain-smoke-pass v378-reader-trusted-bottom-progress-smoke-pass v379-reader-multi-file-slider-manifest-smoke-pass v380-reader-multi-file-local-slider-smoke-pass v431-reader-native-forward-seam-transit-lock-smoke-pass v432-reader-native-forward-seam-render-hold-smoke-pass v516-reader-nav-slider-anchor-offset-target-pass v522-reader-multi-file-guard-cleanup-pass v522-reader-append-seam-anchor-correction-cleanup-smoke-pass v522-reader-append-boundary-native-retain-cleanup-smoke-pass
- Owner/UI: v382-pc-site-sidebar-close-toggle-smoke-pass v382-mobile-modal-layout-smoke-pass v403-audit-log-query-smoke-pass v441-owner-session-entry-redirect-smoke-pass v503-owner-css-split-pass
- Historical phase: Rebuild Phase 145

# v539 - full-search CPU load mitigation

이 제목은 압축 archive의 v539 원문을 가리키는 호환 index입니다.

## v630

# TXT Reader Multi v630 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.30.0`
- 런타임/캐시 마커: `rebuild-v630`
- 기준 배포본: `txt_reader_v629.zip`
- 결과 배포본: `txt_reader_v630.zip`

## 수정 사항

- Owner `파일 정리` 화면에서 후보 경로가 닫힌 상세 영역 안에만 있어 실제 대상 파일을 알아보기 어려웠던 문제를 수정했다.
- 각 묶음 제목 줄에 첫 정리 대상의 상대 경로를 항상 표시하고 첫 묶음을 자동으로 펼친다. 결과 영역의 최소 높이, grid row, overflow, visibility도 명시해 데스크톱·모바일 배치를 안정화했다.
- 정리 스크립트 출력 형식을 Node `.cjs`에서 UTF-8 BOM이 포함된 PowerShell `.ps1`로 변경했다. Node.js 없이 실행하며 기본 dry-run, `-Apply` 격리 이동, 경로 경계·reparse point·크기·mtime·대표 파일·대상 충돌 재검증을 유지한다.
- 전용 메타데이터 관리 화면과 서재 작품 팝업 양쪽에 수집 후보 개별 삭제 버튼을 추가했다. 삭제된 후보가 이미 적용된 경우 적용 데이터 사본은 유지하고 끊어진 candidate 참조만 제거한다.
- 제목, 작가, 소개글, 장르, 태그, 연재 상태, 출간 연도, 언어를 사용자가 직접 입력할 수 있는 편집기를 두 화면에 추가했다. 비어 있지 않은 입력만 기존 적용 정보에 병합한다.
- 후보 삭제와 직접 입력 저장은 기존 metadata editor 권한, same-origin, CSRF, rate limit, 작품 ACL 경계를 그대로 사용하며 원자적 저장 실패 롤백을 적용한다.

## 실행 방법

1. Owner 콘솔의 `파일 정리`에서 `판정 미리보기`를 누르고 실제 대상 경로를 확인한다.
2. `.ps1`을 내려받아 `.\txt-reader-library-cleanup-....ps1 -Library "실제 서재 경로"`로 dry-run한다.
3. 결과를 승인한 뒤에만 `-Apply`를 추가한다. 파일은 삭제되지 않고 `.txt-reader-cleanup` 아래로 이동된다.

## 검증

- v629 ZIP SHA-256, ZIP 경로 안전성, 외부/내부 manifest 및 1,928개 파일 전체 SHA-256 대조를 완료했다.
- 실제 판본 fixture에서 PS1 dry-run 후보 5건과 `-Apply` 격리 이동 5건을 확인했고 대표 파일은 유지됨을 검증했다.
- 메타데이터 후보의 타 작품 삭제 거부, 적용 후보 삭제 후 적용 데이터 유지, candidate 참조 해제, 직접 입력 병합, 재시작 후 영속화를 검증했다.
- 프런트엔드 모듈 manifest 246개 구조·문법 검사를 통과했다.
- 서버 종합·HTTP 일부 검사는 로컬 `express` 미설치, 브라우저 시각 검증은 브라우저 런타임 권한 오류로 환경 차단되었다. 관련 핵심 서비스와 정적 UI 계약 검사는 별도로 통과했다.

<!-- v630-release-pass -->

## v631

# TXT Reader Multi v631 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.31.0`
- 정적 캐시 마커: `rebuild-v631`
- 기준 배포본: `txt_reader_v630.zip`
- 결과 배포본: `txt_reader_v631.zip`

## 서재 로딩 장애 수정

- 구버전 Service Worker가 `/scripts/` 아래의 새 앱 모듈과 새 Service Worker 등록 스크립트를 모두 차단하면서 서재가 로딩 화면에서 멈출 수 있던 전환 교착 상태를 수정했다.
- 업데이트 조정 스크립트를 구버전 worker의 정적 자산 가로채기 범위 밖인 `/service-worker-register.js`에서도 제공한다.
- 서재, 사이트, 모바일, 메타데이터, Owner 관리, 초기 진입 화면에서 업데이트 조정 스크립트를 앱 진입점보다 먼저 실행한다. 새 앱 모듈이 차단되더라도 업데이트 안내와 적용 동작은 실행된다.
- 서버의 해당 별칭 경로는 인증 게이트보다 앞에서 제공하고 `no-store`로 응답하므로, 낡은 인증 화면이나 캐시에 갇힌 상태에서도 전환 코드를 받을 수 있다.
- 기존 보안 계약은 유지했다. 업데이트 적용 버튼은 서버 권한 확인을 통과한 사용자에게만 표시되며, 대기 중인 worker도 활성화 직전에 권한을 다시 확인한다. 자동 `skipWaiting` 우회는 추가하지 않았다.

## v630 기능 유지

- Owner 파일 정리 화면의 실제 대상 경로 표시와 안정적인 레이아웃을 유지했다.
- 정리 스크립트는 Node.js `.cjs`가 아닌 PowerShell `.ps1`로 내려받으며 dry-run과 `-Apply` 격리 이동을 지원한다.
- 메타데이터 후보 삭제와 사용자의 직접 메타데이터 입력 기능을 유지했다.

## 검증

- 구버전 worker가 루트 업데이트 조정 경로를 가로채지 않는지, 서버 별칭이 인증 게이트보다 앞에 있는지, 여섯 화면 모두 조정 코드를 앱보다 먼저 실행하는지 자동 검사했다.
- PWA 캐시 계약, build mismatch 경계, 이중 권한 적용, 서재 정리 UI 및 실제 fixture, 메타데이터 후보 삭제·직접 입력 회귀 검사를 통과했다.
- 프런트엔드 모듈 246개의 구조·문법 검사를 통과했다.
- 패키지 manifest의 전체 파일 크기와 SHA-256, ZIP 항목 집합, CRC, 경로 안전성, 안전 추출 후 파일 해시를 대조한다.

<!-- v631-release-pass -->

## v632

# TXT Reader Multi v632 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.32.0`
- 정적 캐시 마커: `rebuild-v632`
- 기준 배포본: `txt_reader_v631.zip`
- 결과 배포본: `txt_reader_v632.zip`

## 서재 로딩 및 업데이트 버튼 수정

- Cloudflare Rocket Loader가 업데이트 조정 스크립트를 `window.load` 이후에 실행하면 새 Service Worker 등록이 시작되지 않던 문제를 수정했다.
- 업데이트 조정 스크립트를 서재·사이트·모바일·메타데이터·Owner·초기 진입 화면의 `<head>`로 이동하고 테마와 앱 진입점보다 먼저 실행한다.
- 해당 화면의 외부 앱 스크립트에 `data-cfasync="false"`를 지정해 Rocket Loader 변환으로 발생한 CSP 인라인 스크립트 차단과 module preload 자격 증명 불일치를 방지한다.
- Service Worker 등록은 문서 로드 완료 여부와 관계없이 즉시 시작한다.
- 적용 버튼을 너무 일찍 눌러 worker가 아직 설치 중이어도 설치 완료를 기다려 활성화한다. 대기 worker가 없을 때 같은 화면을 새로고침하는 반복 동작은 제거했다.
- 서버 권한 확인과 worker 내부 이중 권한 확인은 유지했다.

## v630·v631 기능 유지

- Owner 파일 정리 대상 경로 표시, PowerShell `.ps1` 정리 스크립트, 메타데이터 후보 삭제 및 직접 입력 기능을 유지했다.
- 구버전 worker가 가로채지 않는 루트 업데이트 조정 경로와 인증 게이트 이전 제공 방식을 유지했다.

## 검증

- `window.load`가 이미 끝난 모의 Cloudflare 환경에서도 worker 등록이 즉시 한 번 호출되는 행동 검사를 추가했다.
- 여섯 화면에서 조정 스크립트가 `<head>`에 한 번만 존재하고 앱·테마보다 먼저 실행되며 모든 앱 스크립트가 Rocket Loader 예외로 지정되는지 검사한다.
- PWA 캐시 계약, build mismatch 경계, 이중 권한 적용, 서재 정리 및 메타데이터 기능 회귀 검사를 수행한다.
- 패키지 manifest, ZIP CRC·항목 집합·경로 안전성, 안전 추출 후 전체 파일 SHA-256을 검증한다.

<!-- v632-release-pass -->

## v633

# TXT Reader Multi v633 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.33.0`
- 정적 캐시 마커: `rebuild-v633`
- 기준 배포본: `txt_reader_v632.zip`
- 결과 배포본: `txt_reader_v633.zip`

## 전반적인 로그인 이후 자산 장애 수정

- 실제 배포 점검에서 `/service-worker-register.js?v=rebuild-v632`는 v632였지만 `/sw.js?v=rebuild-v632` 본문은 v628로 반환되는 것을 확인했다. CDN이 worker URL의 query string을 무시해 이전 worker를 계속 제공한 것이 업데이트 버튼 무반응의 핵심 원인이었다.
- worker 등록 주소를 query 기반 `/sw.js?v=...`에서 build별 고유 pathname `/sw-rebuild-v633.js`로 변경했다.
- worker와 업데이트 조정 응답에 `CDN-Cache-Control`, `Cloudflare-CDN-Cache-Control`, `Surrogate-Control: no-store`를 추가했다.
- 로그인 성공 후 일반 사용자는 `/library-rebuild-v633.html`, Owner는 `/admin/users-rebuild-v633.html`로 진입한다. CDN에 남은 v628 로그인 HTML·JavaScript도 서버가 내려준 현재 `redirectTo`를 사용하므로 최신 HTML을 강제로 받는다.
- 이전 HTML이 요청한 CSS를 409 `text/plain`으로, JavaScript를 `TXT_READER_BUILD_MISMATCH` 예외 프로그램으로 바꾸던 서버 동작을 제거했다. 현재 파일을 200과 정상 MIME으로 제공하되 해당 응답은 캐시하지 않는다.
- active Service Worker도 다른 build 자산을 합성 오류로 차단하지 않고 network `no-store`로 전달한다. 따라서 업데이트 전환 중에도 CSS와 앱 모듈을 화면에서 사용할 수 있다.
- 이전 build 자산은 normalized worker cache에 넣지 않아 build 간 캐시 오염을 방지한다.

## 기존 기능 유지

- Rocket Loader 예외와 즉시 worker 등록, 적용 버튼의 설치 대기 처리를 유지했다.
- 서버 및 worker의 이중 업데이트 권한 확인을 유지했다.
- Owner 파일 정리, PowerShell `.ps1`, 메타데이터 후보 삭제와 직접 입력 기능을 유지했다.

## 검증

- build별 worker 경로가 인증 게이트보다 앞에서 제공되고 조정 코드가 정확한 고유 경로를 등록하는지 검사했다.
- 이전 v628 query의 CSS와 모듈 요청이 body replacement 없이 실제 파일 처리로 전달되고 CDN·브라우저 모두 no-store인지 검사했다.
- worker가 미래 build 자산을 network로 전달하며 mismatch CSS·throwing JavaScript를 만들지 않는지 검사했다.
- PWA, Cloudflare 지연 실행, build 경계, 이중 권한, 서재 정리, 메타데이터 및 프런트엔드 모듈 회귀 검사를 수행했다.
- ZIP 안전 추출 후 manifest 전체 파일 크기와 SHA-256을 대조한다.

<!-- v633-release-pass -->

## v634

# TXT Reader Multi v634 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.34.0`
- 정적 캐시 마커: `rebuild-v634`
- 기준 배포본: `txt_reader_v633.zip`
- 결과 배포본: `txt_reader_v634.zip`

## 노벨피아 작품 표지 수정

- `https://novelpia.com/novel/282407`을 점검한 결과, 성인 모드가 꺼진 응답의 표지는 실제 작품 이미지가 아니라 `/img/novel/adult_cover_img.jpg`였고 `og:image`도 사이트 공용 이미지였다.
- 상세 표지 영역의 원본 링크, `src`, lazy-load 속성, `srcset`, CSS `background-image`를 공용 Open Graph 이미지보다 먼저 사용한다.
- 공용 홍보 이미지, 성인 대체 표지, 준비 중 표지, favicon/logo/user placeholder를 표지 후보에서 제외한다.
- 성인 대체 표지가 응답되면 인증 필요 오류로 분류해 Owner가 로그인 프로필에서 본인·연령 인증과 성인 모드 ON을 완료하도록 안내한다.
- 인증된 상세 페이지에서 얻은 실제 표지 URL은 작품 상세 URL을 `Referer`로 전달해 기존 안전한 cover downloader로 저장한다.

## 직접 입력 표지 업로드와 접기

- 메타데이터 전용 페이지와 서재 메타데이터 창의 `직접 입력` 영역을 기본 접힌 `<details>`로 변경했다.
- 사용자가 영역을 열어 JPEG, PNG, WebP, GIF, AVIF 표지를 최대 5MB까지 선택할 수 있다.
- 브라우저 MIME만 신뢰하지 않고 서버에서 파일 시그니처를 검사한다.
- 업로드 파일은 SHA-256 asset ID로 중복 제거하며 수동 메타데이터에 적용된 뒤 기존 cover 접근 권한 검사를 사용한다.
- 텍스트 필드를 비워도 표지만 저장할 수 있고, 기존 값은 유지된다.

## 검증

- 노벨피아 인증 상세 fixture의 원본 표지 링크 추출과 공용/성인 대체 이미지 차단을 검증했다.
- lazy `srcset`, background 이미지, 실제 cover downloader 전달 경로를 검증했다.
- 수동 표지의 형식 판별, 해시 중복 제거, 수동 적용·접근 권한 인덱스, 5MB UI 제한을 검증했다.
- 두 메타데이터 화면 모두 기본 접힘이며 표지 업로드 API를 호출하는지 정적 회귀로 검증했다.
- ZIP 생성 후 manifest의 파일 크기·SHA-256, archive entry 집합, CRC를 다시 대조한다.

<!-- v634-release-pass -->

## v635

# TXT Reader Multi v635 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.35.0`
- 정적 캐시 마커: `rebuild-v635`
- 기준 배포본: `txt_reader_v634.zip`
- 결과 배포본: `txt_reader_v635.zip`

## 업데이트 적용 수정

- 실제 waiting worker가 없는데 update 배너가 표시되던 `controllerchange` 경로를 제거했다.
- `업데이트 적용`은 권한 확인 후 `registration.update()`를 호출하고 `updatefound`, worker `statechange`, `installed`를 기다린다.
- 설치된 worker에 `TXT_READER_SKIP_WAITING`을 전달하고 `controllerchange`가 발생한 명시적 적용에서만 페이지를 한 번 reload한다.
- 새 worker가 나타나지 않거나 설치·활성화가 실패하면 버튼을 복구하고 오류를 표시해 `업데이트 준비 중`으로 무기한 남지 않는다.
- 이전 Service Worker가 더 최신 version query의 entry를 감지하면 해당 client의 이어지는 query 없는 정적 dependency도 network `no-store`로 우회해 신·구 build 혼합을 막는다.
- 업데이트 권한은 기존처럼 Owner 또는 usable library access와 metadata access를 모두 가진 사용자만 허용한다. 로그인 화면은 update coordinator를 로드하지 않는다.

> 이 버튼은 서버에 이미 배포된 새 PWA 정적 build를 활성화한다. ZIP 또는 Docker image를 다운로드해 서버 프로그램을 교체하는 자동 배포 기능은 아니다.

## 표지 안정성 수정

- 새 cover asset에 제한된 lease를 부여해 manual/candidate metadata 참조가 저장되기 전 quota prune으로 삭제되지 않게 했다.
- 참조 저장이 완료되면 lease를 해제해 이후 정상 quota 정리 대상이 되도록 했다.
- 표지 temp 파일을 fsync하고 rename한 뒤 부모 directory도 fsync한다.
- `METADATA_COVER_MAX_BYTES`를 원격 다운로드, 수동 upload raw parser, 저장 서비스, 메타데이터 전용 페이지와 서재 metadata UI가 공통 사용한다.
- NovelPia 성인 대체 표지가 cover box가 아니라 meta에만 있어도 인증 필요 상태로 분류한다.
- NovelPia 표지 영역에서 anchor의 작품 상세 URL보다 image/source/lazy/srcset/background-image 후보를 우선하고 `/novel/<id>` 페이지 URL을 표지로 거절한다.

## 검증 하네스 보완

- PowerShell 미설치 시 library cleanup fixture를 코드 실패가 아닌 capability 차단으로 분류한다.
- NovelPia provider revision, Express `raw` mock, Service Worker 함수 인자·소스 문자열 고정 검사를 현재 계약에 맞게 갱신했다.
- v635 전용 update state-machine, mixed-build bypass, cover lease/quota, NovelPia 표지 판정, release coverage 회귀를 quick/release verifier에 연결했다.

## 검증 결과

- v634 대비 실제 파일 diff: 추가 6개, 수정 455개, 삭제 0개.
- package manifest inventory: 1,960개 파일(현재 manifest 자신은 inventory에서 제외).
- JS/MJS/CJS 문법 검사: 1,108개 통과.
- precompressed asset 생성: 316개 원본에 대해 gzip/Brotli 생성.
- quick: 409개 중 376개 통과, 33개 의존성 차단, 코드 실패 0개.
- full: 431개 중 386개 통과, 45개 환경 차단, 코드 실패 0개.
- 차단 환경: `express`, `iconv-lite`, `playwright-chromium` 및 브라우저 runtime이 현재 검증 환경에 없음.
- 실제 Chromium update UI, Cloudflare edge cache, Samsung Internet, provider 실계정, Docker 실기동, 대규모 SMB 장시간 운용은 실행하지 않았으며 통과로 간주하지 않는다.

<!-- v635-release-pass -->

## v636

# TXT Reader Multi v636 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.36.0`
- 정적 캐시 마커: `rebuild-v636`
- 기준 배포본: `txt_reader_v635.zip`
- 결과 배포본: `txt_reader_v636.zip`

## Service Worker 업데이트 조정

- 15초 watchdog은 활성화 시도를 취소하지 않고 지연 안내와 상태 재확인만 제공한다.
- 늦게 발생한 `controllerchange`도 동일 activation attempt에 귀속해 페이지를 한 번만 reload한다.
- 새 worker는 활성화 시 기존 window client를 stale로 표시하고 reload 필요 메시지를 보낸다.
- 업데이트 실행 탭은 즉시 reload하고, v636 이상 보조 탭은 저장 후 전환을 선택한다.
- 전환을 미룬 stale 탭의 실행 JS/fragment 요청은 409로 차단해 old runtime/new module 혼합을 방지한다.
- 프로토콜을 모르는 v635 이하 탭은 3초 유예 후 현재 URL로 자동 갱신한다.
- 권한 API의 네트워크 실패는 실제 권한 부족과 분리해 배너와 재시도를 유지한다.

## 표지 lease 재시작 내구성

- pending cover lease를 `METADATA_COVER_DIR/.pending-cover-leases.json`에 원자적으로 저장한다.
- lease sidecar write·fsync·rename·directory fsync 완료 후 업로드 응답을 반환한다.
- 서비스 시작 시 lease를 동기 복원한 뒤 startup prune을 실행한다.
- provider candidate는 `updateCandidateCover → store.flush → durable lease release` 순서를 사용한다.
- browser capture와 manual metadata도 durable 저장 완료 뒤 lease를 해제한다.
- 저장 실패에서는 lease를 유지하고, 이미 metadata 참조가 durable한 뒤 lease 정리 실패는 성공한 편집을 500으로 바꾸지 않는다.

## 검증

- 지연 activation 후 controllerchange reload, 보조 탭 deferred reload, legacy 탭 grace reload, stale executable module 차단 fixture를 추가했다.
- 17MiB 표지와 16MiB quota로 서비스 재시작 후 lease 복원, prune 생존, durable release 후 정리를 검증했다.
- v635 대비 실제 파일 diff는 추가 5개, 수정 158개, 삭제 0개다. package manifest와 manifest diff 문서를 포함한 변경 추적 항목은 165개다.
- JavaScript/MJS/CJS 1,111개 문법 검사가 통과했다.
- gzip 316개와 Brotli 316개를 원본과 대조했다.
- quick 회귀는 379/412 통과, 의존성 차단 33개, 코드 실패 0개다.
- full 회귀는 386/431 통과, 환경 차단 45개, 코드 실패 0개다.
- 차단 항목은 현재 환경에 없는 `express`, `iconv-lite`, `playwright-chromium` 또는 실네트워크 capability 검사다.

<!-- v636-release-pass -->

## v637

# TXT Reader Multi v637 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.37.0`
- 정적 캐시 마커: `rebuild-v637`
- 기준 배포본: `txt_reader_v636.zip`
- 결과 배포본: `txt_reader_v637.zip`

## 수정 내용

### Service Worker restart-safe build gate

- client build 상태를 Cache Storage의 schema-versioned record에 영속화했다.
- stale/deferred 상태는 시간 경과로 current가 되지 않으며, record가 없으면 unknown fail-closed다.
- navigation build header만으로 fresh 승격하지 않고 READY handshake 뒤에만 실행 자산을 허용한다.
- handshake와 parser module request의 경합은 실제 state 전이를 짧게 기다린 뒤, 미확인 시 409로 차단한다.
- 서버와 Service Worker 모두 old/future JS·MJS·worker·fragment·WASM 요청에 current 파일을 반환하지 않는다.

### 업데이트 적용 idempotency

- update button의 `addEventListener`/`onclick` 이중 경로를 단일 handler로 통합했다.
- authorization, registration update, skipWaiting을 activation attempt 단위로 중복 방지했다.
- v636의 delayed activation, 늦은 controllerchange 단일 reload, 보조 탭 저장/연기, 권한 일시 실패 구분을 유지했다.

### 수동 표지 무결성·lease

- manual save는 정확한 SHA-256 cover asset ID만 받는다.
- 실제 regular file, symlink 금지, signature/extension, full content hash를 검증한다.
- client cover URL 필드를 거절하고 canonical internal URL을 서버가 생성한다.
- metadata flush 후 applied record를 재조회해 정확한 asset 참조가 확인된 뒤에만 lease를 해제한다.
- 실패·부분 적용·flush 실패에서는 lease를 유지하고 bounded expiry/startup recovery를 사용한다.

## 검증

### 작업 트리 검증

- JavaScript/MJS/CJS 1,116개 문법 검사: 통과 1,116개, 실패 0개.
- gzip 316개와 Brotli 316개를 원본과 해제 대조: 총 632개 통과, 실패 0개.
- v637 전용 상태 전이 회귀 5개와 v636 대표 보존 회귀: 통과.
- quick 회귀: 384/417 통과, 의존성 차단 33개, 코드 실패 0개.
- full 회귀: 386/431 통과, 환경 차단 45개, 코드 실패 0개.
- 단일 quick/full 명령은 현재 실행 도구의 장시간 제한을 넘을 수 있어 runner의 최종 deduplicated task 목록을 연속 구간으로 실행해 합산했다. 각 구간은 코드 실패 없이 완료됐다.

### 최종 ZIP 독립 검증

- 빈 디렉터리 재추출 전 ZIP entry 2,029개를 검사했고 traversal, 절대 경로, symlink, 특수 파일, 중복 entry, 대소문자 충돌은 0개였다.
- 재추출본의 manifest inventory 1,974개와 실제 파일의 경로·크기·SHA-256이 전부 일치했다. 현재 manifest 자체는 자기참조 방지를 위해 inventory에서 제외한다.
- 외부 `package-manifest-v637.json`, `package-manifest-diff-v637.md`, 변경 보고서와 ZIP 내부 동명 파일이 바이트 단위로 일치했다.
- 재추출본 JavaScript/MJS/CJS 1,116개 문법 검사와 gzip 316개·Brotli 316개 원본 대조가 전부 통과했다.
- 재추출본 v637 전용 회귀 5개와 v636 update/cover, Reader 진행도·fileChar 대표 회귀가 통과했다.
- 재추출본 quick 회귀: 384/417 통과, 환경 차단 33개, 코드 실패 0개.
- 재추출본 full 회귀: 386/431 통과, 환경 차단 45개, 코드 실패 0개.
- 환경 차단 로그의 누락 모듈은 `express`, `iconv-lite`, `playwright-chromium`이며 PowerShell capability fixture도 현재 환경에서 사용할 수 없었다.
- package manifest diff는 이전·현재 전체 file inventory의 크기·SHA-256을 비교하는 실제 파일 diff로 생성했다.

## 환경 검증 제외

실제 Playwright Chromium, Docker/Podman 실기동, Samsung Internet, Cloudflare edge cache, provider 계정, 장시간 SMB, arm64 QEMU는 현재 환경에서 실제 검증하지 않은 경우 명시적으로 미실행 처리한다.

<!-- v637-release-pass -->

## v638

# TXT Reader Multi v638 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.38.0`
- 정적 캐시 마커: `rebuild-v638`
- 기준 배포본: `txt_reader_v637.zip`
- 결과 배포본: `txt_reader_v638.zip`

## 배포 안정화

- 로그인 페이지에 update UI 없는 build READY handshake를 추가했다.
- v636 canonical `coverUrlLocal`을 호환 입력으로만 허용하고 서버가 URL을 재생성한다.
- Service Worker client record를 replaced-client cleanup과 최대 256개 상한으로 제한했다.

## 동일 metadata 후보 묶음

- 정규화된 metadata 내용 fingerprint가 같은 provider 후보를 하나의 group으로 반환한다.
- provider, source URL, match score, cover variant는 provenance로 유지한다.
- 대표 후보는 match score 우선, 동점이면 provider priority 순서로 선택한다.
- group apply와 한 번의 durable flush를 사용하는 group delete API/UI를 추가했다.

## 맨 위 이동

- document와 nested scroll container를 지원하는 접근성 있는 맨 위 이동 버튼을 7개 주요 페이지에 추가했다.
- 360px threshold, reduced-motion, safe-area, reader bottom bar를 반영한다.

## 검증

작업 트리 기준 실제 결과:

- JavaScript/MJS/CJS 문법 검사: 1,123개 통과
- gzip 원본 대조: 318개 통과
- Brotli 원본 대조: 318개 통과
- v638 전용 회귀 6개 통과
- quick 회귀: 390/423 통과, 환경 차단 33개, 코드 실패 0개
- full 회귀: 386/431 통과, 환경 차단 45개, 코드 실패 0개

환경 차단은 현재 설치되지 않은 `express`, `iconv-lite`, `playwright-chromium`과 명시적 capability fixture다. 실제 Chromium, Samsung Internet, Docker/Podman, Cloudflare edge, 실제 공급자 계정, 장시간 SMB, arm64 QEMU는 미실행이다.

독립 재추출 검증 결과:

- ZIP entry 2,044개 안전성 검사 통과
- manifest inventory 1,989개 경로·크기·SHA-256 대조 통과
- 외부 manifest·manifest diff·변경 보고서와 ZIP 내부 파일 바이트 일치
- 재추출본 JavaScript/MJS/CJS 1,123개 문법 검사 통과
- 재추출본 gzip/Brotli 각 318개 원본 대조 통과
- 재추출본 v638 전용 회귀 6개 통과
- 재추출본 quick 390/423, 환경 차단 33, 코드 실패 0
- 재추출본 full 386/431, 환경 차단 45, 코드 실패 0

별도 `release_verify.js` 결과:

- pre-extraction archive safety 통과: 2,044 entries
- ZIP integrity, clean extract, forbidden-entry 검사 통과
- package manifest content 검증 통과: 1,989 files
- 이후 runtime dependency 설치의 `npm ci`가 현재 실행 제한을 초과해 전체 verifier는 미완료
- 미완료 verifier를 성공으로 간주하지 않음

<!-- v638-release-pass -->

## v639

# TXT Reader Multi v639 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.39.0`
- 정적 캐시 마커: `rebuild-v639`
- 기준 배포본: `txt_reader_v638.zip`
- 결과 배포본: `txt_reader_v639.zip`

## 배포 전 전수 감사 수정

### 인증 전 로그인 자산

- `login.html`이 참조하는 `scroll-to-top.js`와 `scroll-to-top.css`를 인증 전 공개 allowlist에 추가했다.
- 로그인 페이지의 로컬 자산 11개를 실제 파일 존재와 pre-auth 통과 기준으로 검사한다.

### 동일 메타데이터 묶음 적용

- 텍스트 대표 후보와 표지 대표 후보를 분리했다.
- 최고 일치율 후보에 표지가 없어도 동등 후보의 검증된 표지를 묶음 화면과 적용 결과에 보존한다.
- 텍스트와 표지는 하나의 serialized durable mutation으로 적용하며 provider/candidate provenance를 각각 기록한다.
- 후보에 없는 필드의 직접 적용은 `METADATA_FIELDS_INVALID`로 거절해 기존 applied 값을 null로 덮지 못하게 했다.
- 후보 삭제 후 applied 데이터는 유지하되 텍스트·표지 candidate provenance를 모두 분리한다.
- 외부 표시용 source URL은 유효한 HTTPS만 반환한다.

### 맨 위 이동 버튼

- 활성 모달과 중첩 스크롤 영역을 MutationObserver로 재평가한다.
- 메타데이터 로그인 화면, 서재 메타데이터 모달, 설정 submodal, 일반 dialog에서 가장 실제로 스크롤된 영역을 우선한다.
- 모달을 열었을 때 배경 문서를 잘못 맨 위로 이동하지 않는다.
- overlay 및 fullscreen stacking mode를 추가해 높은 z-index UI 뒤에 숨지 않게 했다.

## 추가 회귀

- `login-public-assets-v639-smoke.js`
- `metadata-equivalent-group-cover-v639-smoke.js`
- `scroll-to-top-overlay-v639-smoke.js`
- `release-verify-current-coverage-v639-smoke.js`

## 소스 트리 검증

- v638 기준 ZIP SHA-256, ZIP entry 안전성, manifest inventory를 재확인했다.
- JavaScript/MJS/CJS 문법 검사: `1,127/1,127` 통과.
- gzip: `318/318` 원본 대조 통과.
- Brotli: `318/318` 원본 대조 통과.
- HTML 10개: 누락 local ref, stale build ref, duplicate ID, target=_blank rel 누락 0개.
- ESM 276개: 누락 relative import 0개.
- symlink·특수 파일·inline event handler·javascript URL markup 0개.
- frontend module supervisor: 246 required module 계약 통과.
- quick: `394/427` 통과, 환경 차단 33, 코드 실패 0, timeout 0.
- full: `386/431` 통과, 환경 차단 45, 코드 실패 0, timeout 0.

## 환경 차단과 실환경 잔여 위험

- `npm ci --ignore-scripts`는 현재 package registry HTTP 503으로 실패했다. 반복 설치하지 않았다.
- `express`, `iconv-lite`, `jschardet`, `playwright-chromium` 의존 검사는 환경 차단으로 분리했다.
- `check_server_structure.js`는 `express` 부재로 완료되지 않았다.
- 실제 Chromium, Docker/Podman, Samsung Internet, Cloudflare edge stale cache, provider 실계정, 장시간 SMB, arm64 QEMU는 미실행이다.
- 최종 `release_verify.js`는 archive 사전 안전성, ZIP 무결성, clean extract, 금지 entry, manifest 1,996개 검증까지 통과했다. 이후 `npm ci`가 실행 제한 안에 완료되지 않아 전체 release verifier는 성공으로 기록하지 않았고 남은 설치 프로세스를 종료했다.

## 독립 ZIP 재추출 검증

- ZIP entry: `2,051`, traversal·절대 경로·symlink·특수 파일·중복·대소문자 충돌 0개.
- manifest inventory: `1,996/1,996`, 누락·추가·크기·SHA-256 불일치 0개.
- 외부 manifest·diff·변경 보고서와 ZIP 내부 동명 파일 바이트 일치.
- 재추출본 JavaScript/MJS/CJS: `1,127/1,127` 통과.
- 재추출본 gzip: `318/318`, Brotli: `318/318` 원본 대조 통과.
- v639 전용 상태 전이 회귀 4개 통과.
- 재추출본 quick: `394/427` 통과, 환경 차단 33, 코드 실패 0, timeout 0.
- 재추출본 full: `386/431` 통과, 환경 차단 45, 코드 실패 0, timeout 0.
- v638 대비 전체 inventory diff: 추가 7, 수정 169, 삭제 0.
- 변경 추적 항목: 177개.

<!-- v639-release-pass -->

## v640

# TXT Reader Multi v640 변경 보고서

## 배포 식별자

- 애플리케이션 버전: `6.41.0`
- 정적 캐시 마커: `rebuild-v641`
- 기준 배포본: `txt_reader_v639.zip`
- 결과 배포본: `txt_reader_v641.zip`

## 소설넷 metadata provider

- 공개 provider `builtin-ssn`과 adapter `ssn-series-v1`을 추가했다.
- 기본 우선순위는 `5`이며, 브라우저 로그인 프로필을 사용하지 않는다.
- 검색 요청은 `https://ssn.so/series/?keyword=<검색어>` 형식이고 숫자형 `/series/<id>/` 상세 경로만 직접 수집 대상으로 허용한다.
- 검색 결과에서는 작품 링크·제목·인접 작가를 추출하고, 상세 페이지에서는 canonical/Open Graph와 본문 구조를 함께 사용해 제목, 작가, 장르, 태그, 소개, 연재 상태, 출판 연도, 언어와 표지를 구성한다.
- 요청 host/path, direct URL, cover host allowlist를 provider registry에서 제한한다.
- parser fixture와 metadata service mock transport로 `search → detail → candidate → auto apply` 상태 전이를 검증했다.

## Owner 관리자 UI

- 사용자 관리 workbench의 활성 panel을 전체 너비 단일 panel로 정리했다.
- 라이브러리 권한 folder picker를 생성·수정 영역에서 같은 1열 구조와 높이로 통일했다.
- 폴더 행을 checkbox, 전체 경로, 작품 수·하위 폴더 수의 공통 구조로 변경했다.
- metadata provider의 자동 적용·우선순위 control과 action button 정렬을 통일했다.
- Playwright 로그인 modal을 desktop 2열 browser/control workspace와 mobile 1열 구조로 재배치했다.
- modal body/footer의 overflow와 좁은 화면 줄바꿈 계약을 보강했다.

## 검증

- JavaScript/MJS/CJS 문법 검사: `1,131/1,131` 통과.
- gzip/Brotli 원본 대조: gzip `319/319`, Brotli `319/319` 통과.
- frontend required module 검사: `246/246` 통과.
- v640 전용 provider parser·collection·Owner workspace·release coverage 회귀 통과.
- 기존 metadata adapter, mobile fallback, NovelPia adult, Playwright provider 격리, bulk fallback 회귀 통과.
- quick 회귀: `398/431` 통과, 환경 차단 `33`, 코드 실패 `0`, command timeout `0`.
- full 회귀: `386/431` 통과, 환경 차단 `45`, 코드 실패 `0`, command timeout `0`.
- 장시간 단일 runner의 외부 실행 제한을 피하기 위해 runner가 만든 동일한 deduplicated 목록을 연속 구간으로 나누어 전 항목을 집계했다.

## 환경 차단·미실행

- 현재 환경에서 `express`, `iconv-lite`, `playwright-chromium` 의존 검사가 차단됐다.
- `npm ci --ignore-scripts`는 출력 없이 실행 제한을 초과해 완료되지 않았고, 남은 프로세스와 부분 `node_modules`를 정리했다. 성공으로 간주하지 않는다.
- 컨테이너 DNS가 `ssn.so`를 해석하지 못해 실제 사이트 HTTP 수집은 실행하지 못했다. fixture와 mock transport 결과를 실사이트 검증으로 표현하지 않는다.
- 설치된 Chromium으로 Owner desktop/mobile screenshot을 시도했으나 브라우저 프로세스가 종료되지 않아 완료되지 않았다. DOM·CSS 계약 회귀만 통과로 기록한다.
- 실제 Docker/Podman, Samsung Internet, Cloudflare edge cache, provider 실계정, 장시간 SMB, arm64 QEMU는 미실행이다.

## 운영 주의

- 소설넷 HTML 구조 또는 외부 cover host가 변경되면 parser fixture와 allowlist를 함께 갱신해야 한다.
- 배포 후 Owner 사용자 관리 화면을 desktop/mobile에서 열어 folder picker와 Playwright modal overflow를 확인한다.
- 소설넷 검색 후보 한 건에 대해 검색·상세·표지·자동 적용을 실제 네트워크 환경에서 확인한다.

## 최종 ZIP 독립 검증

- 빈 디렉터리 재추출 ZIP entry: `2,065`개, traversal·절대 경로·symlink·특수 파일·중복·대소문자 충돌 `0`.
- package manifest inventory: `2,008/2,008`, 누락·추가·크기·SHA-256 불일치 `0`.
- 외부 manifest·manifest diff·변경 보고서와 ZIP 내부 파일의 바이트 일치.
- 재추출본 JavaScript/MJS/CJS `1,131/1,131` 통과.
- 재추출본 gzip `319/319`, Brotli `319/319` 원본 대조 통과.
- 재추출본 quick `398/431`, 환경 차단 `33`, 코드 실패 `0`, timeout `0`.
- 재추출본 full `386/431`, 환경 차단 `45`, 코드 실패 `0`, timeout `0`.
- 전체 inventory diff는 v639 대비 추가 `12`, 수정 `176`, 삭제 `0`이다. current manifest는 자기참조 hash를 피하기 위해 inventory에서 제외된다.

<!-- v640-release-pass -->

## v648

- durable catalog mutation generation과 tombstone sidecar로 삭제 항목 부활 차단.
- 마지막 정상 catalog를 유지하면서 async refresh하고 production sync cold scan 차단.
- request catalog consumers를 bounded API로 통일하고 503/Retry-After 전파.
- drag & drop, 최근·즐겨찾기 reveal, 단축키 기록, metadata lease logger 결함 수정.
- 영어 언어팩 중복 키 제거.
- Provider 적용 후 수동 metadata 편집을 applied shard와 해당 작품 patch로 처리해 전체 후보 gzip 재압축과 즉시 전체 shelf reload를 제거.

상세: `docs/v648-audit-stability-fixes.md`.

<!-- v648-release-history-pass -->

## v662

- 서재 환경설정 지연 UI 요청이 Cloudflare 530 또는 일시적 5xx로 실패할 때 제한 재시도한다.
- Cloudflare 1XXX 코드와 `CF-Ray`를 오류 진단에 포함한다.
- 지연 UI HTML/CSS를 Service Worker precache에 포함한다.
- 지속적인 Tunnel/DNS 장애는 성공으로 처리하지 않는다.

<!-- v662-release-history-pass -->

## v665 — 수동 표지 인식·Node 직접 실행·문서 통합

- 브라우저 MIME 오분류와 `.file`·`.jfif` 파일명을 실제 image signature 판정으로 흡수했다.
- BMP 지원과 잘린 BMP 거절, HEIC/HEIF 명시적 415 안내를 추가했다.
- `node server.js`, `node .`, `npm start`의 공통 launcher를 추가했다.
- 버전별 중복 문서를 canonical 문서와 release history로 통합했다.

<!-- v665-release-history-pass -->
## v668 — 서재·Reader shell 구조 분리

- standalone 서재 전용 `library-shell.html` 추가
- Reader main, loading skeleton, toolbar, content, jump/offline UI를 서재 DOM에서 제거
- profile별 shell URL·fetch promise 분리와 runtime fail-closed 검증
- 최초 entry router를 body paint 전 parser-blocking 실행으로 변경

<!-- v668-release-history-pass -->
## v675 · 2026-07-27

서버 progress delta journal, metadata compact candidate index, trusted proxy source CIDR, Reader prefetch watchdog, PWA dual failure response, font symlink/no-follow, 공통 modal focus manager, profile별 skeleton을 도입했다. 공개 locator와 shard schema는 유지했다.

<!-- v675-release-history-pass -->
## v676 · 2026-07-27

Metadata bounded shard load, proxy IP/source validation, prefetch orphan circuit, modal stack recovery, progress/font no-follow, Metadata folder filtering and list continuity, Helper shortcut/responsive UI, Compose and current-check registration gates.

<!-- v676-release-history-pass -->
