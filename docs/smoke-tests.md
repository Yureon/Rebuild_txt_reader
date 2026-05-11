## v532 package-lock regular file smoke

- Command: `node tools/checks/package-lock-regular-file-smoke.js`
- Purpose: verify `package-lock.json` is a real regular file, not a symbolic link, and that ZIP/TAR packaging tools reject symlink lockfiles.
- Marker: `v532-package-lock-regular-file-pass`, `v532-package-lock-regular-file-smoke-pass`.

## v563 Docker npm public registry smoke

- Command: `node tools/checks/package-lock-public-registry-smoke.js`
- Purpose: verify `.npmrc` pins `https://registry.npmjs.org/` and every `package-lock.json` resolved tarball URL avoids sandbox-only registry hosts.
- Regression covered: Docker build timeout while fetching `jschardet` from `packages.applied-caas-gateway1.internal.api.openai.org`.

## v527 Cloudflare Tunnel WAN exposure docs smoke

- `tools/checks/operations-docs-smoke.js`: `.env.example`, deployment/proxy/production/security/operations 문서가 Cloudflare Tunnel `CF-Visitor` 신뢰 전제와 WAN direct exposure 금지 조건을 유지하는지 확인한다.
- 핵심 문구: NPM 관리자 포트 81뿐 아니라 NPM service entry 80/443과 Node 앱 포트도 외부 WAN에서 직접 접근 불가능해야 한다.

- `tools/checks/security-hardening-v531-smoke.js`: verifies `OWNER_PASSWORD_MIN_LENGTH` env wiring, `createEl({ html })` disablement in favor of explicit `safeHtml`, and masked owner raw diagnostics rendering.
- `tools/checks/login-session-diagnostics-smoke.js`: v525부터 cloudflare-tunnel 모드에서 `CF-Visitor: {"scheme":"https"}`가 `X-Forwarded-Proto: http`를 보완해 production HTTPS gate를 통과시키는지 확인한다.
## v524 login PWA icon/manifest smoke
- `tools/checks/public-asset-allowlist-smoke.js`: 로그인 HTML이 manifest/apple-touch/favicon 링크를 포함하는지, 해당 경로들이 exact public allowlist에 있는지 확인한다.
- `tools/smoke_server_http.js`: 실제 서버를 띄워 로그인 전 `/login.html`의 link 선언과 `/manifest.json?v=rebuild-v553`, `/icon/icon-192.png`, `/icon/favicon-32x32.png`, `/favicon.ico`, `/apple-touch-icon.png` 응답을 검증한다.
- broad `.png`/`.ico` 공개는 계속 금지한다.

## v516 reader nav slider anchor-offset smoke

- Command: `node tools/checks/reader-nav-slider-anchor-offset-smoke.js`
- Purpose: verify nav-slider programmatic jump targets use the same viewport anchor offset as progress measurement instead of the legacy 18% viewport offset, while terminal 100% keeps bottom alignment.
- Marker: `v516-reader-nav-slider-anchor-offset-target-pass`, `v516-reader-nav-slider-anchor-offset-smoke-pass`.

# Smoke test policy

기준 버전: rebuild-v553

## v521 fullscreen viewport transition anchor smoke

- `tools/checks/reader-viewport-transition-anchor-smoke.js`
- Purpose: verify fullscreen button/shortcut capture the reader viewport anchor before transition, fullscreen/pseudo fullscreen/viewport-fit/visualViewport resize reuse rather than overwrite that anchor, and restore uses existing `restoreVirtualViewportAnchor(... explicit:true)` with restore timer de-duping.
- Marker: `v521-reader-viewport-transition-anchor-pass`, `v521-reader-viewport-transition-anchor-smoke-pass`.


## v520 reader nav slider / actual bottom progress smokes

- Command: `node tools/checks/reader-nav-slider-in-window-jump-smoke.js`
- Purpose: verify nav-slider targets already present in the loaded virtual window use direct `scrollToVirtualTarget()` instead of replace-loading the same chunk, preventing replace-load guards from resetting the visible position toward the first block.
- Marker: `v520-reader-nav-slider-in-window-jump-pass`, `v520-reader-nav-slider-in-window-jump-smoke-pass`.

- Command: `node tools/checks/reader-actual-bottom-progress-trust-smoke.js`
- Purpose: verify terminal progress trusts actual DOM bottom when `remainingBottom <= 2`, even if the viewport anchor row is above the last body row on tall/mobile screens.
- Marker: `v520-reader-actual-bottom-progress-trust-pass`, `v520-reader-actual-bottom-progress-trust-smoke-pass`.
- Included in: `npm run smoke:reader`.


## v519 reader row measured margin height smoke

- Command: `node tools/checks/reader-row-measured-margin-height-smoke.js`
- Purpose: verify virtual row measured heights include computed vertical margins before values enter `measureCache`, so virtual `totalHeight`/prefix and actual DOM scrollHeight use the same row box basis. Also verifies diagnostics expose `rowMeasuredMarginHeightPass` / `lastRowMeasuredMarginHeight`.
- Marker: `v519-reader-row-measured-margin-height-pass`, `v519-reader-row-measured-margin-height-smoke-pass`.
- Included in: `npm run smoke:reader`.

## v514 reader nav terminal progress sync smoke

- Command: `node tools/checks/reader-nav-terminal-progress-sync-smoke.js`
- Purpose: verify bottom/nav progress normalizes through `resolveNavTerminalProgressAddress()` before slider display, applies 100% only for trusted terminal bottom, caps pre-terminal 100% rounding, and records the diagnostic dataset marker.
- Marker: `v514-reader-nav-terminal-progress-sync-pass`, `v514-reader-nav-terminal-progress-sync-smoke-pass`.


Smoke test는 문서 파일의 존재 여부와 독립적으로 소스/런타임 동작을 검증한다. 단, 운영 문서와 `.env.example` 같은 배포 안전장치는 별도 smoke로 핵심 문구와 설정 예시가 유지되는지 확인한다.

## v513 reader unified viewport restore policy smoke

- Command: `node tools/checks/reader-unified-append-restore-policy-smoke.js`
- Marker: `v513-reader-unified-viewport-restore-policy-pass`, `v513-reader-unified-viewport-restore-policy-smoke-pass`.
- Purpose: verify append, measure-commit, and viewport/prune restore paths all reuse `resolveUnifiedAppendRestorePolicy()` before legacy correction/micro/fallback guards; also verifies the no-op v512 non-body seam suppression helper has been removed while anchor row-type trace remains.
- Included in: `npm run smoke:reader`.

## v504 multi-file 90% manifest hold smoke

- Command: `node tools/checks/reader-multifile-90-manifest-hold-smoke.js`
- Marker: `v504-reader-multifile-90-manifest-hold-smoke-pass`, `v504-reader-multi-file-late-manifest-hold-pass`.
- Purpose: verify the multi-file late-range active scroll fixture keeps fallback progress near 90% instead of adopting a backward exact manifest ratio near 84%, while idle exact manifest adoption and near-terminal small-delta adoption remain unchanged.
- Included in: `npm run smoke:reader`.

## 처음 설치

`package-lock.json`은 v530부터 패키지에 포함한다. 설치 검증은 lockfile을 보존하고 `npm ci` 또는 Docker build를 우선 사용한다.

```bash
npm install --no-audit --no-fund --package-lock=false
```

## 빠른 확인

```bash
npm run smoke:quick
```

동일 명령:

```bash
node tools/run_smoke_tests.js --quick
```

## 일반 확인

기본 smoke는 docs/cache/security/reader/search/settings/server 핵심 smoke를 실행한다. 오래 걸릴 수 있는 frontend guard는 기본 smoke에서 제외한다.

```bash
npm run smoke
```

동일 명령:

```bash
node tools/run_smoke_tests.js --standard
```

## 전체 확인

전체 smoke는 standard에 frontend guard를 더한다.

```bash
npm run smoke:full
```

동일 명령:

```bash
node tools/run_smoke_tests.js --full
```

## 영역별 확인

```bash
npm run smoke:docs
npm run smoke:cache
npm run smoke:security
npm run smoke:reader
npm run smoke:search
npm run smoke:settings
npm run smoke:frontend
npm run smoke:server
```

직접 실행도 가능하다.

```bash
node tools/run_smoke_tests.js --docs
node tools/run_smoke_tests.js --cache
node tools/run_smoke_tests.js --security
node tools/run_smoke_tests.js --reader
node tools/run_smoke_tests.js --search
node tools/run_smoke_tests.js --settings
node tools/run_smoke_tests.js --frontend
node tools/run_smoke_tests.js --server
```

## 그룹 구성

| 그룹 | 목적 |
|---|---|
| `quick` | 문서/버전/핵심 admin-user-search-cache-reader 정적 smoke와 server structure를 빠르게 확인 |
| `docs` | 문서 통합, 배포 가이드, 운영 문서, 버전 toast 확인 |
| `cache` | 다중 사용자 계정/권한/cache/search manifest/precompressed static 확인 |
| `security` | 쿠키, 비밀번호 정책, CSP script hardening, public asset allowlist, strict origin, fileops 확인문구, rate-limit, 가입코드, audit, diagnostics 확인 |
| `reader` | seam anchoring, append/prune/native scroll settle, slider/bottom/jump 관련 회귀 확인 |
| `search` | 다중 화수 검색, cache-only no-network, Web Worker, search cache manifest 확인 |
| `settings` | 설정 DOM 연결, 기능 컨트롤, PC/mobile layout smoke 확인 |
| `frontend` | rebuild frontend check와 frontend supervisor 실행 |
| `server` | server structure와 HTTP smoke 실행 |
| `standard` | docs + cache + security + reader + search + settings + server |
| `full` | standard + frontend |

## 권장 실행 순서

일반 개발/수정 후:

```bash
npm install --no-audit --no-fund --package-lock=false
node tools/run_smoke_tests.js --quick
node tools/run_smoke_tests.js --security
node tools/run_smoke_tests.js --server
```

reader/search를 건드리지 않은 경우에도 릴리즈 전에는 다음을 한 번 실행한다.

```bash
node tools/run_smoke_tests.js --reader
node tools/run_smoke_tests.js --search
```

최종 패키징 전:

```bash
node tools/run_smoke_tests.js --full
npm audit --omit=dev --json --package-lock=false
```

## Audit

```bash
npm audit --omit=dev --json --package-lock=false
```

## 주요 개별 smoke

| smoke | 목적 |
|---|---|
| `version-toast-smoke.js` | cache-buster와 rebuild marker 일치 확인 |
| `csp-inline-script-smoke.js` | login/admin/index inline script 제거와 CSP script hardening 확인 |
| `operations-docs-smoke.js` | `.env.example`, 운영 체크리스트, production diagnostics 문서 핵심 문구 확인 |
| `signup-code-register-smoke.js` | 가입코드 발급/회원가입 route와 UI wiring 확인 |
| `signup-code-atomic-smoke.js` | 가입코드 일회용 consume 원자성 확인 |
| `audit-log-query-smoke.js` | owner-only audit 조회/export 확인 |
| `audit-log-retention-smoke.js` | audit tail/rotate 정책 확인 |
| `admin-user-state-snapshot-smoke.js` | user state snapshot/restore API 확인 |
| `user-state-snapshot-retention-smoke.js` | snapshot retention 확인 |
| `search-cache-only-no-network-smoke.js` | 서버 요청 없는 검색에서 content API fetch가 발생하지 않는지 확인 |
| `search-worker-client-smoke.js` | Web Worker 검색 fallback/결과 호환 확인 |
| `search-cache-manifest-smoke.js` | search cache manifest와 권한 회수 purge 확인 |
| `reader-small-episode-chunk-boundary-smoke.js` | v383 small 2-chunk seam 안정화 확인 |
| `reader-append-seam-anchor-correction-smoke.js` | v390 append seam anchor correction 확인 |
| `reader-native-forward-scroll-retain-smoke.js` | v430 active native forward scroll 중 chunk-window append/render anchor 보정 억제 확인 |

## timeout 처리 기준

sandbox에서 긴 smoke가 timeout될 수 있다. 이 경우 다음처럼 보고한다.

- 어떤 그룹/명령이 timeout됐는지
- 출력상 어디까지 통과했는지
- timeout된 명령을 개별 재실행했는지
- 개별 재실행 결과가 통과/실패/미검증인지

## package-lock 정책

`package-lock.json`은 v530부터 최종 ZIP에 포함한다. `node_modules/`, `.npm-cache/`, `data/`는 계속 제외한다.

## v411 smoke additions

- `search-local-default-no-network-smoke.js`: 검색 모달 기본값이 서버 요청 없이 cache/loaded 범위만 스캔하는지 확인한다.
- `admin-operational-diagnostics-smoke.js`: `/api/admin/diagnostics`의 `summary/findings/checklist`와 owner UI 렌더링 hook을 확인한다.
- `admin-preflight-ui-smoke.js`: owner 콘솔 배포 전 점검 버튼과 `healthz/time/diagnostics` preflight wiring을 확인한다.
- `release-archive-backup-smoke.js`: ZIP과 별도로 `.tar.gz` 백업 패키징을 검증한다.


## v417 smoke additions

- `skeleton-ui-smoke.js`: 앱 셸 first paint, 라이브러리, reader, 검색, owner 콘솔 skeleton placeholder와 runtime marker를 확인한다.


## v417 owner actions / release verify

- owner 콘솔의 사용자 생성, 수정, 활성 전환, 세션 강제 만료, 계정 삭제, 비밀번호 초기화 wiring은 `public/scripts/admin/actions.js`로 분리한다.
- 운영 진단과 배포 전 점검은 카드형 요약과 `details` 기반 원본 JSON을 함께 제공한다.
- `npm run release:verify -- <zip>`는 ZIP integrity, 금지 항목, precompressed hash, current-version lint, owner split smoke, frontend check를 clean extract에서 확인한다.
- 검색 모달에서 제거된 대소문자 구분/캐시 전용 옵션은 `search-option-dead-code-smoke`로 재도입을 방지한다.

## v436 cache hardening diagnostics smokes

- `tools/checks/reader-api-cache-hardening-smoke.js`: v434 conditional cache 유지, block-manifest stable access hash, ACL 변경 후 old ETag 304 재사용 금지 smoke 연결을 확인한다.
- `tools/checks/content-cache-io-diagnostics-smoke.js`: content cache I/O metrics marker, 숫자 counter, admin `ioDiagnostics` 연결, 민감 정보 비노출, release/cache smoke 연결을 확인한다.


## v437 owner diagnostics UI smoke

`admin-io-diagnostics-table-smoke.js`는 owner 콘솔이 `/api/admin/diagnostics`의 `ioDiagnostics`를 별도 표로 렌더링하고 기존 원본 JSON details를 유지하는지 확인한다.

## v438 reader API cold/warm smoke

- `tools/smoke_server_http.js`: content chunk와 block-manifest의 first/repeat 요청 시간을 측정하고, repeat 요청이 비정상적으로 느려지는 회귀를 감지한다.
- `tools/checks/reader-api-cold-warm-cache-smoke.js`: cold/warm timing marker, monotonic clock 사용, cache/release smoke 연결, reader virtual layout 비의존성을 정적으로 확인한다.
- marker: `v438-reader-api-cold-warm-cache-smoke-pass`, `v438-reader-api-cold-warm-cache-static-smoke-pass`.



## v439 measured cache strategy smoke

- `tools/checks/cache-strategy-adjustment-smoke.js`: content async miss가 known-signature loader를 사용해 중복 stat을 만들지 않는지, library hot hit가 deep-signature TTL 안에서 root stat을 생략하는지, block-manifest cache hit/miss metrics가 증가하는지 확인한다.
- marker: `v439-cache-strategy-adjustment-smoke-pass`, `v439-cache-strategy-adjustment-pass`, `v439-library-cache-strategy-pass`, `v439-block-manifest-cache-strategy-pass`.


## v503 owner/developer diagnostics CSS split smoke

- smoke: `tools/checks/admin-owner-css-split-review-smoke.js`
- marker: `v503-owner-css-split-smoke-pass`, `v503-owner-css-split-pass`.
- Purpose: verify `owner.css` owns Developer Debug / Recovery Center modal and cache-management layout rules, `app.css` no longer contains those extracted owner rules, and `sync-devtools.mjs` lazy-loads `/styles/owner.css?v=rebuild-v553` before opening owner tools.
- `source-loader.js`, `css-ownership-guards.js` and `css-app-shell-ownership-report.js` read ownerCssSource so frontend ownership checks still guard Recovery/Developer Debug selectors after the split.

## v440 admin/owner CSS split review smoke

- smoke: `tools/checks/admin-owner-css-split-review-smoke.js`
- marker: `v440-admin-owner-css-split-review-smoke-pass`, `v440-admin-owner-css-split-review-pass`.
- Purpose: verify the owner console keeps using `/styles/admin-users.css?v=rebuild-v553`, reader shells keep using `styles/app.css?v=rebuild-v553`, and admin-only selectors do not drift into reader `app.css`.
- This is a boundary/review smoke only; it does not split reader CSS, modify reader selectors, or require browser visual regression fixtures.

## v441 modulepreload/cache boundary smoke

- smoke: `tools/checks/modulepreload-cache-policy-boundary-smoke.js`.
- marker: `v441-modulepreload-cache-policy-boundary-pass`.
- Purpose: keep queryless modulepreload URLs, queryless rebuild ESM revalidation, versioned rebuild ESM immutable caching, and precompressed sidecar header parity aligned.

## v441 owner session entry redirect smoke

- smoke: `tools/checks/owner-session-entry-redirect-smoke.js`.
- marker: `v441-owner-session-entry-redirect-smoke-pass`, runtime marker `v441-owner-session-entry-redirect-pass`.
- Purpose: if an existing owner session opens `/`, `/index.html`, `/site.html`, or `/mobile.html`, the server redirects to `/admin/users.html` instead of serving the reader shell. Reader sessions still receive the reader shell normally.


## v442 cache diagnostics / invalidation / deployed header smokes

- `tools/checks/cache-metrics-threshold-diagnostics-smoke.js`: `/api/admin/diagnostics`가 `ioDiagnostics.thresholds`와 `v442-cache-metrics-threshold-diagnostics-pass` marker를 노출하고, owner UI가 threshold 표를 렌더링하는지 정적으로 확인한다.
- `tools/checks/cache-invalidation-contract-smoke.js`: novels/content/block-manifest ETag scope가 사용자/accessVersion/권한/file/chunk/episode 범위를 유지하는지 확인하고, content file 변경 시 cache miss가 발생하는지 service smoke로 확인한다. marker는 `v442-cache-invalidation-contract-smoke-pass`이다.
- `tools/checks/deployed-cache-header-script-smoke.js`: 운영자가 실행할 `tools/check_deployed_cache_headers.js` 스크립트, `v442-deployed-cache-header-check-pass` marker, 문서 연결을 확인한다. 실제 외부 URL 호출은 release smoke에서 수행하지 않는다.

### v444 reader anchor trace export smoke

- Marker: `v444-reader-anchor-trace-export-smoke-pass`
- Runtime marker: `v444-reader-anchor-trace-export-pass`
- Diagnostics marker: `v444-reader-anchor-trace-diagnostics-pass`
- Purpose: verify that virtual layout diagnostics, recovery snapshots, and manual diagnostics carry bounded anchor trace evidence for both single-file and multi-file reader modes.
- Scope: diagnostics-only; the smoke must not require browser automation, library fixtures, or reader CSS changes.

## v445 reader body-anchor inertia retain smoke

`tools/checks/reader-body-anchor-inertia-retain-smoke.js` verifies `v445-reader-body-anchor-inertia-retain-pass`. It confirms that body-adjusted anchors preserve negative offsets in delta estimation and suppress small active/coasting native-scroll corrections that would otherwise kill scroll inertia.

## v445 reader anchor regression report smoke

`tools/checks/reader-anchor-regression-report-smoke.js` verifies `v445-reader-anchor-regression-report-pass`. It checks that the Recovery diagnostics panel exposes `앵커링 리포트 JSON` and that the report carries anchorTrace, virtualDiagnostics, current reader position, and progress without sensitive fields.

## v446 reader inertia fixture expansion smoke

`tools/checks/reader-inertia-fixture-expansion-smoke.js` verifies `v446-reader-inertia-fixture-expansion-pass`. It exercises single-file and multi-file 10~18KB-style fixtures around 50% and 70~80% scroll regions and confirms active/coasting body-anchor corrections do not write `scrollTop`.

## v446 reader safe-area body progress smoke

`tools/checks/reader-safe-area-body-progress-smoke.js` verifies `v446-safe-area-body-row-progress-pass`, `v446-safe-area-multi-file-body-progress-pass`, and `v446-safe-area-multi-file-null-manifest-fallback-pass`. It confirms a multi-file safe-area progress update does not treat a missing folder manifest as 0% and remaps a visible header row to the nearest body row before computing viewport progress.


## v447 reader multi-file progress stability smoke

`tools/checks/reader-multi-file-progress-stability-smoke.js` verifies `v447-reader-progress-stable-without-manifest-pass`. It confirms multi-file viewport progress near an append seam remains stable when estimated block metadata changes and no exact block manifest is available.

## v447 reader buffer append current chunk retain smoke

`tools/checks/reader-buffer-append-current-chunk-retain-smoke.js` verifies `v447-reader-buffer-append-current-chunk-retain-pass`. It confirms scroll-buffer append/prepend commits retain the previous visible `current.chunk` until viewport-derived progress updates it.

## v448 reader progress manifest adoption guard smoke

`tools/checks/reader-progress-manifest-adoption-guard-smoke.js` verifies `v448-reader-manifest-adoption-guard-pass` and `v448-reader-progress-phase-report-pass`. It confirms active native scroll in the 70~85% append-seam band keeps chunk-ratio fallback while an exact block manifest would otherwise move progress backward.

## v448 reader append seam 70~85 progress fixture smoke

`tools/checks/reader-append-seam-70-85-progress-fixture-smoke.js` verifies `v448-reader-append-seam-70-85-fixture-pass`. It covers 70%, 80%, and 85% seam-band fixtures so manifest adoption cannot reintroduce the bottom-bar oscillation seen around chunk attachment.
## v449 reader append inertia damp smoke

`tools/checks/reader-append-inertia-damp-smoke.js` verifies `v449-reader-scroll-buffer-append-inertia-extend-pass` and `v449-reader-append-micro-correction-damp-pass`. It covers the forward scroll-buffer append path where native scroll inertia can expire before chunk commit, and the post-append sub-block correction path that can cause small up/down reader shakes.
## v450 optimization smokes

- `tools/checks/reader-anchor-trace-low-overhead-smoke.js` checks `v450-reader-anchor-trace-low-overhead-pass`, verifies anchor trace diagnostics expose push/drop counters, and guards against the old trace array copy path returning to the scroll hot path.
- `tools/checks/precompressed-static-metadata-cache-smoke.js` checks `v450-precompressed-static-metadata-cache-pass`, verifies cached stat reuse for `.br`/`.gz` sidecar selection, and keeps the precompressed middleware wired before `express.static`.


## v451 iPad/touch coast retain smoke

`tools/checks/reader-ipad-touch-coast-retain-smoke.js` verifies `v451-reader-ipad-scroll-coast-retain-pass` and `v451-reader-anchor-report-live-state-pass`. It covers the iPad 12.9 diagnostics case where touch/native scroll coast can outlive the short scroll-active grace window and where `앵커링 리포트 JSON` previously reported stale `single-file`/empty current state while virtual diagnostics showed multi-file rows.


## v452 optimization smoke bundle

- `tools/checks/library-catalog-performance-smoke.js` verifies `v453-library-catalog-performance-pass` and `v453-novels-api-payload-budget-pass` for `/api/novels` payload metrics and auth-scoped response cache boundaries.
- `tools/checks/search-worker-warm-start-smoke.js` verifies `v453-search-worker-warm-start-pass` and ensures the search UI prewarms/reuses the existing worker client.
- `tools/checks/reader-row-measure-cache-diagnostics-smoke.js` verifies `v453-reader-row-measure-cache-diagnostics-pass` diagnostics shape for row pool and measure cache hit/miss selection work.
- `tools/checks/static-asset-preload-budget-smoke.js` records static entry/preload asset sizes and verifies precompressed sidecar coverage.

## v453 optimization smoke bundle

- `node tools/checks/novels-api-response-cache-budget-smoke.js` verifies `/api/novels` response-cache budget headers, normal miss-to-hit behavior, byte diagnostics, and oversized-entry skip handling.


## v488 reader anchoring stability contract smoke

- `node tools/checks/reader-anchoring-stability-contract-smoke.js`
- 목적: v487에서 안정화된 reader anchoring/slider/fileChar 좌표계 보호 문서가 누락되거나, 핵심 금지 항목이 빠지는 것을 막는다.
- 이 smoke가 실패하면 최적화 작업자는 reader 관련 파일을 수정하기 전에 `docs/reader-anchoring-stability-contract.md`를 먼저 갱신해야 한다.
- Marker: `v488-reader-anchoring-stability-contract-smoke-pass`.

## v491 folder mutation permission and action visibility smoke

- Command: `node tools/checks/folder-mutation-permission-smoke.js`
- Purpose: verify owner-managed `folderMutationAccess` normalization, admin create/edit/signup payload wiring, folder picker wiring for move/delete permissions, `/api/user-access/snapshot` propagation, restricted user access to folder move/delete routes, and library action sheet hiding of unauthorized mutation buttons.
- Marker: `v491-folder-mutation-picker-permission-smoke-pass`.


## v492 library drag permission smoke

- Command: `node tools/checks/folder-mutation-permission-smoke.js`
- Purpose: extend the v491 folder mutation permission smoke so user sessions without folder move permission cannot start native library drag for folders, novels, or episodes, and drop handling rejects crafted unauthorized drag payloads before calling the move API.
- Marker: `v492-library-drag-permission-ui-pass`.

## v493 folder mutation policy smoke

- Command: `node tools/checks/folder-mutation-permission-smoke.js`
- Purpose: verify `folderMutationAccess ⊆ libraryAccess`, source folder library access checks, user delete `DELETE:<categoryPath>` confirmation, user folder move/delete audit markers, and client-side libraryAccess target gating for action sheet, drag/drop, and move picker direct input.
- Marker: `v493-folder-mutation-policy-smoke-pass`.


## v494 owner console layout smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Purpose: verify the owner console keeps the compact user management grid, explicit operation named areas, bounded tall admin cards, diagnostics 12-column output grid, and responsive fallbacks.
- Historical marker: `v494-admin-owner-layout-smoke-pass`. Current smoke file advances the active marker for the latest package.


## v495 cache threshold card layout smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Purpose: verify the owner operations diagnostics layout keeps `Cache metric thresholds` full-width inside the compact 12-column diagnostics grid so value/threshold columns remain readable.
- Marker: `v495-cache-threshold-card-layout-pass`.


## v496 user management horizontal layout smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Purpose: verify the owner user-management tab keeps create/list/edit cards in a horizontal desktop/medium layout, compacts create/edit forms into two-column grids, and falls back to block layout on mobile.
- Marker: `v496-admin-user-horizontal-layout-pass`.

## v497 user management horizontal readability smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Historical marker: `v497-admin-user-horizontal-layout-pass`.
- Purpose: verify the owner user-management tab uses a forced horizontal flex row from 720px upward, the create card keeps enough width for folder pickers, and long folder names wrap instead of overlapping.
- Reader anchoring stability files are outside this smoke scope.


## v498 user management cascade-audited layout smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Marker: `v499-admin-user-item-row-layout-pass`.
- Purpose: verify the owner user-management tab uses the final admin users scoped 3-column grid override from 600px upward, keeps create/list/edit cards in a single horizontal row with horizontal overflow instead of medium-width vertical stacking, renders folder mutation pickers full-width inside cards, caps folder depth indentation, and keeps long folder names wrapped.
- Reader anchoring stability files are outside this smoke scope.


## v499 user management item-row layout smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Marker: `v499-admin-user-item-row-layout-pass`.
- Purpose: verify the owner user-management tab keeps create/list/edit cards in one horizontal row, and that each user create/edit `.field` renders as a label-left/control-right row instead of a vertical label/input stack.
- Also verifies readable folder picker height, capped deep folder indentation, and long folder path wrapping.
- Reader anchoring stability files are outside this smoke scope.

## v500 user management three-panel redesign smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Marker: `v502-admin-user-workbench-tabs-pass`.
- Purpose: verify the owner user-management tab is designed as a true three-panel horizontal UI (`사용자 생성 | 사용자 목록 | 사용자 편집`), with grouped create/edit form sections, horizontal user-list rows, readable folder picker panels, and mobile block fallback only below 720px.
- Reader anchoring stability files are outside this smoke scope.


## v501 owner 사용자 관리 강제 가로 배치

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Marker: `v502-admin-user-workbench-tabs-pass`.
- Purpose: verify that the owner 사용자 관리 tab keeps `사용자 생성 | 사용자 목록 | 사용자 편집` as a horizontal flex row even on narrow viewports, using horizontal scroll instead of a vertical fallback.


## v502 owner user-management workbench smoke

- Command: `node tools/checks/admin-owner-layout-smoke.js`
- Marker: `v502-admin-user-workbench-tabs-pass`.
- Purpose: prevent the owner 사용자 관리 UI from regressing to three visible vertical lanes. The smoke checks horizontal workbench tabs, single active panel behavior, hidden inactive panels, wide panel grid CSS, and horizontal user-list row regions.


### admin-owner-css-split-review-smoke.js v505 note

- Also verifies `v505-owner-modal-hidden-bootstrap-pass`: `app.css` keeps only the hidden bootstrap for lazy owner tool DOM, while rich Recovery Center / Developer Debug positioning and cache-management layout remain in `owner.css`.

### admin-owner-css-split-review-smoke.js v506 note

- Also verifies `v506-owner-css-residual-split-pass`: residual Recovery Center / Developer Debug detail selectors must live in `owner.css`, while `app.css` keeps only the owner-tool hidden bootstrap and Settings launch styling.


## v507 CSS boundary and search speed smoke

- `tools/checks/css-html-boundary-contract-smoke.js`: HTML/page/fragment 단위 CSS 분리 경계를 고정한다. Reader shells는 `app.css`, owner admin page는 `admin-users.css`, Developer Debug / Recovery Center fragment는 lazy-loaded `owner.css`를 사용하며, app.css에는 owner modal hidden bootstrap만 남아야 한다. Marker: `v507-css-html-boundary-contract-pass`.
- `tools/checks/search-full-scan-speed-smoke.js`: 전체검색 server-friendly network concurrency 1~3, live/current concurrency 1~3, worker batch size 2~5, worker cachebuster `rebuild-v553`, cache-only/no-network concurrency 4을 고정한다. Markers: `v508-search-full-scan-concurrency-tune-pass`, `v508-search-live-full-scan-concurrency-pass`, `v508-search-worker-batch-size-tune-pass`.
## v508 search concurrency and library scroll stability smoke

- `tools/checks/search-full-scan-speed-smoke.js`: 전체검색 server-friendly network concurrency 1~3, live/current full scan concurrency 1~3, worker batch size 2~5, worker cachebuster `rebuild-v553`, cache-only/no-network concurrency 4을 고정하고 dynamic single-file search가 chunk를 하나씩 fetch하지 않는지 확인한다. Markers: `v508-search-full-scan-concurrency-tune-pass`, `v508-search-live-full-scan-concurrency-pass`, `v508-search-worker-batch-size-tune-pass`.
- `tools/checks/search-multi-episode-full-scan-smoke.js`: 다중파일 전체검색이 episode/file target을 순차 처리하지 않고 bounded target queue로 병렬 처리하는지 확인한다. Marker: `v508-search-multi-episode-target-concurrency-pass`.
- `tools/checks/library-virtual-scroll-row-height-freeze-smoke.js`: 라이브러리 virtual renderer가 `virtual-scroll` 중 현재 window row 높이로 rowHeight를 재계산하지 않고 stable row height를 유지하는지 확인한다. Marker: `v508-library-virtual-scroll-row-height-freeze-pass`.

## v509 smoke additions

- `tools/checks/search-full-scan-speed-smoke.js`: verifies adaptive full-search markers, client-tier profile, fetch/worker feedback hooks, v509 worker cachebuster, and live single-file search not falling back to strict one-by-one scanning.
- `tools/checks/search-modal-close-abort-smoke.js`: verifies the search modal X button aborts the active search run and records `v509-search-modal-close-abort-pass`.
- `tools/checks/library-virtual-scroll-window-hold-smoke.js`: verifies virtual-scroll DOM replacement is skipped while the visible range remains inside the cached rendered window.

## v510 library/reader anchoring smoke additions

- `node tools/checks/library-virtual-scroll-anchor-restore-smoke.js` verifies that virtual-scroll renders capture the current top library row, feed it into window metrics, and restore it after DOM replacement.
- `node tools/checks/reader-unified-append-restore-policy-smoke.js` verifies that multi-file append restores first pass through the unified native-scroll ownership policy before older correction guards.

Markers: `v510-library-virtual-scroll-anchor-restore-pass`, `v510-reader-unified-append-restore-policy-pass`.
## v511 reader/library scroll stability smoke updates

- `node tools/checks/reader-unified-append-restore-policy-smoke.js` now also verifies `v511-reader-unified-append-measure-policy-pass`: measure-commit correction must reuse the unified native-forward append policy before older correction guards can adjust scrollTop.
- `node tools/checks/library-virtual-scroll-anchor-restore-smoke.js` now also verifies `v511-library-virtual-anchor-single-restore-pass` and `v511-library-scroll-anchor-bottom-clamp-pass`: virtual-scroll anchor restore owns the scrollTop adjustment once, and anchor fallback writes are thresholded/clamped.
- `node tools/checks/library-virtual-scroll-window-hold-smoke.js` now also verifies `v511-library-virtual-scroll-bottom-edge-hold-pass`: cached windows that already include the final rows may hold DOM replacement at the bottom edge.

### v517 library virtual scroll restore decision

- `node tools/checks/library-virtual-scroll-restore-decision-smoke.js` verifies that virtual-scroll window replacement uses a single restore decision path, suppresses stale missing-anchor scrollTop fallback during native virtual scroll, softens row-anchor correction threshold, and prefers bottom-distance retention at the list edge.
- Markers: `v517-library-virtual-scroll-restore-decision-pass`, `v517-library-scroll-anchor-virtual-bottom-retain-pass`, `v517-library-virtual-scroll-restore-decision-smoke-pass`.

- `node tools/checks/library-virtual-scroll-prefetch-window-smoke.js` verifies that virtual-scroll renders use a wider prefetch window and refresh cached windows earlier near their edges, reducing late DOM attachment during fast library scrolling.
- Markers: `v518-library-virtual-scroll-prefetch-overscan-pass`, `v518-library-virtual-scroll-early-edge-refresh-pass`, `v518-library-virtual-scroll-prefetch-window-smoke-pass`.
## v522
- v522-reader-multi-file-guard-cleanup-pass: 다중파일 리더에서 chunk seam 오인으로 추가됐던 manifest hold / seam anchor correction allowance를 비활성화하고, native append-boundary 소유권과 explicit target 경로로 guard 책임을 정리했다.



## v523 public icon alias smoke
- `tools/checks/public-asset-allowlist-smoke.js`: root favicon/apple-touch icon alias가 public path인지 확인하고 broad `.png`/`.ico` allowlist가 없는지 확인한다.
- `tools/smoke_server_http.js`: 실제 서버를 띄운 뒤 로그인 전 `/favicon.ico`와 `/apple-touch-icon.png`가 200으로 응답하고 `X-Public-Icon-Alias: v524-public-icon-alias-before-auth-pass`를 갖는지 확인한다.

## v526 owner diagnostics Cloudflare visitor smoke

- `node tools/checks/admin-cloudflare-visitor-diagnostics-smoke.js` verifies that owner diagnostics treats `DEPLOYMENT_MODE=cloudflare-tunnel`, `X-Forwarded-Proto=http`, and `CF-Visitor={"scheme":"https"}` as effective HTTPS, matching the login gate.
- It also verifies owner ops cards expose `effective protocol`, `X-Forwarded-Proto`, and `CF-Visitor` separately.
- Markers: `v526-admin-cloudflare-visitor-diagnostics-pass`, `v526-admin-cloudflare-visitor-diagnostics-smoke-pass`.

### v528 Cloudflare Tunnel exposure diagnostics smoke

- `node tools/checks/admin-cloudflare-tunnel-exposure-diagnostics-smoke.js`
- 현재 요청의 Cloudflare header set 감지, `unknown-server-side` WAN 직접 노출 상태, NPM/Node WAN 차단 checklist, owner UI card marker를 확인한다.
- Marker: `v528-cloudflare-tunnel-exposure-diagnostics-pass`, smoke marker: `v528-cloudflare-tunnel-exposure-diagnostics-smoke-pass`.


### v530 owner diagnostics readability CSS smoke

- Command: `node tools/checks/admin-ops-diagnostics-readability-smoke.js`
- Purpose: verify owner 운영 상태 diagnostics CSS keeps Cloudflare Tunnel exposure diagnostics full-width, uses wider mini/finding grids, avoids narrow vertical word splitting, and keeps admin cachebusters on `rebuild-v553`.
- Marker: `v530-owner-diagnostics-readability-css-pass`, smoke marker: `v530-owner-diagnostics-readability-smoke-pass`.

## v530 security smoke additions

- `security-hardening-v530-smoke.js` checks lockfile inclusion, compose runtime install removal, session HMAC markers, CSRF localStorage removal, login rate limit keying, and TXT size limit markers.

## v535 security smoke additions

- `tools/checks/security-hardening-v535-smoke.js` checks IP-wide auth rate limits, user password minimum env clamping, production strict-origin fail-closed behavior, CSP opt-in exceptions, font upload body limits, and owner diagnostics surfacing.

## v534 search coverage preview scheduling smoke

- `tools/checks/search-coverage-preview-schedule-smoke.js`: verifies search modal open and post-search completion schedule the coverage preview instead of awaiting it, duplicate preview work is coalesced, cleanup cancels pending preview timers, and the search worker cachebuster matches `rebuild-v544`.
- Marker: `v534-search-coverage-preview-schedule-smoke-pass`.


## v536 theme/safe-area smoke

- `node tools/checks/theme-shortcut-safe-area-polish-smoke.js`
  - 상단바 테마 버튼이 HTML/body 다크모드 토글이 아니라 테마 편집 모달을 여는지 확인한다.
  - 네트워크 인디케이터가 theme 변수 기반 배경을 사용하는지 확인한다.
  - safe-area 중앙 gradient matte가 투명화되어 검정 배경만 남는지 확인한다.

## v537 search server-load mitigation smoke

- `tools/checks/search-server-load-mitigation-smoke.js`: verifies full search no longer calls `ensureBlockManifest()` from the search module, adaptive full-search concurrency caps are server-friendly, network full-search content requests carry `X-Search-Scan: 1`, `novels-routes` forwards the search-scan flag, and `content-service` skips sync chunk payload disk writes for search-scan cold misses while preserving normal reader payload writes. Marker: `v537-search-server-load-mitigation-smoke-pass`.
- `tools/checks/search-full-scan-speed-smoke.js`: now also verifies `v537-search-server-load-mitigation-pass`, `X-Search-Scan`, and the 3~6 / 1~3 server-friendly adaptive bounds.
- `tools/checks/search-multi-episode-full-scan-smoke.js`: now verifies multi-episode target concurrency is capped at 2 and content requests are marked as search scans.
## v538 disk cache auto-prune smoke

- `tools/checks/disk-cache-auto-prune-smoke.js`: verifies the server creates the disk cache janitor, exposes owner diagnostics, reads the new env knobs, deletes only runtime cache files under `data/chunk_indexes`, `data/content_chunks`, and `data/block_manifests`, and preserves user data outside the cache scopes. Marker: `v538-disk-cache-auto-prune-smoke-pass`.



## v539 search content cache limit smoke

- `tools/checks/search-content-cache-limit-smoke.js` validates that `CONTENT_FILE_CACHE_MAX_BYTES` and `CONTENT_FILE_CACHE_MAX_ENTRIES` are wired through env/app/docs/release history and runner coverage.
- Related search CPU smokes: `search-modal-close-abort-smoke.js`, `search-full-scan-speed-smoke.js`, `search-server-load-mitigation-smoke.js`.

- `tools/checks/content-worker-pool-abort-smoke.js`: verifies content worker-thread pool wiring, request-abort propagation from `/content` routes, `.env` controls, frontend search-worker termination on abort, and a small worker-backed content load when dependencies are installed. Marker: `v541-content-worker-pool-abort-smoke-pass`.
