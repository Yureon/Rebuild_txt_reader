# v682 PowerShell 5.1 호환성 검증

- `node tools/checks/library-organization-v643-smoke.js`
- `node tools/checks/v682-library-organization-powershell51-compat-smoke.js`
- `node tools/run_v682_targeted.js`
- `node tools/run_v682_static_integrity.js`

정적 회귀는 금지 API 제거와 보안 경계 유지를 확인한다. 실제 Windows PowerShell 5.1 runtime 실행은 해당 환경에서 별도로 확인하며, 실행하지 않은 경우 통과로 집계하지 않는다.

<!-- v682-smoke-tests-pass -->

# v681 Metadata 수동 출처 필터 검증

- `node tools/checks/v681-metadata-manual-provider-filter-smoke.js`
- `node tools/checks/metadata-work-filters-v623-smoke.js`
- `node tools/run_v681_targeted.js`
- `node tools/run_v681_static_integrity.js`

환경 차단은 통과로 집계하지 않는다.

<!-- v681-smoke-tests-pass -->

# v677 현재 검증 기준

- `tools/run_v677_targeted.js`: v677 구조 회귀와 주요 상속 계약.
- `tools/run_v677_static_integrity.js`: package 전체 source/config/docs pattern inventory, JS syntax, frontend module, gzip/Brotli, format parser, runtime dependency gate.
- `v677-active-check-registration-smoke`: 모든 현재 smoke가 quick/audit/release verifier에 등록됐는지 확인한다.
- runtime dependency 미설치, browser/OS capability 부재는 exit 77 환경 차단이며 pass가 아니다.

<!-- v677-smoke-current-pass -->

# v674 현재 검증 계약

- `v674-progress-local-compaction-smoke.mjs`: 80k/10k/10k fixture에서 이전 full-sort와 새 증분 bounded snapshot의 선택 동등성, 사용자 scope 격리, collection 전체 scan 0회를 검증한다.
- `v674-reader-prefetch-cancel-race-smoke.mjs`: abort 직후 재예약에서 최대 동시 실행 1, replacement 실행과 이전 controller의 상태 비침범을 검증한다.
- `v674-library-bounded-fallback-smoke.mjs`: virtual failure의 500/300 cap, 활성 작품 보존, 10k/5k bookmark index와 collapsed lazy render를 검증한다.
- `v674-service-worker-navigation-state-failure-smoke.js`: CacheStorage open/put/quota 실패 뒤 navigation 200과 handshake 전 executable 409를 검증한다.
- `v674-server-filesystem-durability-smoke.js`: rename 뒤 directory sync 실패와 journal commit 순서를 결정적으로 주입한다.
- `v674-server-device-profile-cap-smoke.js`: 100개 device 뒤 관련 구조의 동일 cap, current/preferred 보존과 reload 일관성을 검증한다.
- `v674-metadata-playwright-dns-pinning-smoke.js`: 공개→private 두 단계 DNS resolver에서 내부 연결이 시작되지 않는지 검증한다.
- `v674-cross-platform-gate-contract-smoke.js`: Windows separator, ESM 위치, 선택적 archive tool과 현재 server bootstrap 검사를 확인한다.
- `release-verify-current-coverage-v674-smoke.js`가 이 회귀를 Quick·Full runner와 clean-extract release verifier에 등록했는지 검사한다.
- Quick·Full은 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v674-smoke-current-pass -->

# v672 현재 검증 계약

- `v672-metadata-cpu-optimization-smoke.js`: 10,000 candidate hot mutation, 증분 index pass, adapter JSON budget, transport-first, Playwright low-CPU 계약을 검증한다.
- `metadata-playwright-secure-fast-v625-smoke.js`: static HTML request-first와 render-required ephemeral page를 검증한다.
- `metadata-novelpia-adult-playwright-v617-smoke.js`: JSON APIRequest fast path와 browser profile 보존을 검증한다.
- `metadata-provider-completion-cooldown-v669-smoke.js`: provider별 수집 완료 후 쿨타임과 교차 provider 비차단을 유지한다.
- Quick·Full의 환경 차단, static-only, 코드 실패, timeout은 별도 집계한다.

<!-- v672-smoke-current-pass -->

# v671 전용 회귀

기준 버전: rebuild-v672

기준 버전: `rebuild-v672`

- `v671-p0-p1-stability-smoke.js`: 진행도 saturation, enqueue EIO, coalesced queue checkpoint, selector budget, candidate shard migration/restart/cleanup, union-find compaction, no-worker fail-closed, async mutation journal, bounded audit batching을 실행한다.
- `release-verify-current-coverage-v671-smoke.js`: current version·문서·runner·release verifier와 v670~v664 주요 회귀 등록을 검사한다.
- Quick·Full은 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v671-smoke-current-pass -->

# v670 전용 회귀

기준 버전: `rebuild-v670`

- `v670-settings-language-advanced-smoke.mjs`: 테마 기반 언어 listbox, 키보드·선택 wiring, UI 글자 stepper, 고급 탭의 관리 도구 순서와 lazy modal 연결을 검사한다.
- `library-reader-settings-v650-smoke.mjs`: 서재·Reader 설정 context와 중복 ID 부재를 확인한다.
- `v658-settings-gesture-labels-smoke.mjs`: 고급 탭이 Reader에만 노출되는 계약을 유지한다.
- `check_frontend_supervisor.js`: 프런트 필수 ESM과 문법을 전수 검사한다.
- 실제 Whale 렌더링은 환경 미검증으로 분리한다.

<!-- v670-smoke-current-pass -->

# v669 전용 회귀

기준 버전: rebuild-v670

기준 버전: `rebuild-v670`

- `metadata-provider-completion-cooldown-v669-smoke.js`: A provider 활성 중 B provider 독립 시작, A 완료 후 A2 쿨타임, provider별 timestamp 분리를 검증한다.
- `metadata-pacing-v582-smoke.js`: 쿨타임이 개별 HTTP 요청이 아니라 provider collection scope에 연결됐는지 검사한다.
- `metadata-bulk-fallback-v578-smoke.js`: A 실패 후 B fallback이 A 쿨타임으로 지연되지 않는지 확인한다.
- Quick·Full 결과는 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 구분한다.

<!-- v670-smoke-current-pass -->

# v667 전용 회귀

기준 버전: rebuild-v668

기준 버전: `rebuild-v667`.

- `v667-ui-metadata-provider-smoke.js`: 서재 Reader skeleton 제거, metadata refresh, Whale autofill guard, 복구센터, Reader settings geometry, 검색 footer, metadata 3개 subtab, custom/builtin 공급자 정의를 검증한다.
- custom selector parser를 fixture HTML로 실행하고 title/author/link/cover/genre/tag 추출을 확인한다.
- 기본 공급자 request override가 내장 parser와 fallback request를 유지하는지 확인한다.
- `providerDefinitions` durable 저장, 재시작 복원, custom 삭제를 실제 임시 store에서 확인한다.
- `v666-non-auth-autofill-guard-smoke.js`는 v667 compatibility 계약으로 Whale/Chromium input/change/autofill 방어와 credential 예외를 계속 검증한다.
- Quick·Full 결과는 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리 기록한다.

<!-- v667-smoke-tests-pass -->

기준 버전: rebuild-v667

# Smoke test 현재 기준

기준: `v667` / `rebuild-v667`

변경 전용 회귀 `v666-non-auth-autofill-guard-smoke.js`는 runtime guard, credential allowlist, vendor ignore, readonly 해제, native autofill 제거, 모든 진입점 wiring, Service Worker precache와 public allowlist를 검사한다. 결과는 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v667-smoke-current-pass -->

기준 버전: rebuild-v665

# Smoke test 현재 기준

기준: `v665` / `rebuild-v665`

변경 전용 회귀는 `v665-manual-cover-recognition-smoke.js`, `v665-node-direct-launch-smoke.js`, `v665-docs-consolidation-smoke.js`다. 결과는 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v665-smoke-current-pass -->

# v664 현재 검사

`v664-library-resume-explorer-quick-smoke.mjs`는 이어보기 판단, 작품 제목·회차·진행률 출력, 선택창 열기/닫기, 서재 Reader URL, standalone 빠른 목록 navigation, 탐색기 최근·즐겨찾기 렌더를 실행한다. Quick/Full 결과는 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v664-smoke-current-pass -->

기준 버전: rebuild-v664

# v663 현재 검사

`v663-assets-csp-cover-smoke.mjs`는 HTML inline script/style, 로컬 asset 참조, ESM import, CSS URL, manifest icon, Service Worker asset, CSP opt-in, 표지·글꼴 stream과 fallback을 검사한다. Quick/Full 결과는 실제 통과, 환경 차단, static-only, 코드 실패, timeout으로 분리한다.

<!-- v663-smoke-current-pass -->

기준 버전: rebuild-v663

# v661 현재 검증

현재 변경 전용 검사는 `v661-audit-fixes-env-docs-smoke.mjs`와 `release-verify-current-coverage-v661-smoke.js`이다. 파일 변경 대기열·오류 전달·journal 내구성, metadata durable enqueue, 정리 후보 plan cache, 로그인 telemetry sidecar, 독서 데이터 점진 렌더링, `.env.example` 중복·버전 서술 제거, stale release artifact gate를 검사한다. 기존 Quick·Full 회귀와 문법·필수 모듈·gzip/Brotli 동등성 검사를 계속 실행한다.

<!-- v661-smoke-current-pass -->

기준 버전: rebuild-v663

# v660 현재 검증

현재 변경 전용 검사는 `v660-read-data-reader-tabs-isolation-smoke.mjs`와 `v660_reader_tabs_browser_validation.py`이다. 제목 resolver는 hash fallback 금지, 과거 기록 제목 복구, live 작품·회차 결합, 새 snapshot 제목 보존을 검사한다. Chromium fixture는 280×568부터 1024×768까지 Reader visible 3-tab의 modal 내부 배치와 horizontal overflow 부재를 검사한다. 사용자 격리는 기존 state/font/localStorage/progress/cache/ACL 회귀 12개를 함께 실행한다.

<!-- v660-smoke-current-pass -->

기준 버전: rebuild-v660

# v659 현재 검증

현재 변경 전용 검사는 `release-verify-current-coverage-v659-smoke.js`, `v659-settings-bindings-layout-smoke.mjs`, `v659-settings-actual-bindings-runtime.mjs`, `v659_settings_browser_validation.py`이다. 정적 token 확인만으로 동작을 통과 처리하지 않고 actual module preference mutation, sync API call, tab 전환, modal render를 실행한다. Chromium fixture는 320×568부터 1440×900까지 설정 scroll, panel visibility, modal layer/폭/scroll을 검사한다.

<!-- v659-smoke-current-pass -->

기준 버전: rebuild-v659

# v658 현재 회귀

- `v658-settings-gesture-labels-smoke.mjs`: Reader modal CSS 격리, page scroll owner, Library debug 비노출, `서재`/`탐색기형` 명칭, metadata document gesture ownership.
- Chromium 실행 검증: 설정 7개 뷰포트 × 4개 탭, metadata 5개 모바일 뷰포트의 중앙·가장자리 touch swipe.
- `release-verify-current-coverage-v658-smoke.js`: runner·release verifier·문서·버전·dependency inventory 등록.

<!-- v658-smoke-current-pass -->

기준 버전: rebuild-v657

# v657 현재 회귀

- `v657-admin-settings-viewport-smoke.mjs`: version-agnostic cleanup disclosure, 423개 fixture의 초기 24개 카드, 설정 단일 scroll owner, 7개 viewport, mobile index/detail 상태.
- `release-verify-current-coverage-v657-smoke.js`: runner·release verifier·문서·버전·dependency inventory 등록.
- v651~v656 관리자·설정·navigation 회귀를 계속 실행한다.

<!-- v657-smoke-current-pass -->

기준 버전: rebuild-v656

# v656 현재 회귀

- `v656-mobile-explorer-settings-smoke.mjs`: 모바일 settings index/detail 상태와 Explorer folder drawer 실행형 검사.
- v652~v655 설정·navigation 회귀를 계속 실행한다.

<!-- v656-smoke-current-pass -->

기준 버전: rebuild-v655

# v655 현재 회귀

- `v655-library-settings-admin-ux-smoke.mjs`: 빠른 목록 폭, Explorer 접기, 카드 제거 배치, 설정 scroll/language layout, 관리자 검토 후보 안내.
- `v654-settings-shelf-navigation-smoke.mjs`: 설정 복귀와 범위 제거·Explorer navigation 보호.
- `settings-workspace-v652-smoke.mjs`: desktop/mobile 설정 workspace 호환 계약.
- `release-verify-current-coverage-v655-smoke.js`: runner·release verifier·문서·버전 계약.

<!-- v655-smoke-current-pass -->

기준 버전: rebuild-v654

# v654 현재 회귀

- `v654-settings-shelf-navigation-smoke.mjs`: 설정 page 단일 scroll owner와 card UI, 안전한 서재 복귀, 최근 alias 제거, shelf 범위 제거, Windows형 폴더 navigation.
- `settings-workspace-v652-smoke.mjs`: v654 page workspace와 모바일 index/detail 호환 계약.
- `release-verify-current-coverage-v654-smoke.js`: runner·release verifier·문서·버전 계약.

<!-- v654-smoke-current-pass -->

기준 버전: rebuild-v654

# v653 현재 회귀

- `settings-library-tab-visibility-v653-smoke.mjs`: context 제한과 active/inactive panel hidden 계약.
- `library-mobile-header-reveal-v653-smoke.mjs`: down compact, upward/boundary reveal, layout hold 계약.
- `release-verify-current-coverage-v653-smoke.js`: runner·release verifier·문서·버전 계약.

<!-- v653-smoke-current-pass -->

기준 버전: rebuild-v652

# v652 현재 회귀

- `settings-workspace-v652-smoke.mjs`: 설정 workspace 구조, 단일 본문 scroll, 모바일 index/detail 계약.
- `admin-cleanup-summary-v651-smoke.mjs`: v652 custom disclosure, lazy hydration, 점진 렌더링.
- `reader-jump-percent-input-v652-smoke.mjs`: 입력 중 value rewrite 금지, IME composition, commit clamp.
- `release-verify-current-coverage-v652-smoke.js`: 현재 runner/release verifier와 문서·버전 계약.

<!-- v652-smoke-current-pass -->

기준 버전: rebuild-v651

# v651 현재 회귀

- `admin-cleanup-summary-v651-smoke.mjs`: summary wrapper와 24개 초기 batch/fake DOM 실행.
- `update-banner-critical-v651-smoke.js`: 7개 진입점, 로그인 전 allowlist, Service Worker precache.
- `settings-page-state-v651-smoke.mjs`: 실제 panel open 판정, 고유 history token, bounded child close.
- `release-verify-current-coverage-v651-smoke.js`: 현재 release verifier/runner 포함 여부.

<!-- v651-smoke-current-pass -->

기준 버전: rebuild-v650

기준 버전: `rebuild-v650`

# v650 전용 회귀

- `library-reader-settings-v650-smoke.mjs`: 서재 page presentation, Reader context tab 제한, 개발자 디버그 유지, 뒤로가기·focus 계약, ID 중복 방지.
- `reader-fullscreen-header-v650-smoke.mjs`: native/browser/pseudo fullscreen의 toolbar·safe-area 테마 연속성 및 foreground 대비.
- `release-verify-current-coverage-v650-smoke.js`: runner·release verifier·버전·문서 등록.

<!-- v650-smoke-current-pass -->

기준 버전: rebuild-v649
기준 버전: `rebuild-v649`

# v649 전용 회귀

기준 버전: `rebuild-v649`.

- `library-mutation-journal-v649-smoke.js`: 130개 mutation 보존과 journal 선기록 실패 시 원본 파일 보존.
- `v649-audit-fixes-smoke.js`: 1,000개 동일본 선형 처리, alias 전체 보존, 검색 profile snapshot, package artifact/license gate.
- `release-verify-timeout-v649-smoke.js`: timeout process tree 종료와 verifier cleanup wiring.
- `admin-responsive-permission-cleanup-v649-smoke.js`: folder picker·중복검사 상태 표시와 360/620/900/1180px breakpoint.
- `release-verify-current-coverage-v649-smoke.js`: runner·verifier·버전·문서 계약.

`staticOnly` 또는 exit 77 결과는 통과가 아니라 환경 차단이다.

<!-- v649-smoke-current-pass -->

# v648 전용 회귀

기준 버전: rebuild-v648

- `library-durable-invalidation-v648-smoke.js`: 삭제 후 catalog commit 전 재시작에서 tombstone 적용.
- `library-request-boundary-v648-smoke.js`: production sync cold scan 차단과 request consumer 경계.
- `v648-audit-runtime-fixes-smoke.mjs`: drag & drop, toast, shortcut, logger, 언어팩 중복 키.
- `metadata-manual-fast-path-v648-smoke.mjs`: applied shard, main gzip 비재작성, write 실패 rollback, main/shard revision 복구, targeted resolver와 client item patch.
- `release-verify-current-coverage-v648-smoke.js`: runner·release verifier·버전·문서 계약.

<!-- v648-smoke-current-pass -->

기준 버전: rebuild-v648

# v647 검증 기준

기준 버전: `rebuild-v648`.

- `library-settings-diagnostics-v647-smoke.mjs`: 실제 bridge 호출로 설정 진단 ReferenceError 재발 방지.
- `reader-search-modal-v647-smoke.js`: 검색 상태 dataset, compact mobile height, CSS 변수 테마와 안내 중복 억제.
- `release-verify-current-coverage-v647-smoke.js`: runner·release verifier·버전·문서 등록.
- `reader-anchoring-stability-contract-smoke.js`: v488 좌표계 보호 문서 계약.
- 기존 Reader·Search·Settings·Quick·Full 회귀를 유지한다.
- 의존성·브라우저·네트워크 미설치는 환경 차단으로 분리한다.

<!-- v647-smoke-tests-pass -->

# v646 검증 기준

기준 버전: rebuild-v646

# v646 회귀

기준 버전: `rebuild-v646`.

- `library-stability-v646-smoke.js`: gzip 단일 직렬화·trusted backup, metadata revision 분리, startup compaction 1회, cold build 단일화와 bounded wait.
- `library-request-resilience-v646-smoke.mjs`: client 동일 요청 병합, bounded retry, stale 목록 보존, route backpressure와 fingerprint semantic revision 정적 계약.
- `release-verify-current-coverage-v646-smoke.js`: runner·release verifier·버전·문서 산출물 등록.

실제 express HTTP route, Docker, 8만 파일 HDD/SMB와 metadata 동시 수집은 의존성 또는 장비가 없으면 환경 차단으로 기록한다.

<!-- v646-smoke-tests-pass -->

# v645 회귀

기준 버전: rebuild-v645

## v645 전용 회귀

- `library-reader-ui-v645-smoke.js`: 모바일 scope tab 가로 배열과 Reader scroll-to-top 제외.
- `network-search-mode-v645-smoke.js`: 실제 연결 badge와 검색 cache/server badge 분리, 검색 실행 상태 계약.
- `deferred-ui-style-recovery-v645-smoke.js`: 이미 삽입된 deferred fragment의 stylesheet 재검증과 search modal selector.

Reader·Search group과 좌표계 guard를 함께 실행한다. Android/Samsung Internet 실화면과 실제 network 전환은 실행 환경이 없으면 환경 차단으로 기록한다.

<!-- v645-smoke-tests-pass -->

# v642 회귀

## v644 전용 회귀

- `library-mobile-header-v644-smoke.js`: 모바일 2열 grid의 모든 row cell 수와 과거 invalid 선언 제거.
- `library-entry-load-budget-v644-smoke.mjs`: render pagination chain 제거, user activity gate, library ACL defer, fingerprint request-path queue 금지.
- 기존 v581 shelf autoload, v612 nonblocking ACL, v613 access bootstrap 회귀를 함께 실행한다.

<!-- v644-smoke-tests-pass -->

기준 버전: rebuild-v644


## v643 전용 회귀

- `library-cleanup-candidates-v643-smoke.js`
- `library-organization-v643-smoke.js`
- `metadata-page-locale-v643-smoke.js`
- `metadata-provider-settings-v643-smoke.js`
- `owner-library-permission-ui-v643-smoke.js`
- `owner-metadata-locale-settings-v643-smoke.js`
- `site-language-packs-v643-smoke.js`
- `release-verify-current-coverage-v643-smoke.js`

실제 PowerShell 실행은 `pwsh`/Windows PowerShell이 없는 환경에서 환경 차단으로 분리한다. 기준 build는 `rebuild-v644`이다.

<!-- v643-smoke-doc-pass -->


기준 버전: rebuild-v642


- `metadata-compressed-store-v642-smoke.js`
- `metadata-candidate-maintenance-v642-smoke.js`
- `metadata-storage-maintenance-ui-v642-smoke.js`
- `library-metadata-content-grouping-v642-smoke.js`
- `library-variant-relations-v642-smoke.js`
- `library-variant-preference-v642-smoke.js`
- `library-content-discovery-v642-smoke.js`
- `library-content-fingerprint-v642-smoke.js`
- `library-cleanup-similarity-ui-v642-smoke.js`
- `library-grouping-runtime-wiring-v642-smoke.js`
- `release-verify-current-coverage-v642-smoke.js`

본문 fingerprint 실행 회귀는 `iconv-lite`와 `jschardet`가 없으면 exit 77 환경 차단으로 기록한다.

<!-- v642-smoke-doc-pass -->

# v640 회귀

감사 38개 항목의 상태 기준: `docs/audit-resolution.md`.
## v641 추가 회귀

- `v641-audit-security-durability-smoke.js`
- `v641-metadata-manual-clear-smoke.js`
- `v641-owner-library-extension-smoke.js`
- `v641-packaging-gates-smoke.js`
- `source-size-budget-v641-smoke.js`
- `package-inventory-exclude-v641-smoke.js`
- `version-contract-import-order-v641-smoke.js`
- `metadata-ssn-live-contract-v641.js` — `RUN_LIVE_PROVIDER_CHECKS=1`에서만 실제 network 수행, 그 외 환경 차단으로 기록
- `release-verify-current-coverage-v641-smoke.js`

Smoke runner는 첫 누락 의존성에서 중단하지 않고 전체 결과를 JSON으로 기록한다.

<!-- v641-current-doc-pass -->

기준 버전: `rebuild-v641`

- `metadata-ssn-provider-v640-smoke.js`: provider priority, URL/path/host 경계, search/detail parser, direct URL, cover allowlist.
- `metadata-ssn-collection-v640-smoke.js`: metadata service의 search→detail→candidate→auto apply 상태 전이.
- `admin-owner-workspace-v640-smoke.js`: user panel, folder picker, provider card, Playwright workspace와 mobile stack 계약.
- `release-verify-current-coverage-v640-smoke.js`: version, runner, verifier, docs와 산출물 연결.

외부 ssn.so live request와 실제 Chromium screenshot은 별도 실환경 항목이다.

<!-- v640-smoke-doc-pass -->

## v640 실제 실행 결과

- JavaScript/MJS/CJS: `1,131/1,131` 통과
- gzip: `319/319` 통과
- Brotli: `319/319` 통과
- frontend required modules: `246/246` 통과
- quick: `398/431` 통과, 환경 차단 `33`, 코드 실패 `0`, timeout `0`
- full: `386/431` 통과, 환경 차단 `45`, 코드 실패 `0`, timeout `0`
- 실제 ssn.so HTTP와 Chromium screenshot은 환경 차단으로 미완료

<!-- v640-validation-result-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

기준 버전: rebuild-v641

v638 전용 fixture:

- `login-silent-handshake-v638-smoke.js`: 로그인 페이지 READY handshake, update banner 미생성, 권한 API 미호출.
- `service-worker-client-state-bounds-v638-smoke.js`: 300회 navigation 뒤 replaced-client 정리와 256개 상한.
- `metadata-manual-cover-legacy-v638-smoke.js`: v636 canonical URL 호환, mismatch 거절, server URL 재생성.
- `metadata-equivalent-candidate-groups-v638-smoke.js`: provider 간 동일 후보 묶음, provenance, 대표 선택, durable group delete.
- `scroll-to-top-v638-smoke.js`: threshold 표시와 nested scroll root 이동.
- `release-verify-current-coverage-v638-smoke.js`: runner/verifier/version/package 연결.

단순 문자열 검사는 연결 검증에만 사용하고, 핵심 상태 전이는 fixture에서 실제 service/store/UI event 순서로 재현한다.

<!-- /v638-current-summary -->


기준 버전: rebuild-v641

전용 상태 전이 fixture:

- `service-worker-client-state-v637-smoke.js`: worker 재시작 후 stale/deferred 복원, unknown fail-closed, TTL fresh 승격 금지, navigation-only 승격 금지, READY handshake 뒤 executable 허용.
- `update-button-idempotency-v637-smoke.js`: 실제 DOM click listener 순서에서 단일 클릭·빠른 연속 클릭의 권한 요청과 skipWaiting 1회성.
- `stale-executable-policy-v637-smoke.js`: 서버/SW 부재 환경에서 stale JS·fragment·WASM 409, 비실행 CSS no-store 분리.
- `metadata-manual-cover-v637-smoke.js`: invalid/missing asset, 외부 URL, symlink·hash 경계, durable applied reference와 lease release 순서.
- `release-verify-current-coverage-v637-smoke.js`: package/runtime marker, runner, release verifier, 전용 회귀 연결.

대표 보존 회귀:

- v636 delayed activation/controllerchange/multi-tab update coordination
- v636 restart-persistent cover lease
- Reader `fileChar`, progress, bookmark, search locator
- file operation serialization, stale lock, symlink/realpath boundary

실행 결과: 작업 트리와 최종 ZIP 재추출본 모두 quick 417개 중 384개 통과·의존성 차단 33개, full 431개 중 386개 통과·환경 차단 45개, 코드 실패 0개. 장시간 단일 프로세스 제한을 피하기 위해 동일한 deduplicated runner 목록을 연속 구간으로 실행했다.

실제 브라우저·Docker·Samsung Internet·Cloudflare edge·provider account·SMB 장시간·arm64 QEMU는 환경 검증으로 분리한다.

<!-- v637-smoke-pass -->

# v636 회귀


기준 버전: rebuild-v636
- `service-worker-update-coordination-v636-smoke.js`: 지연 activation, 보조 탭 deferred reload, legacy 탭 유예 reload, stale module 409 gate.
- `metadata-cover-lease-durability-v636-smoke.js`: 17MiB/16MiB quota 재시작 lease 복원, durable release, flush-before-release 순서.
- `release-verify-current-coverage-v636-smoke.js`: runner·release verifier·버전·핵심 계약 연결.

<!-- v636-smoke-pass -->

# v635 검증 추가

기준 버전: rebuild-v635

- `metadata-cover-update-safety-v635-smoke.js`: quota 초과 상태의 upload→apply lease, lease 해제 후 prune, 동적 업로드 제한, directory fsync, NovelPia meta-only 성인 표지와 anchor-wrapped 이미지 판정을 검증한다.
- `service-worker-update-activation-v635-smoke.js`: waiting worker가 처음 없는 상태에서 updatefound→installed→skipWaiting→controllerchange→단일 reload를 검증하고 future-build client의 query 없는 dependency cache bypass를 검증한다.
- `release-verify-current-coverage-v635-smoke.js`: v635 package/runtime/worker route와 quick/release verifier 연결을 확인한다.
- `library-cleanup-real-fixture-v628-smoke.js`는 PowerShell 미설치 시 코드 실패가 아닌 capability 차단으로 분류한다.
- 과거 provider revision·Express mock·Service Worker 문자열 고정 검사도 현재 계약을 따라가도록 갱신했다.

- 독립 회귀: quick 409개 중 376개 통과/33개 의존성 차단, full 431개 중 386개 통과/45개 환경 차단, 코드 실패 0개.

<!-- v635-smoke-pass -->

# v629 검증 추가

- `release-verify-current-coverage-v629-smoke.js`: v629 package/runtime/report/manifest 계약과 quick/release 연결을 확인한다.
- `ui-build-badge-v629-smoke.js`: 메타데이터 및 Owner Console의 사용자 표시 버전과 DOM build marker가 현재 버전과 일치하는지 확인한다.
- `release-verify-current-coverage-v628-smoke.js`는 이후 버전에서도 v628 기능 계약을 검증할 수 있도록 `>= 628` 방식으로 변경했다.
- 현재 환경 결과는 quick 394개 중 361개 통과/33개 dependency 차단, full 429개 중 384개 통과/45개 dependency 차단, 코드 실패 0개다. `login-origin-healthz-smoke.js`는 자식 서버 stderr를 상위 runner에 전달해 `express` 누락을 정확히 분류한다.

<!-- v629-smoke-pass -->

# v628 서재 묶음·정리 스크립트 회귀

- `tools/checks/library-cleanup-real-fixture-v628-smoke.js`: 실제 서재 이름 패턴의 묶음 판정, 후보 관계, dry-run, 격리 이동, 빈 선택 안전성을 검증한다.
- `tools/checks/library-cleanup-admin-route-v628-smoke.js`: Owner 경계, CSRF, 계획/스크립트 API, 감사 로그 최소화를 검증한다.
- `tools/checks/smoke-runner-command-timeout-v628-smoke.js`: 멈춘 자식 프로세스 종료와 환경 차단 분류를 검증한다.
- `tools/checks/release-verify-current-coverage-v628-smoke.js`: v628 런타임·패키지·릴리스 검사 연결을 검증한다.

<!-- v628-library-cleanup-smoke-pass -->

# v627 재감사·업데이트 권한 회귀

기준 버전: rebuild-v634

- `tools/checks/v627-reaudit-fixes-smoke.js`: 재감사 8건, 로그인 popup 제거, 이중 권한 판정을 검증한다.
- `tools/checks/metadata-live-score-competition-v627-smoke.js`: 우선 provider 95% 뒤에 score 99% provider가 있을 때 99%가 적용되는지 검증한다.
- `tools/checks/fileops-stale-lock-v627-smoke.js`: 이동 후 삭제·이름 변경이 새 경로에서 동시에 실행되지 않는지 검증한다.
- `tools/checks/release-verify-current-coverage-v627-smoke.js`: runner/release verifier 연결, runtime/package, update authorization 계약을 검증한다.

<!-- v627-reaudit-patch-pass -->

# v626 UI·Compose 회귀

- `tools/checks/ui-scrollbar-compose-v626-smoke.js`: metadata work list/page/detail/login relay, Owner console, lazy diagnostics의 Firefox/WebKit scrollbar 계약과 stable gutter를 검증한다. main/example Compose의 configurable `0.0.0.0` publish와 sidecar의 host port 비공개도 확인한다.
- `tools/checks/release-verify-current-coverage-v626-smoke.js`: v626 검사와 release verifier 연결, runtime/package version, 문서 marker를 검증한다.
- Chromium CDP viewport audit: entry, login, offline, Owner 6개 section, metadata dark/light, library/site/mobile shell, settings/search modal의 16개 상태를 1440×1000, 1200×800, 1024×768, 768×1024, 667×375, 430×932, 390×844, 360×800, 320×568에서 검사한다. 총 144건의 document horizontal overflow는 0건이어야 한다.
- metadata scrollbar render audit: dark desktop와 light 390px에서 `scrollbar-width:thin`, WebKit width 10px, 2px transparent border, 999px radius, stable gutter를 확인한다.

<!-- v626-ui-full-viewport-audit-pass -->

# v625 보안·metadata 성능 회귀

- `node tools/checks/security-reaudit-v625-smoke.js`
- `node tools/checks/metadata-playwright-secure-fast-v625-smoke.js`
- `node tools/checks/metadata-performance-v625-smoke.js`
- `node tools/checks/release-verify-current-coverage-v625-smoke.js`

보안 12개 수정 계약, redirect manual hop·response dispose·page reuse, 단일/모호 후보 adaptive detail budget와 표지 1건 상한을 검증한다.

# v624 반응형·metadata polling 회귀

- `node tools/checks/responsive-pages-v624-smoke.js`
  - metadata desktop/mobile header ownership
  - admin 1200px workbench containment
  - 320px reader/library compact controls와 접근성 이름
  - login/deferred modal touch target
- `node tools/checks/metadata-job-poll-selection-v624-smoke.js`
  - selected work ID·serial guard
  - selection clear/change와 pagehide cancellation
  - cancellable polling timer
- `node tools/checks/release-verify-current-coverage-v624-smoke.js`
  - quick/release verifier 연결, version/package/UI/polling 계약
- Browser viewport audit: 8개 page × 7개 viewport = 56건, page horizontal overflow 0건. Owner modal audit: 2개 modal × 4개 viewport = 8건, viewport 이탈 0건. Quick smoke 346 통과/32 환경 차단/코드 실패·timeout 0, frontend 246, precompressed hash 630.

# v623 메타데이터 작품 필터 회귀

- `node tools/checks/metadata-work-filters-v623-smoke.js`
  - API client query 직렬화
  - 서버 status/provider 정규화·predicate·응답 echo
  - 상태/provider UI와 URL 보존
  - stale selection 정리
  - polling 일시 장애·장시간 작업 분리
  - 모바일 필터 배치와 provider badge overflow
- `node tools/checks/release-verify-current-coverage-v623-smoke.js`
  - quick/release verifier 연결, 버전·문서 marker·핵심 코드 계약

환경 의존 서버 E2E가 차단되더라도 위 fixture·정적 검사는 독립적으로 실행한다.

## v622 전체 감사 수정 회귀

- `full-audit-fixes-v622-smoke.js`: 감사 27개 항목의 설정·코드·문서·패키징 계약을 검증한다.
- `metadata-transport-security-smoke.js`: 공통 network policy와 IPv4-mapped IPv6·multicast·site-local 차단을 의존성 import 전에 검증한다.
- `fileops-async-serialization-v592-smoke.js`: 독립 경로 병렬 실행과 충돌 경로 직렬화를 검증한다.
- `metadata-playwright-v585-smoke.js`: sandbox 기본 활성화와 profile 기반 수집 계약을 검증한다.
- `precompressed-hash-smoke.js`: 남은 textual Brotli/Gzip sidecar가 원본과 일치하는지 검증한다.
- Quick 결과: 341 통과, 32 환경 차단, 코드 실패 0. 환경 차단은 `SMOKE_ALLOW_DEPENDENCY_BLOCKS=1`에서만 인정한다.

기준 버전: `rebuild-v626`

## v621 provider 모바일 경로
- `metadata-provider-mobile-v622-smoke.js`: 5개 provider request plan, 모바일 fixture, URL 정규화, 로그인·연령·차단 gate와 Playwright device profile 계약을 검증한다.
- `metadata-mobile-fallback-service-v622-smoke.js`: 데스크톱 0건 뒤 모바일 fallback, 데스크톱 성공 시 모바일 생략, 상세 완전성 fallback/병합, 접근 제한의 공개 fallback 차단을 실제 service harness로 검증한다.
- `metadata-munpia-current-v622-smoke.js`: 문피아 현재 데스크톱·모바일 경로와 구조화 데이터·URL 정규화·차단 진단 회귀를 검증한다.
- `metadata-restart-resume-v614-smoke.js`: optional 모바일 request 중 shutdown abort가 즉시 queue에 전파되어 cursor와 JSONL batch가 보존되는지 함께 검증한다.
- `release-verify-current-coverage-v622-smoke.js`: quick/release verifier, 구현, fixture와 문서 marker 연결을 고정한다.

기준 버전: `rebuild-v626`

## v620 문피아 현재 경로

- `metadata-munpia-current-v620-smoke.js`: 데스크톱·모바일 검색, 현재 모바일 상세, 구조화 데이터, URL 정규화, 차단 페이지 오류를 검증한다.
- `release-verify-current-coverage-v620-smoke.js`: quick/release 검증 목록과 문피아 fallback 구현·문서 계약을 고정한다.

# v619 메타데이터 우선순위·일괄 적용 회귀

- `metadata-score-priority-bulk-apply-v619-smoke.js`: 95% 경계, 일치율 우선 및 동점 provider priority 선택, 94.9% 검토 대기, 영속 일괄 적용 job을 검증한다. marker: `v619-metadata-score-priority-bulk-apply-smoke-pass`.
- `release-verify-current-coverage-v619-smoke.js`: API·라우트·UI·문서와 quick/release verifier 연결을 검증한다.

기준 버전: `rebuild-v626`

# v617 노벨피아 성인 작품 회귀

- `metadata-novelpia-adult-playwright-v617-smoke.js`: 공급자 원본 페이지에서 `credentials: include` JSON fetch, `verification_required` 상태, 프로필 보존과 인증 완료 복귀를 검증한다. marker: `v617-metadata-novelpia-adult-playwright-pass`.
- `metadata-novelpia-adult-collection-v617-smoke.js`: 일반 검색 빈 결과 뒤 19세 검색·상세 수집·자동 적용, 인증 오류의 공개 transport fallback 차단을 검증한다. marker: `v617-metadata-novelpia-adult-collection-pass`.
- `metadata-novelpia-cover-v634-smoke.js`: 작품 표지 링크·lazy/srcset·background 후보 우선순위, 공용 OG/성인 대체 이미지 차단, 인증 안내 연결을 검증한다. marker: `v634-metadata-novelpia-cover-smoke-pass`.
- `metadata-manual-cover-upload-v634-smoke.js`: 수동 표지 이미지의 형식 판별·해시 저장·적용 권한 인덱스와 직접 입력 패널의 기본 접힘·업로드 UI를 검증한다. marker: `v634-metadata-manual-cover-upload-smoke-pass`.
- `release-verify-current-coverage-v617-smoke.js`: 위 검사가 quick runner와 release verifier에 포함되는지 검증한다.

기준 버전: `rebuild-v626`

# v616 추가 회귀

- `metadata-view-state-v616-smoke.js`: 메타데이터 적용·삭제·재조회가 작품 목록과 상세 후보의 스크롤·포커스를 보존하고 전체 목록 reset을 호출하지 않는지 검증한다. marker: `v616-metadata-view-state-pass`.
- `ux-disruption-guard-v616-smoke.js`: 태그 저장, 독서 데이터 복원, 펼치기/접기, provider 설정, PWA 업데이트가 불필요한 상단 이동·강제 reload를 만들지 않는지 검증한다. marker: `v616-ui-disruption-guard-pass`.
- `release-verify-current-coverage-v616-smoke.js`: 위 검사가 quick runner와 release verifier에 포함되는지 검증한다.

기준 버전: `rebuild-v626`

# v615 추가 회귀

- `metadata-candidate-dedup-v615-smoke.js`: 동일 provider·동일 정규화 내용의 저장 ID 재사용, 목록 중복 제거, 다른 provider 분리, 실제 내용 변경 분리, 기존 중복 저장소 병합을 검증한다.
- `release-verify-current-coverage-v615-smoke.js`: v615 중복 제거 검사가 quick runner와 release verifier에 포함되는지 검증한다.

# v614 추가 회귀

- `v614-auth-bootstrap-redirect-pass`: 401 로그인 redirect와 owner 403 관리 화면 redirect
- `v614-critical-preload-budget-smoke-pass`: navigation/auth 핵심 9개 preload와 appearance 지연 로드
- `v614-metadata-restart-resume-smoke-pass`: 840/8532 cursor 보존, shutdown batch 보존, candidate 보유 작품 재수집 제외
- `v614-metadata-queue-restart-resume-pass`: shutdown을 cancelled가 아닌 queued 재개 상태로 저장
- `v614-metadata-auto-apply-smoke-pass`: 정확한 제목·작가 표기 차이 후보, Metadata Helper 캡처, 재시작 후 보존 후보의 자동 적용
- `v614-metadata-auto-apply-policy-pass`: 강한 일치 또는 정확한 단일 제목 후보만 자동 적용하고 불확실 후보는 수동 검토로 유지
- `v614-release-verify-current-coverage-pass`: preload, 인증 redirect, metadata 재개·자동 적용 회귀가 quick/release verifier에 포함되는지 검사

# v613 현재 회귀 계약

<!-- v613-current-smoke-contract-pass -->

필수 v613 검사는 다음을 포함한다.

- `user-scoped-storage-v613-smoke.mjs`
- `progress-user-scope-v613-smoke.mjs`
- `reader-cache-user-scope-v613-smoke.mjs`
- `access-bootstrap-v613-smoke.mjs`
- `progress-lifecycle-immediate-v613-smoke.mjs`
- `progress-delta-single-acl-v613-smoke.js`
- `critical-preload-budget-v613-smoke.js`
- `ui-version-accessibility-v613-smoke.js`

제거된 v421 recovery 세분화 모듈을 직접 여는 historical smoke는 현재 runtime 존재 여부를 검사하지 않고 `removed-recovery-files-v421.json` 제거 계약을 검증한다. Express, iconv-lite, Playwright, Docker, provider 계정, Android/Samsung Internet, SMB 장시간 부하처럼 환경이 필요한 검사는 미실행과 실패를 구분한다.

# v612 whole-project contract smokes

- `progress-delta-v612-smoke.mjs`: 작품 단위 delta, 큰 진행도 payload 제한, 413 비재시도, local fallback 상한.
- `library-async-event-guard-v612-smoke.mjs`: 서재 event handler의 sync/async 오류 흡수.
- `library-access-snapshot-v612-smoke.mjs`: 기본 compact snapshot과 signature 변경 시 상세 ID 비차단 조회.
- `archive-safety-v611-smoke.js` 및 `package-archive-fallback-v610-smoke.js`: v612 형식 인식 ZIP 경로를 회귀 검증한다.

기준 버전: rebuild-v626

# v611 whole-project contract smokes

- `api-boundary-v611-smoke.js`: route-local 5xx masking and nested Express 4 async handler coverage.
- `archive-safety-v611-smoke.js`: pre-extraction traversal, duplicate, portable collision, and entry-type guards.
- `deployment-probe-v611-smoke.js`: non-destructive dual-directory startup probes, complete precompression discovery, and refresh hydration state.

- `async-route-v610-smoke.js`: all route factories and Express 4 rejection-to-JSON behavior.
- `shutdown-contract-v610-smoke.js`: synchronous and asynchronous shutdown failure aggregation.
- `deployment-state-boot-v610-smoke.js`: data-dir precedence, hydration-before-write, preference scope, and boot recovery wiring.
- `font-sync-atomic-v610-smoke.js`: synchronous upload/delete rollback behavior.
- `package-archive-fallback-v610-smoke.js`: ZIP creation, integrity, entry audit, and dependency exclusion without external `zip`.

# v609 추가 회귀

- `reader-race-ownership-v608-smoke.mjs`: same-chunk join/promotion, stale-session rejection, abort, keepalive progress, deferred timer ownership.
- `json-backup-windows-fsync-v608-smoke.js`: Windows-compatible sync/async backup fsync handles.

- `session-logout-durability-v606-smoke.js`: 성공 logout의 재시작 내구성과 저장 실패 rollback.
- `login-session-durability-v606-smoke.js`: cookie 발급 전 session durable flush.
- `content-worker-shutdown-v606-smoke.js`: worker terminate await와 실패 전파.
- `precompressed-http-boundary-v606-smoke.js`: qvalue·identity 406·client close stream 중단.
- `metadata-store-idempotency-v606-smoke.js`: retry 후보 ID 재사용·최신순·durable rollback.
- `metadata-cover-access-scope-v606-smoke.js`: 대규모 제한 계정 cover ACL scope 조회.
- `release-verify-current-coverage-v606-smoke.js`: clean verifier 필수 회귀 coverage.

기준 버전: rebuild-v626

# v605 추가 회귀

- `csrf-multitab-v605-smoke.js`
- `csrf-client-retry-v605-smoke.mjs`
- `fileops-symlink-boundary-v605-smoke.js`
- `fileops-folder-cache-prescan-v605-smoke.js`
- `user-state-access-fastpath-v605-smoke.js`
- `user-state-write-acl-v605-smoke.js`
- `proxy-scheme-trust-v605-smoke.js`
- `legacy-sync-disabled-v605-smoke.js`
- `state-sync-number-validation-v605-smoke.js`
- `static-cache-versioning-v605-smoke.js`
- `shutdown-docker-contract-v605-smoke.js`
- `docker-library-mount-mode-v605-smoke.js`
- `build-mismatch-worker-v605-smoke.js`
- `account-auth-timing-path-v605-smoke.js`

## v605 안정성 회귀 범위

### v605 신규 회귀

공통 JSON backup, 서비스별 backup 치유, session 평문 migration, 사용자 상태 API 내구성, metadata provider/job 격리, 인증 자산 재검증, 이전 build 자산 경계, 권한 snapshot payload, 경량 metadata context를 별도 회귀로 검증한다. release verifier coverage 검사로 현재 핵심 회귀가 clean ZIP 검증에서 누락되지 않도록 한다.

- JSON durable write, sync flush, session retry, shutdown failure propagation.
- user state durable admin mutation, cache eviction, admin delete rollback.
- content cache in-flight invalidation과 async disk-cache janitor.
- account async auth/scrypt, signup persistence rollback, registration commit.
- font atomic storage·filename collision, site language·audit-log security.
- metadata queue/bulk/cover async I/O와 owner diagnostics async filesystem.
- bounded tag browser·window navigation·사용자 태그 facet 우선순위.
- 실제 Chromium 서재 UX, 태그 필터, 초기 부팅 long-task 예산.

기준 버전: `rebuild-v605`

## v601 추가 회귀

- `library-tag-facet-v601-smoke.mjs`: 전체 histogram 기반 자동 태그 임계값과 사용자 태그 예외.
- `library-user-tags-contract-v601-smoke.js`: 사용자 태그 검색·facet cache·전체 분포 응답.
- `read-data-user-tags-v601-smoke.mjs`: 태그 내보내기·가져오기·rollback과 예약 키 차단.
- `state-record-key-v601-smoke.js`: 서버 상태 map prototype 오염 방지.
- `read-data-record-key-v601-smoke.mjs`: 브라우저 독서 데이터 진행률 map의 예약 키 병합 방지.
- `rebuild-package-script-smoke.js`: current manifest diff 상수 import와 실제 dry-run 패키징 계약.
- `library-v601-browser-smoke.js`: 실제 Chromium scrollbar computed style와 태그 표시 전환.

## v596 화면 구조·브라우저 UX 회귀

- `ux-structure-v596-smoke.js`: owner accordion/sticky summary/lazy picker와 metadata mobile master-detail/history/focus/keyboard/CSS hidden 계약을 정적으로 검증한다.
- `ux-browser-v596-smoke.js`: system Chromium이 있는 환경에서 390×844 실제 DOM·layout으로 owner lazy picker와 metadata 목록→상세·Escape·focus 복원·accessible name을 검증한다.
- 브라우저 E2E는 `TXT_READER_CHROMIUM_PATH=/usr/bin/chromium node tools/checks/ux-browser-v596-smoke.js`로 실행하며 clean release 기본 판정에는 system browser 의존성을 추가하지 않는다.

<!-- v596-ux-smoke-pass -->

## v595 초기 로드 회귀

- `initial-load-optimization-v595-smoke.js`: library/site/mobile 초기 정적 graph, 영어 사전·언어 편집기·reader cache maintenance 지연 로드, 105 modules/690KB 예산을 검증한다.
- 기존 사이트 언어팩·사용자 언어 편집 회귀는 분리된 runtime과 editor facade를 함께 검사한다.

<!-- v595-initial-load-smoke-pass -->

## v594 UX·접근성·CSP 회귀

- `ux-core-v594-smoke.js`: theme boot 공개 경로, constructable custom CSS, unload beacon 제거, 접근성 label/tab, owner logout/build, metadata compact header, 44px touch target, toast/status dedupe를 검사한다.
- 초기 module graph 예산은 상향하지 않고 custom CSS editor/runtime 분리로 유지한다.

<!-- v594-regression-doc-pass -->

## v589 전체 회귀·release verifier·timer lifecycle 회귀

- `smoke-runner-dedupe-v589-smoke.js`: quick/standard/full 그룹이 실행 직전 command label 기준으로 중복 제거되는지 검증한다.
- `release-verify-default-deps-v589-smoke.js`: 기본 clean ZIP 검증도 runtime dependency 설치 후 API smoke를 실행하는지 검증한다.
- `disk-cache-janitor-lifecycle-v589-smoke.js`: periodic timer와 initial delayed timer가 `stop()`에서 모두 해제되는지 검증한다.
- `reader-anchoring-stability-contract-smoke.js`: v488 reader 보호 인수인계 문구가 현재 handoff에 유지되는지 검증한다.

## v578 메타데이터 대량 수집·fallback·테마 첫 페인트 회귀

- `metadata-bulk-fallback-v578-smoke.js`: 701개 작품 단일 bulk job, batch 권한/취소 정리, 1.5~2.0배 delay 계산, Naver 실패 후 Kakao 후보 자동 적용을 검증한다.
- `metadata-theme-bulk-v578-smoke.js`: 전용/모달 전체 수집 UI의 500 제한 제거, 공급자 fallback 정적 계약, 모든 진입 HTML의 pre-CSS theme boot, legacy palette migration과 dark-amber CSS marker를 검증한다.
- 기존 metadata store/queue, transport security, route ACL, shelf enrichment, dedicated page 회귀를 함께 실행한다.

## v577 서재 화면·메타데이터·모달 회귀

- `library-page-view-mode-v577-smoke.js`: library 새 진입의 카드형 기본값과 카드/트리 버튼을 검증한다.
- `library-tree-redesign-v577-smoke.js`: 폴더·작품·회차 계층과 tree workspace containment를 검증한다.
- `metadata-dedicated-page-v577-smoke.js`: 전용 화면, 60개 pagination, 권한 제어, deep link와 no-store를 검증한다.
- `settings-nested-modal-stack-v577-smoke.js`: 설정 하위 모달의 shared layer 등록과 동적 z-index를 검증한다.

## v576 웹 메타데이터 회귀

- `metadata-provider-adapters-smoke.js`: 5개 공급자 sanitized fixture와 공식 URL 분류
- `metadata-store-queue-smoke.js`: 후보 귀속, 적용, bounded retention, Cookie 암호화, batch queue, 취소
- `metadata-transport-security-smoke.js`: SSRF, allowlist, charset와 short response 처리
- `metadata-cover-cache-smoke.js`: magic byte, content-addressed cache와 invalid image 차단
- `metadata-collection-pipeline-smoke.js`: direct 수집→후보→표지→적용 pipeline
- `metadata-routes-access-smoke.js`: 작품·작업·표지 ACL과 전체 접근 O(1) asset 확인
- `metadata-shelf-enrichment-smoke.js`: 서재·트리·검색·필터 반영과 revision ETag
- `metadata-library-ui-smoke.mjs`: 안전한 DOM, 수집·후보 적용·설정 UI

실제 공급자 live crawl은 회귀에 포함하지 않는다. 외부 네트워크 변동과 계정 상태 때문에 release 판정은 deterministic fixture를 사용한다.

## v575 탐색·필터·트리 회귀

- `library-navigation-filter-tree-smoke.mjs`: reader URL context, alias focus, facet state, compact tree, target episode lazy load.
- `library-shelf-api-smoke.js`: focus pagination, filter facets, filtered shelf, episode-free tree payload.
- `library-shelf-ui-smoke.js`: filter DOM/CSS, compact API client, tree focus markers.
- `library-tree-payload-budget-smoke.js`: 1,000작품×20회차 합성 카탈로그에서 episode/file 검색 문자열을 유지한 compact tree가 full catalog보다 최소 60% 작고 더 빠르게 직렬화되는지 검증한다.

## v574 서재·리더 분리 및 그룹 회귀

- `library-variant-grouping-smoke.js`: 범위·완결·작가·복사본 신호와 대표 판본 선택을 검증한다.
- `library-variant-api-smoke.js`: shelf 그룹, favorites/recent alias, meta/variants alias와 raw catalog 보존을 검증한다.
- `library-variant-client-compat-smoke.mjs`: 숨겨진 판본의 최신 진행도와 즐겨찾기 승계를 검증한다.
- `library-episode-sequence-grouping-smoke.js`: 접두사 회차, 숫자 시퀀스, 합본 제외, 기존 회차 폴더와 destructive mutation 차단을 검증한다.
- `library-episode-sequence-api-smoke.js`: 가상 회차 그룹의 shelf/meta/episodes/raw API 직렬화를 검증한다.
- `separate-library-reader-pages-smoke.js`: `/library.html` 기본 진입, reader query navigation, 서재 복귀와 PWA manifest를 검증한다.

## v573 회귀

- `library-stale-while-revalidate-smoke.js`: nested SMB `EIO`와 last-known-good snapshot 보존을 검증한다.
- `normalized-content-cache-recovery-smoke.js`: short read, warm full-file sync hash 제거, 동일 크기 bit flip의 요청 청크 검출·재생성을 검증한다.
- `deferred-ui-runtime-recovery-smoke.mjs`: 29개 필수 node의 최초·재유실 복구를 검증한다.
- `owner-style-loader-runtime-smoke.mjs`: owner CSS 실패 링크 제거와 실제 재시도를 검증한다.
- `docker-entrypoint-wiring-smoke.js`: Dockerfile entrypoint 연결, 고정 runtime identity 문서와 실제 write probe 실행을 검증한다.
- `release-verify-with-server-smoke.js`: dependency install 선행과 package manifest content verifier를 검증한다.

`release:verify --with-server`는 clean extract 후 manifest를 먼저 대조하고, 의존성을 설치한 뒤 runtime-sensitive smoke와 HTTP 통합 검사를 실행한다.

## v572 streaming cache 회귀

- `streaming-normalization-equivalence-smoke.js`: 1,315개 formatter option, 인코딩, large-line spool 및 deterministic chunk-boundary 동등성을 검증한다.
- `streaming-normalized-content-worker-smoke.js`: worker의 full-text 미반환, UTF-8/BOM/CP949/UTF-16LE/BE, bounded sample, long single paragraph, metrics와 v570 metadata 호환을 검증한다.
- 두 검사는 quick/cache/full에 포함된다.
- 성능 수치는 smoke pass 조건이 아니라 별도 독립 프로세스 fixture 측정으로 기록한다.

## v570 normalized content cache 회귀

- `normalized-content-range-cache-smoke.js`: worker 결과의 main entry 전체 text 제거, 동시 요청 합치기, UTF-16LE 범위 재조립, surrogate 경계, warm worker 0회.
- `normalized-content-cache-recovery-smoke.js`: 손상 index, missing meta, 원본 변경 복구.
- `normalized-content-cache-security-smoke.js`: opaque key, root containment, 경로 비노출, symlink 거부, static 미노출.
- `block-manifest-range-locator-smoke.js`: block/chunk/fileChar 연속성과 UTF-16 좌표.
- `disk-cache-in-use-protection-smoke.js`: active cache janitor 보호.
- 신규 검사는 quick/cache/full에 포함되며 locator 검사는 reader에도 포함된다.

## v569 async signatures, deferred UI, retry and shelf budget checks

- `library-deep-signature-cache-smoke.js`: stale snapshot 반환 후 비동기 signature 검사와 background refresh가 완료되는지 검증합니다.
- `deferred-ui-fragment-smoke.js`: 핵심/지연 HTML ID 분리, 중복 ID 방지, versioned force-cache fragment/style, element recollection을 검증합니다.
- `client-performance-metrics-smoke.js`: 부팅 단계, shell/deferred/lazy resource, bounded long-task와 진단 행을 검증합니다.
- `content-worker-retry-ux-smoke.mjs`: 503 code/`Retry-After` 전달, 전경 1회 재시도와 배경 무소음 정책을 검증합니다.
- `library-shelf-dom-budget-smoke.mjs`: 528개 연속 로드에서 카드 480개 상한, 스냅샷 누적 개수, 보호 작품 유지와 catalog map 정리를 검증합니다.

## v568 lazy-loading and initial graph regression checks

- `tools/checks/lazy-feature-loading-smoke.js`: verifies heavy feature roots are absent from the static boot imports/modulepreloads, reader intent preload exists, search is not force-loaded on reader changes, and periodic sync UI is dynamically loaded.
- `tools/checks/initial-module-graph-budget-smoke.js`: traverses static ESM imports from `site.mjs` and `mobile.mjs` and enforces the 115-module / 760KB source ceiling.
- Existing reader, search, settings, cache, security and server HTTP groups remain required.

## v567 resource regression checks

- `tools/checks/library-stale-while-revalidate-smoke.js`: verifies elapsed time does not force a rebuild, a real nested change serves stale data once, and a single background refresh publishes the new snapshot.
- `tools/checks/content-worker-resource-budget-smoke.js`: verifies one active worker plus a bounded queue and a 503 queue-full rejection.
- `tools/checks/library-shelf-resource-budget-smoke.mjs`: verifies 300ms search debounce, append-only load-more, and the 12-work episode LRU.
- `tools/checks/library-shelf-api-smoke.js`: additionally verifies true title ordering and bounded identical-query cache hits.

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

기준 버전: rebuild-v605

## v600 추가 회귀

- `initial-load-v600-smoke.js`: 사용자 태그 runtime을 포함한 초기 graph 지연 로드 계약.
- `initial-load-browser-v600-smoke.js`: warm-up 후 반복 Chromium boot-window long task 측정.
- `library-quick-switcher-v600-smoke.js`: 최근/즐겨찾기 단일 패널 탭 구조.
- `library-v600-browser-smoke.js`: 실제 DOM 탭 전환과 사용자 태그 추가·적용·동기화.
- `library-user-tags-v600-smoke.js`: 클라이언트/서버 정규화·저장·검증.
- `library-user-tags-api-v600-smoke.js`: shelf/tree/filter 사용자 태그 반영.
- `metadata-pacing-v600-smoke.js`: 구형 1200ms 값의 3000ms 하한 및 실제 4500~6000ms 범위.


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

- `tools/checks/search-coverage-preview-schedule-smoke.js`: verifies search modal open and post-search completion schedule the coverage preview instead of awaiting it, duplicate preview work is coalesced, cleanup cancels pending preview timers, and the search worker cachebuster matches `rebuild-v567`.
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

### v566 shelf-first library

- `tools/checks/library-shelf-api-smoke.js`: starts an HTTP router fixture and verifies cursor pagination, ACL-filtered counts, favorites/recent ordering, episode omission, same-origin cover policy, lazy episode summaries, and ETag 304 behavior.
- `tools/checks/library-shelf-ui-smoke.js`: verifies shelf/file tabs, scope controls, 48-item page budget, lazy API wiring, direct-open cards, explicit load-more, mobile fallback, and reduced-motion CSS.
- `tools/checks/library-shelf-request-race-smoke.mjs`: dynamically verifies that a superseded shelf request is aborted, cannot overwrite the latest query result, and does not produce an error toast.

## v588 추가 회귀

- `metadata-access-permission-v588-smoke.js`: 기본 차단, accessVersion 무효화, owner 콘솔 필드, 문서/API/UI 이중 방어.
- `metadata-routes-access-smoke.js`: 허용/차단/폴더 제한/owner 경계.
- `library-quick-header-v588-smoke.js`: 파일 트리·Windows 탐색기 빠른 목록 헤더와 카드형 숨김 계약.

## v590 계약 정합성 회귀

- `architecture-storage-contract-v590-smoke.js`: Express 4 및 JSON/JSONL 영속 저장 구조와 문서 계약을 검사한다.
- `release-output-path-v590-smoke.js`: current release helper가 루트 manifest/change report와 consolidated docs를 계획하는지 검사한다.
- `pwa-service-worker-v590-smoke.js`: service worker cache version, API·인증 HTML 제외, navigation offline fallback, 공개 allowlist를 검사한다.
- `metadata-document-access-v590-smoke.js`: `/metadata.html` 권한 거부가 403 `metadata_access_required` JSON 계약을 사용하는지 검사한다.

<!-- v590-contract-alignment-smoke-doc-pass -->


## v591 오류·성능 회귀

- `precompressed-static-async-io-v591-smoke.js`: request hot path에서 sync stat이 없어야 하고 동일 파일의 async stat이 병합되는지 검사한다.
- `content-async-source-io-v591-smoke.js`: main thread source/cache 동기 I/O를 차단한 상태에서 cold/warm 청크가 동작하는지 검사한다.
- `block-manifest-async-io-v591-smoke.js`: source signature와 disk manifest가 async I/O를 사용하고 folder stat 동시성이 제한되는지 검사한다.
- `library-async-build-v591-smoke.js`: 동기 filesystem 함수를 차단한 상태에서 cold catalog build, in-flight 병합, invalidation generation 방어를 검사한다.
- `library-route-async-build-v591-smoke.js`: novels·manifest·metadata·ACL·owner route가 async catalog getter를 사용하고 state filter가 async 결과를 기다리는지 검사한다.
- `sync-state-lifecycle-v591-smoke.js`: timer unref, snapshot 실패 진단, shutdown final flush를 검사한다.
- `sync-state-data-path-v591-smoke.js`: 활성 sync 파일이 data volume에 있고 기존 root 파일을 비파괴 이관하는지 검사한다.
- `session-store-lifecycle-v591-smoke.js`: 예약 저장·cleanup timer 제거와 shutdown final atomic flush를 검사한다.
- `metadata-queue-persistence-v591-smoke.js`: 다수 progress update가 queue 전체 파일 쓰기 한 번으로 병합되는지 검사한다.
- `search-adaptive-listener-cleanup-v591-smoke.js`: 검색 재설치 시 adaptive global listener disposer 호출을 검사한다.

<!-- v591-performance-regression-doc-pass -->


## v592 추가 오류·성능 회귀

- `metadata-store-async-persistence-v592-smoke.js`: 50개 mutation이 flush 전 디스크 쓰기 0회, durability boundary에서 atomic write 1회로 병합되는지 검사한다.
- `metadata-queue-graceful-stop-v592-smoke.js`: active handler abort cleanup과 cancelled 상태 저장 전에 queue stop이 resolve하지 않는지 검사한다.
- `fileops-async-serialization-v592-smoke.js`: 동시 filesystem mutation이 직렬화되고 async path를 사용하는지 검사한다.
- `service-worker-cache-key-v592-smoke.js`: query/hash canonical key, current-cache lookup, 512-entry cap, redirect/API 제외 계약을 검사한다.
- `graceful-shutdown-v592-smoke.js`: HTTP close와 application persistence stop을 함께 기다리고 force-close 경계가 있는지 검사한다.
- `admin-diagnostics-async-v592-smoke.js`: 운영 진단이 synchronous cold catalog getter를 호출하지 않는지 검사한다.

<!-- v592-performance-followup-regression-doc-pass -->

## v593 provider Playwright·권한·종료 회귀

- `metadata-playwright-all-providers-v593-smoke.js`: 5개 provider descriptor의 persistent profile, 공식 로그인 URL과 login 완료 흐름을 검사한다.
- `metadata-playwright-security-persistence-v593-smoke.js`: login path, 외부 redirect 차단, profile 만료 감지, 상태 write coalescing과 async profile tree 삭제를 검사한다.
- `metadata-permission-button-v593-smoke.js`: metadata link/action의 first-paint hidden 및 권한 snapshot 동기화를 검사한다.
- `page-logout-controls-v593-smoke.js`: 서재·metadata 로그아웃, 서재 진행률/device sync 선행 저장과 로그아웃 runtime의 dynamic import를 검사한다.
- `audit-log-async-v593-smoke.js`: audit append의 sync I/O 제거, 직렬 순서, redaction, flush/stop을 검사한다.
- `graceful-shutdown-request-drain-v593-smoke.js`: HTTP request drain이 persistence service stop보다 먼저 완료되는지 검사한다.

<!-- v593-regression-doc-pass -->


## v599 초기 로드 계약

초기 library/site/mobile 정적 import graph는 90개 모듈·580KB 이하를 유지한다. 고급 설정, 상세 진단, tree fixture와 native drag-and-drop handler는 실제 사용 시 동적 로드한다.


## v645 Reader·검색·서재 UI 회귀

- `library-reader-ui-v645-smoke.js`: 모바일 전체/최근/즐겨찾기 버튼의 가로 배치, Reader 상단 이동 버튼 억제, 실제 `nsearch-panel` 모바일 selector와 검색 실행 버튼을 검사한다.
- `network-search-mode-v645-smoke.js`: 네트워크 연결 배지와 검색 범위 배지를 분리하고, 캐시 준비 상태가 연결 상태를 덮어쓰지 않는지, IME Enter 및 명시적 검색 버튼 계약을 검사한다.
- `deferred-ui-style-recovery-v645-smoke.js`: 지연 UI HTML이 이미 존재해도 검색/설정 stylesheet를 다시 검증하고 누락 시 복구하는 계약을 검사한다.

## v662 회귀

- `v662-deferred-ui-530-recovery-smoke.mjs`: 530/1033 응답 뒤 성공 재시도, cache 정책 전환, 404 즉시 실패, SW precache와 공개 allowlist를 검사한다.

<!-- v662-smoke-current-pass -->

<!-- v661-smoke-current-pass -->

## v668 서재·Reader shell 분리 회귀

- `v668-library-shell-isolation-smoke.mjs`: library shell 필수 서재 DOM, Reader DOM 부재, Reader shell 보존, profile별 URL·promise 격리와 body paint 이전 entry router를 검사한다.
- `release-verify-current-coverage-v668-smoke.js`: v668 버전·문서·압축·CSP·shell 회귀가 quick runner와 release verifier에 포함됐는지 검사한다.

<!-- v668-smoke-current-pass -->
## v675 현재 회귀

`run_v675_targeted.js`는 current-release coverage와 progress journal/replay, metadata compact index/startup bound, trusted proxy source, prefetch watchdog, Service Worker dual failure, font symlink boundary, modal focus manager, profile skeleton을 실행한다. 전체 검증은 environment-blocked를 pass와 분리한다.

<!-- v675-smoke-current-pass -->
## v676 current gates

`release-verify-current-coverage-v676-smoke.js`와 `v676-active-check-registration-smoke.js`가 모든 v676 회귀를 quick/full/release verifier에 등록했는지 검사한다. 전용 회귀는 Compose YAML, trusted proxy, bounded candidate load, prefetch orphan circuit, modal stack, font I/O, progress journal symlink, extension shortcut/UI, Metadata folder/list continuity를 포함한다.

<!-- v676-smoke-current-pass -->
