# 배포 가이드 — v682 current

기준 build는 `rebuild-v682`이다. v682 전체 패키지를 배포한 뒤 Owner 관리 페이지에서 라이브러리 정리/재배치 스크립트를 다시 다운로드해야 한다. 기존 v681에서 내려받은 `.ps1`에는 호환성 결함이 남아 있으므로 재사용하지 않는다.

<!-- v682-deployment-pass -->

# 배포 가이드 — v681 current

기준 build는 `rebuild-v681`이다. Metadata 수동 입력 출처 필터의 HTML·ESM·precompressed 자산과 Service Worker cachebuster를 한 패키지로 배포한다.

<!-- v681-deployment-pass -->

# 배포 가이드 — v680 current

기준 build: `rebuild-v680`

1. `npm ci --omit=dev` 후 `node server.js --check-config`를 실행한다.
2. v680 전체 패키지를 배포해 HTML cachebuster, Service Worker BUILD와 precompressed 자산을 함께 갱신한다.
3. 로그인 화면의 Owner 팔레트와 서로 다른 두 사용자 계정의 테마 격리를 확인한다.
4. 서재→Metadata→Reader 이동 및 Metadata 직접 URL 진입에서도 현재 사용자 테마가 유지되는지 확인한다.

<!-- v680-deployment-theme-pass -->

# 배포 가이드 — v679 current

기준 build: `rebuild-v679`

1. 이전 v677 Service Worker가 열린 탭을 모두 닫거나 업데이트 완료를 확인한다.
2. v679 전체 패키지를 배포해 HTML의 `?v=rebuild-v679`, Service Worker BUILD와 precompressed 자산을 함께 갱신한다.
3. 확장 프로그램은 기존 폴더를 v679 파일로 교체한 뒤 `chrome://extensions` 또는 `whale://extensions`에서 새로고침한다.
4. `node server.js --check-config`, targeted/static 검증을 실행한다.

<!-- v679-deployment-cache-refresh-pass -->

# 배포 가이드 — v676 current

기준 버전: `rebuild-v676`

기준 버전: `rebuild-v674`

<!-- v673-deployment-current-pass -->

기준 버전: rebuild-v672

# TXT Reader Multi 배포 가이드

기준 버전은 `v669` / `6.70.0` / `rebuild-v670`이다.

기준 버전: rebuild-v670

## 직접 Node 실행

```bash
npm ci --omit=dev
node server.js --check-config
node server.js
```

`node .`과 `npm start`도 같은 launcher를 사용한다. 기본 `.env`는 project root에서 읽는다. `--env-file`에 상대 경로를 주면 현재 실행 디렉터리 기준으로 찾고, env 내부의 상대 `LIBRARY_PATH`·`TXT_READER_DATA_DIR`은 env 파일 위치 기준으로 해석한다. CLI로 준 경로는 실행 디렉터리 기준이다.

## Docker 실행

기존 `docker compose up -d --build` 경로를 유지한다. Docker entrypoint와 직접 Node 실행 모두 `server/bootstrap.js`에 도달해야 한다. 배포 후 `/healthz`, 로그인, 서재, Reader, 수동 metadata 표지 업로드를 확인한다.

## Proxy

Cloudflare Tunnel → NPM:80 HTTP → TXT Reader:3000 HTTP 구성을 사용한다. 외부 TLS/HSTS는 Cloudflare가 담당하며 상세는 `proxy-tunnel-setup.md`를 따른다.

<!-- v669-deployment-current-pass -->

기준 버전: rebuild-v664

# v664 배포 요약

현재 build는 `rebuild-v664`이다. 배포 후 서재에서 작품을 열어 이어보기 선택창과 탐색기 최근·즐겨찾기를 확인한다. Cloudflare Tunnel→NPM HTTP 구성은 `proxy-tunnel-setup.md`를 따른다.

<!-- v664-deployment-current-pass -->

# v663 배포 요약

현재 build는 `rebuild-v663`이다. Cloudflare Tunnel이 NPM `80/http`로 연결되면 NPM의 Force SSL·HSTS·HTTP/2를 끄고 Cloudflare에서 HTTPS/HSTS를 처리한다. 상세 설정과 표지 redirect 진단은 `proxy-tunnel-setup.md`를 따른다.

<!-- v663-deployment-current-pass -->

# v661 배포 기준

- package version: `6.61.0`
- runtime build/cache: `rebuild-v663`
- 배포 전 ZIP SHA-256, archive 안전성, package manifest 전수 대조를 수행한다.
- `FILEOPS_MUTATION_QUEUE_MAX`, `FILEOPS_MUTATION_WAIT_TIMEOUT_MS`, `FILEOPS_MUTATION_WATCHDOG_MS`를 환경에 맞게 조정한다.
- `data/accounts.json.login-telemetry.json`은 로그인 시각 sidecar이며 계정 파일과 같은 durable volume에 둔다.
- 실제 Docker, Samsung Internet, 8만 파일 HDD/SMB, 외부 provider는 실행 여부를 별도로 기록한다.

<!-- v661-deployment-current-pass -->

기준 버전: rebuild-v663

# v660 배포 기준

기준 버전: rebuild-v660

- package version: `6.60.0`
- runtime build/cache: `rebuild-v660`
- PWA asset cache가 v660으로 전환되는지 확인한다.
- 독서 데이터 제목과 Reader 설정 탭은 v660 targeted/browser 회귀를 실행한다.
- 실제 Docker, Samsung Internet, 8만 파일 HDD/SMB는 실행하지 않았다면 미검증으로 기록한다.

<!-- v660-deployment-current-pass -->

# v659 배포 기준

- package version: `6.59.0`
- runtime build/cache: `rebuild-v659`
- 배포 전 ZIP SHA-256과 package manifest를 확인하고 기존 컨테이너의 durable data volume은 교체하지 않는다.
- PWA asset cache가 v659으로 전환되는지 확인한다.
- 실제 Samsung Internet, Docker/Podman, Cloudflare Tunnel/NPM 경계 검증은 수행 여부를 별도로 기록한다.

<!-- v659-deployment-current-pass -->

기준 버전: rebuild-v659

# v657 배포 기준

현재 배포 build는 `rebuild-v657`이며 package version은 `6.57.0`이다. 정적 자산과 Service Worker cachebuster가 모두 v657인지 확인한다. 실제 Android/Samsung Internet과 reverse proxy 경계는 별도 실환경 검증 대상으로 남긴다.

<!-- v657-deployment-current-pass -->

# v656 배포 기준

현재 배포 build는 `rebuild-v656`이며 package version은 `6.56.0`이다.

<!-- v656-deployment-current-pass -->

기준 버전: rebuild-v655

# v655 배포 기준

현재 배포 기준은 `6.55.0` / `rebuild-v655`이다. 변경된 app/deferred/admin CSS, Explorer·Shelf·cleanup runtime과 원본·gzip·Brotli를 함께 배포하고 Service Worker version query를 유지한다. v654 자산과 혼용되면 폴더 접기·설정 스크롤·검토 후보 안내가 보장되지 않는다.

<!-- v655-deployment-current-pass -->

기준 버전: rebuild-v654

# v654 배포 기준

현재 배포 기준은 `6.54.0` / `rebuild-v654`이다. 변경된 settings fragment/CSS와 library shelf/favorites/quick-action runtime의 원본·gzip·Brotli를 함께 배포하고 Service Worker version query를 유지한다. v653 HTML 또는 CSS가 혼용되면 새 범위 제거와 설정 scroll 계약이 보장되지 않는다.

<!-- v654-deployment-current-pass -->

기준 버전: rebuild-v654

# v653 배포 기준

현재 배포 기준은 `6.53.0` / `rebuild-v653`이다. 신규 `library-header-scroll-state.mjs`와 변경된 settings/shelf/explorer runtime의 원본·gzip·Brotli를 함께 배포하고 Service Worker version query를 유지한다.

<!-- v653-deployment-current-pass -->

기준 버전: rebuild-v652

# v652 배포 기준

현재 배포 기준은 `6.52.0` / `rebuild-v652`이다. `public/styles/admin-users-v652.css`와 변경된 설정 fragment/runtime, Reader jump runtime의 gzip/Brotli를 원본과 함께 배포한다. 오래된 HTML·CSS가 혼용되지 않도록 Service Worker build handshake와 version query를 유지한다.

<!-- v652-deployment-current-pass -->

기준 버전: rebuild-v651

# v651 배포 기준

현재 배포 기준은 `6.51.0` / `rebuild-v651`이다. update banner critical CSS는 Service Worker 등록 전에 배포하고 `/styles/update-banner.css`를 로그인 전 public asset으로 유지한다.

<!-- v651-deployment-current-pass -->

기준 버전: rebuild-v650

# v650 배포 기준

현재 배포 기준은 `6.50.0` / `rebuild-v650`이다. 설정 화면 변경 후 precompressed asset과 Service Worker query version을 함께 배포한다.

<!-- v650-deployment-pass -->

기준 버전: rebuild-v649
기준 버전: `rebuild-v649`

# v648 배포 주의

기준 버전: rebuild-v648. `data/work-metadata-applied.json.gz(.bak)`는 첫 applied mutation 또는 migration에서 자동 생성되므로 data directory의 쓰기 권한과 여유 공간을 확인한다. 기존 `data/library-catalog-cache.json.gz(.bak)`는 유지한다. v648부터 같은 경로에 `.state.json(.bak)`이 생성된다. data directory가 쓰기 가능하지 않으면 mutation state를 보존할 수 없으므로 배포 전 권한과 여유 공간을 확인한다.

<!-- v648-deployment-catalog-state-pass -->

# v648 배포 기준

기준 버전: rebuild-v648

배포 후 설정 화면에서 `getLibraryCurrentWindowRows is not defined` 오류가 재발하지 않는지와 모바일 Reader 본문 검색 모달의 compact idle layout을 확인한다.

<!-- v648-deployment-pass -->

# v646 배포 기준

기준 버전: rebuild-v646

# v646 배포 가이드

기준 버전: `rebuild-v646`.

metadata gzip을 평문으로 되돌리지 않는다. 기존 `work-metadata.json.gz(.bak)`와 fingerprint gzip을 백업한 뒤 배포한다. 새 운영 변수의 기본값은 `LIBRARY_REQUEST_COLD_WAIT_MS=4000`, `LIBRARY_SHELF_BUILD_CONCURRENCY=1`, `LIBRARY_SHELF_BUILD_MAX_PENDING=8`이다.

배포 후 cold start에서 503이 잠시 보일 수 있으나 단일 background build가 끝나면 정상화되어야 한다. 지속적인 503은 SMB 지연, 권한 오류 또는 incomplete scan을 진단한다. 대기열·동시성을 무작정 늘리지 않는다.

<!-- v646-deployment-pass -->

# v645 배포 가이드

기준 버전: rebuild-v645

v645는 data schema migration을 추가하지 않는다. 배포 후 브라우저가 `/sw-rebuild-v645.js`와 `?v=rebuild-v645` 실행 자산으로 전환됐는지 확인한다. 모바일 서재 scope tab, Reader의 공용 scroll-to-top 미표시, network badge와 본문 검색 modal을 확인한다.

<!-- v645-deployment-pass -->

# v642 배포 가이드

## v644 fingerprint 진입 지연

`LIBRARY_FINGERPRINT_ENTRY_DELAY_MS`는 서재 첫 응답과 HDD/SMB fingerprint sample I/O 사이의 지연이다. 기본값은 `15000`ms이며 허용 범위는 1,000~120,000ms다. batch와 concurrency는 기존 `LIBRARY_FINGERPRINT_BACKGROUND_BATCH`, `LIBRARY_FINGERPRINT_CONCURRENCY`를 사용한다.

<!-- v644-deployment-fingerprint-delay-pass -->

기준 버전: rebuild-v644


## v643 배포 추가 절차

기준 build는 `rebuild-v644`이다. 기존 data directory와 `work-metadata.json.gz(.bak)`를 백업한 뒤 배포한다. 라이브러리 구조 변환은 배포 과정에서 자동 실행되지 않는다. Owner > 파일 정리 > 라이브러리 정리에서 **복사 mode** 스크립트를 내려받아 별도 destination에서 검증하고, 컨테이너 mount를 전환한 뒤 필요할 때만 구 경로를 정리한다.

비한국어 UI에서 metadata provider가 보이지 않는 것은 정상 계약이다. 수집 운영은 Owner site language를 한국어로 선택한 세션에서 수행한다.

<!-- v643-deployment-pass -->


기준 버전: rebuild-v642


기준 버전: `rebuild-v642`

첫 기동에서 기존 `work-metadata.json`과 fingerprint JSON이 있으면 gzip migration이 예약된다. 압축 primary 저장 성공 전에는 legacy 파일을 삭제하지 않는다. 배포 후 Owner storage 화면에서 source가 `compressed-primary`인지 확인한다. 후보 cleanup은 자동 실행되지 않는다.

<!-- v642-deployment-pass -->

# v638 배포 가이드

## v641 배포 gate

production secret example 값은 서버 시작 또는 session store 생성 단계에서 거절된다. Docker/browser/provider DNS가 없는 환경에서는 `predeploy_environment_gate.js`가 JSON blocked 항목을 남긴다. 이 결과를 실제 실행 성공으로 해석하지 않는다.

<!-- v641-current-doc-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

기준 버전: rebuild-v641

배포 전 추가 확인:

1. 활성 Service Worker가 있는 브라우저에서 로그아웃 후 로그인 화면의 두 스크립트가 200으로 실행되는지 확인한다.
2. 세션 만료 redirect 뒤 로그인 및 재로그인을 확인한다.
3. v637/v636 탭이 남은 상태에서 canonical manual cover 저장이 성공하고 외부 URL 입력은 거절되는지 확인한다.
4. metadata 후보 묶음의 공급자 링크와 표지 변형 수를 실제 공급자 데이터로 확인한다.
5. 긴 서재·metadata·reader 화면에서 맨 위 버튼이 실제 스크롤 컨테이너를 올리는지 확인한다.

<!-- /v638-current-summary -->


기준 버전: rebuild-v641

현재 package version은 `6.41.0`, runtime marker는 `rebuild-v641`이다. origin/CDN에는 HTML, `/service-worker-register.js`, `/sw-rebuild-v641.js`, versioned runtime assets를 같은 배포 단위로 올린다. 오래된 HTML 또는 실행 asset 요청이 남아도 서버는 current executable을 조용히 반환하지 않고 409 reload-required를 반환한다.

배포 후 Service Worker client state Cache Storage record가 생성되는지, 업데이트 연기 탭이 worker 재시작 뒤에도 차단되는지 확인한다. `METADATA_COVER_DIR`은 cover 파일과 `.pending-cover-leases.json`의 atomic write·fsync를 지원해야 하며, symlink asset은 유효한 표지로 인정하지 않는다.

<!-- v637-deployment-pass -->

# v636 배포 확인


기준 버전: rebuild-v636
배포 후 첫 업데이트에서 여러 탭을 열어 둔 경우 v635 이하 탭은 짧은 유예 후 자동 갱신될 수 있다. `METADATA_COVER_DIR`은 표지 파일뿐 아니라 `.pending-cover-leases.json`의 atomic rename·fsync가 가능해야 한다. 읽기 전용 또는 directory fsync 불가 volume에서는 업로드가 실패할 수 있으므로 사전 확인한다.

현재 runtime marker: `rebuild-v636`.

<!-- v636-deployment-pass -->

# v635 배포 기준

기준 버전: rebuild-v635

현재 package version은 `6.35.0`, runtime marker는 `rebuild-v635`이다. 운영자가 새 ZIP 또는 container image를 배포한 뒤 브라우저의 `업데이트 적용` 버튼은 새 Service Worker 정적 build를 활성화한다. 버튼 자체가 서버 ZIP이나 Docker image를 다운로드·교체하지는 않는다. 배포 후 `/sw-rebuild-v635.js`와 정적 자산이 origin/CDN에서 함께 제공되는지 확인한다.

<!-- v635-deployment-pass -->

# v627 update 권한·listen 경계

기준 버전: rebuild-v634

기준 버전: `rebuild-v634`

- `HOST=0.0.0.0` 또는 Compose의 `TXT_READER_BIND_ADDRESS=0.0.0.0`은 모든 host interface에서 listen한다. 외부 노출은 host port publish, firewall, router port-forward, reverse proxy/Tunnel 구성으로 제한한다.
- 시스템 update 승인 endpoint는 인증 세션과 library+metadata 권한을 서버에서 판정한다. reverse proxy cache 대상에서 제외하고 cookie와 no-store를 보존한다.

<!-- v627-reaudit-patch-pass -->

# v626 Docker host publish 주소

일반 Compose는 다음 형식으로 host port를 publish한다.

```yaml
ports:
  - "${TXT_READER_BIND_ADDRESS:-0.0.0.0}:${PORT:-3000}:3000"
```

- LAN의 다른 기기에서 직접 접근하거나 별도 host/LXC의 NPM이 접근해야 하면 기본 `TXT_READER_BIND_ADDRESS=0.0.0.0`을 사용한다.
- reverse proxy가 같은 host에 있고 외부 직접 접근을 막으려면 `TXT_READER_BIND_ADDRESS=127.0.0.1`로 제한한다.
- `0.0.0.0`은 모든 host interface에 publish하므로 공유기 포트포워딩과 host 방화벽에서 WAN 직접 접근을 차단해야 한다.
- cloudflared sidecar 예제는 host port를 publish하지 않으며 이 변수와 무관하게 private Docker network를 사용한다.

<!-- v626-docker-bind-address-pass -->

기준 버전: rebuild-v626

## v613 배포 추가 점검

- 런타임/cache marker와 정적 자산 query가 모두 `rebuild-v613`인지 확인한다.
- 계정 전환 후 `txt-reader.rebuild.scope.<userId>.*` localStorage와 사용자별 IndexedDB cache가 섞이지 않는지 공용 브라우저에서 확인한다.
- 제한 계정은 `/api/user-access/snapshot?includeNovelIds=true` 상세 응답을 받을 수 있어야 하며 reverse proxy가 query를 제거하지 않아야 한다.
- 진행도 delta route `PATCH /api/user-state/progress/:novelId`와 lifecycle keepalive 요청이 reverse proxy에서 차단되지 않는지 확인한다.
- 배포 호스트에 `zip`, `unzip`, `zipinfo`가 있어야 릴리스 ZIP 생성·검증이 가능하다. TAR를 ZIP으로 대체하지 않는다.
- IndexedDB가 차단된 브라우저에서는 축약 localStorage fallback 경고가 표시되는지 확인한다.

기준 버전: rebuild-v626

## v611 startup persistence probe contract

- 시작 probe는 `$TXT_READER_DATA_DIR/.write-check.$$`와 `user-data/.write-check.$$`처럼 현재 프로세스 전용 경로만 사용한다.
- 기존 `.write-check` 디렉터리를 재귀 삭제하지 않는다.
- data root뿐 아니라 실제 계정·사용자 상태 저장 위치인 `user-data`도 쓰기 가능해야 서버를 시작한다.
- 임시 오류 로그는 프로세스별 파일을 사용하고 종료 시 제거한다.

## v610 runtime data directory contract

The Node server and Docker entrypoint both use `TXT_READER_DATA_DIR`. The default is `/app/data`. `DATA_DIR` remains supported only as a lower-priority entrypoint alias; when both are present, `TXT_READER_DATA_DIR` wins. Compose users who change this path must mount the same container path and keep it writable by UID 1000/GID 0.

# v606 배포 추가 점검

- 현재 runtime/cache marker: `rebuild-v613`.
- login/logout 성공은 session JSON durable flush 이후 반환되므로 `data` volume의 쓰기 권한과 fsync 오류를 배포 전에 확인한다.
- graceful shutdown은 HTTP drain, 저장소 flush, content worker terminate를 포함한다. Compose stop grace는 앱 유예보다 길어야 한다.
- library mutation을 사용하지 않으면 library mount는 read-only를 유지한다.

# v605 배포 전 확인

1. `/healthz`와 화면 badge가 `rebuild-v605`/`v605`인지 확인한다.
2. 기본 library mount는 `LIBRARY_MOUNT_MODE=ro`다. 이동·삭제 기능이 필요한 경우에만 `rw`를 명시한다.
3. 앱 종료 유예 45초보다 Compose `stop_grace_period` 60초가 길어야 한다.
4. `DEPLOYMENT_MODE=direct`에서는 forwarded headers를 신뢰하지 않는다. reverse proxy 사용 시 `trusted-proxy` 또는 `cloudflare-tunnel`을 선택하고 origin 직접 접근을 차단한다.
5. v605 ZIP의 clean verifier와 실제 Docker build/run을 실행한다.

기준 버전: `rebuild-v605`

## v605 배포 전 확인

1. `/app/data`에서 file·directory fsync와 atomic rename이 가능한지 확인한다. SMB/NFS 계열 data volume은 rename·fsync semantics를 별도 검증한다.
2. graceful stop에서 final persistence 실패가 발생하면 컨테이너 종료 code를 성공으로 취급하지 않는다.
3. `/healthz` build, `X-TXT-Reader-Build`, owner/metadata badge가 모두 v605인지 확인하고 오래된 sidecar·proxy cache를 제거한다.
4. 수천 태그 계정은 기본 자동 모드와 검색/cursor 탐색을 사용하며 브라우저 DOM에 전체 태그를 한 번에 생성하지 않는다.
5. production 규모에서 password operation 중 event-loop delay, disk-cache janitor, metadata queue flush를 관찰한다.

# v584 메타데이터 Playwright 배포

1. Docker 이미지는 `node:20.20.2-bookworm-slim`에서 `playwright-chromium`과 Chromium 시스템 의존성을 설치한다. 기존 Alpine 기반 이미지를 재사용하지 말고 반드시 재빌드한다.
2. `data/metadata-browser-profiles/`를 포함한 `/app/data`가 UID 1000에서 쓰기 가능해야 한다. 프로필은 계정 세션을 포함할 수 있으므로 백업·권한을 민감 정보로 취급한다.
3. 공급자 ID·비밀번호와 `METADATA_AUTH_SECRET`은 `.env`에 넣지 않는다. owner가 `/metadata.html`의 중계 화면에서 직접 로그인한다.
4. Playwright를 사용할 수 없는 런타임은 `METADATA_PLAYWRIGHT_ENABLED=0`으로 끄고 Metadata Helper를 사용한다. 커스텀 Chromium은 `METADATA_PLAYWRIGHT_EXECUTABLE_PATH`로 지정한다.
5. reverse proxy는 `/api/metadata/*`와 PNG screenshot 응답을 다른 API와 동일하게 전달하되 no-store를 덮어쓰지 않는다. WebSocket은 사용하지 않는다.
6. 컨테이너가 공식 공급자와 인증 호스트로 outbound HTTPS를 수행할 수 있어야 한다.

## v573 대형 TXT cache·Docker 배포

- `data/normalized_content`의 v572 이하 index는 `v573-filechar-chunk-index-2`와 다르므로 해당 작품 최초 접근 시 재생성한다. 서버 시작 시 일괄 변환하지 않는다.
- `/app/data`에는 normalized cache와 계정·세션·사용자 데이터가 함께 있으므로 삭제 범위를 구분한다. cache 롤백 정리는 앱 중지 후 `data/normalized_content`만 대상으로 한다.
- Docker image는 고정 비-root `UID 1000`, primary `GID 0`이다. `APP_UID`, `APP_GID`, `APP_RUNTIME_GID` 환경변수로 runtime identity를 변경하지 않는다.
- 실제 `/app/docker-entrypoint.sh`가 `/app/data` 존재와 쓰기 가능 여부를 검사한 뒤 서버를 실행한다.
- bind mount는 `1000:1000` owner-write 또는 GID 0 group-write 구성을 사용한다. compose의 `create_host_path:false` 때문에 호스트 `./data`를 먼저 만들어야 한다.

# Deployment guide

기준 버전: rebuild-v605

이 문서는 `txt_reader_multi` 계열을 내부망 또는 HTTPS reverse proxy 뒤에서 운영하기 위한 최소 배포 기준을 정리한다.

## v574 기본 페이지 흐름

- `/`와 일반 사용자 로그인 성공 후 기본 목적지는 `/library.html`이다.
- `/library.html`은 서재 전용 페이지이며 작품 선택 시 `/site.html?novelId=<id>` 또는 `/mobile.html?novelId=<id>`로 이동한다.
- 리더 페이지는 서재 사이드바를 함께 렌더링하지 않으며 상단 복귀 버튼으로 `/library.html`에 돌아간다.
- 세 HTML 진입점은 모두 `Cache-Control: no-store`로 제공한다. reverse proxy가 이를 장기 캐시로 덮어쓰지 않게 한다.


## 1. 필수 환경변수

```env
LOGINID=owner_admin
LOGINPW=change_this_to_14_chars_or_more
OWNER_PASSWORD_MIN_LENGTH=14
USER_PASSWORD_MIN_LENGTH=8
PORT=3000
URL=http://localhost:3000
APP_ORIGIN=http://localhost:3000
REQUIRE_STRICT_ORIGIN=1
ALLOW_CLOUDFLARE_INSIGHTS=0
ALLOW_BLOB_WORKER=0
LIBRARY_PATH=/absolute/path/to/novels
DEPLOYMENT_MODE=direct
LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS=30000
LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS=300000
LIBRARY_SIGNATURE_CHECK_CONCURRENCY=8
```

`LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS`는 비동기 변경 확인 기본 간격이고, `LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS`는 느린 SMB에서 자동 backoff할 최대 간격이다. `LIBRARY_SIGNATURE_CHECK_CONCURRENCY`는 동시에 실행할 metadata stat 수이며 기본 8이다.

`LOGINID`와 `LOGINPW`는 owner 콘솔 전용 계정이다. 일반 독서 계정은 owner 콘솔에서 직접 만들거나 가입코드 기반 회원가입으로 생성한다.

## 2. production 비밀번호 정책

`NODE_ENV=production`에서는 `LOGINPW`가 공백 제거 기준 `OWNER_PASSWORD_MIN_LENGTH` 이상이어야 한다. 기본값은 14이며 보안 하한은 10이다. 조건을 만족하지 않으면 `/api/login`은 설정 오류로 차단된다. development/local smoke 환경은 짧은 테스트 비밀번호를 계속 허용한다.

## 3. production session cookie

`NODE_ENV=production`에서는 로그인 쿠키로 `__Host-session_token`을 발급한다. 이 쿠키는 `Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`를 사용하며 `Domain`을 설정하지 않는다.

브라우저 접속 origin이 HTTPS가 아니면 Secure cookie가 저장되지 않는다. v391부터는 이 조합에서 로그인 성공처럼 보인 뒤 되돌아가는 대신 `/api/login`이 `production_https_required` 오류와 진단 payload를 반환하며, 로그인 화면도 세션 쿠키 저장 여부를 `/api/csrf`로 확인한 뒤 이동한다.

## 4. Origin 설정

`APP_ORIGIN`과 `URL`을 모두 읽어서 허용 origin을 병합한다. 내부망과 외부망 주소가 둘 다 필요하면 쉼표로 구분한다. 경로(`/login.html`)가 아니라 origin만 입력한다.

Production strict origin mode requires an explicit `APP_ORIGIN` or `URL`. If both are empty, unsafe API requests fail closed instead of trusting the request `Host` fallback.

```env
URL=http://192.168.1.100:3000,https://reader.example.com
APP_ORIGIN=http://192.168.1.100:3000,https://reader.example.com
```

## 5. 배포 모드

| 모드 | 용도 | 주요 설정 |
|---|---|---|
| `direct` | 내부망 직접 접속 | `NODE_ENV` 비움 또는 development, HTTP 가능 |
| `trusted-proxy` | Nginx Proxy Manager/Caddy/Traefik 등 HTTPS reverse proxy 뒤 | `NODE_ENV=production`, `X-Forwarded-Proto: https` 필요 |
| `cloudflare-tunnel` | Docker cloudflared sidecar 전달 | `NODE_ENV=production`, 앱 `HOST=0.0.0.0`, host port 미공개 |

### 내부망 direct 예시

```env
NODE_ENV=
DEPLOYMENT_MODE=direct
URL=http://192.168.1.100:3000
APP_ORIGIN=http://192.168.1.100:3000
HOST=0.0.0.0
```

### HTTPS reverse proxy 예시

```env
NODE_ENV=production
DEPLOYMENT_MODE=trusted-proxy
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=0.0.0.0
```

reverse proxy는 다음을 전달해야 한다.

- `Host`
- `X-Forwarded-Proto: https`
- 실제 클라이언트 IP 헤더가 필요하면 `CLIENT_IP_HEADER`에 명시

### Cloudflare Tunnel 예시

```env
NODE_ENV=production
DEPLOYMENT_MODE=cloudflare-tunnel
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=0.0.0.0
CLIENT_IP_HEADER=CF-Connecting-IP
```

### Cloudflare Tunnel + 내부 NPM 신뢰 경계

`cloudflare-tunnel` 모드에서 `CF-Visitor: {"scheme":"https"}`를 production HTTPS 판정에 사용하는 것은 다음 경로만 외부 진입점이라는 전제에서 안전하다.

```text
외부 사용자 -> Cloudflare -> cloudflared outbound tunnel -> 내부 NPM 또는 Node 앱
```

따라서 다음 포트는 WAN/공유기 포트포워딩/공용 방화벽에서 직접 열지 않는다.

- NPM 관리자 포트: 보통 `81`
- NPM service entry: `80`, `443`
- Node 앱 포트: 보통 `3000`
- 기타 내부 앱 포트

관리자 포트만 막는 것으로는 부족하다. NPM의 일반 서비스 포트 `80/443`이 외부에서 직접 접근 가능하면 공격자가 Cloudflare를 우회해 `CF-Visitor`, `CF-Connecting-IP`, `X-Forwarded-Proto` 헤더를 위조할 수 있다. 이 경우 `DEPLOYMENT_MODE=cloudflare-tunnel`의 신뢰 모델이 성립하지 않는다.

Cloudflare Tunnel 뒤에 NPM을 둘 때 권장 흐름은 다음과 같다.

```text
Cloudflare Tunnel public hostname: reader.example.com -> http://NPM_내부IP:80
NPM proxy host: reader.example.com -> http://Node앱_내부IP:3000
공유기 포트포워딩: 80/443/81/3000 없음
```

## 6. 운영 진단

owner 콘솔에서 `운영 진단` 버튼을 누르면 `/api/admin/diagnostics`를 통해 다음을 확인한다.

- `NODE_ENV`
- `DEPLOYMENT_MODE`
- request protocol
- `x-forwarded-proto`
- data dir writable
- library path readable
- account/session/audit 저장소 상태

상세 진단 절차는 `docs/production-diagnostics.md`를 참조한다.

## 7. 가입코드 기반 회원가입

일반 사용자는 owner가 발급한 가입코드로만 회원가입할 수 있다.

1. owner 콘솔에서 가입코드를 발급한다.
2. 코드에 `libraryAccess`를 설정한다.
3. 사용자는 로그인 화면의 회원가입 탭에서 코드와 계정 정보를 입력한다.
4. 가입 성공 후 로그인 화면에서 다시 로그인한다.

가입코드 원문은 저장하지 않고 hash만 저장한다. 기본 운영은 일회용 코드가 권장된다.

## 8. Healthcheck

컨테이너와 reverse proxy 상태 확인은 `/healthz`를 사용한다.

```bash
curl -f http://localhost:3000/healthz
```

## 9. 배포 ZIP 제외 원칙

활성 통합 sync 상태는 data volume의 `data/sync_data.json`에 저장된다. v590 이하에서 생성된 루트 `sync_data.json(.bak)`은 신규 data 파일이 없을 때 자동으로 읽어 비파괴 이관하므로 첫 v591 배포 전까지 별도 백업을 유지한다.

배포 ZIP에는 다음을 포함하지 않는다.

- `node_modules`
- `data`
- `sync_data.json`
- `sync_data.json.bak`
- `test_novels`
- `.npm-cache`
- `package-lock.json`

## 10. v411 운영 진단 자동 판정

v411부터 `/api/admin/diagnostics`는 `summary`, `findings`, `checklist`, `diagnosticsGradePass`를 반환한다.

owner 콘솔은 이를 다음처럼 표시한다.

| 등급 | 기준 |
|---|---|
| `ok` | 운영 전제와 현재 요청/저장소 상태가 충돌하지 않음 |
| `warn` | 동작 가능하지만 외부망 운영 전 확인 필요 |
| `error` | 로그인 유지, 쿠키, 저장소, 라이브러리 스캔 실패 가능 |

대표 오류는 다음과 같다.

- `production_https`: `NODE_ENV=production`이지만 HTTPS로 인식되지 않음
- `forwarded_proto_mismatch`: proxy/tunnel scheme header가 production HTTPS와 불일치
- `app_origin_mismatch`: 현재 접속 origin과 `APP_ORIGIN` 첫 항목이 다름
- `owner_password_policy`: production owner 비밀번호가 너무 짧음
- `storage_writable`: data/accounts/session/audit 저장소 쓰기 권한 문제
- `library_readable`: `LIBRARY_PATH` 읽기 또는 라이브러리 스캔 문제

NPM/Cloudflare 상세 설정은 `docs/proxy-tunnel-setup.md`를 참조한다.


## v442 deployed cache header check

배포 후 Cloudflare/NPM이 origin의 cache/security 관련 header를 덮어쓰지 않는지 다음 스크립트로 점검할 수 있다. marker는 `v442-deployed-cache-header-check-pass`이다.

```bash
node tools/check_deployed_cache_headers.js https://reader.example.com --cookie="session_token=..." --version=rebuild-v500
```

원칙:

- `/login.html`, `/site.html`, `/mobile.html`, `/admin/users.html`은 `no-store`여야 한다.
- `/api/*`는 public/immutable cache가 아니어야 한다. reader API는 private revalidation 또는 no-store만 허용한다.
- `/scripts/rebuild/main.mjs?v=rebuild-v500` 같은 versioned rebuild asset만 장기 immutable 대상이다.
- query 없는 `/scripts/rebuild/main.mjs`는 `public, max-age=0, must-revalidate`여야 한다.
- precompressed 응답은 `Vary: Accept-Encoding`, `Content-Encoding`, `ETag`/`Last-Modified`를 보존해야 한다.

스크립트는 쿠키를 저장하지 않는다. `--cookie`를 생략하면 로그인 없이 확인 가능한 `/login.html`만 확인하고 나머지 인증 필요 경로는 skip한다.

## v530 dependency and container policy

Release archives include `package-lock.json`. Production deployments should use `docker compose build` or `npm ci --omit=dev` rather than `npm install` at container start. The default compose file builds from the Dockerfile and applies read-only rootfs, dropped capabilities, and `no-new-privileges`.

Set `SESSION_STORE_SECRET` to a stable random value of at least 16 characters in production. Production startup fails when it is missing or too short.

Set `MAX_TEXT_FILE_BYTES` according to the largest TXT file you intentionally serve. The default is 100 MiB.

### Proxmox LXC Docker build AppArmor failure

If `docker compose up -d` fails during `Dockerfile RUN npm ci` with an error similar to:

```text
runc run failed: unable to start container process: error during container init: unable to apply apparmor profile: apparmor failed to apply profile: write fsmount:fscontext:proc/thread-self/attr/apparmor/exec: no such file or directory
```

then the build container did not even reach npm. This is a nested-Docker AppArmor/LXC host issue. The package lock is not the direct cause. Recommended options, in order:

1. Run Docker on a VM or host instead of inside LXC.
2. If Docker must run inside LXC, make sure the CT is configured for Docker nesting and AppArmor support according to the host policy.
3. Avoid exposing NPM/Node directly to WAN even if relaxing LXC/AppArmor for local deployment.

v563 pins the Docker build path to the public npm registry in two places: `.npmrc` is copied before `npm ci`, and every `package-lock.json` `resolved` tarball URL must avoid sandbox/internal registry hosts such as `packages.applied-caas` or `internal.api.openai`. The related guard is `node tools/checks/package-lock-public-registry-smoke.js`.


## v590 정적 자산·컨테이너 버전 확인

```bash
docker compose up -d --build --force-recreate txt_reader
curl -sS http://127.0.0.1:3000/healthz
curl -sSI http://127.0.0.1:3000/metadata.html | grep -i 'x-txt-reader-build\|cache-control'
```

`/healthz`의 `build`와 `X-TXT-Reader-Build`는 `rebuild-v605`이어야 하며 메타데이터 화면 제목 옆에는 `v605`이 표시되어야 한다. 이전 Cookie UI 또는 1.8~2.4초 요청 간격이 보이면 이전 이미지·환경값·정적 자산을 제공하고 있는 상태다. v604는 3000ms 미만의 구형 기준값을 3000ms로 보정한다.



## v592 종료·파일 조작 확인

- 종료 로그 이후 active metadata 수집 handler가 남지 않고 queue/store 상태가 최종 저장되는지 확인한다.
- SMB 라이브러리의 rename/move/delete는 async 직렬 mutation queue를 사용한다. 대형 폴더 이동 전에 전체 재귀 scan을 수행하지 않는다.
- service worker static cache는 동일 path의 query 변형을 별도 entry로 누적하지 않으며 최대 512개로 제한된다.

<!-- v592-deployment-lifecycle-check-pass -->

## v593 공급자 프로필·종료 확인

- owner 콘솔 metadata 탭에서 5개 공급자 카드가 Playwright 지원 상태를 표시하는지 확인한다.
- 필요한 공급자별 로그인을 완료한 뒤 profile status가 `ready`인지 확인한다.
- `/healthz` build와 metadata badge는 `rebuild-v594`/`v594`여야 한다.
- SIGTERM 배포 시 HTTP request가 먼저 drain되고 metadata/session/sync/user-state/Playwright/audit flush가 완료되는지 로그를 확인한다.

<!-- v593-deployment-provider-shutdown-pass -->
## v640 provider 운영 주의

소설넷은 외부 공개 HTML provider이므로 사이트 구조 변경이나 접근 제한에 영향을 받을 수 있다. 실패 시 다른 provider 수집을 중단하지 않으며, 운영 로그에서 `builtin-ssn` job의 transport·parse 단계와 최종 URL을 확인한다.

<!-- v640-deployment-provider-pass -->

## Cloudflare 530 경계 확인

외부 정적 리소스가 530이면 응답 본문의 1XXX 코드와 `CF-Ray`를 먼저 기록한다. 앱 직접 경로 `http://10.250.4.246:3000/fragments/deferred-ui.html`, NPM 경유 경로, 외부 도메인을 순서대로 비교한다. 앱 직접 경로가 200이고 외부만 530이면 Cloudflare DNS/Tunnel 경계 문제다.

<!-- v662-deployment-530-pass -->
# v674 배포 주의사항

- package `6.74.0`, build `rebuild-v674`, Service Worker cache `txt-reader-static-rebuild-v674`를 한 세트로 배포한다.
- read-only filesystem, disk full, SMB disconnect 또는 directory sync 오류는 이제 durable mutation 실패로 반환된다. data와 library mount가 directory sync를 지원하는지 staging 환경에서 확인한다.
- Cloudflare Tunnel → NPM 구성은 앱 서버 포트에 대한 직접 외부/LAN 접근을 차단하고 proxy가 `CF-Connecting-IP` 등 신뢰 header를 덮어써야 한다.
- metadata Playwright를 쓰면 exact provider/resource host의 DNS와 TLS 동작을 확인한다. 내부 주소 fallback이나 suffix 기반 우회는 허용하지 않는다.
- 최종 ZIP에는 `node_modules`, `.env`, runtime data, 이전 릴리스 산출물과 독립 검증 결과가 포함되지 않는다.

<!-- v674-deployment-current-pass -->
## Trusted proxy CIDR · v675

`DEPLOYMENT_MODE=trusted-proxy|cloudflare-tunnel`에서는 `TRUSTED_PROXY_CIDRS`를 실제 NPM/Cloudflare Tunnel/container socket peer subnet으로 제한한다. 기본 예시는 loopback과 Docker 사설망이며 운영 네트워크에 맞게 축소해야 한다. public client 주소 대역을 넣지 말고 origin의 WAN 직접 접근을 차단한다.

<!-- v675-deployment-proxy-cidrs-pass -->
## v676 trusted proxy 설정

Compose environment는 다음과 같이 목록 문법으로 작성한다: `- TRUSTED_PROXY_CIDRS=127.0.0.0/8,::1/128,172.16.0.0/12`. 실제 Tunnel/NPM에서 Node socket에 연결하는 source subnet만 추가하고, origin 포트는 해당 source 외에는 firewall/네트워크 ACL로 차단한다. Header 값이 유효 IP가 아니면 무시된다.

<!-- v676-deployment-proxy-cidrs-pass -->
