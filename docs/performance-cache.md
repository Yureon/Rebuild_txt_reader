# Performance and cache notes

기준 버전: rebuild-v544
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
- `owner.css` is not linked from `site.html` or `mobile.html`; `public/scripts/rebuild/features/owner-style-loader.mjs` injects `/styles/owner.css?v=rebuild-v544` immediately before Developer Debug or Recovery Center opens.
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

Marker: `v507-css-html-boundary-contract-pass`. CSS 분리는 selector 단위 추가 분해를 중단하고 HTML/page/fragment 단위로 고정한다. `app.css`는 reader/site 공용, reader/safe-area/slider/progress CSS, 검색 shell, app-shell owner tool 초기 숨김 bootstrap만 소유한다. `admin-users.css`는 `public/admin/users.html` 전용 사용자 관리/가입코드/운영진단 UI를 소유한다. `owner.css`는 Developer Debug / Recovery Center 상세 스타일을 소유하며 `owner-style-loader.mjs`가 `/styles/owner.css?v=rebuild-v544`를 lazy-load한다.

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
