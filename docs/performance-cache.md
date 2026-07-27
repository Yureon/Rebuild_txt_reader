# v682 캐시·성능 계약

PowerShell 상대경로 계산은 파일마다 URI 변환이나 디스크 열거를 추가하지 않고 정규화된 문자열 prefix 제거만 수행한다. 서버 catalog·Metadata cache와 브라우저 cache 구조는 변경하지 않는다.

<!-- v682-performance-cache-pass -->

# v681 캐시·성능 계약

수동 입력 출처 필터는 기존 shelf cursor와 ETag/cache key의 `metadataProviderIds` 구성요소를 그대로 사용한다. 별도 전체 catalog materialization이나 Metadata shard 재조회는 추가하지 않는다.

<!-- v681-performance-cache-pass -->

# v680 테마 bootstrap·캐시 계약

- 첫 화면 theme boot는 `txt-reader.rebuild.activeThemeScope`와 사용자별 scoped prefs만 읽는다.
- 로그인 성공 시 theme-only API를 한 번 호출해 redirect 전에 scope를 prime한다. 요청 실패는 로그인을 막지 않으며 이후 일반 state hydration이 교정한다.
- Metadata 독립 페이지는 전체 사용자 상태를 먼저 렌더하지 않고 theme bootstrap 뒤 사용자 scope state를 생성한다.
- 정적 자산 cache namespace는 `rebuild-v680`으로 통일한다.

<!-- v680-performance-cache-pass -->

# v679 정적 자산·UI 계약

- Metadata folder search style은 `metadata-page.css` 원본과 gzip/Brotli가 byte-equivalent해야 한다.
- HTML cachebuster와 Service Worker BUILD는 `rebuild-v679`로 일치한다.
- Extension popup 폭은 380px intrinsic width이며 `100vw`와 narrow media query로 자기 viewport 폭을 재계산하지 않는다.
- v677의 candidate heap eviction과 tree cursor paging 성능 계약은 유지한다.

<!-- v679-performance-cache-pass -->

# 성능·캐시 계약 — v676 current

기준 버전: `rebuild-v676`

# v674 Reader·서재 대규모 경로

- Reader localStorage fallback은 hydration 시 만든 사용자 scope별 bounded snapshot에 현재 locator만 증분 반영한다. 일반 저장에서 resident 80k/10k/10k map 전체를 열거하지 않는다.
- 진행도 duplicate signature 판정은 persistence와 in-memory mutation보다 먼저 수행한다. IndexedDB debounce는 공유 deferred 하나로 합친다.
- 가상 서재 차단 실패 시 80,000개 전체 DOM을 만들지 않고 최대 500작품, 펼친 작품당 최대 300회차만 렌더한다. 활성 작품은 cap 밖이어도 보존한다.
- bookmark count는 작품별 `filter` 대신 한 번 생성한 `Map`을 사용하고, 접힌 작품의 episode DOM은 생성하지 않는다.

합성 fixture `positions 80,000 / byNovel 10,000 / readMeta 10,000`에서 이전 전체 정렬 평균 `132.81ms`, p95·최대 `133.81ms` 대비 증분 평균 `4.92ms`, p95 `6.58ms`, 최대 `7.00ms`였다. `10,000` 작품·`5,000` bookmark fixture의 반복 filter 평균은 `270.52ms`, p95 `287.55ms`, index 평균은 `0.86ms`, p95 `1.05ms`였다. 실제 브라우저 layout, N100, HDD/SMB, 네트워크는 포함하지 않는다.

<!-- v674-performance-hot-path-pass -->

# v673 대규모 collection·cache 경로

- applied metadata mutation은 전체 applied index rebuild를 하지 않는다.
- shelf 일반 조회는 final page에만 사용자 태그를 결합하고 검색 key는 검색·태그 필터에서만 만든다.
- 작품 변형 coarse bucket은 제목 앞·뒤와 길이 band를 함께 사용해 pairwise component를 제한한다.
- disk cache prune은 eligible 개수와 관계없이 `maxDeletePerRun` 크기의 heap만 보관한다.

<!-- v673-performance-hot-path-pass -->

# v672 Metadata CPU 예산

10,000 candidate synthetic fixture의 한 후보 저장 5회 평균은 변경 전 145.21ms, 변경 후 2.43ms였다. 변경 후 실행형 smoke에서는 평균 약 5ms 이하를 요구하지 않고 50ms 상한으로 환경 변동을 허용한다. 이 수치는 외부 provider 네트워크·Playwright 실사이트·Docker 운영 측정이 아니다.

CPU 보호 경계:

- candidate index incremental mutation
- normalization LRU 2,048개
- JSON document 32개·8MiB
- Playwright heavy resource blocking
- collector context idle TTL 90초

<!-- v672-metadata-cpu-budget-pass -->

# v671 저장·이벤트 루프 성능 경계

- metadata candidates는 32개 shard로 분할하며 mutation은 dirty shard만 직렬화·압축한다.
- queue checkpoint는 `setImmediate` 뒤 snapshot을 만들고 동시 변경을 하나의 write loop로 병합한다.
- candidate compaction은 token index와 union-find를 사용하며 cleanup preview는 256개 단위로 event loop에 yield한다.
- worker 없는 content fallback은 작은 파일에만 허용하고 상한 초과 파일은 503이다.
- library mutation journal은 serial async atomic write, audit log는 bounded batch append와 주기/중요 이벤트 fsync를 사용한다.
- metadata shard는 monolithic JSON peak를 줄이지만 load 후 candidate 전체를 메모리에 유지하는 현재 한계가 있다.

<!-- v671-performance-p0-p1-pass -->

# v649 대규모 작품 묶음·검색 profile

- 64개 이상 동일 prefix/middle hash component는 exact-content fast path를 사용해 pair map을 만들지 않는다.
- 일반 oversized component의 pairwise 비교 범위는 최대 128개 partition으로 제한한다.
- 검색 성능 profile의 cgroup 탐지는 service 생성/명시적 refresh에서만 실행하고 API GET은 snapshot만 반환한다.

<!-- v649-performance-large-group-pass -->

# v648 metadata 수동 수정 fast path

- Provider 적용·수동 수정·적용 해제는 전체 `work-metadata.json.gz`를 다시 압축하지 않는다.
- metadata API는 정상 작품 ID를 raw catalog에서 직접 찾고 variant complete-link grouping은 historical alias fallback에서만 수행한다.
- 클라이언트는 API의 `novelPatch`를 해당 shelf item·현재 Reader novel에 적용하며 전체 서재 reload를 요청하지 않는다.
- 제목·작가 수정에 따른 전체 grouping 재평가는 다음 명시적 catalog refresh에서 수행한다.

<!-- v648-metadata-manual-fast-path-performance-pass -->

# v648 서재 요청·cache 안정성

- production의 sync cold full scan은 비활성화한다. 요청은 bounded async catalog API를 사용한다.
- mutation 시 마지막 정상 catalog 전체를 버리지 않고 영향 항목만 tombstone으로 제거한다.
- cold build pending/backoff/failure와 shelf queue 포화는 503/Retry-After로 응답한다.
- mutation state sidecar는 catalog 전체보다 작은 동기 원자 write만 수행하며 HDD/SMB tree scan을 실행하지 않는다.

<!-- v648-performance-catalog-boundary-pass -->

# v646 서재 cache·부하 안정성

- shelf/variant/facet cache는 적용 metadata revision만 사용한다. 후보 수집과 provider 설정은 presentation cache miss를 만들지 않는다.
- fingerprint `verifiedAt` 갱신은 semantic revision을 변경하지 않는다.
- cold catalog는 하나의 async build를 공유하며 요청 대기는 기본 4초로 제한한다.
- presentation build는 기본 concurrency 1, pending 8이며 초과 요청을 빠르게 503으로 돌려보낸다.
- metadata/fingerprint gzip은 유지하되 한 번의 JSON 직렬화와 compressed SHA 검증으로 write amplification을 줄인다.

<!-- v646-library-cache-performance-pass -->

# v645 Reader·검색 성능 경계

본문 검색은 기본 cache/visible chunk 경로를 유지하며 사용자가 전체검색을 선택한 경우에만 서버 content API를 사용한다. stylesheet 복구는 기존 deferred DOM이 있어도 link가 없거나 실패했을 때 한 번 수행한다. 이번 변경은 Reader chunk prefetch, virtual window와 fileChar 계산을 변경하지 않는다.

<!-- v645-reader-search-performance-pass -->

# v642 fingerprint cache

## v644 서재 진입 부하 예산

- 초기 shelf 요청: 48개 page 1회.
- 추가 page: 실제 wheel/touch/keyboard/scrollbar activity 이후 near-bottom에서만 1회.
- render event 자체는 pagination을 트리거하지 않는다.
- 제한 사용자 전체 accessible ID 조회는 shelf 표시 이후 nonblocking 처리한다.
- fingerprint enqueue는 request path에서 금지하고 기본 15초 뒤 background batch로 실행한다.
- 동일 catalog background 예약은 최소 60초 간격이다.

<!-- v644-library-entry-performance-pass -->

## v643 대규모 라이브러리 성능 경계

라이브러리 정리 preview는 cached catalog와 metadata만 사용하며 TXT 본문이나 fingerprint를 새로 읽지 않는다. preview 응답 sample은 300개로 제한하고 스크립트 생성 시에만 전체 plan을 직렬화한다. 중복 정리 UI의 자동 갱신은 1.5초 간격 최대 4회로 제한해 8만 파일 HDD/SMB 환경의 polling 폭증을 방지한다.

<!-- v643-performance-pass -->


본문 유사도는 전체 파일을 읽지 않고 시작부와 25% 지점의 bounded range만 읽는다. 기본 concurrency 1, queue 512, 화면 갱신당 background batch 64다. cache는 최대 100,000개 entry를 유지하고 gzip primary/backup으로 저장한다.

<!-- v642-fingerprint-performance-pass -->

# v614 초기 preload 복구

- `core/user-scope-bootstrap.mjs`, `features/lazy-features.mjs`, `features/library.mjs`는 인증 판정과 서재/리더 navigation 설치에 필요한 boot-critical 모듈로 다시 modulepreload한다.
- `settings/appearance.mjs`, reader/search/bookmark 본체는 계속 의도 기반 동적 로드를 유지한다.
- preload 수 예산은 9개이며 queryless module URL을 사용해 서버 revalidation cache 정책과 일치시킨다.

# v613 초기 로딩·사용자 cache scope

<!-- v613-critical-preload-budget-pass -->

- entry HTML의 critical `modulepreload`는 app shell, main, API, utils, state, UI 6개 이하로 제한한다.
- library, lazy features, appearance runtime은 app shell mount와 사용자 scope bootstrap 이후 동적으로 요청한다.
- 정적 entry graph 차단 상한은 580KB이며 v613 측정은 약 185KB다. 목표 540KB와 경고 560KB를 별도로 유지한다.
- reader cache는 사용자 ID별로 통계를 집계하고 다른 사용자의 chunk/search manifest를 반환하지 않는다.

# v606 성능·캐시 보강

- folder-limited cover 검사는 전체 library scan을 자산마다 반복하지 않고 ACL+library generation별 bounded scope를 재사용한다.
- precompressed file stream은 response close 시 즉시 destroy한다.
- 초기 import graph 예산은 90 modules/580,000 bytes이며 v606 최종 소스 최대값은 579,919 bytes다.

기준 버전: `rebuild-v613`

# v605 배포 성능 계약

- 제한 사용자 상태 요청은 요청 단위로 ACL context promise를 재사용해 입력·출력 필터가 catalog를 중복 조회하지 않는다.
- query 없는 scripts/styles/fragments/icons는 `max-age=0, must-revalidate`를 사용하며 현재 `?v=rebuild-v605` 자산만 immutable이다.
- 사용자 상태 bundle cache는 idle 기준 soft limit와 hard ceiling을 함께 사용한다.
- 앱 종료 유예는 45초, HTTP 강제 drain은 10초이며 Compose stop grace는 60초다.
- 폴더형 작품 mutation은 cache invalidation을 위해 SMB 트리를 동기 재귀 스캔하지 않고 전체 in-flight content build를 먼저 취소한다.

## v604 배포 성능 계약

### v604 초기·요청 경로 최적화

- 전체 라이브러리 권한 snapshot은 전체 작품 ID를 직렬화하지 않고 `accessVersion` 기반 compact signature를 사용한다. catalog가 아직 없으면 snapshot API가 catalog cold build를 선행하지 않는다.
- metadata provider/job/probe 및 owner·전체 권한 cover 요청은 전체 library를 로드하지 않는다.
- 제한 권한 사용자는 허용 작품 ID를 `Set`으로 재사용해 반복 `map().includes()`를 제거한다.

- content cache 무효화는 Map 삭제뿐 아니라 in-flight worker를 abort해 불필요한 CPU와 stale cache 재삽입을 막는다.
- disk cache janitor의 recursive scan·stat·unlink·summary는 비동기 경로를 사용하며 주기 timer는 진행 중 작업을 중복 실행하지 않는다.
- owner diagnostics와 사용자 snapshot 파일 순회는 요청 thread에서 동기 재귀 I/O를 수행하지 않는다.
- scrypt는 비동기 crypto 경로를 사용한다.
- 태그 filter DOM은 선택 태그를 포함해 최대 180개 window를 렌더링하고 나머지는 cursor·검색으로 탐색한다.
- tag facet loader/search controls는 필터 interaction 전 초기 static graph에 포함하지 않는다.
- 초기 예산: 90 modules 이하, 580,000 source bytes 이하. 현재 최대 89 modules / 579,919 bytes.

기준 버전: `rebuild-v605`

## v601 태그 facet 성능 계약

- 서버는 전체 태그 이름을 무제한 직렬화하지 않고 빈도 상위 500개 옵션과 전체 histogram 요약을 반환한다.
- 자동 임계값은 전체 분포를 사용하며 UI 렌더링 대상은 최대 목표 240개 수준으로 제한한다.
- 사용자 정의 태그와 현재 선택된 태그는 희소 태그 억제와 무관하게 유지한다.

## v595 초기 모듈 그래프 최적화

- library-page 기준 초기 정적 graph를 110 modules / 755,675 bytes에서 104 modules / 676,545 bytes로 줄였다.
- 영어 번역 사전, 사용자 언어 편집기, reader cache maintenance를 사용 시점까지 지연한다.
- 측정값은 source byte 합계이며 gzip 전송량이나 운영 네트워크 시간으로 해석하지 않는다.
- `initial-load-optimization-v595-smoke.js`가 105 modules / 690,000 bytes 예산과 heavy module 제외를 검증한다.

<!-- v595-initial-load-budget-pass -->

## v594 초기 UX 비용 보호

- custom CSS 적용 runtime과 편집기를 분리해 appearance 초기 graph에 편집 UI가 포함되지 않도록 했다.
- build toast는 동일 version에서 한 번만 생성하고 status pill은 기존 노드를 교체해 DOM 누적을 방지한다.

<!-- v594-initial-ux-budget-pass -->

## v575 카드 → 파일 탐색 전환 최적화

- 파일 탐색 최초 전환은 전체 episode 객체 배열을 포함하는 `/api/novels` 대신 compact `/api/novels/tree`를 사용한다.
- multi-file 작품의 회차 배열은 펼치거나 현재 회차 위치를 복원할 때만 `/api/novels/:novelId/episodes`로 조회한다.
- 같은 tree 요청은 하나의 Promise로 합치고, 동일 catalog reference의 tree model을 재사용한다.
- 1,000작품×20회차 로컬 합성 fixture에서 검색용 episode/file 문자열을 유지한 tree payload는 513,837 bytes로 full catalog 1,371,691 bytes보다 62.5% 작았다. 측정된 직렬화·응답 시간은 full 약 145ms, tree 약 65ms였으며 실제 SMB·8만 파일 운영 수치가 아니다.

## v573 range integrity and library snapshot budget

- warm normalized cache 진입은 metadata/index/size만 확인하며 전체 `.text` 동기 SHA-1을 요청 경로에서 계산하지 않는다.
- 요청된 청크의 UTF-16LE byte range만 읽고 SHA-256을 검증한다. 따라서 first warm request의 비용은 전체 파일 크기가 아니라 요청 chunk 크기에 비례한다.
- 손상 청크는 cache key를 invalid 처리하고 worker rebuild를 한 번 수행한다.
- 라이브러리 scan은 어느 하위 폴더의 I/O 실패라도 전체 commit을 중단해 일부 작품만 사라지는 snapshot을 방지한다.
- 실제 SMB latency/event-loop 수치는 이번 문서의 로컬 검증 결과로 대체하지 않는다.

## v572 streaming normalized cold build

- `v571-streaming-normalized-content-build-pass`: large disk-cache cold builds use bounded-sample encoding detection and streaming decode/output/hash/chunk indexing.
- `v571-streaming-normalization-equivalence-smoke-pass`: 1,315 existing formatter/option/encoding/chunk-boundary comparisons protect normalized output and `fileChar` semantics.
- `v571-streaming-normalized-content-worker-smoke-pass`: verifies no full text result, UTF-8/BOM/CP949/UTF-16LE/BE, long-line spool, metrics and v570 metadata compatibility.
- Local 3-run medians: 20MiB line fixture RSS -45.9% and elapsed time -21.7%; 50MiB line fixture RSS -67.0% and elapsed time -31.5%. Single-paragraph RSS fell 8.4% at 20MiB and 47.5% at 50MiB, while elapsed time increased 48.6% and 37.3% respectively. No blanket latency improvement is claimed.

## v570 normalized content range cache

- `v570-normalized-content-range-cache-pass`: 1MiB 이상 TXT의 정규화 결과는 UTF-16LE disk cache와 chunk index로 저장하고 메인 프로세스는 전체 문자열을 보관하지 않는다.
- `v570-content-range-read-pass`: 콘텐츠 API와 block manifest는 `fileChar * 2` byte offset으로 요청 범위만 읽는다.
- 3회 중앙값 로컬 합성 측정에서 20MiB cold peak RSS는 391.1→362.0MiB(-7.4%), 50MiB는 708.1→671.6MiB(-5.1%)였다. 50MiB warm 두 번째 chunk는 2451→10.6ms, peak RSS는 708.2→139.2MiB였다.
- 측정은 local filesystem과 main+worker 합산 process RSS 기준이며 실제 SMB·Docker 장시간 결과가 아니다.
- disk cache 용량은 fixture 기준 20MiB 원본 약 17.2MiB, 50MiB 원본 약 42.9MiB였다. 텍스트 언어·인코딩·정규화 결과에 따라 달라진다.

## v569 비동기 라이브러리 검사와 지연 UI 예산

- `v569-library-async-signature-check-pass`: HTTP 요청은 디렉터리 `stat` 순회를 수행하지 않고 마지막 정상 스냅샷을 반환한다. deep signature 검사는 `fs.promises.stat`와 `LIBRARY_SIGNATURE_CHECK_CONCURRENCY`로 제한한다.
- `v569-library-signature-backoff-pass`: 변경이 없는 검사 소요 시간의 6배를 다음 검사 간격의 하한으로 사용하고 `LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS`에서 제한한다. 변경이 확인되면 기본 간격으로 복귀한다.
- 비동기 검사가 변경을 확인한 뒤 실행하는 catalog rebuild는 아직 동기 빌드다. 따라서 실제 SMB에서 build duration과 event-loop 지연을 별도로 관찰해야 한다.
- 핵심 앱 셸과 CSS는 라이브러리/리더 시작 화면만 포함한다. 설정·검색·북마크·복구·진단 HTML/CSS는 first-use versioned asset으로 로드한다.
- 서재 DOM은 480개 카드로 제한하며, 앞 카드 제거 시 보이는 카드 앵커와 보호 작품 객체를 유지한다.

## v568 initial client graph and lazy features

- `v568-main-lazy-boot-pass`: the library shell boots without static imports of reader, search, bookmarks/read-data, theme editor, or recovery/devtools feature roots.
- `v568-lazy-feature-runtime-pass`: features are imported once on first intent, expose load/error diagnostics, and can be retried after a failed import.
- `v568-lazy-reader-intent-preload-pass`: pointer/focus intent on a shelf/tree item starts the reader import before the open action; automatic last-read restoration still awaits the reader normally.
- `v568-periodic-device-sync-lazy-ui-pass`: periodic sync no longer statically imports device-management and remote-resume UI. Remote resume code is requested only when the server reports an actionable offer.
- The site/mobile static ESM graph is guarded at no more than 115 modules and 760,000 source bytes; the patch measurement is 105 modules and about 692KB, down from 208 modules and about 1.60MB in v567.
- Shelf cards use `content-visibility:auto` with a stable intrinsic size so offscreen cards retain layout space without full paint/layout work.

## v567 library/content resource budget

- `v567-library-stale-while-revalidate-pass`: elapsed time alone no longer rebuilds the full library. Root/deep signatures are checked at `LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS` (default 30000ms); changed trees return the last-known-good snapshot and schedule one background rebuild.
- `v567-content-entry-worker-pool-pass`: automatic worker concurrency is 1, queue default is 8, active tasks keep the worker referenced, and completed idle workers are immediately unreferenced before retirement after 30 seconds. Queue overflow returns HTTP 503 instead of unbounded buffering.
- `v567-content-worker-resource-budget-pass`: worker failures for files larger than `CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES` do not fall back to synchronous main-thread preprocessing.
- `v567-library-shelf-query-cache-pass`: shelf search keys and global title order are built once per library snapshot; ACL results and identical shelf responses use bounded caches.
- `v567-library-shelf-append-render-pass`: load-more appends only the new page. `v567-library-episode-lru-pass` limits hydrated episode arrays to 12 recently used multi-file works.

Measured synthetic checks in the patch environment: an unchanged 80,000-file snapshot stayed at one build after the change-check interval (post-interval check about 10.8ms versus about 605ms initial build). Four approximately 20MiB cold content jobs with the safe default worker pool peaked at about 306MiB RSS; the v566 audit observed about 1.27GiB with four workers. These are synthetic local-filesystem measurements, not production SMB results.

# Performance and cache notes

기준 버전: rebuild-v605

## v600 초기 부팅 측정 계약

- `bootStart.at`부터 `bootComplete.at`까지 겹치는 long task만 초기 부팅 task로 집계한다.
- `bootDurationMs`는 `bootComplete.at - bootStart.at`으로 계산한다.
- Chromium 회귀는 warm-up 1회 후 3회 이상 측정한다.
- 본 측정 예산은 요청 ESM 100개 이하, boot-window long task 2개 이하, 단일 task 180ms 이하이다.
- 사용자 태그 runtime은 헤더나 작품 메뉴를 실제 사용할 때 동적 import하므로 초기 정적 graph에 포함하지 않는다.


## v566 shelf catalog load budget

- The default shelf request uses `/api/novels/shelf` with a 48-work page and omits episode arrays. This avoids serializing and parsing the full episode catalog during normal library entry.
- The legacy full catalog is loaded only after the user switches to `파일 탐색`. Multi-file episode summaries are fetched on work open and deduplicated per work while a request is in flight.
- Shelf filters use explicit server requests with a short debounce; scrolling the shelf does not invoke the file-tree virtual renderer.
- Shelf scope counts intersect user favorites/recents with the current ACL-filtered library.


## v565 scroll and background resource controls

- Reader virtual layout stores a mutation revision. When rows, measured heights, and prefix lengths are unchanged, repeated render/diagnostic calls reuse the current `heights`, `prefix`, and `totalHeight` instead of summing every virtual row again. Marker: `v565-reader-virtual-layout-cache-pass`.
- Delayed `measure` / `render-window` anchor corrections larger than the viewport continuity threshold are suppressed only during the native-scroll settle window. Explicit restore, pending slider/search/navigation targets, prepend, and prune coordinates bypass this guard. Marker: `v565-reader-native-large-correction-guard-pass`.
- Periodic device sync skips hidden-document and offline intervals and resumes on `visibilitychange` / `online`. Unchanged payload suppression remains enabled. Marker: `v565-periodic-device-sync-visibility-guard-pass`.
- Disk cache janitor healthy passes call `statfsSync` only and reuse the last cache summary. Recursive cache-directory size scans are performed on actual prune or explicit owner diagnostics. Marker: `v565-disk-cache-healthy-scan-skip-pass`.
- Docker image creation no longer installs `python3`, `make`, or `g++` because the locked runtime dependency set is pure JavaScript.

## v540 block manifest server load mitigation

- Multi-file folder block-manifest requests are now coalesced by structural key, so concurrent cold requests share one build instead of each walking and parsing every episode.
- A short folder manifest/signature hot cache is enabled in the app to reduce repeated stat sweeps immediately after a successful build or disk hit.
- Large folder manifest builds yield between episode batches to keep the server event loop responsive.
- The production app disables per-episode manifest disk writes during aggregate folder builds. This keeps cold folder manifest creation from growing `data/block_manifests/episodes` by one JSON file per episode; direct episode manifest requests still persist episode cache files on demand.

## v539 full-search CPU load mitigation

- 전체 검색은 chunk별 `/content` 요청을 반복하므로, 서버 cold miss에서 `content-service`가 파일 전체를 다시 읽고 전처리하는 경로가 CPU hotspot이 될 수 있다.
- v539는 검색 모달 overlay/Escape 닫기 경로도 active search `AbortController`를 중단하도록 보정했다. 결과 클릭 이동은 `{ abort:false }` 옵션 passthrough로 검색 지속 의도를 유지한다.
- v539는 network full-search concurrency를 낮췄다. full/live 검색은 1~2, multi-episode target 병렬도는 1이다. worker batch는 이미 확보된 text에 대한 client-local 매칭이므로 2~4를 유지한다.
- `CONTENT_FILE_CACHE_MAX_BYTES` 기본값은 `max(128MiB, MAX_TEXT_FILE_BYTES + 32MiB)`이다. 큰 TXT 전체 검색에서 기본 48MiB file cache limit 때문에 파일 전체 read/decode/preprocess/chunk-boundary 생성이 반복되는 상황을 줄이기 위한 설정이다.
- 대용량 파일을 많이 동시에 운영한다면 RAM 여유에 맞춰 `CONTENT_FILE_CACHE_MAX_BYTES`와 `CONTENT_FILE_CACHE_MAX_ENTRIES`를 조정한다. 이 캐시는 런타임 메모리 캐시이며, `data/content_chunks` 디스크 캐시 자동 정리 정책과 별개다.


## Library deep signature cache

v348부터 라이브러리 빌드 중 실제 순회한 디렉터리 signature를 기록한다. 메인 15초 TTL 안에서도 `LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS` 간격으로 중첩 디렉터리 변경 여부를 확인한다.

## Precompressed static

v349부터 public 정적 파일에 대해 미리 생성한 `.br`/`.gz` sidecar를 제공한다. `Accept-Encoding: br`이 있으면 `.br`, gzip만 있으면 `.gz`, sidecar가 없으면 원본 파일로 fallback한다. `ETag`, `Last-Modified`, `304 Not Modified`, `Vary: Accept-Encoding`을 지원한다.

## Content cache rawText 제거 / textHash 재사용

v352부터 content cache entry는 formatted `text`, `textHash`, chunk bounds, stat signature, format stats만 보관하고 raw decoded text를 cache에 남기지 않는다. block manifest의 `contentHash`는 가능하면 cached entry의 `textHash`를 재사용한다. 대용량 TXT에서 원본/포맷 문자열 중복 보관과 중복 hash 계산을 줄이기 위한 서버 메모리 최적화다.

## v383 small episode append boundary

Small 2-chunk episode appends defer wide-tail seam rendering until the viewport is actually near the seam. Virtual spacers also opt out of native browser scroll anchoring so spacer height changes do not become the browser's anchor choice during active scroll.

## v398 검색 캐시 전용 모드

<!-- v398-search-cache-only-no-network-smoke-pass -->

검색 패널의 `서버 요청 없이 검색` 모드는 표시 중인 chunk, 메모리 검색 캐시, IndexedDB reader cache에 있는 chunk만 스캔한다. 이 모드에서는 본문 content API를 호출하지 않으며, 캐시 외 chunk는 `skippedCacheOnlyChunks`로 기록한다.
## v399 Web Worker client search

- 전체/캐시 검색에서 chunk text 확보 후 정규식 매칭 계산을 가능한 경우 `search-worker.js` Web Worker로 위임한다.
- Worker API가 없거나 worker 오류가 나면 기존 main-thread `collectMatches()` 경로로 fallback한다.
- `cache-only` 검색의 no-network 정책은 유지하며, worker는 이미 확보된 chunk text만 처리한다.
- rebuild `.mjs` 개수 고정 smoke를 보존하기 위해 worker는 `.mjs`가 아닌 `.js` 파일로 제공한다.



## v400 search cache manifest

<!-- v400-search-cache-manifest-smoke-pass -->

Reader IndexedDB cache now keeps a lightweight search cache manifest per user/accessVersion/novel/episode/preprocess/content identity. The manifest records which chunks are already available for client-side search, so `서버 요청 없이 검색` can estimate searchable coverage without treating uncached server content as available. When `/api/user-access/snapshot` changes, the reader cache purge also removes search cache manifest records for novels no longer allowed by the server ACL.


## v404 audit/snapshot retention

- Audit log 조회는 tail window 기반으로 동작하여 큰 JSONL 파일 전체를 메모리로 읽지 않는다.
- Audit log는 기본 최대 5MB에서 `.1` 파일로 rotate한다.
- 사용자 state snapshot은 retention 정책을 적용해 reset/delete/restore 자동 snapshot이 무제한 누적되지 않도록 한다.


## v434 reader API conditional revalidation

- `/api/novels`, `/api/novels/:novelId/content`, `/api/novels/:novelId/episodes/:episodeId`는 `Cache-Control: private, max-age=0, must-revalidate`, weak ETag, `Vary: Cookie`를 사용한다.
- ETag scope에는 사용자, accessVersion, 권한 signature, 콘텐츠/라이브러리 identity가 포함된다. `/api/*`는 public cache 대상이 아니다.
- 클라이언트는 reader 조회 GET 중 좁은 allowlist만 `cache: 'no-cache'`로 호출하고, 인증/관리/권한/설정/파일 조작 API는 `no-store`를 유지한다.
- CSS 분리는 이번 버전에서 수행하지 않았다. 후보는 owner/admin 전용 CSS의 추가 분리이며, reader/safe-area/mobile layout CSS는 회귀 위험 때문에 별도 버전에서 검토한다.

## v436 운영 캐시/진단 기준

- HTML entrypoint는 `no-store`로 둔다. `/login.html`, `/site.html`, `/mobile.html`, `/admin/*`는 edge cache에서 제외한다.
- `/api/*`는 public, immutable, 장기 `max-age`를 붙이지 않는다. reader API는 `Cache-Control: private, max-age=0, must-revalidate`, `ETag`, `Vary: Cookie` 기반의 private revalidation만 허용한다.
- versioned rebuild asset만 장기 immutable 대상으로 둔다. 예: `/scripts/rebuild/*.mjs?v=rebuild-vXXX`.
- query 없는 ESM import 경로는 stale cache 위험이 있으므로 Cloudflare/NPM이 임의로 장기 cache하지 않게 한다.
- Cloudflare/NPM은 origin의 `Cache-Control`, `ETag`, `Vary`를 제거하거나 덮어쓰지 않는다.
- Cloudflare Cache Rules에서는 `/api/*`, `/login.html`, `/site.html`, `/mobile.html`, `/admin/*`를 edge cache 제외 대상으로 둔다.
- `v436-content-cache-io-diagnostics-pass` diagnostics는 병목 판단용 측정값만 노출하며, 성능 전략 변경은 별도 측정 후 진행한다.

## v438 reader API cold/warm smoke

- `tools/smoke_server_http.js`는 content chunk와 block-manifest를 같은 인증/권한 조건에서 first/repeat로 요청해 elapsed time을 기록한다.
- 이 smoke는 최적화 전략을 변경하지 않는다. repeat 요청이 비정상적으로 느려지는 회귀를 감지하기 위한 운영 guard이며, 측정값 기반 tuning은 별도 버전에서만 수행한다.
- reader virtual layout, chunk seam, safe-area, search jump, slider 안정화 코드는 이 smoke와 무관하다.



## v439 measured cache strategy adjustment

- v438 cold/warm smoke와 v436 `ioDiagnostics` counters를 기준으로 cache 전략만 소규모 조정한다.
- content cache async miss 경로는 최초 stat signature를 재사용해 동일 요청에서 중복 `statSignatureCalls`/중복 miss recursion을 만들지 않는다.
- library cache는 `LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS` 안의 hot hit에서 root stat을 생략하고, TTL이 지난 뒤 root/deep directory signature를 다시 확인한다.
- block-manifest cache는 hit/miss/store/eviction counter를 노출하고, 재저장 시 Map 순서를 갱신해 LRU eviction 의도를 유지한다.
- reader virtual layout, chunk seam, safe-area, search jump, slider 코드는 변경 대상이 아니다.

## v440 admin/owner CSS split review

- marker: `v440-admin-owner-css-split-review-pass`.
- Current finding: owner/admin UI is already isolated behind `public/styles/admin-users.css`, while PC/mobile reader shells use `public/styles/app.css`.
- Decision: do not split or edit reader `app.css` in v440. The safe next step is a boundary smoke that prevents admin-only selectors from drifting into reader CSS and prevents reader shells from loading owner/admin CSS.
- Follow-up only after visual regression coverage: consider extracting owner diagnostics-only table/layout rules from `admin-users.css` if the owner console stylesheet grows materially.


## v503 owner/developer diagnostics CSS split

- marker: `v503-owner-css-split-pass`.
- `public/styles/app.css` remains the reader base stylesheet and keeps reader/safe-area/search/library/settings launch styles.
- Developer Debug and Recovery Center modal/cache/diagnostics CSS moved to `public/styles/owner.css`.
- `owner.css` is not linked from `site.html` or `mobile.html`; `public/scripts/rebuild/features/owner-style-loader.mjs` injects `/styles/owner.css?v=rebuild-v568` immediately before Developer Debug or Recovery Center opens.
- This reduces initial reader CSS bytes without touching reader anchoring, slider, progress, chunk append/prepend, search jump, or block manifest code.

## v441 modulepreload/cache policy boundary

- marker: `v441-modulepreload-cache-policy-boundary-pass`.
- `site.html` and `mobile.html` keep queryless `modulepreload` URLs so they match queryless ESM import specifiers.
- Queryless `/scripts/rebuild/*.mjs` responses must remain `public, max-age=0, must-revalidate`.
- Versioned `/scripts/rebuild/*.mjs?v=rebuild-v500` responses may use `public, max-age=31536000, immutable`.
- HTML entry pages remain `no-store`.
- Precompressed `.br`/`.gz` sidecar responses must preserve the same cache policy as their source asset and keep `Vary: Accept-Encoding`.


## v442 cache threshold / invalidation audit / deployed header check

- `v442-cache-metrics-threshold-diagnostics-pass`는 `/api/admin/diagnostics`의 `ioDiagnostics.thresholds`에 운영 경고 기준과 warning summary를 추가한다. 이 값은 hard fail이 아니라 병목 판단용 표시이며, 비밀번호/session token/signup code 원문은 포함하지 않는다.
- `v442-cache-invalidation-contract-smoke-pass`는 library/content/block-manifest conditional cache가 사용자, accessVersion, 권한 signature, file stat/text hash, chunk/episode scope를 유지하는지 감사한다. ACL 변경 후 old ETag가 304로 재사용되지 않는 block-manifest runtime smoke도 포함한다.
- `v442-deployed-cache-header-check-pass`는 배포 후 Cloudflare/NPM이 origin header를 덮어쓰지 않는지 확인하는 운영 스크립트 marker다. 앱 설정을 자동 변경하지 않고 응답 header만 점검한다.

## v448 reader manifest adoption note

Reader progress may temporarily hold chunk-ratio fallback during active native scrolling in the 70~85% append-seam band. This is not an HTTP cache policy change; it prevents a newly available exact block manifest from moving the bottom bar backward while the user is still scrolling. When scrolling is idle, the exact manifest ratio is allowed to surface.
## v449 reader scroll-buffer inertia note

Forward scroll-buffer append now records an append inertia extension before loading the next chunk. The extension is limited to native scroll sources and does not change explicit jump or pending target behavior. Post-append sub-block corrections are damped during the same short grace window to avoid visible one-block-less oscillation after the chunk attaches.
## v450 optimization pass

- Marker: `v450-reader-anchor-trace-low-overhead-pass`. Anchor trace diagnostics remain available for regression reports, but the hot path now updates the bounded trace buffer in place and avoids reading DOM `scrollHeight` for every trace event. Trace events use the virtual layout total height as `scrollHeight` and mark `scrollHeightSource: virtual-total-height`.
- Marker: `v450-precompressed-static-metadata-cache-pass`. Precompressed static serving now uses a short-lived metadata cache for original and sidecar file stats so repeated `*.mjs`, `*.css`, and HTML sidecar responses do not repeat the same stat/exists work on every request.
- This version intentionally does not change reader anchoring thresholds, chunk-window append/prune behavior, safe-area progress rules, search jump, slider behavior, or CSS.



## v452 optimization diagnostics

`/api/novels` now records library catalog serialization timing, payload bytes, novel count, and auth-scoped response-cache hit/miss counters in the library cache status. The response cache key includes the user/access scope and library signature, so it is not shared across permission boundaries.

The search panel prewarms the search worker on open/run and exposes `v453-search-worker-warm-start-pass` in search stats. This avoids creating the worker on the first scanned chunk when the browser supports Web Workers.

Reader row/measure cache diagnostics expose coverage and pool reuse ratios for future measurement-based reader optimization. v452 does not change anchor correction, chunk seam, safe-area, slider, or search jump behavior.

## v453 optimization diagnostics

`/api/novels` now keeps its auth-scoped response cache within a bounded memory budget. The default budget is 16 MiB total and 2 MiB per response entry. Oversized catalog payloads still return normally, but the server skips in-memory response caching and exposes `X-Novels-Api-Response-Cache-Skip: entry-too-large` plus byte diagnostics. The miss path reuses the serialized JSON payload to calculate the response body hash, avoiding an extra stable stringify pass.

Reader anchoring, chunk seam correction, safe-area progress, search jump, and slider logic were not changed in v453.


## v505 owner CSS hidden bootstrap

`owner.css` remains lazy-loaded for Developer Debug / Recovery Center rich styles, but `app.css` keeps `v505-owner-modal-hidden-bootstrap-pass` so app-shell owner tool DOM is hidden before the lazy stylesheet arrives. This prevents raw Recovery Center markup from appearing below the reader content while preserving the owner CSS split.

## v506 owner CSS residual split

`app.css` keeps the critical reader shell, settings launcher styling, and the `v505-owner-modal-hidden-bootstrap-pass` display-none guard. Residual Recovery Center / Developer Debug detail selectors such as recovery logs, recovery chunk modals, recovery trial history, action rows, mobile devtools layout, and debug output formatting are split into `owner.css` under `v506-owner-css-residual-split-pass`.


## v507 CSS HTML boundary contract and full-search speed tune

Marker: `v507-css-html-boundary-contract-pass`. CSS 분리는 selector 단위 추가 분해를 중단하고 HTML/page/fragment 단위로 고정한다. `app.css`는 reader/site 공용, reader/safe-area/slider/progress CSS, 검색 shell, app-shell owner tool 초기 숨김 bootstrap만 소유한다. `admin-users.css`는 `public/admin/users.html` 전용 사용자 관리/가입코드/운영진단 UI를 소유한다. `owner.css`는 Developer Debug / Recovery Center 상세 스타일을 소유하며 `owner-style-loader.mjs`가 `/styles/owner.css?v=rebuild-v568`를 lazy-load한다.

Full search tune markers: `v507-search-full-scan-concurrency-tune-pass`, `v507-search-worker-batch-size-tune-pass`. v507에서는 전체검색의 non-live network chunk fetch concurrency를 8에서 12로 올리고 worker postMessage batch를 4에서 6으로 늘렸다. v508에서 다시 보강되어 현재 값은 network 16, live/current 4, worker batch 8이며 cache-only/no-network는 3을 유지한다.
## v508 full-search concurrency and library virtual scroll stability

Markers: `v508-search-full-scan-concurrency-tune-pass`, `v508-search-live-full-scan-concurrency-pass`, `v508-search-multi-episode-target-concurrency-pass`, `v508-search-worker-batch-size-tune-pass`. 전체검색의 실제 병목은 두 군데였다. 단일파일/current 검색은 live reader context로 분류되어 chunk fetch concurrency가 1이었고, 다중파일 검색은 episode target을 순차 처리했다. v508은 network full scan concurrency를 16, live/current full scan concurrency를 4, worker batch size를 8로 조정하고, 다중파일 target queue를 최대 3개 병렬로 실행한다. Cache-only/no-network concurrency는 3으로 유지한다.

Marker: `v508-library-virtual-scroll-row-height-freeze-pass`. 라이브러리 폴더 목록의 virtual renderer는 scroll 중 현재 window row를 다시 측정하면서 rowHeight/spacer가 바뀔 수 있었다. v508은 `virtual-scroll` 중 rowHeight를 직전 non-scroll render에서 캡처한 stable row height로 freeze해 중간 스크롤 구간의 index 재해석 튐을 줄인다.

## v509 adaptive search and library virtual-scroll hold

Markers: `v509-search-adaptive-profile-pass`, `v509-search-adaptive-feedback-pass`, `v509-search-adaptive-input-pressure-pass`, `v509-library-virtual-scroll-window-hold-pass`.

Search full-scan scheduling no longer relies only on fixed v508 values. The fixed values are kept as upper bounds, while the runtime profile starts from a client tier inferred from hardware concurrency, device memory, connection hints, and save-data mode. The matcher records fetch-batch and worker-batch elapsed time and reduces concurrency/batch size when slow batches or user input pressure are observed. Stable fast batches may raise values back toward the upper bounds.

Library virtual scrolling keeps the v508 stable row-height freeze and additionally avoids replacing the virtual DOM while the requested visible range remains inside the already-rendered cached window. This reduces repeated `replaceChildren()` during middle-list scrolling.


## v510 library virtual scroll anchor

Long library lists keep using row-height freeze/window hold, and v510 adds top-row anchor capture/restore for actual virtual-scroll window replacements. Marker: `v510-library-virtual-scroll-anchor-restore-pass`.

## v537 full-search server-load mitigation

- Marker: `v537-search-server-load-mitigation-pass`.
- Full search no longer forces `ensureBlockManifest()` before scanning. Block manifests remain available through reader jump/open paths and should be lazy for search-result navigation.
- Adaptive full-search limits are intentionally server-friendly: full scan 3~6, live/current 1~3, multi-episode 1~2, worker batch 2~4.
- Network content scans send `X-Search-Scan: 1`; the server responds with `X-Content-Search-Scan: v537-search-scan-content-load-mitigation-pass` and skips sync chunk payload disk writes on search-scan cold misses.
- Owner diagnostics can expose `searchScanRequests` and `searchScanPayloadWriteSkipped` via content cache status.
## v538 disk cache auto-prune

Marker: `v538-disk-cache-auto-prune-pass`. The server now starts a bounded disk-cache janitor for runtime cache directories only. The pruning targets are `data/chunk_indexes`, `data/content_chunks`, and `data/block_manifests`; account data, session data, user state, fonts, audit logs, and library TXT files are intentionally excluded (`v538-disk-cache-protected-data-pass`).

Default policy:

- enabled by default: `DISK_CACHE_AUTO_PRUNE_ENABLED=1`
- trigger when the data filesystem reaches `DISK_CACHE_PRUNE_USAGE_PCT` percent used, default `85`
- also trigger when available bytes fall below `DISK_CACHE_PRUNE_MIN_FREE_MB`, default `2048`
- delete oldest cache files first, with temporary cache files prioritized
- stop when usage falls to `DISK_CACHE_PRUNE_TARGET_USAGE_PCT`, default `80`, and available space is at least `DISK_CACHE_PRUNE_TARGET_FREE_MB`, default `4096`
- skip files newer than `DISK_CACHE_PRUNE_MIN_FILE_AGE_MS`, default `60000`, to reduce races with active writes
- cap each run with `DISK_CACHE_PRUNE_MAX_DELETE_PER_RUN`, default `5000`

Owner diagnostics expose `ioDiagnostics.diskCacheJanitor` with filesystem usage, cache bytes/files per directory, run counters, deleted bytes/files, and the last trigger.


## v591 request hot-path I/O

- precompressed static sidecar metadata cache miss는 `fs.promises.stat`을 사용하며 동일 경로의 in-flight 요청을 병합한다.
- async TXT chunk API는 source signature와 chunk payload/index, normalized metadata/index를 비동기로 읽는다.
- block manifest API는 source/cache stat·read·write를 비동기로 수행하고 폴더 episode signature 수집을 최대 8개 동시 작업으로 제한한다.
- 최초 및 background library catalog scan은 `fs.promises`를 사용한다. 동시 cold 요청은 하나의 build promise를 공유하고 invalidation generation이 바뀐 snapshot은 폐기한다.
- cache identity 계산은 source 권한 확인과 분리되어 있으며 요청마다 SMB `realpathSync`를 수행하지 않는다.
- metadata queue의 progress-only 상태는 기본 300ms 동안 병합한다. terminal/status/cancel 변경은 즉시 기록한다.
- sync state 및 session store timer는 event loop를 유지하지 않으며 app shutdown에서 최종 상태를 flush한다.

<!-- v591-request-hot-path-io-pass -->


## v592 metadata·fileops·service worker 추가 성능 계약

- metadata candidate/apply/settings mutation은 in-memory generation으로 병합하고 durability boundary에서 `fs.promises` temp write → fsync → rename으로 저장한다.
- metadata queue stop은 active run cleanup과 terminal 상태 영속화가 완료될 때까지 기다린다.
- fileops mutation은 async 직렬 queue를 사용한다. 대형 폴더 move는 mutation 직후 전체 cache를 비우므로 move 전 재귀 scan을 수행하지 않는다.
- admin diagnostics는 cold library를 동기 build하지 않고 async catalog getter를 사용한다.
- service worker static cache는 query/hash가 제거된 canonical request key를 사용하고 최대 512개 entry를 유지한다.

<!-- v592-metadata-fileops-cache-performance-pass -->

## v593 profile·audit hot-path I/O

- Playwright 성공 요청은 `profiles.json`을 매번 동기 재작성하지 않는다. 짧은 지연으로 상태 변경을 병합하고 atomic async write를 직렬화한다.
- audit event append는 request handler에서 sync stat/rename/append를 수행하지 않고 process-local async write chain에 등록한다.
- audit 조회/export, admin diagnostics와 server shutdown은 pending write를 flush한다.
- shutdown은 active HTTP request를 먼저 drain해 완료 직전 mutation이 닫힌 저장소에 기록되는 경쟁을 방지한다.

- owner profile 삭제는 async recursive remove이며 profile 크기에 비례하는 `rmSync` event-loop 정지를 만들지 않는다.
- 서재 로그아웃은 dynamic import로 분리해 `library-page.mjs`, `site.mjs`, `mobile.mjs` 초기 정적 graph 예산을 유지한다.

<!-- v593-playwright-audit-performance-pass -->


## v599 초기 로드 계약

초기 library/site/mobile 정적 import graph는 90개 모듈·580KB 이하를 유지한다. 고급 설정, 상세 진단, tree fixture와 native drag-and-drop handler는 실제 사용 시 동적 로드한다.
## v675 hot path

진행률 저장은 전체 state normalize/serialize 대신 durable sidecar journal과 capped progress collection의 증분 merge를 사용한다. metadata candidate index는 single-ID string과 collision-only array를 사용해 Set과 배열 중복 상주를 줄인다. 실제 50k/100k RSS는 운영 fixture에서 별도 측정한다.

<!-- v675-performance-hot-path-pass -->
## v676 hot path

Metadata candidate는 shard 전체를 합친 후 자르지 않는다. 격리 loader process에서 각 shard를 순차 파싱하면서 global 20,000개와 작품별 상한을 유지해 startup resident object와 index 입력 크기를 제한한다. applied candidate는 protected set으로 별도 보존한다. Reader prefetch는 active orphan 2개에서 circuit을 열어 abort 무시 downstream의 무제한 누적을 막는다.

<!-- v676-performance-hot-path-pass -->
