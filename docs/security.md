# 보안 계약 — v682 current

PowerShell 5.1 호환 변경은 root containment를 완화하지 않는다. root와 candidate를 `GetFullPath`로 정규화하고 case-insensitive prefix 경계를 확인한 후에만 상대경로를 계산하며, root와 각 기존 경로 구성요소의 reparse-point 검사를 유지한다.

<!-- v682-security-pass -->

# 보안 계약 — v681 current

`metadataProvider=manual`은 사용자 입력 값을 저장 경로나 외부 요청으로 사용하지 않고, 정규화된 applied metadata provider ID 비교에만 사용한다. 기존 session·library ACL·same-origin 쓰기 경계를 변경하지 않는다.

<!-- v681-security-pass -->

# 보안 계약 — v680 current

`GET /api/theme-bootstrap`은 session 확인과 `no-store`를 적용하고 theme key allowlist만 반환한다. Owner 고정 palette와 일반 사용자 state service를 분리하며 진행도·북마크·권한·device profile 전체를 노출하지 않는다. 로그인 페이지는 과거 사용자의 local theme를 읽지 않는다. 기존 CSRF/session, ACL, trusted proxy, no-follow 파일 경계와 PWA executable fail-closed 정책은 유지한다.

<!-- v680-security-pass -->

# 보안 계약 — v679 current

v679은 보안 정책을 완화하지 않는다. v677의 Metadata cover/audit `O_NOFOLLOW`, trusted proxy source 검증, 사용자 ACL, PWA mixed-build executable fail-closed를 유지한다. UI 수정은 CSS와 extension popup layout에 한정된다.

<!-- v679-security-pass -->

# 보안 계약 — v676 current

기준 버전: `rebuild-v676`

# v674 현재 보안 경계

기준 버전은 package `6.74.0`, runtime `rebuild-v674`이다.

- Metadata Playwright fallback은 검증되지 않은 API 요청 경로를 사용하지 않는다. 허용된 정확한 호스트를 DNS로 확인하고 HTTPS 소켓을 고정하며, redirect와 표지 요청도 매 단계 다시 검증한다.
- 파일 변경 journal은 실제 mutation과 관련 parent directory sync가 끝난 뒤에만 committed가 된다. `EIO`, `ENOSPC`, `EACCES`, `EROFS`는 성공으로 축소하지 않는다.
- 사용자별 device 상태는 current/preferred device를 보존하는 동일한 bounded key set으로 정리한다.
- PWA navigation 보조 상태 저장 실패는 정상 HTTP 응답을 뒤집지 않되, handshake 전 실행 자산은 fail-closed로 차단한다.
- trusted proxy raw header, 로컬 data directory의 font symlink, 실제 브라우저·SMB·디스크 장애 검증은 별도 운영 환경 점검 항목으로 남아 있다.

<!-- v674-security-current-pass -->

## 과거 릴리스 기록

# v671 자원 고갈·내구성 보안 경계

기준 버전: rebuild-v672

기준 버전: `rebuild-v671`

- custom provider selector는 입력 크기·node·depth·query time 예산을 초과하면 중단한다.
- metadata enqueue와 library mutation journal은 durable commit 이전에 실행 상태를 publish하지 않는다.
- candidate shard는 committed revision과 정확히 일치하는 primary/backup만 신뢰한다.
- content worker가 없는 대형 TXT를 main event loop에서 처리하지 않는다.
- audit queue는 hard cap을 가지며 중요 보안·파일 mutation 이벤트는 일반 이벤트보다 우선하여 durable flush한다.

<!-- v671-security-resource-durability-pass -->

# v669 provider 쿨타임 보안·부하 경계

기준 버전: rebuild-v670

기준 버전: `rebuild-v670`

- provider별 collection queue는 서로 다른 key를 사용해 한 사이트의 쿨타임이 다른 사이트의 호출을 전역 차단하지 않는다.
- 실제 collection이 시작된 뒤 성공·실패·취소로 종료되면 완료 시점부터 same-provider 쿨타임을 적용한다.
- 시작 전에 취소된 waiter는 외부 요청을 하지 않았으므로 미래 쿨타임을 소비하지 않는다.
- 한 작품 내부 HTTP 요청마다 긴 쿨타임을 반복하지 않되, 같은 provider의 collection 전체를 직렬화해 동시 폭주를 막는다.
- 기존 HTTPS·host/path allowlist·DNS pinning·사설 주소 차단·redirect 재검증·응답 크기 제한을 유지한다.

<!-- v669-security-provider-cooldown-pass -->

# v667 공급자 정의·Whale autofill 보안 경계

기준 버전: rebuild-v668

기준 버전: `rebuild-v667`

- 공급자 정의 CRUD는 same-origin, CSRF, owner session, 한국어 metadata locale gate를 모두 요구한다.
- custom URL은 HTTPS 443, credential/hash 없음, 저장 host/path 범위, DNS pinning 및 사설 주소 차단을 통과한다.
- selector parser는 HTML을 실행하지 않으며 제한된 descendant selector만 평가한다.
- non-auth autofill guard는 실제 credential scope를 제외한 text/search/email/url/tel/password/textarea/contenteditable에 적용한다. focus와 timer만으로 readonly를 풀지 않으며 사용자 pointer/keyboard intent 후 Whale/Chromium의 지연 autofill을 재검사한다.
- 로그인·회원가입·계정 비밀번호 변경은 표준 `username`, `current-password`, `new-password`, `one-time-code` token을 유지한다.

<!-- v667-security-provider-autofill-pass -->

기준 버전: rebuild-v667

# 보안·개인정보 기준 — v666

비인증 입력은 `autocomplete=off`, exact vendor ignore 속성, 짧은 readonly 초기 방어와 native autofill detection을 사용한다. 실제 로그인·회원가입·계정 비밀번호 변경만 credential autocomplete를 허용한다. guard는 입력값을 서버나 storage로 전송하지 않으며 사용자가 편집한 값은 제거하지 않는다.

<!-- v667-security-current-pass -->

기준 버전: rebuild-v665

# 보안 기준 — v665 추가 사항

수동 표지는 MIME·확장자를 신뢰하지 않고 허용된 raster signature와 content hash를 검증한다. SVG, symlink, hash 불일치, 잘린 BMP는 허용하지 않는다. Node `--check-config`는 secret-free allowlist 필드만 출력한다.

<!-- v665-security-current-pass -->

# v664 보안 기준

이어보기 선택창은 same-origin query marker만 사용하고 외부 script/style을 추가하지 않는다. 기존 CSP, 세션, origin, ACL과 사용자 데이터 격리 계약을 유지한다.

<!-- v664-security-current-pass -->

기준 버전: rebuild-v664

# v663 CSP·자산 보안 기준

기본 CSP는 self-only script와 `unsafe-inline` 금지를 유지한다. Cloudflare Web Analytics/Browser Insights는 `ALLOW_CLOUDFLARE_INSIGHTS=1`일 때만 허용한다. 사용자 글꼴은 same-origin `/api/fonts/file/`만 FontFace source로 수용한다. metadata 표지와 글꼴 route는 기존 session·ACL을 유지하며 private revalidation로 stream한다.

<!-- v663-security-assets-pass -->

기준 버전: rebuild-v663

# v661 보안·내구성 기준

파일 변경은 library root 바깥 경로를 거절하는 기존 경계를 유지한다. 대기열 상한과 요청 취소는 자원 고갈 위험을 제한한다. journal 저장 실패는 fail-closed 또는 명시적 복구 필요 오류로 처리한다. Owner 파일 변경은 성공·실패 모두 감사 로그에 남긴다. metadata durable enqueue와 로그인 telemetry sidecar는 기존 인증·CSRF·ACL 계약을 변경하지 않는다.

<!-- v661-security-durability-pass -->

기준 버전: rebuild-v663

기준 버전: rebuild-v660

기준 버전: rebuild-v655

기준 버전: rebuild-v654

# v654 설정·사용자 범위 변경 보안

설정 page history 수정은 인증·session·CSRF 경계를 변경하지 않는다. 최근·즐겨찾기 제거는 현재 사용자 book-data 저장소만 변경하며 catalog·다른 사용자 상태를 수정하지 않는다. Windows형 `목록` 동작은 이미 ACL로 제공된 category path 안에서만 client navigation을 수행한다.

<!-- v654-security-user-scope-pass -->

기준 버전: rebuild-v654

기준 버전: rebuild-v650

기준 버전: rebuild-v649
기준 버전: `rebuild-v649`

# v649 mutation fail-closed 및 package inventory

mutation journal을 저장할 수 없으면 destructive filesystem 작업을 시작하지 않는다. 현재 버전이 아닌 dependency inventory·validation 파일은 release inventory에서 제외하며, dependency license가 unresolved 상태면 inventory 생성과 packaging gate를 실패시킨다.

<!-- v649-security-fail-closed-pass -->

# v648 metadata applied shard 보안

Applied shard는 기존 metadata store와 동일한 data directory·0600 temp·fsync·trusted backup·atomic rename 계약을 사용한다. shard는 ACL을 대체하지 않으며 metadata route는 기존 viewer/editor/Owner 권한, same-origin, CSRF와 rate limit을 유지한다.

<!-- v648-security-metadata-applied-shard-pass -->

# v648 durable catalog state 보안

mutation sidecar는 library root hash를 포함하며 다른 root의 state를 재사용하지 않는다. tombstone 상대 경로는 절대 경로와 `..`를 거절하고, 파일은 기존 durable store와 같은 data directory 권한으로 원자 저장한다.

<!-- v648-security-catalog-state-pass -->

기준 버전: rebuild-v648

# v646 보안 기준

기준 버전: rebuild-v646

# v645 보안 경계

기준 버전: rebuild-v645

검색 modal 복구는 고정된 same-origin fragment/style URL만 사용하며 사용자 입력을 selector·HTML로 삽입하지 않는다. 검색어는 기존 API encoding과 권한 경계를 유지한다. Reader scroll-to-top 제외는 UI scope 변경이며 사용자 데이터·ACL·Service Worker 실행 자산 경계를 변경하지 않는다.

<!-- v645-security-pass -->

# v638 보안 경계

기준 버전: rebuild-v644


## v643 보안 경계

- library organization script는 기본 dry-run이며 source/destination root 동일·중첩, root 탈출, symlink/reparse point, duplicate source, 기존 target을 방어한다.
- provider 설정 endpoint는 Owner + same-origin + CSRF + rate limit + 한국어 locale 조건을 모두 요구한다.
- site language header는 기능 표시/한국 provider 활성화 경계이며 사용자 library/metadata ACL을 대체하지 않는다.
- provider 설정 durable write 실패 시 요청 전 메모리 snapshot으로 rollback한다.

기준 버전: `rebuild-v644`.

<!-- v643-security-pass -->


기준 버전: rebuild-v642


## v641 보안 강화

- production에서 공개 예제 `LOGINPW`와 `SESSION_STORE_SECRET`을 거절한다.
- 비밀번호 변경 후 session flush 실패 시 메모리 session metadata를 rollback한다.
- stale `users-static.html`을 제거했다.
- Metadata Helper host permission을 정확한 HTTPS host로 제한하고 URL 판정을 공유 policy로 통합했다.
- 수동 metadata는 존재하지 않는 필드, 값 없는 선택 필드, set/clear 충돌을 거절한다.

<!-- v641-current-doc-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

기준 버전: `rebuild-v641`

- 로그인 페이지도 READY handshake 전에는 실행 자산을 받지 않는 원칙을 유지한다. UI 없는 coordinator를 사용해 보안 경계를 완화하지 않고 로그인 회귀를 수정했다.
- legacy `coverUrlLocal`은 동일 SHA-256 asset의 정확한 canonical 내부 URL일 때만 호환 입력으로 통과한다. URL은 신뢰하거나 저장하지 않고 서버가 검증된 asset ID로 다시 생성한다.
- metadata group ID는 서버가 정규화된 content fingerprint에서 생성한다. client가 group member ID를 임의 지정할 수 없다.
- group delete는 서버가 현재 후보를 다시 계산한 뒤 동일 group member만 한 번의 durable mutation으로 삭제한다.
- scroll-to-top script는 정적 UI만 제어하며 사용자 텍스트·HTML을 삽입하지 않는다.

<!-- /v638-current-summary -->


기준 버전: rebuild-v641

기준 버전: `rebuild-v641`

## 실행 자산

- current build가 확인되지 않은 client는 fail-closed다.
- Service Worker의 메모리 수명이나 stale TTL을 신뢰 경계로 사용하지 않는다.
- navigation header는 handshake를 대체하지 않는다.
- 서버와 Service Worker 모두 stale/future JS·MJS·worker·fragment·WASM 요청에 현재 실행 파일을 반환하지 않는다.
- mismatch 응답은 `Cache-Control: no-store`, HTTP 409, `X-TXT-Reader-Reload-Required: 1`을 사용한다.

## 수동 표지

- 입력은 lowercase로 정규화 가능한 정확한 64자리 SHA-256 hex `coverAssetId`만 허용한다.
- cover directory의 실제 regular file이어야 하며 symlink는 거절한다.
- 파일 signature, 확장자, 전체 content SHA-256이 asset ID와 일치해야 한다.
- client의 `coverUrl`, `coverUrlLocal`, `coverRemoteUrl`은 신뢰하지 않고 서버가 `/api/metadata/covers/<assetId>`를 생성한다.
- metadata flush 후 durable applied record를 재조회하여 동일 asset ID와 canonical URL이 확인된 경우에만 lease를 해제한다.
- 실패·부분 적용·flush 실패에서는 lease를 유지하며, bounded lease expiry가 orphan recovery를 담당한다.

<!-- v637-security-boundary-pass -->

# v636 정적 build·표지 내구성 경계


기준 버전: rebuild-v636
새 Service Worker가 제어권을 획득한 기존 탭에는 stale-client gate를 적용해 이전 runtime이 새 실행 module을 가져오지 못하게 한다. 표지 lease는 cover 디렉터리 내부 sidecar에 0600·atomic rename·fsync로 저장하며, metadata store의 durable flush 이전에는 해제하지 않는다.

<!-- v636-security-boundary-pass -->

# v635 업데이트·표지 보안/내구성

기준 버전: rebuild-v635

기준 버전: `rebuild-v635`

- 업데이트 적용은 프런트엔드와 Service Worker 양쪽에서 `/api/system-update/authorization`을 확인한다.
- update 요청이 새 worker를 찾지 못하면 활성화를 가장하지 않고 실패 상태로 복구한다.
- future-build client는 이전 cache의 query 없는 ESM dependency를 재사용하지 않는다.
- 수동 표지 parser와 저장 서비스는 `METADATA_COVER_MAX_BYTES`를 동일하게 적용하고 파일 시그니처를 재검사한다.
- 신규 asset은 제한된 lease 동안 prune 대상에서 제외되며 적용 성공 후 lease를 해제한다.
- 표지 파일의 atomic rename 뒤 부모 directory를 fsync해 metadata 참조와 directory entry의 내구성 간격을 줄인다.

<!-- v635-security-pass -->

# v627 보안·내구성 보강

기준 버전: rebuild-v634

- Chromium provider host는 public DNS 검증 뒤 `--host-resolver-rules`로 연결 대상을 고정한다.
- Playwright profile 측정이 entry cap에서 잘리면 안전한 크기로 간주하지 않고 cleanup 대상으로 처리한다.
- 비밀번호 변경 성공은 현재 session version의 durable flush 이후 반환한다.
- 명시적 Service Worker update는 `/api/system-update/authorization`과 worker 내부 재검증을 모두 통과해야 한다.
- Owner는 전체 권한으로 허용하고 일반 사용자는 usable library access와 metadata access를 모두 요구한다.
- `0.0.0.0`은 모든 interface에서 listen하며 firewall·port publish·router 설정이 외부 노출을 결정한다.

<!-- v627-system-update-dual-permission-pass -->

# v626 host bind·UI 경계

- direct/main Compose는 사용자의 LAN 접근 요구에 맞춰 `TXT_READER_BIND_ADDRESS` 기본값을 `0.0.0.0`으로 제공한다. 이는 인증 우회 방어가 아니며, WAN 포트포워딩·공인 방화벽 규칙·origin 직접 접근은 별도로 차단해야 한다.
- 같은 host reverse proxy만 앱에 접근할 배포에서는 `TXT_READER_BIND_ADDRESS=127.0.0.1`을 권장한다.
- cloudflared sidecar Compose는 host port를 publish하지 않고 private Docker network만 사용한다.
- scrollbar UI는 가시성을 유지하며 `display:none` 또는 scrollbar 완전 숨김을 사용하지 않아 keyboard/mouse 사용자가 scroll 가능 영역을 인지할 수 있다.

<!-- v626-docker-bind-address-pass -->

# v625 보안 재감사 수정

- Playwright APIRequestContext는 자동 redirect를 끄고 각 hop의 HTTPS·provider allowlist·DNS public-address를 요청 전에 검증한다. 모든 `APIResponse`는 `finally`에서 dispose한다.
- same-origin page fetch는 page-side AbortController, Content-Length 선검사, streaming byte cap을 사용한다.
- shared/device 사용자 CSS는 실제 상태 저장 normalizer에서 공통 강한 sanitizer를 사용한다.
- 로그인·가입·비밀번호 변경 성공 시 계정 bucket과 IP-wide bucket을 함께 초기화한다.
- profile maintenance 전체에 비동기 오류 경계를 두며, 파일 mutation 직전 parent realpath/dev/inode를 다시 확인한다.
- 보안 헤더는 JSON parser 이전에 적용하고 모든 production Compose 예제는 read-only, tmpfs, cap drop, no-new-privileges를 사용한다.
- production의 `SESSION_STORE_SECRET` 누락은 시작 실패로 처리한다. Chromium sandbox는 기본 활성화하고 명시적 opt-in에서만 해제한다.

<!-- v625-security-reaudit-fixes-pass -->

# v606 보안·세션 경계

- session cookie는 durable session write 성공 뒤에만 발급한다.
- logout persistence 실패는 cookie를 지우지 않고 session·CSRF 메모리 상태를 복구한다.
- precompressed middleware는 client disconnect 이후 downstream middleware나 late header write를 실행하지 않는다.
- 제한 계정 cover 접근 scope는 folder ACL과 library generation으로 격리한다.

기준 버전: rebuild-v626

# v605 추가 보안 감사

- direct 배포에서는 `X-Forwarded-Proto`를 신뢰하지 않으며 trusted proxy 모드에서만 forwarded HTTPS를 인정한다.
- 사용자 상태 쓰기는 응답 필터에 의존하지 않고 저장 전에 library ACL을 적용한다.
- 제한 계정의 `novelUserTags`, progress position key, device `collapsedFolders`도 필터링한다.
- 파일 작업은 최종 경로뿐 아니라 library root 아래 모든 중간 경로의 symbolic link를 거부한다.
- 다중 탭은 최근 CSRF token 8개를 유지하며 토큰 갱신 재시도는 한 번으로 제한한다.
- 사용되지 않는 구형 `/api/sync` 읽기·쓰기는 모두 410으로 폐기했다.

## v604 복구·권한·자산 보안 계약

### v604 추가 보안 계약

- 손상 primary가 정상 `.bak`을 덮어쓰지 않는다. backup 복구 후 primary를 자동 치유한다.
- 평문·구형 session 저장소는 제거하고 HMAC schema의 빈 저장소로 재작성한다.
- provider profile 상세, queue persistence 진단, metadata job requester 정보는 owner에게만 노출한다. 일반 사용자는 자신이 요청한 job만 조회·취소할 수 있다.
- provider profile 축소는 provider 목록뿐 아니라 작품별 metadata 응답에도 동일하게 적용한다.
- Service Worker는 현재 build와 다른 query의 자산을 normalized cache에서 조회하거나 저장하지 않는다.
- 사용자 권한이 필요한 font·cover 응답은 `private, max-age=0, must-revalidate`와 `Vary: Cookie`를 사용한다.
- 이전 build query의 script·fragment·style·icon을 새 build와 조용히 혼합하지 않는다.

- Express fingerprint header `X-Powered-By`를 비활성화한다.
- 계정 password hash의 scrypt parameter와 encoded field 길이를 엄격히 검증한다.
- 회원가입·비밀번호 변경·초기화는 비동기 scrypt를 사용하며 동시 변경은 관찰한 hash mismatch로 충돌 처리한다.
- JSON 저장은 고유 temp와 exclusive create, fsync, atomic rename을 사용해 동시 write의 temp 충돌과 부분 파일을 방지한다.
- 가입코드·계정·사용자 삭제는 저장 실패 시 메모리와 개인 상태를 rollback한다.
- 종료 시 최종 저장 실패를 숨기지 않고 `SHUTDOWN_PERSISTENCE_FAILED`로 전파한다.
- 감사 로그와 사이트 언어 map은 예약 record key를 거부한다.

기준 버전: `rebuild-v605`

## v601 사용자 상태 record-key 보안

- 사용자 입력으로 생성되는 상태 map은 `__proto__`, `prototype`, `constructor` 키를 저장하지 않는다.
- 적용 범위는 사용자 태그, 진행률 map, 장치 sync metadata, device profile, legacy bucket, 사용자 언어 map, custom theme ID다.
- 서버 정규화뿐 아니라 독서 데이터 가져오기 클라이언트 경로에서도 같은 예약 키를 거부한다.

기준 버전: `rebuild-v605`

## v594 custom CSS·로그인 공개 자산 경계

- 로그인 전 공개 허용은 `theme-boot.js` 한정이며 API 또는 인증 HTML을 추가로 공개하지 않는다.
- 사용자 CSS는 constructable stylesheet로 적용하며 CSP `style-src`에 `unsafe-inline`을 추가하지 않는다.
- 빈 사용자 CSS는 stylesheet를 생성하거나 채택하지 않는다.

<!-- v594-security-css-pass -->

# v584 웹 메타데이터 인증 보안 경계

- 공급자 Cookie 문자열을 입력·저장·전송하는 기능과 `METADATA_AUTH_SECRET`은 제거했다.
- 5개 공급자의 Playwright 프로필 로그인·화면·입력·삭제 API는 owner 전용이고 Same-Origin, CSRF, rate limit, no-store를 적용한다.
- 로그인 ID·비밀번호는 상태 JSON이나 `.env`에 기록하지 않고 현재 Playwright 페이지에만 전달한다.
- 영구 브라우저 프로필은 `data/metadata-browser-profiles`에 `0700` 디렉터리로 저장하며 release ZIP·로그에 포함하지 않는다.
- Playwright 이동 URL은 공급자와 공식 인증 호스트의 HTTPS 443만 허용한다.
- Metadata Helper는 `cookies` 권한이 없고 Cookie, Authorization, raw HTML, 로그인 입력값을 서버로 보내지 않는다.
- 상세·검색·redirect·표지 URL은 공급자 code allowlist와 public DNS 검사를 통과해야 한다.
- 내부망·loopback·link-local·reserved IP, credentials, 비표준 port와 허용되지 않은 path는 거부한다.
- 표지는 서버가 magic byte를 검증해 `data/metadata-covers`에 저장하며 외부 URL을 클라이언트에 노출하지 않는다.
- 표지 API도 library ACL을 검사하며 수집 실패는 기존 적용 결과를 삭제하지 않는다.

## v573 normalized cache·release 보안 경계

- 요청된 normalized 청크의 정확한 UTF-16LE 바이트 SHA-256을 index와 대조하며, 불일치 cache는 폐기·재생성한다.
- cache key/path는 API 입력이 아니며 ACL을 통과한 작품 요청만 내부 범위를 읽는다.
- active `.line.tmp`와 cache temp는 janitor 후보 수집 및 실제 unlink 직전에 사용 중 여부를 확인한다.
- final release manifest는 manifest 자신을 제외한 ZIP 전체 파일 집합, bytes와 SHA-256을 clean extract에서 검증한다.
- Docker entrypoint는 비-root `1000:0` 상태로 `/app/data` 쓰기 probe를 수행하며 동적 UID/GID 변경을 제공하지 않는다.

## v572 streaming cache 보안 경계

- encoding sample과 source stream은 권한 검사를 통과해 서버가 해석한 원본 file path만 사용한다.
- long-line spool 이름은 cache root containment 검사와 random suffix를 사용하고 `wx`, mode 0600으로 생성한다.
- spool/cache 실제 경로는 API나 diagnostics에 노출하지 않는다.
- symlink 및 path traversal 방지는 v570 normalized cache descriptor 검증을 그대로 적용한다.

## v570 normalized cache 보안

- cache filename은 원본 경로가 아닌 SHA-256 key이며 metadata에 원본 절대 경로를 기록하지 않는다.
- root containment, regular-file, symlink 거부, JSON 크기와 chunk entry 상한을 검증한다.
- `data/normalized_content`는 `public` static root 밖에 있고 직접 URL로 제공하지 않는다.
- cache를 읽기 전 기존 library ACL/content route 권한 경계를 유지한다.
- 부분·손상 cache는 신뢰하지 않고 재생성한다.

# Security notes

기준 버전: rebuild-v605

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
- `style-src`에는 `'unsafe-inline'`이 없고 `style-src-attr 'none'`을 사용한다. 동적 사용자 CSS는 constructable stylesheet/CSSOM 경로만 사용한다.
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

## v593 Playwright·audit·shutdown 경계

- Playwright 수집의 최종 URL을 provider host/path allowlist로 재검증하고 외부 redirect 및 로그인 화면을 콘텐츠로 수용하지 않는다.
- 공급자 프로필 상태와 audit log append는 비동기 직렬·atomic persistence를 사용한다. 관리자 조회와 종료는 pending write를 flush한다.
- graceful shutdown은 새 요청을 차단하고 기존 HTTP 요청이 끝난 뒤 영속 서비스들을 종료해 종료 직전 mutation 손실을 방지한다.
- metadata 권한 UI는 편의 기능일 뿐이며 `/metadata.html`과 모든 metadata API의 서버 ACL이 최종 권한 경계다.

- profile 삭제는 provider ID 검증 후 고정 profiles root 아래에서 비동기로 수행하며 외부 경로를 받지 않는다.
- 수집 최종 URL의 provider path 재검증과 login path segment 경계 검사를 유지한다.

<!-- v593-security-playwright-audit-shutdown-pass -->
## v640 소설넷 provider 경계

`builtin-ssn` request는 HTTPS `ssn.so`/`www.ssn.so`와 `/series/` prefix로 제한한다. direct target은 query·fragment 없는 숫자형 상세 URL만 인정한다. cover URL은 명시적 registry allowlist를 통과해야 하며 provider가 임의 host 접근 권한을 확장하지 않는다.

<!-- v640-ssn-security-pass -->

<!-- v662-security-deferred-ui-pass -->

## v668 profile shell 경계

- `/fragments/library-shell.html`과 `/fragments/app-shell.html`은 로그인 완료 뒤에만 제공하며 공개 인증 allowlist에 추가하지 않는다.
- library shell에는 Reader 본문, loading skeleton, toolbar, jump/offline UI를 포함하지 않는다.
- client runtime은 library shell에 Reader DOM이 섞인 응답을 감지하면 fail-closed로 boot를 중단한다.
- 외부 HTML이나 사용자 입력을 shell HTML로 삽입하지 않으며 CSP의 `unsafe-inline`을 추가하지 않는다.

<!-- v668-security-shell-boundary-pass -->
# v674 보안 경계

- Metadata Playwright fallback은 allowlisted hostname의 사전 공개 IP 확인만으로 연결을 허용하지 않는다. 실제 연결은 확정 주소에 pin하거나 안전한 pin을 제공할 수 없는 경로를 fail-closed한다.
- redirect 후 URL의 scheme, exact/suffix host 정책, path, 공개 IP와 응답 크기 제한을 유지한다. profile cookie가 RFC1918, loopback, link-local 대상으로 전송되어서는 안 된다.
- 이번 릴리스는 proxy header 신뢰 범위를 자동 변경하지 않았다. Cloudflare/custom header를 쓰는 배포는 직접 접근을 방화벽으로 막고 신뢰 proxy가 header를 덮어쓰는지 확인해야 한다.
- user font directory를 다른 로컬 주체가 쓸 수 있는 배포에서는 symlink를 허용하지 않는다. API는 symlink 생성 기능을 제공하지 않지만 운영 filesystem 권한은 별도 방어선이다.

<!-- v674-security-dns-proxy-boundary-pass -->
## Proxy·font boundary · v675

client-IP header는 socket peer가 `TRUSTED_PROXY_CIDRS`에 포함될 때만 신뢰한다. origin 직접 노출을 허용하는 설정이 아니며 방화벽 ACL을 대체하지 않는다. font response는 symlink를 거부하고 canonical base 내부 realpath를 `O_NOFOLLOW`로 연 뒤 열린 handle을 `fstat`해 regular file만 stream한다.

<!-- v675-security-proxy-font-boundary-pass -->
## v676 proxy·font·journal 경계

Forwarded client IP는 socket peer가 명시 trusted CIDR에 속하고 값이 실제 IPv4/IPv6일 때만 사용한다. 기본 trusted source는 loopback뿐이다. Font와 progress journal은 root realpath containment, `O_NOFOLLOW`, 열린 handle `fstat`를 사용하며 `EIO`·권한·read-only 오류를 not-found로 축소하지 않는다.

<!-- v676-security-proxy-font-journal-pass -->
