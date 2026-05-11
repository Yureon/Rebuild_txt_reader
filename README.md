# TxT Reader Multi

셀프호스팅 TXT 웹소설 리더입니다. Node.js + Express 서버와 Vanilla JavaScript ESM 클라이언트로 구성되어 있으며, owner 계정이 일반 독서 계정과 라이브러리 접근 권한을 관리합니다.

기준 버전: `rebuild-v564`

## 핵심 기능

- 대용량 TXT chunk 기반 reader
- 단일 파일 / 폴더형 다중 에피소드 지원
- 읽기 위치, 북마크, 최근 열람, 설정 동기화
- owner 콘솔 기반 일반 사용자 생성, 가입코드, 권한 관리
- 폴더 prefix 기반 library ACL
- cache-first 검색 기본값
  - 전체검색 OFF: 표시 중 / 메모리 / IndexedDB 캐시만 검색
  - 전체검색 ON: 서버 content API로 전체 범위 검색
- owner-only 운영 진단
  - `ok / warn / error` 등급
  - finding별 조치 방법
  - 배포 전 점검 버튼
- PWA, 오프라인 캐시, 복구 센터

## 빠른 시작

```bash
cp .env.example .env
npm install --no-audit --no-fund --package-lock=false
node server.js
```

브라우저에서 `http://localhost:3000`으로 접속한다. `.env`의 `LOGINID` / `LOGINPW`는 owner 콘솔 전용 계정이다.

## Docker Compose

```bash
mkdir -p ./data/user-data
# 권장: UID 1000 owner-write
chown -R 1000:1000 ./data
chmod -R u+rwX,g+rwX ./data
# 대안: root group-write bind mount를 유지해야 하는 환경
# chgrp -R 0 ./data && chmod -R g+rwX ./data
docker compose up -d --build
```

Cloudflare Tunnel sidecar 예시는 다음 파일을 사용한다.

```bash
docker compose -f docker-compose.cloudflare-tunnel.example.yml up -d
```


### v548 Docker data and search profile note

`rebuild-v564` keeps `/app/data` as a host-side bind mount and runs the app as non-root UID `1000` with primary GID `0`. This supports both `1000:1000` owner-write directories and `0:0` group-write directories such as `drwxrwxr-x`. The compose files use `create_host_path:false` for `/app/data` so Docker Compose does not silently create a wrong directory. Run `sh tools/fix_docker_data_permissions.sh` from the project directory before the first `docker compose up`, or keep an existing `root:root` data directory group-writable.

Search concurrency is modestly relaxed from the v539 server-protection profile: full/live search may scale up to 3 concurrent content requests, multi-episode target scanning up to 2, cache-only scanning to 4, and client worker batches up to 5. The limits remain bounded and adaptive so user input pressure or slow batches still reduce throughput automatically.

### v563 Docker npm registry note

`package-lock.json` must not contain `packages.applied-caas`, `internal.api.openai`, or other sandbox-only npm registry URLs. Docker builds copy `.npmrc` before `npm ci` and install with `--no-audit --no-fund`, so production builds use `https://registry.npmjs.org/` and avoid the previous internal-registry timeout.

## Cloudflare Tunnel / NPM 보안 전제

Cloudflare Tunnel 모드에서 앱은 `DEPLOYMENT_MODE=cloudflare-tunnel`일 때 `CF-Visitor: {"scheme":"https"}`를 production HTTPS 판정의 보조 신호로 사용할 수 있다. 이 신뢰 모델은 **외부 인터넷에서 NPM 80/443/81 또는 Node 앱 포트로 직접 접근할 수 없는 구성**이 전제다. 관리자 포트 81만 막는 것으로는 부족하며, 일반 서비스 포트 80/443도 WAN에서 Cloudflare를 우회해 접근되면 안 된다.

## 주요 환경변수

| 변수 | 설명 |
|---|---|
| `LOGINID` | owner 계정 ID |
| `LOGINPW` | owner 계정 비밀번호. production에서는 OWNER_PASSWORD_MIN_LENGTH 이상 필요(기본 14, 하한 10) |
| `USER_PASSWORD_MIN_LENGTH` | 일반 user 비밀번호 최소 길이. 기본 8, 설정 하한 8 |
| `PORT` | 앱 포트. 기본 3000 |
| `HOST` | bind 주소. Cloudflare Tunnel 단독 구성은 `127.0.0.1` 권장 |
| `LIBRARY_PATH` | TXT 라이브러리 경로 |
| `APP_ORIGIN`, `URL` | 브라우저 주소창의 origin. 여러 개면 쉼표 구분 |
| `DEPLOYMENT_MODE` | `direct`, `trusted-proxy`, `cloudflare-tunnel` |
| `REQUIRE_STRICT_ORIGIN` | unsafe method Origin/Fetch Metadata 검증 |
| `ALLOW_CLOUDFLARE_INSIGHTS`, `ALLOW_BLOB_WORKER` | CSP 예외 opt-in. 기본값은 둘 다 0 |
| `CLIENT_IP_HEADER` | 필요 시 실제 client IP header |

## 운영 문서

- `docs/deployment-guide.md`: 배포 모드와 환경변수
- `docs/proxy-tunnel-setup.md`: Nginx Proxy Manager / Cloudflare Tunnel
- `docs/operations-checklist.md`: 배포 전 점검 목록
- `docs/security.md`: 인증, CSP, cookie, owner diagnostics 경계
- `docs/smoke-tests.md`: smoke test 그룹 설명
- `docs/multi-user-access-control.md`: multi-user / ACL 설계

## 검증

```bash
npm run smoke:docs
npm run smoke:search
npm run smoke:cache
npm run smoke:security
npm run smoke:reader
npm run smoke:settings
npm run smoke:server
node tools/check_rebuild_frontend.js --quiet-ok
node tools/check_frontend_supervisor.js --quiet-ok
npm audit --omit=dev --json --package-lock=false
```

배포 ZIP에는 `node_modules`, `data`, `sync_data.json`, `test_novels`, `.npm-cache`를 포함하지 않는다. `package-lock.json`은 일반 파일로 포함한다.


## v417 skeleton UI

초기 앱 셸, 라이브러리 목록, reader 본문 로딩, 검색 실행 중 결과 영역, owner 콘솔 초기 로딩 영역에 스켈레톤 UI를 추가했다. reader anchoring 계열 로직은 변경하지 않았다.


## v417 owner actions / release verify

- owner 콘솔의 사용자 생성, 수정, 활성 전환, 세션 강제 만료, 계정 삭제, 비밀번호 초기화 wiring은 `public/scripts/admin/actions.js`로 분리한다.
- 운영 진단과 배포 전 점검은 카드형 요약과 `details` 기반 원본 JSON을 함께 제공한다.
- `npm run release:verify -- <zip>`는 ZIP integrity, 금지 항목, precompressed hash, current-version lint, owner split smoke, frontend check를 clean extract에서 확인한다.
- 검색 모달에서 제거된 대소문자 구분/캐시 전용 옵션은 `search-option-dead-code-smoke`로 재도입을 방지한다.



### v541 content worker pool / search abort note

`rebuild-v564` moves cold TXT content preprocessing for search-triggered `/content` loads into a bounded worker-thread pool and propagates HTTP abort signals into those builds. Stopped full searches can now cancel queued/running cold content work instead of leaving the main server process saturated. Configure with `CONTENT_WORKER_THREADS_ENABLED` and `CONTENT_WORKER_POOL_SIZE`.

### v540 block manifest server-load mitigation note

`rebuild-v540` reduces server CPU/IO spikes around multi-file block manifests. Concurrent cold folder manifest requests are coalesced, repeated hot requests avoid immediate full episode stat sweeps, and the server no longer writes every per-episode manifest JSON while building one aggregate folder manifest. Direct episode manifest cache files are still written on demand.

### v537 search server-load mitigation note

`rebuild-v539`부터 전체검색은 검색 시작 전에 block manifest 전체 cold build를 강제하지 않습니다. 전체검색 content 요청은 `X-Search-Scan: 1`을 붙이고, 서버는 해당 요청의 cold chunk payload에 대해 동기 디스크 쓰기를 생략해 검색 후 서버 CPU/IO 잔류 부하를 줄입니다. Reader anchoring / slider / virtual-layout 안정화 로직은 이 변경의 대상이 아닙니다.

### v536 UI polish note

`rebuild-v536`부터 상단바의 테마 버튼은 다크모드 직접 전환이 아니라 테마 색상 모달을 여는 바로가기입니다. 네트워크 인디케이터 배경은 선택한 테마 색상에 맞춰 조정되며, safe-area 상단 matte는 완전 검정 배경을 유지합니다.

### 사용자 정의 사이트 언어

설정 > 일반 > 사이트 언어에서 기본 한국어/영어 외에 사용자 정의 언어를 추가할 수 있습니다. 언어 이름과 코드를 입력한 뒤, 한 줄에 `원문=표시문구` 형식으로 UI 문구를 직접 등록합니다. 예: `설정=Settings`. JSON 객체 형식도 허용합니다. 등록하지 않은 문구는 기본 한국어/영어 fallback을 사용합니다.
