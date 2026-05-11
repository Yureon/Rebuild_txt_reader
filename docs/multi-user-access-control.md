# txt_reader_multi 다중 사용자 및 라이브러리 접근 제어 설계

기준 버전: rebuild-v534

## 확정된 운영 모델

- `.env`의 `LOGINID` / `LOGINPW`는 owner 콘솔 전용 계정이다.
- owner 계정은 로그인 후 `/admin/users.html`로 이동한다.
- owner는 기본 독서 계정이 아니며, 독서용 일반 사용자는 owner 콘솔에서 별도로 생성한다.
- 기존 `sync_data.json`은 migration하지 않는다.
- v385부터 일반 사용자 상태는 `data/user-data/<userId>/state.json` namespace로 저장한다.
- v386은 owner 콘솔에서 사용자 편집, 계정 활성/비활성, 비밀번호 초기화, 라이브러리 폴더 트리 선택 UI를 제공한다.
- 라이브러리는 공유 자원이다.
- `folders` mode는 선택한 폴더와 모든 하위 폴더를 포함한다.
- 권한은 UI 숨김이 아니라 서버 API에서 강제해야 한다.
- 다음 단계에서 `/api/novels`, `/api/content`, `/api/search`, `/api/block-manifest` 권한 강제를 적용한다.
- path 검사는 segment 단위 prefix 비교로 수행한다.

## v387에서 강제해야 할 API

- `/api/novels`: 사용자 권한에 맞게 목록 필터링
- `/api/content`: 직접 path 요청 차단
- `/api/search`: 검색 대상과 결과 모두 권한 필터링
- `/api/block-manifest`: 단일/다중파일 manifest 권한 확인
- 최근 항목/즐겨찾기/북마크/독서 데이터 관리 응답: 현재 권한 기준 필터링

<!-- v389-txt-reader-multi-owner-console-pass -->
<!-- v389-txt-reader-multi-library-access-pass -->
<!-- v389-txt-reader-multi-user-account-pass -->
<!-- v389-txt-reader-multi-user-state-namespace-pass -->
<!-- v389-txt-reader-multi-admin-library-tree-pass -->
<!-- v389-admin-user-management-ui-smoke-pass -->

## v387 서버 ACL 강제

- 일반 사용자 session만 reader API를 사용할 수 있다. `.env` owner session은 사용자 관리 콘솔 전용이며 `/api/novels`, content, episode content, block-manifest reader API에서 `reader_user_session_required`로 거부된다.
- `/api/novels` 응답은 현재 user의 `libraryAccess` 기준으로 필터링한다.
- `/api/novels/:novelId/content`와 `/api/novels/:novelId/episodes/:episodeId`는 직접 URL 호출도 서버에서 path 권한을 검사한다.
- `/api/novels/:novelId/block-manifest`와 episode block manifest도 동일하게 권한을 검사한다.
- 서버에는 별도 `/api/search` route가 없고 현재 검색은 허용된 novel/content endpoint를 통해 chunk를 읽는 클라이언트 검색 구조다. 따라서 v387에서는 content/manifest/list ACL이 검색 범위를 간접 강제한다. 별도 서버 검색 API가 추가되면 같은 ACL 유틸을 반드시 적용해야 한다.
- `/api/user-state` 응답은 저장 데이터 자체를 삭제하지 않고 현재 접근 가능한 novelId 기준으로 favorites, bookmarks, recents, progress, lastOpenedNovelId를 필터링한다. 권한을 다시 부여하면 저장된 사용자 데이터는 재노출될 수 있다.
- `folders` mode는 segment 단위 prefix 비교를 유지해 `판타지/작가A`와 `판타지/작가A_다른폴더`를 구분한다.

<!-- v389-txt-reader-multi-library-api-acl-pass -->
## v389 owner/user 운영 API 경계

- fileops mutation API는 기본적으로 owner session 전용이다. 단, v490 이후 일반 user session은 `folderMutationAccess`와 `libraryAccess` 조건을 모두 만족하는 `PATCH /api/folders/move` 및 `DELETE /api/folders`만 호출할 수 있다. 라이브러리 파일명 변경, novel/episode/file 이동/삭제 API는 계속 owner-only이다.
- `/api/recovery-status`는 sync/session/font/library cache 상태를 포함하므로 owner session 전용이다.
- `/api/time`은 상태나 라이브러리 정보를 노출하지 않는 liveness/time diagnostic이므로 인증된 user/owner 공통 API로 유지한다.
- 일반 user session의 역할은 reader API, 사용자별 state API, 사용자별 font API 사용으로 제한한다.
- owner session은 사용자 관리, 라이브러리 파일 조작, 복구 상태 확인을 담당하며, reader API는 계속 `reader_user_session_required`로 차단한다.

<!-- v389-owner-api-boundary-smoke-pass -->



## v389 권한 미리보기와 클라이언트 캐시 정리

<!-- v389-admin-library-preview-pass -->
<!-- v389-txt-reader-multi-user-access-snapshot-pass -->
<!-- v389-reader-access-snapshot-cache-purge-pass -->

- owner 콘솔은 `/api/admin/users/:userId/library-preview`를 통해 특정 사용자에게 실제로 노출될 소설 목록 수와 샘플을 확인한다.
- 일반 reader 세션은 `/api/user-access/snapshot`에서 `accessVersion`, `libraryAccess`, `accessibleNovelIds`를 받는다.
- 클라이언트는 이전 snapshot과 달라지면 IndexedDB reader cache 중 현재 권한에 없는 `novelId` record를 제거한다.
- 권한 회수는 서버 ACL이 1차 방어선이고, 클라이언트 cache purge는 이미 저장된 오프라인 chunk 노출을 줄이는 보조 방어선이다.

## v392 사용자 운영 보강

<!-- v392-font-owner-boundary-smoke-pass -->
<!-- v392-admin-user-state-management-smoke-pass -->
<!-- v392-admin-user-state-management-route-pass -->
<!-- v392-txt-reader-multi-user-state-admin-management-pass -->
<!-- v392-reader-access-revoked-current-reader-pass -->

- v392 당시 font upload/delete mutation은 owner session 전용이었다. v426부터 글꼴은 사용자별 저장소로 분리되며 일반 reader session도 자기 계정 범위의 `/api/fonts/upload`, `/api/fonts/:filename` 삭제, 목록 조회, 파일 다운로드를 사용할 수 있다.
- owner 콘솔은 `/api/admin/users/:userId/state/export`로 사용자별 서버 저장 독서 데이터를 JSON으로 내보낼 수 있다.
- owner 콘솔은 `/api/admin/users/:userId/state/reset`로 사용자별 서버 저장 독서 데이터를 초기화할 수 있다. 이 요청은 owner session, Same-Origin, CSRF, `confirmText: "RESET"`을 모두 요구한다.
- 일반 reader session은 admin state export/reset API를 호출할 수 없다.
- 일반 reader 세션의 `/api/user-access/snapshot` signature가 바뀌고 현재 열람 중인 `novelId`가 더 이상 허용 목록에 없으면 클라이언트는 reader를 닫고 목록 선택 상태로 복귀한다. 서버 ACL은 여전히 1차 방어선이다.

## v426 사용자별 글꼴 저장소 분리

<!-- v426-user-font-library-scope-smoke-pass -->
<!-- v426-user-font-library-scope-pass -->
<!-- v426-user-font-upload-route-pass -->

- 운영 목표는 라이브러리 파일만 owner 권한 설정과 맞물려 공유하고, 독서 상태/기기 설정/글꼴 등 나머지 사용자 데이터는 사용자별로 분리하는 것이다.
- `/api/fonts`, `/api/fonts/upload`, `/api/fonts/:filename`, `/api/fonts/file/:filename`은 인증된 owner/user session의 font scope를 사용한다.
- 일반 reader 사용자의 글꼴 파일과 메타데이터는 `data/user-data/<userId>/fonts` 및 `data/user-data/<userId>/font-library.json`에 저장한다.
- owner 글꼴은 기존 owner scope인 `data/fonts` 및 `data/font-library.json`에 남긴다. 일반 reader는 owner 글꼴 목록이나 파일을 조회하지 않는다.
- 같은 family 이름의 사용자 글꼴도 서로 다른 user scope에서는 독립적으로 허용된다. 삭제도 자신의 scope 안에서만 수행된다.
- 라이브러리 파일 조작(fileops)은 기본 owner 전용이다. v490 이후 예외적으로 일반 user의 폴더 이동/삭제만 owner가 `folderMutationAccess`로 허용할 수 있으며, 사용자 권한 설정은 계속 owner 전용이다.

## v493 folder mutation access policy

<!-- v493-folder-mutation-access-policy-pass -->
<!-- v493-folder-mutation-policy-smoke-pass -->

- `folderMutationAccess`는 `{ moveFolders: string[], deleteFolders: string[] }` 구조이며, 각 항목은 지정 폴더와 하위 폴더에 적용된다.
- `folderMutationAccess`는 항상 `libraryAccess`의 부분집합이어야 한다. owner가 사용자 또는 가입코드를 생성/수정할 때 이 조건을 벗어나면 저장을 거부한다.
- user session의 폴더 이동/삭제 실행 시 서버는 source folder가 `folderMutationAccess`에 포함되는지와 `libraryAccess` 안인지 둘 다 검사한다.
- user session의 폴더 이동 target은 `libraryAccess` 안이어야 한다. root target은 `libraryAccess.mode === "all"`일 때만 허용한다.
- user session의 폴더 삭제는 `confirmText: "DELETE:<categoryPath>"`를 요구한다. owner 삭제는 기존 `DELETE` 확인을 유지한다.
- user session의 성공한 폴더 이동/삭제는 `library.folder.move`와 `library.folder.delete` audit event로 기록한다.
- UI에서는 권한 없는 이동/삭제 버튼과 drag/drop target을 숨기거나 비활성화하지만, 최종 보안 경계는 서버 ACL이다.

## v393 owner console 계정 삭제 정책

<!-- v393-admin-user-delete-policy-smoke-pass -->
<!-- v393-admin-user-delete-policy-route-pass -->

owner console은 일반 사용자 계정 삭제를 지원한다. 삭제 API는 owner session, Same-Origin, CSRF, `DELETE:<username>` 확인문구를 요구한다. 삭제 시 `stateAction`은 `preserve` 또는 `reset` 중 하나이며, 기본값은 `preserve`이다.

## v394 일반 사용자 세션 강제 만료

<!-- v394-admin-user-session-revoke-smoke-pass -->
<!-- v394-admin-user-session-revoke-route-pass -->

owner console은 특정 일반 사용자의 기존 로그인 세션을 강제 만료할 수 있다. `POST /api/admin/users/:userId/sessions/revoke`는 owner session, Same-Origin, CSRF, `confirmText: "REVOKE"`를 요구한다. 또한 일반 사용자의 활성/비활성 상태가 변경될 때 `sessionVersion`을 증가시켜, 비활성화 중 남아 있던 오래된 세션이 재활성화 후 다시 유효해지지 않게 한다.

## v395 운영 진단과 감사 로그

<!-- v395-audit-log-service-smoke-pass -->
<!-- v395-admin-diagnostics-smoke-pass -->
<!-- v395-admin-diagnostics-pass -->

v395는 owner 전용 운영 보조 기능을 추가한다.

- 감사 로그는 `data/audit-log.jsonl`에 JSON Lines 형식으로 저장한다.
- 최종 배포 ZIP에는 `data` 디렉터리를 포함하지 않으므로 로그 파일 자체는 산출물에 포함하지 않는다.
- 기록 대상 이벤트는 사용자 생성/수정/비밀번호 초기화/state export/reset/계정 삭제/세션 강제 만료, font upload/delete이다.
- 로그 payload는 password/token/csrf/cookie/hash 성격의 필드를 `[redacted]`로 기록한다.
- `/api/admin/diagnostics`는 owner session에서만 접근 가능하며, `NODE_ENV`, `DEPLOYMENT_MODE`, `APP_ORIGIN`, request protocol, forwarded proto, data directory writable 여부, library path readable 여부, audit log writable 여부를 반환한다.
- 이 API는 운영 진단용이며 비밀번호, 세션 토큰, CSRF 토큰을 반환하지 않는다.


## v396 권한 변경 영향 미리보기

<!-- v396-admin-access-preview-compare-smoke-pass -->
<!-- v396-admin-access-preview-compare-pass -->

v396은 owner 콘솔의 라이브러리 권한 변경 UX를 보강한다.

- `POST /api/admin/users/:userId/library-preview/compare`는 저장 전 권한 변경안을 받아 현재 권한과 변경 예정 권한의 접근 가능 작품 수를 비교한다.
- 응답에는 전체 작품 수, 현재 접근 가능 수, 변경 후 접근 가능 수, 추가될 작품 수, 회수될 작품 수, 유지될 작품 수와 각 샘플이 포함된다.
- 이 API는 owner session, Same-Origin, CSRF를 요구한다. 비교 요청 자체도 운영 감사 로그에 `admin.user.library_preview_compare` 이벤트로 기록된다.
- owner 콘솔은 폴더 트리 검색 입력, 선택된 권한 폴더 고정 표시, mode별 서버 ACL 의미 안내를 표시한다.
- `folders` mode는 기존처럼 segment 단위 prefix 비교를 사용하므로 `무협/작가A`는 허용하되 `무협/작가A_다른폴더`는 허용하지 않는다.


## v397 가입코드 기반 회원가입

<!-- v397-signup-code-register-smoke-pass -->
<!-- v397-signup-code-register-route-pass -->
<!-- v397-admin-signup-code-route-pass -->

v397은 owner가 일반 user 계정을 직접 생성하는 흐름에 더해, owner가 미리 라이브러리 권한을 설정한 가입코드를 발급하고 초대 대상자가 로그인 화면의 회원가입 탭에서 해당 코드를 입력해 계정을 생성하는 흐름을 추가한다.

- 가입코드 원문은 발급 응답에 한 번만 표시하고 서버에는 `codeHash`만 저장한다.
- 저장소는 `data/signup-codes.json`이며 최종 ZIP에는 `data`를 포함하지 않는다.
- 기본 가입코드는 1회용이다. `maxUses`, `expiresAt`, `enabled`, `libraryAccess`, `defaultEnabled`를 가진다.
- `/api/register`는 auth gate의 public path이지만 Same-Origin과 전용 rate-limit을 적용한다.
- 회원가입 성공 시 자동 로그인하지 않고 로그인 화면으로 복귀한다.
- 가입 시 코드의 `libraryAccess`를 새 user 계정에 적용한다.
- owner의 가입코드 발급/수정/폐기와 public 회원가입 성공/실패는 audit log에 기록한다.

## v401 사용자 state snapshot/restore

- owner는 `/api/admin/users/:userId/state/snapshots`에서 사용자별 독서 데이터 snapshot을 생성하고 목록을 조회할 수 있다.
- `/api/admin/users/:userId/state/snapshots/:snapshotId`는 snapshot JSON 다운로드를 제공한다.
- `/api/admin/users/:userId/state/snapshots/:snapshotId/restore`는 `confirmText: "RESTORE"`와 CSRF/Same-Origin/owner session을 요구한다.
- state reset 및 계정 삭제 시 `stateAction: reset` 전에는 자동으로 before_reset/before_delete_reset snapshot을 생성한다.
- snapshot restore 전에도 현재 상태를 before_restore snapshot으로 보존한다.
- marker: `v401-admin-user-state-snapshot-smoke-pass`.
## v402 계정 운영 / 비밀번호 정책

- owner 콘솔은 사용자 비밀번호 초기화 시 직접 입력 또는 임시 비밀번호 발급을 지원한다.
- 임시 비밀번호 원문은 응답에 한 번만 표시되며, audit log에는 원문을 기록하지 않는다.
- owner가 비밀번호를 초기화하면 대상 user의 `sessionVersion`이 증가하여 기존 user 세션이 만료된다.
- 일반 user는 설정 > 일반 > 데이터 및 고급 영역의 계정 비밀번호 카드에서 자기 비밀번호를 변경할 수 있다.
- 자기 비밀번호 변경 시 현재 세션은 새 `sessionVersion`으로 갱신되어 유지되고, 다른 기존 세션은 만료된다.
- 계정 레코드에 `lastLoginAt`, `lastPasswordResetAt`, `lastPasswordChangedAt`, `lastSessionRevokedAt`을 저장해 owner 콘솔 운영 판단에 사용한다.
- marker: `v402-account-password-operations-smoke-pass`.



## v403 audit log 조회/운영 이력

- owner-only `GET /api/admin/audit-log` API를 추가해 최근 감사 이벤트를 조회한다.
- owner-only `GET /api/admin/audit-log/export` API를 추가해 필터된 이벤트를 JSONL로 다운로드한다.
- 지원 필터: `limit`, `eventType`, `userId`, `username`, `since`, `until`, `q`.
- 응답 이벤트는 audit write 단계에서 이미 redaction된 payload를 사용하며, 비밀번호/토큰/cookie/hash 필드는 원문으로 노출하지 않는다.
- owner 콘솔에는 `감사 로그` 버튼과 audit log card가 추가된다.
- marker: `v403-audit-log-query-pass`, `v403-audit-log-query-smoke-pass`.


## v404 hardening

- 가입코드 회원가입은 `consumeCodeForRegistration()` 경로로 처리한다. 가입코드 사용권을 먼저 저장해 일회용 코드가 중복 사용되지 않게 하고, 계정 생성 실패 시 사용권을 되돌린다.
- audit log 조회는 전체 파일을 한 번에 읽지 않고 tail window를 사용한다. 로그가 최대 크기를 넘으면 `audit-log.jsonl.1`로 rotate한다.
- 사용자 state snapshot은 기본 최근 30개/사용자별 50MB retention을 적용한다. 자동 snapshot을 우선 prune하고, 한도를 계속 초과하면 오래된 snapshot부터 제거한다.
- marker: `v404-signup-code-atomic-smoke-pass`, `v404-audit-log-retention-smoke-pass`, `v404-user-state-snapshot-retention-smoke-pass`.


## v427 사용자별 개인 데이터 경계 명확화

<!-- v427-user-data-isolation-doc-pass -->

v427 기준 목표는 `라이브러리 파일만 owner 권한 설정과 맞물려 공유하고, 그 외 모든 개인 데이터는 사용자별로 독립`이다.

- 라이브러리 파일은 owner의 library root를 공유하되 `/api/novels`, `/api/content`, `/api/search`, `/api/block-manifest`에서 사용자별 `libraryAccess`로 제한한다.
- 독서 위치, snapshot, 설정, 사용자 글꼴은 `data/user-data/<userId>/...` 범위에 둔다.
- 글꼴 UI는 `내 계정 전용 글꼴`과 `이 기기 전용`을 구분해서 표시한다.
- 상세 기준은 `docs/user-data-isolation.md`에 둔다.
