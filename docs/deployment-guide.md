# Deployment guide

기준 버전: rebuild-v544

이 문서는 `txt_reader_multi` 계열을 내부망 또는 HTTPS reverse proxy 뒤에서 운영하기 위한 최소 배포 기준을 정리한다.

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
LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS=2000
```

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
| `cloudflare-tunnel` | Cloudflare Tunnel 단독 전달 | `NODE_ENV=production`, `HOST=127.0.0.1` 권장 |

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
HOST=127.0.0.1
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

Set `SESSION_STORE_SECRET` to a long random value in production. If it is missing, the app uses an ephemeral secret and all sessions are invalidated after restart.

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
