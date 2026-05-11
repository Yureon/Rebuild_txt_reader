# v540 next-session handoff

Current basis is `txt_reader_multi_v541.zip`. v540 focused on the deployed-server block manifest CPU/IO issue: folder block-manifest builds are coalesced, hot repeated requests avoid immediate full stat sweeps, large builds yield between batches, and aggregate folder builds no longer fan out per-episode manifest JSON writes by default. Keep reader scroll/anchoring files untouched unless a fresh reproduction points there.

# v539 다음 세션 인수인계

현재 기준 ZIP은 `txt_reader_multi_v541.zip`이다. v539는 전체 검색 후 서버 CPU 코어 하나가 풀로드되는 문제를 줄이기 위한 검색/캐시 한정 패치다. 다음 세션에서는 반드시 `search.mjs` → `search/matcher.mjs` → `/content` route → `content-service.js` 경로를 실제 코드로 확인하고, reader anchoring/slider/progress/virtual-layout/block-manifest 코드는 건드리지 않는 것을 기본값으로 삼아야 한다.

핵심 변경 사항:

- 검색 모달 overlay 클릭, input Escape, results/navigation Escape 닫기 경로가 active `AbortController`를 abort한다.
- 결과 클릭 이동은 `results-view.mjs`의 `{ abort:false }` 옵션이 `search.mjs` callback을 통해 보존되어야 한다.
- 검색 network concurrency는 full/live 1~2, multi-episode target 1이다. 서버 단일 Node event loop 기준이다.
- `CONTENT_FILE_CACHE_MAX_BYTES` / `CONTENT_FILE_CACHE_MAX_ENTRIES`가 env에 추가되었고, `createContentService()`로 전달된다. 기본값은 `max(128MiB, MAX_TEXT_FILE_BYTES + 32MiB)`이다.
- 전체 검색 구조 자체는 아직 chunk별 `/content` 요청 방식이다. 장기 개선은 별도 서버 search endpoint + cancellation + semaphore + event-loop yielding으로 검토한다.

검증 우선순위:

1. `node tools/checks/search-modal-close-abort-smoke.js`
2. `node tools/checks/search-full-scan-speed-smoke.js`
3. `node tools/checks/search-server-load-mitigation-smoke.js`
4. `node tools/checks/search-content-cache-limit-smoke.js`
5. `npm run smoke:search`

# v532 다음 세션 인수인계

현재 기준 ZIP은 `txt_reader_multi_v533.zip`이다. v531에서 보안 강화를 위해 `package-lock.json`을 포함했으나, 사용자 환경에서 해당 lockfile이 GPT 내부 심볼릭 링크처럼 인식되어 외부 빌드가 불가능한 문제가 보고되었다. v532는 lockfile을 일반 파일로 재생성했고, ZIP/TAR 패키징 도구가 `package-lock.json` symlink를 거부하도록 보강했다.

다음 작업에서 패키징을 수행할 때는 반드시 `node tools/checks/package-lock-regular-file-smoke.js`를 실행하고, 산출 ZIP/TAR 안의 `package-lock.json`이 regular file인지 확인해야 한다. 기존 reader 안정화 보호 로직(v513/v519/v520/v521 등)은 건드리지 않는다.

# v527 security documentation note

Current baseline: `txt_reader_multi_v527.zip`. v527 is a documentation/smoke update. It does not change runtime server logic from v526. It documents the security precondition for v525/v526 Cloudflare Tunnel HTTPS trust: when `DEPLOYMENT_MODE=cloudflare-tunnel` trusts `CF-Visitor: {"scheme":"https"}`, the origin must not be directly reachable from the public WAN. Blocking only NPM admin port 81 is insufficient; NPM service ports 80/443 and the Node app port, usually 3000, must also be blocked from WAN/direct port-forwarding. External access must enter through Cloudflare Tunnel only.

# Next session handoff prompt

다음 세션에서 그대로 붙여넣어 사용할 인수인계 프롬프트입니다.

```text
웹 소설 뷰어 프로젝트 txt_reader_multi 작업을 이어서 진행해줘.

이번 작업 기준 파일은 내가 업로드하는 최신 ZIP이다.
현재 최신 작업 기준은 txt_reader_multi_v521.zip 이다.
중요 안정 기준은 txt_reader_multi_v489.zip 이며, v489는 reader anchoring / slider / progress / append-prepend chunk 안정화 이후 사용자가 체감상 튐 현상이 사라졌다고 평가한 기준이다.

반드시 지켜야 할 원칙:

1. 반드시 ZIP을 실제로 풀고, 관련 파일을 직접 열어 확인한 뒤 작업해줘.
2. 과거 대화 기억이나 함수명 추정만으로 수정하지 마.
3. 실제 이벤트 흐름과 데이터 흐름을 줄 단위로 따라가며 확인해줘.
4. 최소 변경으로 작업해줘.
5. 리팩터링, 포맷 변경, 불필요한 CSS 정리, 주변 구조 재작성은 하지 마.
6. 작업한 내용은 새 버전 ZIP으로 패키징해줘.
7. 통과했다고 보고하는 검증 명령은 실제로 실행한 명령만 적어줘.
8. 실제 기기 테스트를 하지 않았다면 반드시 “미수행”이라고 적어줘.
9. 새 guard를 계속 덧붙이는 방식은 피하고, 기존 guard 간 충돌 여부를 먼저 검토해줘.
10. reader 관련 작업은 반드시 안정화 계약 문서를 우선 적용해줘.

반드시 먼저 읽을 문서:

- docs/reader-anchoring-stability-contract.md
- docs/handoff.md
- docs/next-session-handoff-prompt.md
- docs/smoke-tests.md
- docs/reader-search-baseline.md
- docs/release-history.md
- docs/performance-cache.md

reader 안정화 보호 기준:

- `docs/reader-anchoring-stability-contract.md`를 최우선 보호 계약으로 적용한다.
- v520 기준으로 v513 unified viewport restore, v516 nav slider anchor offset, v519 margin-aware row measurement, v520 nav-slider in-window jump, v520 actual DOM bottom progress trust를 보호한다.
- v521: 전체화면/브라우저 viewport 전환 시 전환 직전 anchor를 캡처하고, fullscreen/pseudo fullscreen/viewport-fit/visualViewport/window resize 단계에서 기존 viewport anchor restore를 explicit으로 재사용한다. fullscreen 관련 문제를 볼 때는 `v521-reader-viewport-transition-anchor-pass`와 `lastViewportTransitionAnchor`를 먼저 확인한다.

- server block manifest의 block별 char range, fileCharIndex 기반 append/prepend anchor restore, native forward/backward measure freeze, 하단 slider fileChar 우선 progress, touch-coast slider thumb settle, append/prepend scrollTop diagnostic, reader debug snapshot/recovery diagnostics, anchoring stability smoke를 임의로 정리하지 않는다.
- Reader 보호 대상 파일은 수정 가능하지만 반드시 줄 단위 검토 후 최소 변경한다.

보호 대상 파일:

- public/scripts/rebuild/features/reader.mjs
- public/scripts/rebuild/features/reader/virtual-layout.mjs
- public/scripts/rebuild/features/reader/progress.mjs
- public/scripts/rebuild/features/reader/coordinates.mjs
- public/scripts/rebuild/features/reader/chunk-window.mjs
- public/scripts/rebuild/features/reader/scroll-side-effects.mjs
- server/services/block-manifest-service.js

v511에서 적용된 변경:

- Reader: `virtual-layout.mjs`에서 기존 `resolveUnifiedAppendRestorePolicy()`를 measure-commit 경로에도 적용했다. 다중파일 native forward append/active settle 중에는 fileChar/body/manifest correction 계열이 scrollTop을 되돌리기 전에 unified policy가 먼저 native scrollTop 소유권을 판단한다. Marker: `v511-reader-unified-append-measure-policy-pass`.
- Reader 보호 대상 중 실제 수정 파일은 `public/scripts/rebuild/features/reader/virtual-layout.mjs`뿐이다. `reader.mjs`, `progress.mjs`, `coordinates.mjs`, `chunk-window.mjs`, `scroll-side-effects.mjs`, `server/services/block-manifest-service.js`는 수정하지 않았다.
- Library: virtual-scroll top-row anchor가 있을 때 fragment 적용 단계의 기존 scrollTop 복원을 생략하고 anchor restore 단일 경로가 보정하도록 했다. Marker: `v511-library-virtual-anchor-single-restore-pass`.
- Library: `restoreLibraryScrollAnchor()`가 scrollTop을 threshold/clamp 처리해 경계/최하단에서 반복 보정을 줄인다. Marker: `v511-library-scroll-anchor-bottom-clamp-pass`.
- Library: cached window가 이미 최하단 row를 포함하는 경우 bottom edge hold를 허용한다. Marker: `v511-library-virtual-scroll-bottom-edge-hold-pass`.
- 갱신 smoke: `reader-unified-append-restore-policy-smoke.js`, `library-virtual-scroll-anchor-restore-smoke.js`, `library-virtual-scroll-window-hold-smoke.js`.





v516 reader 하단바 slider anchor-offset 보정:
- v516은 다중파일 현재 화 내부 하단바 jump가 target ratio와 어긋나는 문제를 줄이기 위해 `scrollToVirtualTarget()`의 nav-slider target offset을 정리했다.
- 실제 이동 경로는 `commitNavSliderPosition()` → `goSliderPosition()` → `goPercent()` → `ratioToChunkTarget()` → `goChunkInternal()` → `scrollToVirtualTarget()`이다.
- multi-file slider는 현재 계약상 현재 화 내부 local ratio다. `folderRatioToEpisodeTarget()`을 다시 연결하지 말고, v380 local slider smoke를 우선한다.
- progress는 36px viewport anchor 기준으로 fileChar/documentRatio를 계산하므로 nav-slider direct block target과 pure ratio fallback도 `VIRTUAL_SCROLL_STABILITY_ANCHOR_OFFSET_PX`를 사용한다. Terminal 100%는 기존 bottom 정렬을 유지한다.
- Marker: `v516-reader-nav-slider-anchor-offset-target-pass`.


v515 reader 하단바 slider 네비게이션 보정:
- v515는 하단바 slider의 실제 이동 commit을 `change` 이벤트에만 의존하지 않도록 수정했다. `input`은 pending ratio를 기록하고 preview만 수행하며, `change`와 `pointerup`/`touchend`/`blur`/`pointercancel`이 `commitNavSliderPosition()`을 통해 실제 `goSliderPosition()`을 호출한다.
- 중복 commit은 `navSliderCommitInFlight`/`navSliderQueuedCommit`으로 정리한다.
- v513에서 체감상 reader 튐이 사라진 `virtual-layout.mjs` unified viewport restore policy와 v514 `progress.mjs` terminal sync는 유지한다.
- 1~2줄 정도 조기 100% 도달은 안정성을 우선해 추가 보정하지 않았다. 더 조정하려면 실제 브라우저 진단에서 `lastReaderNavTerminalProgressSync.mode`와 slider value/scrollTop을 먼저 확인한다.

v514 reader 하단바 진행률 보정:
- v513에서 reader 튐은 사용자 실기기 피드백상 사라진 것으로 평가되었다. 따라서 v513의 `restoreVirtualViewportAnchor()` unified policy는 유지한다.
- 남은 문제는 하단바/슬라이더 진행률이었다. 최하단인데 100%가 아니거나, 실제 최하단 전에 100%가 먼저 표시되는 증상이다.
- v514는 `public/scripts/rebuild/features/reader/progress.mjs`에 `resolveNavTerminalProgressAddress()`를 추가했다. `getChunkViewportState()`의 trusted bottom 판정이 true일 때만 nav/safe/snapshot 진행률을 100%로 맞춘다. trusted bottom이 아닌데 fileChar/documentRatio가 100% 근처로 먼저 올라오면 pre-terminal cap을 적용해 slider value가 1000으로 조기 반올림되지 않게 한다.
- 진단은 `app.state.lastReaderNavTerminalProgressSync.mode`를 확인한다: `trusted-terminal-100`, `pre-terminal-cap`, `normal`.
- scrollTop restore/append/prune/measure guard는 v514에서 변경하지 않았다.

v512/v513 reader guard 정리:

- v512는 non-body seam/header anchor suppression을 trial로 적용했으나, 사용자 실기기 피드백상 개선/악화가 없었다. v513에서는 `resolveSeamNonBodyAnchorSuppress()`와 `v512-reader-seam-non-body-anchor-suppress-pass` marker를 제거했다.
- v513에서 75~100% 구간을 검토한 결과, 비율 기반 `resolveManifestAdoptionDocumentRatio()`는 progress/slider documentRatio 계열이며 직접 `scrollTop`을 쓰지 않는다. 직접 scrollTop을 조정하는 핵심 경로는 append/render-window/measure/prune viewport restore다.
- v510은 append restore, v511은 measure-commit에 `resolveUnifiedAppendRestorePolicy()`를 적용했다. v513은 남아 있던 `restoreVirtualViewportAnchor()`에도 동일 policy를 correction/micro/fallback보다 먼저 적용했다. Marker: `v513-reader-unified-viewport-restore-policy-pass`.
- 다음 세션에서 실제 다중파일 75~100% 테스트 후 여전히 튐이 있으면 새 guard를 추가하기보다 `lastUnifiedAppendRestorePolicy`, `lastScrollStability`, `lastRenderWindowStability`, `lastAppendSeamScrollTopDiagnostic`, anchor trace의 phase/rowType/deltaPx를 기준으로 어떤 scrollTop writer가 실행되는지 먼저 확인한다.


v519 reader row measured margin height 보정:
- 사용자 제공 anchoring JSON에서 `totalChunks: 1`인 다중파일 단일 chunk episode인데 `virtualRemainingBottom: 0`, 실제 DOM `remainingBottom: 559`가 동시에 기록되었다. Append seam 진단은 null이므로 chunk append 문제가 아니라 virtual height accounting mismatch다.
- `.reader-vrow-body{margin:0 0 .86em;}`인데 기존 `collectVirtualMeasureUpdates()`는 `getBoundingClientRect().height`만 저장해 margin-bottom을 measureCache/prefix/totalHeight에서 누락했다.
- v519는 `measureVirtualRowOuterHeight()`를 추가해 row rect height + computed marginTop/marginBottom을 measureCache에 저장한다. Diagnostic은 `rowMeasuredMarginHeightPass`, `lastRowMeasuredMarginHeight`로 확인한다.
- 이 변경은 단일파일에서도 동일한 virtual/actual bottom 오차 가능성을 줄인다. 다만 단일파일은 episode boundary/folder progress/bottom guard가 덜 겹쳐 증상이 덜 드러났을 가능성이 높다.
- v513 unified viewport restore, v516 nav-slider anchor offset, v517/v518 library virtual scroll 개선은 되돌리지 않는다.

다음 우선 확인 작업:

- reader 다중파일 80~95% 구간 실제 확인.
- chunk append 직후 native forward scroll 유지 여부 확인.
- 라이브러리 긴 폴더 목록 스크롤 관성/최하단 처리 실제 확인.
- 문제가 남으면 새 guard 추가가 아니라 decision log를 기준으로 기존 guard 통합/정리를 계속 진행.
```


현재 최신 흐름:

- v513: reader 75~100% 구간 튐은 `restoreVirtualViewportAnchor()`에 unified append restore policy를 적용하면서 사용자가 체감상 사라졌다고 평가했다. 이 로직은 보호한다.
- v514: 하단바 terminal progress sync를 적용했다. 1~2줄 조기 100% 정도는 회귀 위험 때문에 추가 보정하지 않는다.
- v515: 하단바 slider release commit을 추가했다.
- v516: 다중파일 현재 화 내부 slider jump target offset을 progress anchor와 맞췄고, 사용자가 정상 동작한다고 확인했다.
- v518: 소설 목록 virtual-scroll prefetch window를 넓혔다. 빠른 스크롤에서 가상화 범위를 넘어간 영역이 늦게 붙는 끊김을 줄이기 위해 virtual-scroll overscan을 48 row, maxWindowRows를 420으로 조정하고 cached-window edge refresh margin을 12~32 row로 넓혔다. Reader anchoring/progress/slider는 변경하지 않았다.
- v517: 소설 목록 virtual-scroll restore decision을 정리했다. `virtual-scroll` 중 stale missing-anchor fallback scrollTop 쓰기를 억제하고, row-anchor threshold를 4px로 완화하며, 최하단 근처는 bottom-distance retain을 우선한다.

소설 목록 스크롤 보호/확인 대상:

- `public/scripts/rebuild/features/library-scroll-anchor.mjs`
- `public/scripts/rebuild/features/library-virtual-render-runtime.mjs`
- `public/scripts/rebuild/features/library-virtual-window-renderer.mjs`
- `public/scripts/rebuild/features/library-virtual-render-cache.mjs`
- `public/scripts/rebuild/features/library-virtual-render-reporting.mjs`

주의:

- library virtual-scroll 중 scrollTop writer는 `applyLibraryVirtualWindowFragment()`와 `restoreLibraryScrollAnchor()` 두 계열이다. 중복 scrollTop 복원을 늘리지 말고 decision을 한 곳으로 모아야 한다.
- 긴 목록 관성/최하단 문제가 남으면 새 guard 추가 전에 `app.state.libraryVirtualLastScrollAnchorRestore`와 `app.state.libraryScrollAnchorLastRestore`의 `restoreMode`, `nearBottom`, `bottomDistance`, `applied`, `delta`를 먼저 확인한다.
## v522
- v522-reader-multi-file-guard-cleanup-pass: 다중파일 리더에서 chunk seam 오인으로 추가됐던 manifest hold / seam anchor correction allowance를 비활성화하고, native append-boundary 소유권과 explicit target 경로로 guard 책임을 정리했다.



서버/PWA 아이콘 alias 주의:
- v523 기준으로 로그인 전 `/favicon.ico`, `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`는 `server/app.js`의 auth gate 이전 alias route에서 처리한다.
- 실제 파일은 `public/icon/favicon.ico`, `public/icon/apple-icon-180x180.png`다.
- broad `.png`/`.ico` allowlist를 추가하지 말고 exact path만 유지한다.
- 관련 marker: `v524-public-icon-alias-before-auth-pass`.

서버/PWA 로그인 아이콘 주의 v524:
- v523에서 서버 alias는 로그인 전 200이었지만 login.html이 manifest/favicon/apple-touch 링크를 선언하지 않아 로그인 화면에서 PWA/파비콘 탐색이 충분하지 않았다.
- v524는 `public/login.html` head에 `/manifest.json?v=rebuild-v534`, `/icon/apple-icon-180x180.png`, `/icon/favicon-32x32.png`, `/icon/favicon-16x16.png`를 명시한다.
- `server/app.js`의 auth gate 이전 exact alias와 `server/middleware/auth.js`의 exact allowlist만 유지한다. broad `.png`/`.ico` 공개 금지.
- 검증: `public-asset-allowlist-smoke.js`, `smoke_server_http.js` pre-auth login/PWA asset checks.
서버/Cloudflare Tunnel HTTPS 판정 주의 v525:
- 사용자의 실제 echo 헤더에서 `x-forwarded-proto=http`, `cf-visitor={"scheme":"https"}` 조합이 확인됐다.
- v525는 `DEPLOYMENT_MODE=cloudflare-tunnel`일 때만 `CF-Visitor`의 `scheme=https`를 `NODE_ENV=production` 로그인 HTTPS gate 통과 조건으로 인정한다.
- origin이 Cloudflare Tunnel 외부로 직접 노출되면 `CF-Visitor` 위조 위험이 있으므로 이 전제를 문서와 배포 설정에서 유지해야 한다.
- `trusted-proxy`/`direct` 모드에서는 `CF-Visitor`를 신뢰하지 않는다.


서버/Cloudflare Tunnel owner diagnostics 주의 v526:
- 로그인 HTTPS gate와 owner 운영 상태의 판정 기준을 맞췄다.
- `DEPLOYMENT_MODE=cloudflare-tunnel`에서 `X-Forwarded-Proto=http`이더라도 `CF-Visitor: {"scheme":"https"}`가 있으면 owner diagnostics는 effective protocol을 https로 보고 production cookie 정책을 정상으로 표시한다.
- 이 신뢰는 Cloudflare Tunnel 모드에서만 유효하다. origin Node/NPM이 외부에 직접 노출되지 않는다는 전제를 깨지 마라.
- 관련 파일: `server/services/admin-diagnostics-service.js`, `public/scripts/admin/ops.js`, `tools/checks/admin-cloudflare-visitor-diagnostics-smoke.js`.

## v528 추가 인수인계 - Cloudflare Tunnel 노출 진단

v528은 owner 운영 상태에 Cloudflare Tunnel 노출 진단을 추가했다. 서버는 WAN에서 NPM/Node 포트가 직접 열려 있는지 단독으로 확정하지 않는다. 대신 현재 요청의 Cloudflare header 존재 여부와 operator checklist를 표시한다.

관련 파일:
- `server/services/admin-diagnostics-service.js`
- `public/scripts/admin/ops.js`
- `tools/checks/admin-cloudflare-tunnel-exposure-diagnostics-smoke.js`

보호할 판단:
- `DEPLOYMENT_MODE=cloudflare-tunnel`에서 `CF-Visitor` 신뢰는 origin/NPM/Node가 WAN에 직접 노출되지 않는다는 운영 전제가 있어야 한다.
- owner 운영 상태는 이 전제를 자동으로 안전하다고 확정하지 말고 `unknown-server-side`로 표시해야 한다.


## v530 추가 인수인계 - owner 운영 상태 CSS 가독성

현재 기준은 `txt_reader_multi_v531.zip`이다. v530는 owner 운영 상태 화면 CSS만 정리했다. 스크린샷 기준 문제였던 Cloudflare Tunnel 노출 진단 카드의 세로 글자 쪼개짐, mini card 과도한 폭 축소, finding card 내부 table nested scroll을 완화했다. 서버 런타임/Cloudflare Tunnel 신뢰 판정/reader/library 로직은 수정하지 않았다.

보호할 사항:
- `v525-cloudflare-visitor-https-trust-pass`와 `v526-admin-cloudflare-visitor-diagnostics-pass`는 유지한다.
- `v528-cloudflare-tunnel-exposure-diagnostics-pass` 서버 진단 의미는 유지한다.
- v530는 `public/styles/admin-users.css`의 표현 계층 변경이다. 운영 상태 데이터 구조를 바꾸지 말 것.

## v530 continuation note

Continue from `txt_reader_multi_v531.zip`. Security hardening changed deployment packaging, session storage, login rate limiting, CSRF client storage, and TXT size limits. Do not revert the v530 package-lock inclusion policy. Expect existing sessions to be invalidated because plaintext session tokens are no longer trusted.

## v531 continuation note

Continue from `txt_reader_multi_v531.zip`. v531 finishes the previously deferred security hardening: `OWNER_PASSWORD_MIN_LENGTH` controls the production owner `LOGINPW` minimum length, defaulting to 14 with a hard lower bound of 10; `createEl({ html })` is disabled and reviewed HTML insertion must use `safeHtml`; owner diagnostics raw JSON is masked in the UI before rendering. Do not re-enable generic `html` attrs in `createEl`; use `text` for user-controlled values. Keep v530 session HMAC storage and package-lock inclusion policy.

## v533 follow-up note

Use v533 or later as the packaging baseline. Verify `package-lock.json` is a regular file and contains no `packages.applied-caas`, `internal.api.openai`, or other sandbox npm registry URLs. If Docker build fails with AppArmor/runc inside Proxmox LXC, treat it as host/LXC configuration, not as a project lockfile error.
# v534 current handoff note

Current baseline/output is `txt_reader_multi_v534.zip` with runtime marker `rebuild-v534`. v534 is a search responsiveness update: coverage preview scans are scheduled/coalesced instead of running synchronously on search open or being awaited after a completed search. Reader scroll/append paths were intentionally left untouched.

# v535 current handoff note

Current baseline/output is `txt_reader_multi_v535.zip` with runtime marker `rebuild-v535`. v535 applies the security review follow-ups only: login/register IP-wide outer throttles, `USER_PASSWORD_MIN_LENGTH` default/lower-bound 8, production strict-origin fail-closed behavior when `APP_ORIGIN`/`URL` are empty, CSP Cloudflare/blob opt-in flags, and font upload raw parser limit reduced to 8 MiB. Reader scroll/append paths were intentionally left untouched.


### v536 추가 인수인계

현재 기준은 `txt_reader_multi_v536.zip` / `rebuild-v536`이다. 상단바 테마 버튼은 다크모드 직접 토글이 아니라 테마 색상 모달 바로가기이며, `appearance.mjs`에서 `openThemeEditorBtn.click()` 경로를 사용한다. safe-area 중앙 회색 overlay는 제거되어야 하며, 네트워크 인디케이터 배경은 theme 변수 기반이어야 한다. 수정 시 `tools/checks/theme-shortcut-safe-area-polish-smoke.js`를 유지·갱신한다.

### v537 추가 인수인계

현재 기준은 `txt_reader_multi_v538.zip` / `rebuild-v544`이다. 다음 세션에서는 사용자가 업로드하는 최신 ZIP을 실제로 풀고, 관련 파일을 직접 열어 확인한 뒤 작업한다.

이번 v537 변경은 전체검색 이후 서버 CPU/IO 잔류 부하 완화가 목적이다. 핵심 보호 지점은 다음과 같다.

1. `public/scripts/rebuild/features/search.mjs`는 전체검색 시작 또는 coverage preview 단계에서 `app.reader.ensureBlockManifest()`를 강제 호출하지 않는다. 검색 결과 jump/open은 기존 reader 경로에서 필요한 manifest를 lazy-load한다. 이 경로를 되돌려 전체 folder manifest cold build를 검색 시작 조건으로 만들지 말 것.
2. `public/scripts/rebuild/features/search/search-performance-profile.mjs`와 `matcher.mjs`의 서버 친화 상한을 유지한다: full scan 3~6, live/current 1~3, multi-episode 1~2, worker batch 2~4. 빠른 브라우저/기기가 서버 CPU 여유를 의미하지 않는다.
3. 전체검색 network content 요청은 `X-Search-Scan: 1`을 붙인다. `server/routes/novels-routes.js`는 이를 `{ searchScan: true }`로 넘기고, `server/services/content-service.js`는 search scan cold miss에서 sync chunk payload disk write를 생략한다. Reader 일반 content 요청의 disk cache write 경로는 유지한다.
4. Owner diagnostics에는 `contentService.getCacheStatus()`의 `searchScanLoadMitigationPass`, `metrics.searchScanRequests`, `metrics.searchScanPayloadWriteSkipped`, `searchScanLastMarker`가 노출될 수 있다. UI를 크게 바꾸지 말고 기존 diagnostics renderer에 맡긴다.
5. `block-manifest-service.js`, `reader.mjs`, `reader/virtual-layout.mjs`, `reader/progress.mjs`, `reader/coordinates.mjs`는 v537에서 수정하지 않았다. v513 unified append restore policy, v516/v520 slider/progress, v519 row measurement, v521 viewport transition anchor, v522 guard cleanup 계약을 계속 보호한다.
6. 실제 긴 전체검색의 서버 CPU 전/중/후 비교, Cloudflare/NPM 경유 테스트, iPad/Android PWA 기기 테스트는 v537 산출 시 미수행이었다. 다음 세션에서 실제 운영 환경에서 확인할 것.

관련 smoke: `npm run smoke:search`, `node tools/checks/search-server-load-mitigation-smoke.js`, `node tools/checks/search-full-scan-speed-smoke.js`, `node tools/checks/search-multi-episode-full-scan-smoke.js`.

패키징 시 `docs/next-session-handoff-prompt.md`를 다시 최신화하고, public 파일 변경 시 `.br`/`.gz` sidecar를 재생성한다.
## v538 disk cache auto-prune note

현재 기준은 `txt_reader_multi_v538.zip` / `rebuild-v544`이다. v538에서는 data volume이 일정 수준 이상 찰 때 서버가 runtime cache만 자동 정리하도록 `disk-cache-janitor-service.js`를 추가했다. 삭제 대상은 `data/chunk_indexes`, `data/content_chunks`, `data/block_manifests`뿐이다. `data/accounts.json`, `data/sessions.json`, `data/user-data`, `data/fonts`, `data/audit-log.jsonl`, `sync_data.json`, 실제 library TXT는 자동 정리 대상이 아니다.

다음 세션에서도 사용자가 업로드하는 ZIP을 실제로 풀고 관련 파일을 직접 열어 확인한 뒤 작업한다. reader anchoring/slider/progress/virtual-layout 안정화 계약은 이번 변경에서 건드리지 않았다.
