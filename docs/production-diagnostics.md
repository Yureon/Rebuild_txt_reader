# Production diagnostics

기준 버전: rebuild-v544

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
HOST=127.0.0.1
CLIENT_IP_HEADER=CF-Connecting-IP
```

주의:

- Cloudflare가 HTTPS를 종료한다.
- 앱이 직접 public internet에 bind되지 않도록 `HOST=127.0.0.1`을 권장한다.
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

현재 `style-src 'unsafe-inline'`은 UI 구조상 유지한다.

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

