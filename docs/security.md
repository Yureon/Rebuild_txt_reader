# Security notes

기준 버전: rebuild-v564

## 적용된 보안 축

- owner/user session 분리
- `.env LOGINID / LOGINPW` owner 전용 계정
- 일반 user 계정의 `scrypt` password hash 저장
- login/register/admin mutation의 Same-Origin/Fetch Metadata 검증
- unsafe method에 대한 Origin/Referer 검증
- `Origin-Agent-Cluster: ?1`
- `X-DNS-Prefetch-Control: off`
- public asset allowlist 축소
- production `__Host-session_token`
- production `LOGINPW` 최소 길이는 `OWNER_PASSWORD_MIN_LENGTH`로 조정 가능하며 기본값은 14, 하한은 10
- CSRF token 기반 mutation 보호
- owner-only admin/recovery/owner-scope mutation, with limited user folder mutation exceptions
- file operation confirmation
- 가입코드 hash-only 저장과 일회용 consume hardening
- sessionVersion 기반 세션 강제 만료 / 비활성화 세션 재활성 방지
- audit log redaction / tail 조회 / rotate
- user state snapshot retention
- rate-limit expired entry pruning

## Owner / user 경계

- owner는 `/admin/users.html` 관리 콘솔 전용이다.
- owner session은 reader API에서 차단된다.
- 일반 user session은 admin API와 recovery status에 접근할 수 없다.
- 일반 user의 라이브러리 접근은 서버 API에서 `libraryAccess`로 강제된다.
- 일반 user는 자기 계정 scope의 font upload/delete만 사용할 수 있다.
- 일반 user의 fileops mutation은 기본 차단이며, `folderMutationAccess`로 허용된 `PATCH /api/folders/move`와 `DELETE /api/folders`만 예외적으로 허용된다.
- `folderMutationAccess.moveFolders/deleteFolders`는 항상 `libraryAccess`의 부분집합이어야 한다. 서버는 저장 시점과 실행 시점 모두에서 source folder가 `libraryAccess` 안인지 검사한다.

## 가입코드 회원가입

- 가입코드 원문은 저장하지 않고 hash만 저장한다.
- `/api/register`는 public path이지만 Same-Origin과 register rate limit을 통과해야 한다.
- 가입코드는 enabled, expiresAt, maxUses, usedCount 기준으로 검증된다.
- v404부터 가입코드 consume은 account 생성과 함께 원자화 경로를 사용한다.
- 클라이언트에는 코드 존재 여부를 과하게 노출하지 않는 통합 실패 메시지를 반환한다.

## Audit log

- owner의 사용자 생성/수정/삭제, 비밀번호 초기화, state export/reset/snapshot/restore, session revoke, font upload/delete, 가입코드 관리 이벤트와 일반 user의 허용된 폴더 이동/삭제 이벤트를 JSONL로 기록한다.
- `password`, `secret`, `token`, `csrf`, `cookie`, `hash` 성격의 key는 `[redacted]`로 기록한다.
- v404부터 audit 조회는 tail window 기반이며, 최대 크기 초과 시 rotate한다.
- audit log 파일은 `data/audit-log.jsonl`에 생성되며 최종 ZIP에는 포함하지 않는다.

## Snapshot 보안

- 사용자 state reset/delete-reset/restore 전 자동 snapshot을 생성한다.
- restore는 `confirmText: "RESTORE"`를 요구한다.
- v404부터 사용자별 snapshot retention을 적용한다.
- snapshot 파일은 `data/user-data/<userId>/snapshots/`에 저장되며 최종 ZIP에는 포함하지 않는다.

## File operations confirmation

- rename: `X-Confirm-Action: fileops-rename`
- move: `X-Confirm-Action: fileops-move`
- delete: `X-Confirm-Action: fileops-delete` 및 body `confirmText`. owner의 기존 폴더/작품/회차 삭제는 `"DELETE"`, 일반 user의 허용된 폴더 삭제는 `"DELETE:<categoryPath>"`를 요구한다.

## v493 folder mutation policy boundary

- user session에서 허용되는 fileops mutation은 폴더 이동과 폴더 삭제뿐이다. novel/episode/file rename/move/delete는 owner-only를 유지한다.
- user folder move/delete의 source folder는 `folderMutationAccess`에도 포함되어야 하고 `libraryAccess` 안에도 있어야 한다.
- user folder move의 target folder는 `libraryAccess` 안이어야 한다. root target은 `libraryAccess.mode === "all"`일 때만 허용한다.
- owner 콘솔과 가입코드 저장 경로는 `folderMutationAccess ⊆ libraryAccess` 정책을 강제한다. `libraryAccess.mode === "none"`인 user/code는 folder mutation 권한을 가질 수 없다.
- 일반 user의 폴더 삭제 요청은 body `confirmText: "DELETE:<categoryPath>"`를 요구한다.
- 일반 user의 폴더 이동/삭제 성공은 `library.folder.move` / `library.folder.delete` audit event로 기록한다. 절대경로는 기록하지 않고 상대 category path만 기록한다.

## CSP 상태

v405부터 `public/login.html`, `public/admin/users.html`, `public/index.html`의 inline script를 각각 `/scripts/login.js`, `/scripts/admin-users.js`, `/scripts/entry-router.js`로 분리했다.

- `script-src` / `script-src-elem`에서 `'unsafe-inline'`을 제거했다.
- 현재 `style-src 'unsafe-inline'`은 유지한다. login/admin/index에 inline style과 style attribute가 남아 있기 때문이다.
- 다음 CSP hardening 단계는 inline style 분리와 style CSP 축소다.

## production HTTPS

`NODE_ENV=production`은 HTTPS 접속을 전제로 한다. HTTP 접속에서 Secure 쿠키가 저장되지 않으면 `/api/login`은 `production_https_required`를 반환한다. reverse proxy는 `X-Forwarded-Proto: https`를 전달해야 한다.

Cloudflare Tunnel + NPM 구성에서 NPM이 `X-Forwarded-Proto`를 `http`로 덮어쓰는 경우, `DEPLOYMENT_MODE=cloudflare-tunnel`에서는 `CF-Visitor: {"scheme":"https"}`를 보조 HTTPS 신호로 신뢰한다. 이 신뢰는 origin이 Cloudflare Tunnel 외부로 직접 노출되지 않는다는 조건에서만 안전하다. 외부 WAN에서 NPM 관리자 포트 `81`만 막는 것으로는 부족하며, NPM service entry `80/443`과 Node 앱 포트도 직접 접근을 차단해야 한다.

## 남은 보안 개선 후보

- admin/login inline style 외부 CSS 분리
- diagnostics raw path redaction 옵션 강화
- audit log 장기 보관/외부 백업 정책
- register 실패 횟수 기반 가입코드 임시 잠금
- IndexedDB search/cache 삭제를 index cursor 기반으로 최적화

## v411 diagnostics security boundary

`/api/admin/diagnostics`는 owner session이 있을 때만 접근할 수 있다. 응답에는 비밀번호 원문, session token, CSRF token을 포함하지 않는다.

v411 진단은 다음 보안 경계를 점검한다.

- production HTTPS 인식
- reverse proxy/tunnel `X-Forwarded-Proto` 조합
- `APP_ORIGIN`과 현재 요청 origin의 불일치 가능성
- production owner password 최소 길이
- writable data/audit/session store
- readable `LIBRARY_PATH`

## v530 hardening additions

- `package-lock.json` is included for reproducible installs and Docker builds.
- `docker-compose.yml` and Cloudflare Tunnel compose examples use the Dockerfile build path, not runtime `npm install`.
- Session and CSRF token persistence uses HMAC digests. Configure `SESSION_STORE_SECRET` in production to keep sessions across restarts.
- Login rate limits are keyed by client IP plus normalized login identity.
- The login page does not store CSRF tokens in `localStorage`.
- `MAX_TEXT_FILE_BYTES` protects content and block-manifest endpoints from oversized TXT reads.


## v531 owner password minimum / safeHtml / diagnostics mask

- `OWNER_PASSWORD_MIN_LENGTH` controls the production owner `LOGINPW` minimum length. Default is 14, accepted range is 10~128.
- `createEl({ html })` is disabled. Use `text` for user-controlled values and only use `safeHtml` for reviewed escaped/trusted markup.
- Owner diagnostics raw JSON details are masked before rendering in the owner UI; token/cookie/CSRF/password values are hidden and IP/path/origin/host values are partially masked for safer screenshots.

## v535 security hardening

- Login and registration now keep their existing per-identity buckets and also apply coarse IP-wide buckets to reduce username/code rotation attacks.
- `USER_PASSWORD_MIN_LENGTH` controls normal user passwords. The default is 8 and configured values are clamped to 8~128.
- Production strict origin mode fails closed when `APP_ORIGIN`/`URL` are empty instead of falling back to the request `Host` for unsafe API requests.
- CSP defaults to self-only scripts/connect/worker sources. Cloudflare Insights and blob workers are opt-in via `ALLOW_CLOUDFLARE_INSIGHTS=1` and `ALLOW_BLOB_WORKER=1`.
- Font uploads now reject oversized raw request bodies at the 8 MiB parser boundary before the font service cap is reached.
