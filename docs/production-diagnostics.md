# v682 라이브러리 정리 스크립트 진단

`[System.IO.Path]에 이름이 GetRelativePath인 메서드가 없음` 오류가 보이면 v681 이하에서 다운로드한 스크립트인지 확인하고 v682에서 다시 생성한다. 새 스크립트에는 `Get-RelativePathCompat`가 포함되고 `[System.IO.Path]::GetRelativePath(` 문자열이 없어야 한다.

<!-- v682-production-diagnostics-pass -->

# v681 Metadata 필터 진단

관리 화면 URL의 `metadataProvider=manual`, 응답 `filters.metadataProviderIds`, 작품 `metadata.providerId`를 순서대로 확인한다. 직접 입력 작품이 보이지 않으면 applied record의 provider 표식과 사용자 library ACL을 함께 점검한다.

<!-- v681-production-diagnostics-pass -->

# v680 테마 진단

진단 시 `document.documentElement.dataset.themeScope`, `window.__TXT_READER_BOOT_THEME__`, localStorage의 `txt-reader.rebuild.activeThemeScope`, 사용자별 `txt-reader.rebuild.scope.<id>.prefs`를 확인한다. `/api/theme-bootstrap`은 로그인 session이 없으면 401, 잘못된 session kind면 403을 반환해야 한다. 응답에는 theme allowlist 외 사용자 상태가 포함되면 안 된다.

<!-- v680-production-diagnostics-pass -->

# v679 진단 추가

Metadata folder input이 흰색 기본 control로 보이면 HTML의 cachebuster, 실제 응답된 `metadata-page.css` ETag, 활성 Service Worker BUILD를 함께 확인한다. Extension popup이 비정상적으로 좁으면 설치 폴더의 `popup.css`가 `--popup-width: 380px` 계약인지 확인한다.

<!-- v679-production-diagnostics-pass -->

# 운영 진단 — v676 current

기준 버전: `rebuild-v676`

# v674 현재 운영 진단

기준 버전은 package `6.74.0`, runtime `rebuild-v674`이다.

- file operation 실패 응답의 `operationApplied`와 `recoveryRequired`를 먼저 확인하고 pending journal을 임의 삭제하지 않는다.
- metadata provider 오류는 DNS pinning·redirect host·cookie 전달·transport fallback 단계를 구분해 기록한다.
- Reader local fallback 지연은 사용자 scope의 snapshot 크기와 compaction 횟수로 확인하며, 전체 resident map 직렬화를 정상 경로로 간주하지 않는다.
- library fallback이 발생하면 prune 안내, active novel 보존, 작품/회차 DOM cap을 함께 확인한다.
- PWA 문제는 network 실패와 CacheStorage 보조 상태 실패를 구분한다.

<!-- v674-production-diagnostics-pass -->

## 과거 릴리스 기록

# v666 입력 자동완성 진단

일반 검색·필터에 로그인 ID가 들어오면 DevTools에서 해당 요소의 `data-autofill-guard="v666"`, `data-lpignore`, `data-1p-ignore`, `data-bwignore`를 확인한다. 속성이 없으면 guard script 로드 실패 또는 fragment 관찰 실패다. script/CSS가 302 로그인 redirect를 받으면 `server/middleware/auth.js` exact public allowlist와 Service Worker precache를 확인한다. 실제 사용자 입력이 지워지면 `data-autofill-user-edited`와 `beforeinput` 경로를 점검한다.

<!-- v667-production-current-pass -->

# v664 진단

이어보기 선택창이 나타나지 않으면 Reader URL의 `from=library`, 진행률 snapshot, 명시적 `episodeId` 유무를 확인한다. 탐색기 빠른 목록이 비면 orchestrator의 공통 quick-list 렌더 호출을 확인한다.

<!-- v664-production-current-pass -->

기준 버전: rebuild-v664


기준 버전: rebuild-v663
# v663 자산 진단

- 표지 200 응답: `X-Txt-Reader-Asset: metadata-cover-v663`
- 사용자 글꼴 200 응답: `X-Txt-Reader-Asset: user-font-v663`
- 앱 직접/NPM 내부 응답에 `Location`이 없고 외부만 반복 redirect하면 Cloudflare/NPM 경계를 조사한다.
- CSP console 오류의 URL이 `static.cloudflareinsights.com`이면 Cloudflare 자동 주입과 `ALLOW_CLOUDFLARE_INSIGHTS` 상태를 일치시킨다.

<!-- v663-production-assets-pass -->

기준 버전: rebuild-v655

# v648 metadata 수동 수정 진단

- 정상 저장 응답에는 `resolvePass: v648-metadata-targeted-resolve-pass`와 `novelPatch.pass: v648-metadata-novel-patch-pass`가 포함된다.
- `metadataStore.mainDirty`, `appliedDirty`, `appliedLoadedSource`, `appliedShardRepairNeeded`를 확인한다.
- applied-only 편집 중 main gzip mtime이 변하거나 shelf API가 전 페이지 재호출되면 fast path 우회로 간주한다.

<!-- v648-production-metadata-fast-path-pass -->

# v648 서재 장애 진단

- `catalogDirty`, `mutationGeneration`, `committedGeneration`, `tombstoneCount`가 지속 증가하면 catalog commit 실패를 확인한다.
- `LIBRARY_SYNC_COLD_BUILD_DISABLED`는 production 요청 경로가 동기 full scan을 시도한 계약 오류다.
- `LIBRARY_COLD_BUILD_PENDING/BACKOFF/FAILED` 및 `LIBRARY_SHELF_BUSY`는 503과 `Retry-After`로 처리한다.
- 반복 full scan보다 durable catalog/state 파일의 root hash, 권한, 디스크 여유, SMB 연결을 먼저 확인한다.

<!-- v648-production-catalog-diagnostics-pass -->

# v646 서재 진입 진단

Owner 진단의 `libraryCache`에서 `durableCatalogLoaded`, `durableCatalogSource`, `coldFailureCount`, `coldFailureBackoffUntil`, `requestColdBackoffRejects`, `asyncBuildsStarted`를 확인한다. 장애 중 `asyncBuildsStarted`가 요청 수만큼 증가하면 회귀이며, 마지막 정상 snapshot이 있으면 목록은 stale 상태로 계속 제공되어야 한다.

<!-- v646-library-stability-diagnostics-pass -->

# v646 서재 장애 진단

- `libraryCache.metrics.requestColdWaits/requestColdTimeouts`: cold catalog 대기와 503 전환 횟수.
- `asyncBuildsStarted/asyncBuildInflightJoins`: 여러 요청이 단일 catalog build를 공유하는지 확인한다.
- 응답 `library_warming`: catalog 준비 중이며 무한 대기나 별도 full scan을 시작했다는 뜻이 아니다.
- 응답 `library_shelf_busy`: presentation bounded queue 초과다. concurrency보다 pending 상향을 먼저 하지 않는다.
- metadata persistence status의 applied/candidates/settings revision을 비교한다. 후보 revision만 증가했다면 shelf presentation은 유지되어야 한다.
- fingerprint status에서 `verificationUpdates` 증가만 있고 `semanticUpdates`가 없으면 presentation revision은 유지되어야 한다.

<!-- v646-library-diagnostics-pass -->

# v645 Reader·검색 진단

- 상단 `toolbar-network-mode`는 연결 profile만 표시한다. cache coverage는 tooltip과 offline download 상태에서 확인한다.
- `nsearch-network-mode`는 `캐시 검색`, `서버 검색`, `오프라인`을 표시한다.
- 본문 검색 CSS가 없으면 `feature-fragments.mjs`가 `/styles/deferred-ui.css?v=rebuild-v645`를 다시 로드한다.
- 검색 버튼이 계속 disabled면 `nsearch-input` input event와 현재 작품 state를 확인한다.
- Reader에 공용 `.scroll-to-top-btn`이 보이면 active scroll root가 `#reader`/`.reader`로 판정됐는지 확인한다.

<!-- v645-reader-search-diagnostics-pass -->

# v642 운영 진단

## v644 서재 진입 진단

- 정상: 최초 `/api/novels/shelf?limit=48` 1회 후 사용자 스크롤 전 추가 cursor 요청 없음.
- 비정상: `shelf-load-more-complete`가 사용자 입력 없이 연속 발생하거나 cursor가 짧은 시간 안에 끝까지 소비됨.
- 제한 사용자 상세 snapshot은 `userAccessReconcilePromise`에서 비동기 처리된다.
- fingerprint I/O는 진입 후 기본 15초 뒤 시작하며 service status의 `queueLength`, `active`, `metrics.bytesRead`로 확인한다.

<!-- v644-library-entry-diagnostics-pass -->

## v643 운영 진단

중복 정리 화면은 fingerprint queue의 pending/running/completed/failed와 sample 제외 사유를 보여준다. provider 설정 문제는 `/api/metadata/providers`의 locale fields와 provider descriptor의 threshold/interval/search limit를 함께 확인한다. library organization은 plan hash, move/unchanged/skipped/collision count를 기록하고 다운로드 직전 full plan을 재계산한다.

<!-- v643-diagnostics-pass -->


관리자 진단의 `ioDiagnostics.libraryContentFingerprint`에서 entry 수, queue, active worker, bytesRead, cache hit/miss, logical/compressed bytes를 확인한다. metadata storage 화면은 후보·적용·보호 수, 압축률, backup·legacy bytes를 표시한다.

<!-- v642-diagnostics-pass -->

# v638 운영 진단

## v641 machine-readable 결과

- `data/diagnostics/smoke-<group>-last.json`
- `data/diagnostics/predeploy-environment-last.json`
- `data/diagnostics/dependency-audit-last.json`

코드 실패, 누락 의존성, 미실행 capability를 분리해 운영 기록에 보존한다.

<!-- v641-current-doc-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

## 로그인 화면 executable 409

로그인 페이지의 `theme-boot.js` 또는 `login.js`가 409라면 HTML에 `data-update-ui="silent"` coordinator가 포함됐는지, `TXT_READER_CLIENT_BUILD_READY`가 현재 build로 전송됐는지 확인한다. unknown-client 정책을 해제해서 우회하지 않는다.

## metadata group 진단

후보 수와 group 수가 예상과 다르면 정규화 대상 필드, provider provenance, 대표 후보 점수와 priority를 확인한다. 표지만 다른 후보는 같은 group에 남고 `coverVariantCount`가 증가하는 것이 정상이다.

<!-- /v638-current-summary -->


기준 버전: `rebuild-v641`

- 실행 자산 409 응답의 `activeBuild`, `requestedBuild`, `X-TXT-Reader-Reload-Required`를 확인한다.
- 현재 페이지인데 반복 409가 발생하면 `/service-worker-register.js` 로드/CSP, READY message, Cache Storage `txt-reader-client-build-state-v1` 쓰기 권한을 확인한다.
- worker 재시작 뒤 stale 탭이 200을 받으면 client state record 손상·삭제 또는 구형 worker 제어 여부를 확인한다.
- manual cover 400/422는 asset ID 형식, 파일 존재, symlink, signature/extension, content hash, client URL 필드 삽입 여부를 확인한다.
- durable applied record는 있는데 lease가 남으면 sidecar write/fsync 오류를 확인한다. 편집 자체는 성공일 수 있으며 bounded expiry와 다음 startup prune이 복구한다.
- lease가 조기에 사라지면 manual save route가 flush 후 readback과 정확한 ID/URL 비교를 거쳤는지 점검한다.

<!-- v637-production-diagnostics-pass -->

# v606 진단 추가

세션 저장 오류가 발생하면 login은 cookie를 발급하지 않고 logout은 현재 cookie를 유지한다. data volume 권한, 남은 용량, inode, atomic rename/fsync 지원을 확인한다. 종료 시 content worker terminate 실패는 정상 종료로 취급하지 않는다. Runtime marker는 `rebuild-v613`이다.

기준 버전: `rebuild-v605`

## v604 복구·권한·성능 진단

- session lifecycle의 `dirty`, `writeFailures`, `retryScheduled`가 지속되면 data volume 권한과 디스크 오류를 확인한다.
- shutdown이 `SHUTDOWN_PERSISTENCE_FAILED`로 종료되면 최종 flush 실패 저장소를 로그에서 확인하고 정상 종료로 간주하지 않는다.
- metadata queue persistence의 pending/dirty/lastError가 장시간 남는지 확인한다.
- disk cache janitor의 in-flight 상태와 최근 scan/prune 시간을 확인하고 동시 janitor가 중복 실행되지 않는지 확인한다.
- 초기 graph는 89 modules, 579,965 bytes 이하이며 실제 Chromium long task는 180ms 예산으로 점검한다.

## v573 cache·SMB 진단

- `contentCache.contentChunkIntegrityPass`: 요청 범위 청크 SHA-256 검증 경로 활성 여부
- `contentCache.invalidNormalizedCacheEntries`: 손상으로 invalid 처리된 cache key 수
- `contentCache.metrics.normalizedChunkHashChecks/Failures`: 범위 무결성 검사와 실패 횟수
- `contentCache.metrics.normalizedCacheCorruptions`: cache 폐기·재생성 트리거 횟수
- `libraryCache.completeScanPass`: 전체 폴더 scan 성공 후에만 snapshot을 확정하는 계약
- `libraryCache.lastRefreshError`: nested SMB 오류 또는 스캔 중 root 변경으로 commit이 중단된 이유

일시 단절 뒤 작품 수가 줄어든 새 snapshot을 정상으로 간주하지 않는다. 마지막 정상 snapshot이 계속 제공되는지 먼저 확인하고, SMB 복구 후 refresh가 완료되는지 확인한다.

## v570 normalized content cache 진단

`contentService.getCacheStatus()`의 `normalizedCacheDiskHits`, `normalizedCacheDiskMisses`, `normalizedCacheBuilds`, `normalizedCacheBuildFailures`, `normalizedRangeReads`, `normalizedRangeReadBytes`, `normalizedRangeReadFailures`를 확인한다. 같은 파일 재접근마다 build가 증가하면 원본 stat 변화, 권한, 손상된 meta/index 또는 cache directory 정리를 점검한다.

`data/normalized_content` 쓰기 실패 시 `/app/data` 권한과 여유 공간을 먼저 확인한다. 실제 library 절대 경로는 HTTP 응답에 노출하지 않고 server log/owner 진단에서만 제한적으로 다룬다.

## v569 라이브러리 변경 검사 진단

owner 진단의 library cache 항목에서 `signatureCheckScheduled`, `signatureCheckInProgress`, `lastSignatureCheckDurationMs`, `lastSignatureCheckTargetCount`, `lastSignatureChangedPath`, `effectiveDeepSignatureCheckTtlMs`를 확인한다. 요청 응답 지연 없이 검사가 진행되어야 하며, 느린 무변경 검사는 최대 TTL까지 자동 backoff한다. 변경 감지 뒤 catalog rebuild는 아직 동기이므로 `lastBuildMs`와 API 지연을 함께 관찰한다.

## v572 normalized streaming 진단

- `contentCache.metrics.normalizedCacheStreamingBuilds`: v571 streaming cold build 완료 횟수
- `streamingNormalizedContentBuildPass`: 런타임 builder marker
- `sourceSampleBytes`: worker 내부 결과에서 실제 인코딩 판정 표본 크기이며 최대 64KiB로 회귀 검증한다.
- 긴 처리 뒤 cache directory에 `*.line.tmp`가 남으면 worker 강제 종료·권한·디스크 오류를 확인한다. 오래된 임시 파일은 janitor 정리 대상이다.

# Production diagnostics

기준 버전: rebuild-v605

이 문서는 외부망/HTTPS 배포에서 로그인, 쿠키, origin, reverse proxy 문제를 진단하는 절차를 정리한다.

## 1. production HTTP 로그인 루프

`NODE_ENV=production`에서는 서버가 `__Host-session_token`을 `Secure` 쿠키로 발급한다. 브라우저가 HTTP 주소로 접속하면 Secure 쿠키를 저장하지 않는다.

증상:

1. `/api/login` 요청이 성공처럼 보인다.
2. `/admin/users.html` 또는 `/site.html`로 이동한다.
3. 세션 쿠키가 없어 다시 `/login.html`로 돌아온다.

v391 이후 서버는 이 조합을 `production_https_required` 오류로 명시한다.

해결:

- 내부망 HTTP 테스트라면 `NODE_ENV`를 비우거나 development로 둔다.
- 외부망 운영이라면 HTTPS로 접속한다.
- reverse proxy가 `X-Forwarded-Proto: https`를 전달하는지 확인한다.

## 2. direct 모드

내부망 직접 접속 예시:

```env
NODE_ENV=
DEPLOYMENT_MODE=direct
URL=http://192.168.1.100:3000
APP_ORIGIN=http://192.168.1.100:3000
HOST=0.0.0.0
```

특징:

- HTTP 접속 허용
- development cookie 사용
- 외부망 공개 전용 설정이 아님

## 3. trusted-proxy 모드

Nginx Proxy Manager, Caddy, Traefik 등 HTTPS reverse proxy 뒤 예시:

```env
NODE_ENV=production
DEPLOYMENT_MODE=trusted-proxy
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=0.0.0.0
```

proxy 요구사항:

- `X-Forwarded-Proto: https`
- `Host` header 보존
- Web origin이 `APP_ORIGIN`과 일치

## 4. Cloudflare Tunnel 모드

```env
NODE_ENV=production
DEPLOYMENT_MODE=cloudflare-tunnel
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=0.0.0.0
CLIENT_IP_HEADER=CF-Connecting-IP
```

주의:

- Cloudflare가 HTTPS를 종료한다.
- `HOST=0.0.0.0`은 모든 네트워크 인터페이스에 listen한다. 외부 공개 여부는 Compose host port publish, host firewall, 공유기 포트포워딩, reverse proxy/Tunnel 구성으로 제한해야 한다.
- Cloudflare Tunnel 뒤에 NPM을 두는 경우에도 NPM `80/443/81`과 Node 앱 포트가 WAN에 직접 노출되면 안 된다. 관리자 포트만 막는 것으로는 부족하다.
- v525 이후 `DEPLOYMENT_MODE=cloudflare-tunnel`에서는 `CF-Visitor: {"scheme":"https"}`가 production HTTPS 판정에 사용될 수 있다. 이 판정은 Cloudflare를 우회한 origin 직접 접근이 차단된 경우에만 신뢰한다.
- Cloudflare beacon 관련 브라우저 콘솔 noise는 앱 기능 오류와 별개일 수 있다.

헤더 진단 예시:

```text
X-Forwarded-Proto: http
CF-Visitor: {"scheme":"https"}
DEPLOYMENT_MODE=cloudflare-tunnel
=> effectiveProtocol=https, cloudflareVisitorHttpsTrusted=true
```

위 상태가 정상으로 표시되더라도, WAN에서 NPM/Node로 직접 접근 가능한 포트가 있으면 헤더 위조 위험이 있으므로 방화벽부터 수정한다.

## 5. owner diagnostics API

owner 콘솔의 `운영 진단`은 `/api/admin/diagnostics`를 호출한다.

v437 이후 owner 콘솔은 `ioDiagnostics`를 원본 JSON details와 별도로 `I/O cache diagnostics` 표에 표시한다. 이 표는 library/content/block-manifest cache 상태와 counter만 보여주며, 사용자 비밀번호, 세션 토큰, 가입코드 원문 같은 민감 정보는 표시 대상으로 추가하지 않는다.

확인 항목:

- `NODE_ENV`
- `DEPLOYMENT_MODE`
- `APP_ORIGIN`
- request protocol
- `x-forwarded-proto`
- data dir writable
- library path readable
- account/session/audit 저장소 상태

일반 user session은 이 API에 접근할 수 없어야 한다.

## 6. Origin mismatch

증상:

- login/register/admin mutation이 403
- 콘솔에 origin/fetch metadata 관련 오류

점검:

1. 브라우저 주소창 origin을 확인한다.
2. `APP_ORIGIN`과 `URL`에 같은 origin이 있는지 확인한다.
3. 포트가 다르면 다른 origin이다.
4. reverse proxy가 redirect로 origin을 바꾸는지 확인한다.

예:

```env
URL=http://192.168.1.100:3000,https://reader.example.com
APP_ORIGIN=http://192.168.1.100:3000,https://reader.example.com
```

## 7. public asset / CSP 진단

v405 이후 login/admin/index script는 외부 JS로 분리되어 `script-src`의 `unsafe-inline`을 사용하지 않는다.

확인:

- `/scripts/login.js`가 비로그인 상태에서 로드되는지
- `/scripts/admin-users.js`는 owner session에서 admin page와 함께 로드되는지
- 브라우저 콘솔에 CSP script-src 차단이 없는지

현재 `style-src`에는 `'unsafe-inline'`이 없으며 `style-src-attr 'none'`으로 inline style attribute를 차단한다.

## 8. 장애 시 우선 수집 정보

- 접속 URL
- `NODE_ENV`
- `DEPLOYMENT_MODE`
- `APP_ORIGIN` / `URL`
- reverse proxy 종류
- `X-Forwarded-Proto` 전달 여부
- owner diagnostics 결과
- `/healthz` 응답 여부
- 브라우저 console의 첫 번째 앱 오류


## v417 owner actions / release verify

- owner 콘솔의 사용자 생성, 수정, 활성 전환, 세션 강제 만료, 계정 삭제, 비밀번호 초기화 wiring은 `public/scripts/admin/actions.js`로 분리한다.
- 운영 진단과 배포 전 점검은 카드형 요약과 `details` 기반 원본 JSON을 함께 제공한다.
- `npm run release:verify -- <zip>`는 ZIP integrity, 금지 항목, precompressed hash, current-version lint, owner split smoke, frontend check를 clean extract에서 확인한다.
- 검색 모달에서 제거된 대소문자 구분/캐시 전용 옵션은 `search-option-dead-code-smoke`로 재도입을 방지한다.

## v436 cache I/O diagnostics

`/api/admin/diagnostics` 응답의 `ioDiagnostics`는 library/content/block-manifest cache 상태와 counters를 운영자가 확인하기 위한 값이다. marker는 `v436-io-diagnostics-cache-status-pass`이다.

노출 범위는 cache entry 수, inflight 수, byte 사용량, cache limit, chunk index pending/write/read counters, file read/stat counters로 제한한다. 절대 경로 세부 목록, 비밀번호, session token, invite/signup code 원문, 사용자별 권한 원문은 diagnostics에 추가하지 않는다.



## v442 cache metric threshold 표시

`/api/admin/diagnostics`의 `ioDiagnostics.thresholds.marker`는 `v442-cache-metrics-threshold-diagnostics-pass`이다. owner 콘솔은 이 값을 `Cache metric thresholds` 표로 표시한다.

표시 기준은 content inflight load, chunk index pending write, 최근 파일 읽기 시간, file cache byte 사용량, content/library/block-manifest miss 비율, manifest cache 한도 도달 여부다. 이 threshold는 운영 경고용이며 요청을 차단하거나 cache 전략을 자동 변경하지 않는다.

민감 정보 비노출 원칙은 유지한다. threshold warning에는 scope, metric, 숫자 값, 기준, 조치 문구만 포함하고 사용자 비밀번호, 세션 토큰, 가입코드 원문, 사용자별 권한 원문을 포함하지 않는다.

## Reader anchor trace diagnostics

`virtualDiagnostics.anchorTraceSummary` and `virtualDiagnostics.anchorTrace` are diagnostics-only evidence for scroll anchoring regressions. They record a bounded history of capture/restore events for both `single-file` and `multi-file` reader modes, including phase, anchor type, row id/index, chunk/episode scope, applied/reason/delta, and scroll geometry. The trace intentionally excludes absolute filesystem paths, passwords, session tokens, and invite/signup code raw values.

## v445 reader anchor regression reports

Recovery diagnostics now includes an `앵커링 리포트 JSON` action. The report is intended for both single-file and multi-file anchoring regression reports and includes the recent anchor trace, virtual layout diagnostics, current viewport, and stored progress. It intentionally avoids session tokens, passwords, signup/invite codes, and absolute library paths.

## v526 Cloudflare visitor in owner diagnostics

Owner 운영 상태 now uses the same HTTPS decision as login. For Cloudflare Tunnel deployments where NPM rewrites `X-Forwarded-Proto` to `http`, diagnostics accepts `CF-Visitor: {"scheme":"https"}` as the effective HTTPS signal only when `DEPLOYMENT_MODE=cloudflare-tunnel`.

The diagnostics request payload includes `effectiveProtocol`, `effectiveSecure`, `cloudflareVisitorScheme`, and `cloudflareVisitorHttpsTrusted`. Treat these as the primary production cookie status fields; raw `forwardedProto` remains visible for troubleshooting.

## v537 search scan diagnostics

`contentService.getCacheStatus()` exposes `searchScanLoadMitigationPass`, `metrics.searchScanRequests`, `metrics.searchScanPayloadWriteSkipped`, `metrics.lastSearchScanAt`, and `searchScanLastMarker`. These counters are intended to confirm that full-search content scans are marked and that cold search scans skip synchronous chunk payload disk writes. They do not indicate reader content cache failure; normal reader content requests still write payload cache entries.
## v538 disk cache auto-prune diagnostics

Owner 운영 상태의 `ioDiagnostics.diskCacheJanitor`는 `v538-disk-cache-auto-prune-diagnostics-pass`를 포함한다. 이 값은 `data/chunk_indexes`, `data/content_chunks`, `data/block_manifests`에 한정된 자동 정리 상태를 나타내며, 사용자 계정/세션/사용자별 독서 데이터/폰트/감사 로그는 정리 대상이 아니다.

확인 항목:

- `enabled`: 자동 정리 활성화 여부
- `fs.usedPct`, `fs.availableBytes`: data volume filesystem 사용량
- `cacheBytes`, `cacheFiles`, `perDir`: 정리 대상 캐시 용량
- `metrics.pruneRuns`, `metrics.filesDeleted`, `metrics.bytesDeleted`, `metrics.lastTrigger`: 실제 정리 이력

## v648 진단 필드

`state.libraryVirtualDiagnosticsError`는 설정에서 사용하는 경량 서재 진단이 실패했을 때만 기록된다. 이 오류는 설정 로드 전체를 중단하지 않는다. 반복 기록이 있으면 catalog state와 virtual row 입력을 확인한다.

검색 panel은 `data-search-layout-state=idle|running|empty|results`를 노출한다.

<!-- v648-production-diagnostics-pass -->
