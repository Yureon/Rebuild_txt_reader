# v682 API 계약

공개 HTTP API와 저장 schema는 변경하지 않는다. Owner의 라이브러리 정리/재배치 다운로드 응답 형식과 파일명도 유지하며, 생성되는 PowerShell 본문만 Windows PowerShell 5.1 호환 구현으로 교체한다.

<!-- v682-api-contract-pass -->

# v681 API 계약

`GET /api/novels/shelf`의 기존 반복 `metadataProvider` query에 특별한 새 schema를 추가하지 않는다. 직접 입력 Metadata는 기존 applied record의 `providerId: manual`을 사용하며, `metadataProvider=manual` 요청은 해당 작품만 반환한다. 응답의 `filters.metadataProviderIds`에도 `manual`이 그대로 유지된다.

기존 Reader locator, Metadata 저장 schema, library cursor와 theme bootstrap API는 변경하지 않는다.

<!-- v681-api-contract-pass -->

# v680 API 계약

`GET /api/theme-bootstrap`을 추가한다. 유효한 세션에만 `no-store`로 응답하며 Owner에는 고정 Owner 팔레트, 일반 사용자에는 `themeMode`, `themePresetId`, `themeColors`, `readerBg`, `readerText`, UI 글자 크기와 밝기만 반환한다. 전체 사용자 상태·진행도·북마크·권한 데이터는 응답하지 않는다.

기존 Reader locator, Metadata, library cursor API schema는 변경하지 않는다.

<!-- v680-api-contract-pass -->

# v679 API 계약

v679은 공개 API schema를 변경하지 않는다. `/api/novels/tree` cursor pagination, Metadata folder search/pagination, candidate hard cap과 사용자 ACL 계약은 v677과 동일하다. 이번 변경은 정적 UI 자산과 cache namespace에 한정된다.

<!-- v679-api-contract-pass -->

# API 계약 — v676 current

기준 버전: `rebuild-v676`

# v674 현재 API 계약

기준 버전은 package `6.74.0`, runtime `rebuild-v674`이다.

- 공개 Reader locator와 metadata shard 응답 형식은 유지한다.
- library file operation은 directory sync 실패 시 성공 응답을 반환하지 않으며, 복구가 필요한 경우 `operationApplied`와 `recoveryRequired` 상태를 보존한다.
- `Accept-Language: *`인 metadata 요청은 RFC의 임의 언어 허용 의미에 따라 기본 locale `ko`로 처리한다.
- device profile 정리는 서버 내부 저장 정책이며 네 개의 관련 map/policy 목록이 같은 key set을 사용한다.

<!-- v674-api-current-pass -->

## 과거 릴리스 기록

# v667 metadata provider definition API

기준 버전: `rebuild-v667`. 다음 route는 same-origin, CSRF, Owner, 한국어 metadata locale을 요구한다.

- `POST /api/metadata/providers/custom`: custom provider 정의 생성
- `PUT /api/metadata/providers/:providerId/definition`: 기본 또는 custom 정의 저장
- `DELETE /api/metadata/providers/:providerId/definition`: 기본 override 복원 또는 custom provider 삭제

응답의 provider descriptor에는 `providerKind`, `definitionMode`, `definition`, `definitionDefaults`, `canEditDefinition`, `canDelete`가 포함된다.

<!-- v667-api-configurable-provider-pass -->

# v666 API 비영향

입력 자동완성 방어는 client DOM 정책이며 API schema, 인증 cookie, CSRF, library ACL, metadata route 계약을 변경하지 않는다.

<!-- v667-api-contract-pass -->

# API 계약 — 현재 추가 사항

기준: `rebuild-v665`

`POST /api/novels/:novelId/metadata/manual-cover`는 binary body를 받는다. 파일명과 원래 MIME은 신뢰 경계가 아닌 진단 정보다. 지원하지 않는 HEIC/HEIF는 `415 METADATA_COVER_UNSUPPORTED_FORMAT`, 손상·signature 불일치는 `400 METADATA_COVER_INVALID`로 구분한다.

<!-- v665-api-contract-pass -->

# v664 API 계약

이번 변경은 서버 API 형식을 변경하지 않는다. 이어보기는 기존 library snapshot과 Reader open 계약을 사용하며 특정 회차 ID가 있으면 명시적 선택을 우선한다.

<!-- v664-api-contract-pass -->

# v663 자산 API 계약

- `GET /api/metadata/covers/:assetId`: session·library ACL 후 private stream. 정상 200에는 `X-Txt-Reader-Asset: metadata-cover-v663`.
- `GET /api/fonts/file/:filename`: 사용자 font scope 후 private stream. 정상 200에는 `X-Txt-Reader-Asset: user-font-v663`.
- 두 route는 canonical same-origin asset이며 애플리케이션 redirect를 반환하지 않는다.

<!-- v663-api-contract-pass -->

# v661 파일 작업·정리 후보 API 계약

- 파일 변경 대기열 초과와 lock 대기 timeout은 `503`과 `Retry-After`를 반환한다. 연결이 종료된 대기 요청은 취소한다.
- filesystem 작업 후 journal commit이 실패하면 `LIBRARY_MUTATION_COMMIT_PERSIST_FAILED`, `recoveryRequired:true`, `fileOperationApplied:true`를 반환한다. rollback journal 저장 실패는 별도 오류로 반환한다.
- Owner의 폴더·작품·회차 이동·삭제·이름 변경은 성공·실패 감사 로그를 남긴다.
- metadata collect/apply 대기열은 디스크 flush가 완료된 뒤 수락 응답을 반환한다.
- `GET /api/admin/library-cleanup/status?planHash=...`는 plan 재계산 없이 상태만 반환한다. 대표 작품 변경 요청은 현재 `planHash`를 포함하며 stale generation은 `409`로 거절한다.

<!-- v661-api-contract-pass -->

# v649 mutation 및 alias 계약

- mutation journal 선기록 실패는 `503`, code `LIBRARY_MUTATION_STATE_UNAVAILABLE`, `Retry-After: 5`로 처리하며 filesystem을 변경하지 않는다.
- shelf/tree 응답의 `progressAliases`와 `variantMemberIds`는 128개에서 절단하지 않는다. 상세 variant 카드 목록은 UI payload 제한을 유지할 수 있으나 진행도 복원 alias는 전체를 보존한다.
- 검색 성능 profile GET은 생성 시 snapshot을 반환하며 cgroup 파일을 요청마다 읽지 않는다.

<!-- v649-api-mutation-alias-pass -->

# v648 metadata item patch contract

`POST /api/novels/:novelId/metadata/apply`, `PUT /api/novels/:novelId/metadata/manual`, `DELETE /api/novels/:novelId/metadata`는 성공 시 `novelPatch`와 `resolvePass`를 반환한다. `novelPatch`는 ID·progress aliases·표시 metadata만 포함하며 전체 catalog payload가 아니다. 정상 raw alias 해석은 전체 variant grouping을 실행하지 않는다.

<!-- v648-api-metadata-item-patch-pass -->

# v648 library warming contract

서재 catalog가 준비되지 않았거나 backoff 중이면 HTTP API는 `503`을 반환한다. 공개 오류는 `library_warming` 또는 `library_busy`이며 `Retry-After`를 포함한다. production route는 `getLibraryCachedForRequestAsync()` 경계를 우선하고 동기 cold scan을 호출하지 않는다.

<!-- v648-api-library-request-boundary-pass -->

# v646 서재 API 안정성

- cold catalog가 `LIBRARY_REQUEST_COLD_WAIT_MS` 안에 준비되지 않으면 `GET /api/novels/shelf`, tree 및 관련 catalog 요청은 `503`, `error=library_warming`, `Retry-After`를 반환할 수 있다.
- variant/tree/facet bounded queue가 가득 차면 `503`, `error=library_shelf_busy`, `Retry-After`를 반환한다.
- 두 응답은 새 full scan을 각각 시작하지 않으며 하나의 catalog/presentation 작업을 공유하거나 빠르게 거절한다.
- client는 해당 오류와 429/502/503/504에만 제한적으로 재시도하고 기존 shelf를 보존한다.
- cold scan 자체가 실패한 첫 요청도 `503`, `error=library_warming`으로 정규화한다. 실패 backoff 동안 state·ACL·block manifest 등 다른 catalog 소비 요청도 새 scan을 시작하지 않는다.
- 마지막 정상 durable catalog가 있으면 저장소 재검증과 무관하게 기존 목록을 먼저 제공한다.

<!-- v646-library-api-stability-pass -->

# v642 API 계약

## v644 `/api/novels/shelf` 호출 계약

응답 schema와 cursor 형식은 변경하지 않는다. client는 최초 진입에 page 1회만 호출하며, 추가 cursor는 실제 사용자 스크롤 의도 이후에만 소비한다. 제한 사용자의 full accessible ID snapshot은 shelf API의 서버 ACL 검사를 대체하지 않으며 client background reconciliation 용도다.

<!-- v644-shelf-api-call-budget-pass -->

## v643 API 계약

- `GET /api/admin/library-organization/plan?layout=<author-title|category-author-title|title>&mode=<copy|move>`: Owner 전용 preview, 최대 300개 sample과 full-plan hash 반환.
- `POST /api/admin/library-organization/script`: Owner 전용 PowerShell script 반환. 서버에서 파일을 이동하지 않는다.
- `PUT /api/metadata/providers/:providerId`: `enabled`, `priority`, `autoApply`, `autoApplyThreshold`, `requestIntervalMs`, `searchLimit` 저장. `requestIntervalMs`는 호환성을 위해 이름을 유지하지만, 의미는 **같은 공급자의 한 작품 수집이 완료된 뒤 다음 작품 수집까지의 기준 쿨타임**이다. 다른 공급자의 시작 시각에는 적용하지 않는다.
- metadata provider 응답은 `metadataAvailableForLocale`, `requestedSiteLanguage`, `localeRestriction:"ko-only"`를 포함한다.
- 비한국어 locale의 provider 변경/수집 endpoint는 HTTP 403 `metadata_locale_unsupported`를 반환한다.

<!-- v643-api-pass -->


Owner metadata storage API:

- `GET /api/metadata/storage`
- `POST /api/metadata/storage/cleanup/preview`
- `POST /api/metadata/storage/cleanup`
- `POST /api/metadata/storage/rewrite`

작품 목록의 대표 item은 `variantMemberIds`, `progressAliases`, `variants[].relation`, `variants[].similarity`, `representativeQuality`를 제공한다. 관계 값은 `duplicate-copy`, `superseded`, `alternate-edition`이다. 수동 검토 후보는 cleanup preview의 `reviewGroups`로 제공한다.

<!-- v642-api-contract-pass -->

# v640 API·provider 계약

## v641 API 변경

- 수동 metadata 저장은 `clearFields`를 지원한다. 지원되지 않는 필드, 값 없는 `fields`, set/clear 충돌은 `METADATA_FIELDS_INVALID`로 거절한다.
- metadata document 권한 실패 navigation은 library notice로 복구한다.
- font와 site-language production route는 async mutation API만 사용한다.

<!-- v641-current-doc-pass -->

`GET /api/metadata/providers`의 provider 목록에 `builtin-ssn`이 추가된다. 기본 priority는 5, `browserProfileSupported`는 false이며 기존 owner provider settings API로 enabled, autoApply, priority를 변경할 수 있다.

수집 job에서 `providerIds:["builtin-ssn"]`을 선택하면 공개 search/detail transport만 사용한다. candidate와 applied metadata의 API shape는 기존 provider와 동일하다.

<!-- v640-api-provider-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

## 후보 조회

`GET /api/novels/:novelId/metadata`는 기존 `candidates`와 함께 다음을 반환한다.

- `candidateGroups[]`: 동일 내용 후보 묶음
- `candidateCount`: 원본 후보 수
- `candidateGroupCount`: 묶음 수
- `groupedCandidateCount`: 묶음으로 절감된 카드 수

각 group은 서버 생성 `id`, `representativeId`, `count`, 대표 `data`, `providers[]`, `sourceCount`, `coverVariantCount`를 포함한다.

## 후보 묶음 적용·삭제

- `POST /api/novels/:novelId/metadata/apply`: `candidateId` 또는 `candidateGroupId` 중 정확히 하나만 받는다.
- `DELETE /api/novels/:novelId/metadata/candidate-groups/:candidateGroupId`: 서버가 현재 fingerprint 기준 member를 재계산해 durable하게 삭제한다.

## legacy manual cover

`coverUrlLocal`은 정확한 `/api/metadata/covers/<same-coverAssetId>`일 때만 v636 호환 입력으로 허용한다. 서버는 이 값을 폐기하고 verified asset에서 canonical URL을 생성한다.

<!-- /v638-current-summary -->


## 정적 실행 자산

old/future `?v=rebuild-vN` 실행 자산 요청은 현재 파일로 forward하지 않는다. JS/MJS/CJS, worker, HTML fragment, WASM은 HTTP 409 JSON `reload_required`와 `X-TXT-Reader-Reload-Required: 1`, no-store를 반환한다. CSS·이미지·폰트 등 비실행 자산은 별도 no-store transition 정책을 적용할 수 있다.

## `PUT /api/novels/:novelId/metadata/manual`

- 수동 표지 입력은 `coverAssetId`만 허용한다.
- `coverAssetId`는 정확한 64자리 SHA-256 hex여야 한다.
- `coverUrl`, `coverRemoteUrl`, 불일치·비정상 `coverUrlLocal`은 400/422 계열 오류로 거절한다. v636의 정확한 same-asset canonical `coverUrlLocal`은 호환 입력으로만 허용하고 서버가 폐기한다.
- 서버는 asset regular file 존재, symlink 금지, image signature/extension, content SHA-256 일치를 검사한다.
- canonical URL `/api/metadata/covers/<assetId>`은 서버가 생성한다.
- metadata flush 후 재조회한 applied record가 동일 asset ID와 URL을 참조할 때만 pending lease를 해제한다.
- 적용 실패·flush 실패·부분 적용이면 lease를 유지한다.

## `POST /api/novels/:novelId/metadata/manual-cover`

기존 `METADATA_COVER_MAX_BYTES` 경계와 image signature 검증을 유지한다. 성공 응답의 asset ID는 후속 manual save에서 사용하며, 응답 URL을 다시 신뢰 입력으로 제출하지 않는다.

<!-- v637-api-contract-pass -->

# v635 표지·업데이트 계약

- `GET /api/metadata/providers`와 `GET /api/novels/:novelId/metadata`는 `manualCoverMaxBytes`를 반환한다.
- `POST /api/novels/:novelId/metadata/manual-cover`의 raw body 제한과 저장 서비스 제한은 `METADATA_COVER_MAX_BYTES`를 공통 사용한다. 기본값은 5MiB이며 환경 설정 허용 범위는 64KiB~20MiB다.
- 업로드 성공 asset은 수동 metadata 적용 전 lease 상태이며 `PUT /api/novels/:novelId/metadata/manual` 성공 후 해제된다.
- `/api/system-update/authorization`은 기존 권한 경계를 유지한다. update 버튼은 승인 후 새 Service Worker 설치·활성화를 기다리며, 새 worker가 없으면 성공으로 처리하지 않는다.

<!-- v635-api-contract-pass -->

# v628 Owner 서재 정리 API

두 API 모두 Owner 세션 전용이며 `Cache-Control: no-store`를 사용한다.

- `GET /api/admin/library-cleanup/plan`: 현재 서재를 다시 읽고 `duplicate-copy`와 `superseded` 후보, 보존본, 파일 크기·수정시각, 계획 해시를 반환한다.
- `POST /api/admin/library-cleanup/script`: same-origin과 CSRF 검사를 거친 뒤 선택 관계/묶음만 포함한 PowerShell `.ps1` 스크립트를 반환한다. 빈 `relations` 배열은 0건 선택이다.

브라우저 API는 파일을 삭제하거나 이동하지 않는다. 생성된 스크립트도 기본은 dry-run이며 `--apply`에서만 서재 내부 격리 폴더로 이동한다. `alternate` 관계는 정리 대상이 아니다.

<!-- v628-library-cleanup-api-pass -->

# v623 메타데이터 작품 목록 필터 API

`GET /api/novels/shelf`는 기존 query에 다음 반복 query를 추가로 받는다.

- `metadataStatus=applied|missing`
- `metadataProvider=<canonical-provider-id>`

정규화된 값은 응답의 `filters.metadataStatuses`, `filters.metadataProviderIds`에 포함된다. 조건은 인증·ACL·검색·기존 facet 처리와 함께 cursor slicing 전에 적용되므로 `total`, `nextCursor`, `focus.index`, `focus.offset`은 필터된 전체 집합을 기준으로 한다. provider 조건은 적용 메타데이터가 존재하고 해당 `providerId`와 일치할 때만 통과한다.

# v613 진행도 delta·클라이언트 scope 계약

<!-- v613-progress-delta-single-acl-pass -->

- `PATCH /api/user-state/progress/:novelId`는 대상 작품 하나만 library `novelById` index에서 조회해 ACL을 판정한다.
- 전체 state ACL Set 구성은 전체 PUT·복구·export처럼 전체 state filtering이 필요한 요청에만 사용한다.
- lifecycle delta는 일반 progress queue와 분리해 즉시 `keepalive` 요청으로 제출한다.
- 네트워크 성공 fingerprint와 로컬 persistence fingerprint를 구분하며 실패한 전송을 동기화 성공으로 기록하지 않는다.
- 모든 client entry는 state hydrate 전에 `/api/user-access/snapshot`으로 사용자 storage scope를 확정한다.

# v612 진행도 delta·권한 snapshot 계약

- `PATCH /api/user-state/progress/:novelId`는 현재 작품 snapshot만 병합 저장하고 전체 `shared` 상태를 응답하지 않는다.
- route의 `novelId`와 payload snapshot의 `novelId`가 다르면 `400`이다. 현재 library ACL 밖 작품은 `403`이다.
- `PUT /api/user-state/progress`는 전체 복구·구버전 호환 경로로 유지한다.
- `GET /api/user-access/snapshot`의 기본 응답은 제한 계정에서도 전체 `accessibleNovelIds`를 계산하지 않는다.
- 권한 signature 변경 후 클라이언트가 `?includeNovelIds=1`을 요청할 때만 허용 작품 ID 전체 목록을 계산한다.
- `libraryDndHoverOpenDelay`는 상태 API의 preference가 아니며 서버 정규화에서 제거된다.

기준 버전: `rebuild-v613`

<!-- v612-api-contract-pass -->

# v611 API error and preference persistence contract

- Every `/api` route forwards rejected async handlers, including nested arrays and `use`/`route`/`param` handlers, to the common JSON error boundary.
- Unexpected 5xx responses use `internal_server_error` without exposing the original exception message or internal error code, including route-local `catch` branches.
- `shared.viewerPrefs.readerEpisodeBoundaryMode` accepts `manual` or `scrollBeyond` and is preserved across devices.
- `readerEpisodeBoundaryOpening` and `readerEpisodeBoundaryCooldownUntil` are runtime locks, not persisted preference fields.
- The client completes `GET /api/user-state` before periodic shared or device writes. Failed hydration is retried before any push.

<!-- v611-api-contract-pass -->

# v606 API 계약 추가

- `POST /api/login`: session durable 저장 실패 시 cookie를 발급하지 않고 `503 session_persistence_failed`.
- `POST /api/logout`: session durable 삭제 실패 시 cookie와 현재 session을 유지하고 `503 SESSION_STORE_DELETE_PERSIST_FAILED`.
- metadata collect API는 queue enqueue를 durable flush한 뒤 `202`를 반환한다.
- 권한이 없는 cover asset은 cache 여부와 무관하게 `404`다.

기준 버전: `rebuild-v613`

# v605 사용자 상태·인증 API 계약

- `PUT /api/user-state/shared`, `PUT /api/user-state/progress`, `PATCH /api/user-state/progress/:novelId`는 저장 전에 현재 library ACL로 작품 ID를 필터링한다.
- 폴더 제한 사용자의 응답에서는 사용자 태그 할당, 진행률 position key, 접힌 폴더도 허용 범위만 반환한다.
- position key는 전체 작품 ID 집합에서 가장 긴 ID 일치를 사용해 접두어 충돌을 방지한다.
- `syncVersion`과 `updatedAt`은 0 이상의 유한한 안전 정수여야 한다.
- `GET /api/sync`와 `POST /api/sync`는 모두 `410 legacy sync api disabled`를 반환한다.
- direct 배포는 임의의 `X-Forwarded-Proto`를 HTTPS 증거로 사용하지 않는다.

## v604 내구성·권한 API 계약

### v604 권한·응답 계약

- `GET /api/user-access/snapshot`: 기본 응답은 compact `accessSignature`를 반환하고 `accessibleNovelIds`를 계산하지 않는다. 제한 사용자는 `?includeNovelIds=1`에서만 허용 작품 ID 목록을 받는다.
- metadata provider 설정은 owner만 변경한다. provider profile 상세와 전역 queue 진단도 owner 전용이다.
- metadata job은 owner 또는 `requestedBy/requesters`에 포함된 사용자만 조회·취소한다. 일반 사용자 응답에서는 requester와 dedupe 내부 필드를 제거한다.
- dedupe 작업의 requester 목록은 임의의 64명 상한으로 잘리지 않으며, 공유 작업을 요청한 모든 계정이 자신의 작업 상태를 계속 조회할 수 있다.
- 작품별 metadata 응답의 provider profile도 일반 사용자에게 최소 상태만 제공한다.
- 오래된 `?v=rebuild-vNNN` 정적 자산 요청은 `X-TXT-Reader-Reload-Required: 1`로 현재 build reload를 요구한다.

- owner user-state snapshot/list/read/restore/reset API는 Promise 완료와 durable write 이후 응답한다.
- shared/progress/device 저장은 durable flush 실패 시 변경 전 메모리 상태로 rollback하고 `503 STATE_PERSISTENCE_FAILED`를 반환한다.
- 사용자 삭제는 상태 reset 전 snapshot을 만들고 account delete 실패 시 해당 snapshot을 복원한다.
- font list/upload/delete/file route는 서비스 오류를 JSON 4xx/5xx로 변환하며 async service를 우선 사용한다.
- register/password/admin password route는 async account API를 사용한다.
- filter-tags는 cursor/search/minCount/limit 계약을 유지하며 클라이언트 DOM window는 180개로 제한한다.
- server stop은 최종 persistence 결과 중 하나라도 실패하면 `SHUTDOWN_PERSISTENCE_FAILED`를 반환한다.

기준 버전: `rebuild-v605`

## v601 서재 태그·검색 계약

- `GET /api/novels/shelf/filters`는 기존 `facets`와 함께 `tagDistribution`을 반환한다.
- `tagDistribution.distinct`는 전체 고유 태그 수, `totalUsage`는 작품별 중복 제거 후 총 사용 횟수, `histogram`은 `{count,tags}` 빈도 분포다.
- 태그 옵션 payload는 빈도 상위 500개로 제한하지만 자동 임계값은 전체 histogram으로 계산한다. 사용자 정의 태그는 별도 `userTags`로 전달되어 상위 목록 밖에서도 표시된다.
- 메타데이터 또는 사용자 태그가 변경되면 shelf 검색 키·필터 cache key·ETag가 함께 갱신된다.

기준 버전: `rebuild-v605`

## v600 사용자 태그 API 계약

사용자 공유 상태에 다음 선택 필드를 추가한다.

```json
{
  "userTags": ["판타지", "완결"],
  "novelUserTags": {
    "novel-id": ["판타지"]
  }
}
```

- `userTags`: 최대 100개, 이름당 최대 40자, 대소문자 비구분 중복 제거.
- `novelUserTags`: 최대 5000개 작품, 작품당 최대 20개 태그.
- 정의되지 않은 태그 적용값은 서버 정규화에서 제거한다.
- `/novels/shelf`, `/novels/tree`, `/novels/:id/meta`, `/novels/shelf/filters`는 현재 사용자의 태그를 반영한다.
- shelf cache key와 ETag 계산에는 사용자 태그 상태가 포함된다.


## v594 UI runtime 계약

- 비로그인 공개 정적 경로에 `/scripts/theme-boot.js`를 포함한다.
- owner logout은 기존 `POST /api/logout` 계약을 사용한다.
- 페이지 unload는 `/api/time`에 POST를 보내지 않는다. `/api/time`은 기존 GET 계약만 유지한다.

<!-- v594-api-ux-pass -->

# v577 페이지 진입 계약

- `GET /library.html`: 인증 후 카드형 서재가 기본이다. `?view=files`가 명시되면 폴더 트리로 진입한다.
- `GET /metadata.html`: 인증이 필요한 메타데이터 전용 화면이며 `Cache-Control: no-store`다.
- 메타데이터 화면은 기존 `/api/novels/shelf`, `/api/novels/:id/metadata`, `/api/metadata/jobs`, `/api/metadata/providers` 계약을 사용하며 전체 작품을 한 번에 직렬화하지 않는다.
- 카드/트리 전환은 클라이언트 표시 상태만 바꾸며 원본 `/api/novels`와 reader 좌표 계약을 변경하지 않는다.

# v576 웹 메타데이터 API 계약

- `GET /api/metadata/providers`: 공급자 상태와 큐 요약
- `GET /api/novels/:novelId/metadata`: 적용 결과, 후보와 편집 가능 여부
- `POST /api/novels/:novelId/metadata/collect`: 자동 검색 또는 `url` 직접 수집
- `POST /api/metadata/collect-missing`: 적용 결과가 없는 작품을 제한된 배치로 큐 등록
- `POST /api/novels/:novelId/metadata/apply`: 후보를 필드별 적용
- `PUT /api/novels/:novelId/metadata/manual`: 사용자가 입력한 비어 있지 않은 필드만 현재 적용 정보에 병합
- `POST /api/novels/:novelId/metadata/manual-cover`: `image/*` 또는 `application/octet-stream` 본문으로 최대 5MB 표지 이미지를 업로드하고, 수동 저장 요청에 사용할 로컬 cover asset 정보를 반환
- `DELETE /api/novels/:novelId/metadata/candidates/:candidateId`: 귀속 작품이 일치하는 수집 후보를 삭제. 이미 적용된 데이터 사본은 유지하고 후보 참조만 해제
- `DELETE /api/novels/:novelId/metadata`: 적용 결과 삭제
- `GET /api/metadata/jobs`, `GET /api/metadata/jobs/:jobId`, `POST .../cancel`: 작업 조회·취소
- `POST /api/metadata/providers/:providerId/browser-login/start`: owner 전용 Playwright persistent login 시작
- `GET /api/metadata/providers/:providerId/browser-login/session|screenshot`: owner 전용 상태·PNG 화면
- `POST /api/metadata/providers/:providerId/browser-login/action|finish`: owner 전용 click/type/key 및 로그인 완료
- `DELETE /api/metadata/providers/:providerId/browser-login/session|browser-profile`: owner 전용 취소·프로필 삭제
- 공급자 Cookie 입력·저장 API는 v584에서 제거됨
- `GET /api/metadata/covers/:assetId`: 로그인 및 library ACL을 통과한 로컬 표지

모든 쓰기 API는 same-origin, CSRF, rate limit과 전체 라이브러리 편집 권한을 요구한다. 후보는 귀속 작품이 일치해야 적용할 수 있다. 외부 표지 URL과 raw response hash는 공개 응답에서 제거한다.

# v575 서재 탐색·필터·소형 트리 API 계약

## Reader → library navigation

- `/library.html?focusNovelId=<id>&focusEpisodeId=<id>&view=shelf&from=reader`
- `focusNovelId`는 대표 판본의 `progressAliases`와도 비교한다.
- shelf 응답의 `focus`는 요청 작품의 전체 필터 결과 내 index와 선택된 page offset을 제공한다.

## Shelf filters

- `GET /api/novels/shelf/filters`: `authors`, `categories`, `publicationStatuses`, `groupKinds`와 각 count를 반환한다.
- `GET /api/novels/shelf`는 반복 query `status`, `author`, `category`, `group`을 받는다.
- 같은 query key 값은 OR, 서로 다른 key는 AND다.

## Compact tree

- `GET /api/novels/tree`는 접근 권한이 적용된 작품 메타만 반환한다.
- multi-file 작품도 `episodes: []`, `episodesLoaded: false`이며 회차는 `/api/novels/:novelId/episodes`로 지연 조회한다.
- 원본 `/api/novels` 계약은 관리·호환 목적으로 유지한다.

# v574 서재·리더 및 작품 묶기 계약

## 페이지 진입

- `GET /library.html`: 인증 후 기본 서재 전용 페이지. HTML은 `Cache-Control: no-store`다.
- `GET /site.html?novelId=<id>&episodeId=<id>`: PC 리더 페이지.
- `GET /mobile.html?novelId=<id>&episodeId=<id>`: 모바일 리더 페이지.
- 리더의 `novelId`가 없으면 마지막 읽기를 복원하며, 유효하지 않으면 빈 리더와 오류 안내를 표시한다.

## 서재 표현 API

- `GET /api/novels/shelf`: ACL 적용 후 작품 카드 표현을 반환한다. 중복·이전 판본은 대표 항목 하나로 묶을 수 있다.
- `GET /api/novels/:novelId/meta`: 숨겨진 판본 alias ID도 대표 작품 metadata로 해석한다.
- `GET /api/novels/:novelId/variants`: 대표와 숨겨진 판본의 관계를 반환한다.
- `GET /api/novels/:novelId/episodes`: 실제 폴더형 작품과 가상 회차 그룹의 회차 요약을 지연 반환한다.
- `GET /api/novels`: 파일 탐색·관리·ACL용 원본 카탈로그다. 판본 그룹 때문에 원본 항목을 제거하지 않는다.

서재 항목의 추가 필드:

- `variantGroupId`, `variantCount`, `hiddenVariantCount`, `isVariantGroup`
- `progressAliases`, `variantMemberIds`, `variants[]`
- `isVirtualEpisodeGroup`, `episodeGroupingKind`, `episodeGroupingPass`

가상 회차 그룹은 읽기용 다중 회차 작품으로 동작하지만 그룹 전체를 실제 폴더로 간주하지 않는다. 전체 rename/move/delete는 `VIRTUAL_EPISODE_GROUP_MUTATION_UNSUPPORTED`로 차단한다.

---

## v573 내부 저장소 변경과 HTTP 호환성

- `/api/content`와 block-manifest의 응답 필드, `fileChar`, chunk/block 번호, ETag와 503/`Retry-After` 계약은 변경하지 않았다.
- normalized cache의 schema 2, per-chunk hash와 invalid/rebuild 상태는 서버 내부 구현이며 cache path/key를 API로 노출하지 않는다.
- 라이브러리 refresh가 nested I/O 오류로 실패하면 기존 성공 snapshot을 계속 제공한다. 부분 스캔 결과를 새 정상 목록으로 확정하지 않는다.
- deferred fragment/style URL의 runtime cachebuster는 `rebuild-v594`이다.

## v572 streaming cold-build contract

- HTTP content/block-manifest 응답과 `fileChar` 의미는 v570과 동일하다.
- streaming decoder, temporary line spool, normalized cache path와 builder metadata는 서버 내부 구현이며 API 입력·응답에 노출하지 않는다.
- v571 당시에는 v570 cache metadata를 읽었지만, v573 schema/index identity 변경 후에는 v572 이하 cache를 최초 접근 시 재생성한다.
- worker queue 503/`Retry-After`, abort, ACL과 main-thread large-file fallback 금지 계약은 유지한다.

## v570 normalized content storage contract

- `/api/content`와 block-manifest 응답의 `content`, `start`, `end`, `currentChunk`, `totalChunks`, `textHash`, `fileChar` 의미는 v569와 동일하다.
- 대형 파일의 내부 entry는 `storage: disk`, `text: null`일 수 있으나 이 내부 필드는 API에 노출하지 않는다.
- worker queue 포화는 기존처럼 503과 `Retry-After`를 반환한다.
- API는 normalized cache path/key를 입력으로 받지 않으며 권한 검사를 통과한 작품만 내부 cache를 읽는다.

## v569 asynchronous library and overload client contract

- Library read routes return the last valid snapshot immediately when a deep signature check is due. Signature I/O is scheduled asynchronously; `X-Library-Refresh-Pending` continues to represent catalog rebuild work, while owner cache diagnostics expose signature-check scheduled/in-progress state, duration, target count and changed path.
- `LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS` is the base check interval, `LIBRARY_DEEP_SIGNATURE_CHECK_MAX_TTL_MS` is the unchanged/slow-check backoff ceiling, and `LIBRARY_SIGNATURE_CHECK_CONCURRENCY` bounds parallel metadata I/O.
- `503 { "error": "content_worker_busy" }` may include `Retry-After`. The client retries only foreground replace/jump content loading once, capped at six seconds; buffer extension and prefetch do not automatically retry.
- `/fragments/deferred-ui.html?v=rebuild-v594` and `/styles/deferred-ui.css?v=rebuild-v594` are authenticated immutable static assets and are not public before login.

## v568 client loading contract

- No server API shape changed in v568. The shelf, episode, content-worker overload, ETag and stale-while-revalidate contracts from v566/v567 remain authoritative.
- Client feature imports are queryless ESM URLs and therefore retain the existing `must-revalidate` cache boundary; versioned HTML/entry assets use `rebuild-v568`.
- A dynamic feature import failure is surfaced to the user and remains retryable; it must not silently fall back to a synchronous large-file server path.

## v567 resource-pressure responses and shelf cache

- Content and block-manifest routes return `503 { "error": "content_worker_busy" }` plus `Retry-After` when the bounded worker queue is full.
- Large-file worker failures return `503 { "error": "content_worker_failed" }`; the server does not synchronously rebuild the large file on the event loop.
- Shelf responses expose `X-Library-Shelf-Cache: hit|miss` and `X-Library-Shelf-Query-Cache: v567-library-shelf-query-cache-pass`. Cache keys include library signature, authenticated access scope, favorites/recents state, normalized query, cursor, and limit.
- `X-Library-Refresh-Pending` indicates that a changed library tree is being rebuilt while the previous valid snapshot is served.

# API Contract — Rebuild v13

이 문서는 현재 프론트엔드가 서버에 기대는 HTTP 계약을 정리한다. v13 기준 서버 구현은 아직 기존 동작을 유지하며, 이 문서는 이후 `routes / services / repositories` 분리와 block manifest API 추가의 기준으로 사용한다.

## 공통 규칙

- 인증은 `session_token` HttpOnly cookie 기반이다.
- 쓰기 API는 동일 출처 검증과 CSRF 검증을 요구한다.
- CSRF 토큰은 `/api/csrf`에서 조회한다.
- JSON 쓰기 API는 `Content-Type: application/json`을 기본으로 한다.
- 폰트 업로드만 `application/octet-stream` raw body를 사용한다.
- 동적 API 응답은 기본적으로 `Cache-Control: no-store` 성격을 유지한다.
- 정적 HTML은 `no-store`, CSS/fragments/icons는 장기 캐시, rebuild ESM은 재검증 캐시를 사용한다.

## 인증

### `POST /api/login`

요청:

```json
{
  "id": "admin id",
  "pw": "admin password"
}
```

응답:

```json
{
  "success": true,
  "csrfToken": "..."
}
```

### `POST /api/logout`

요구:

- authenticated session
- same-origin
- CSRF

응답:

```json
{ "success": true }
```

### `GET /api/csrf`

응답:

```json
{
  "authenticated": true,
  "csrfToken": "..."
}
```

미인증 상태에서는 `authenticated: false`를 반환한다.

## 라이브러리/본문

### `GET /api/novels`

라이브러리 트리를 반환한다.

응답 핵심 필드:

```json
{
  "novels": [],
  "ts": 1710000000000
}
```

노드 형태는 단일 파일 소설과 폴더형 에피소드 소설을 모두 포함한다. 프론트엔드는 `id`, `title`, `path`, `type`, `episodes`, `categoryPath` 계열 필드를 사용한다.

### `GET /api/novels/:novelId/content`

단일 파일 소설 본문을 chunk 단위로 반환한다.

쿼리:

- `chunk`: 0 기반 chunk 번호
- `preRemoveNoise`: `0 | 1`
- `preChapterSpacing`: `0 | 1`
- `preCollapseBreaks`: `0 | 1`
- `preSplitDense`: `0 | 1`
- `preAggressive`: `0 | 1`

응답:

```json
{
  "content": "...",
  "chunk": 0,
  "totalChunks": 12,
  "hasPrev": false,
  "hasNext": true,
  "contentHash": "..."
}
```

### `GET /api/novels/:novelId/episodes/:episodeId`

폴더형 소설의 특정 에피소드 본문을 chunk 단위로 반환한다. 쿼리와 응답 계약은 단일 파일 본문 API와 동일하다.

## 파일/폴더 관리

모든 쓰기 API는 same-origin + CSRF 검증이 필요하다. fileops mutation은 기본 owner-only이다.

### `PATCH /api/folders/rename`

폴더 이름을 변경한다. owner session 전용이다.

### `PATCH /api/folders/move`

폴더를 다른 카테고리 경로로 이동한다. owner session은 허용된다. user session은 다음 조건을 모두 만족해야 한다.

- source `categoryPath`가 `folderMutationAccess.moveFolders` 범위 안이다.
- source `categoryPath`가 `libraryAccess` 범위 안이다.
- target `targetCategoryPath`가 `libraryAccess` 범위 안이다.
- root target은 `libraryAccess.mode === "all"`일 때만 허용한다.

실패 시 `folder_mutation_access_denied`와 `v493-folder-mutation-access-policy-pass`를 반환한다. 성공한 user move는 `library.folder.move` audit event로 기록한다.

### `DELETE /api/folders`

폴더를 삭제한다. owner session은 기존 `confirmText: "DELETE"`로 허용된다. user session은 다음 조건을 모두 만족해야 한다.

- source `categoryPath`가 `folderMutationAccess.deleteFolders` 범위 안이다.
- source `categoryPath`가 `libraryAccess` 범위 안이다.
- body `confirmText`가 `DELETE:<categoryPath>`와 일치한다.

성공한 user delete는 `library.folder.delete` audit event로 기록한다.

### `PATCH /api/novels/:novelId/move`

단일 파일 또는 폴더형 소설을 이동한다.

### `PATCH /api/episodes/:novelId/:episodeId/move`

에피소드 파일을 이동한다.

### `PATCH /api/novels/:novelId/episodes/:episodeId/rename`

에피소드 파일 이름을 변경한다.

### `DELETE /api/novels/:novelId/episodes/:episodeId`

에피소드 파일을 삭제한다.

## 사용자 상태/동기화

### `GET /api/user-state`

공유 상태, 기기별 상태, 메타 정보를 반환한다.

v23부터 기존 필드에 더해 선택 필드 `syncPolicySummary`를 반환할 수 있다. 기존 클라이언트는 이 필드를 무시해도 된다.

```json
{
  "version": 1,
  "updatedAt": 1710000000000,
  "sharedUpdatedAt": 1710000000000,
  "sharedVersion": 10,
  "deviceUpdatedAt": 1710000000000,
  "deviceVersion": 3,
  "shared": {},
  "device": {},
  "deviceProfiles": {},
  "currentDeviceId": "device-id",
  "syncPolicySummary": {
    "currentDeviceId": "device-id",
    "preferredDeviceId": null,
    "effectiveDeviceId": "device-id",
    "currentDeviceIsPreferred": false,
    "preferredDeviceKnown": false,
    "hasOtherDevices": false,
    "devices": [],
    "progressAuthority": {
      "hasLastRead": false
    }
  }
}
```

### `PUT /api/user-state/shared`

공유 상태를 저장한다.

주요 범위:

- 즐겨찾기
- 북마크
- 최근 열람
- 접힌 폴더
- viewer prefs
- progress map
- theme buckets
- sync policy

### `PUT /api/user-state/progress`

전체 진행도 상태를 저장한다. 복구·가져오기·구버전 클라이언트 호환용 경로다. 일반 독서 중 저장은 아래 delta API를 사용한다.

### `PATCH /api/user-state/progress/:novelId`

현재 작품의 진행도 snapshot 하나만 병합 저장한다. 요청 본문은 `snapshot`, `syncVersion`, `updatedAt`을 포함한다. 응답은 `progressSnapshot`, `sharedVersion`, `syncPolicySummary`를 포함할 수 있지만 전체 `shared` 상태를 되돌려 보내지 않는다.

```json
{
  "snapshot": {
    "novelId": "novel-id",
    "episodeId": "episode-id",
    "chunk": 12,
    "totalChunks": 20,
    "ratio": 0.35,
    "documentRatio": 0.75,
    "episodeDocumentRatio": 0.35,
    "fileCharIndex": 9033,
    "ts": 1710000000000
  },
  "syncVersion": 21,
  "updatedAt": 1710000000000
}
```

### `PUT /api/user-state/device`

기기별 상태를 저장한다.

### `GET /api/sync` / `POST /api/sync`

구형 동기화 API는 모두 `410 legacy sync api disabled`를 반환한다. 현재 클라이언트는 `/api/user-state` 계열을 사용한다.

## 복구/진단

### `GET /api/recovery-status`

세션, 동기화 파일, 스냅샷, 캐시 상태 등 최소 진단 정보를 반환한다.

### `GET /api/time`

서버 기준 timestamp를 반환한다.

```json
{ "ts": 1710000000000 }
```

## 폰트 라이브러리

### `GET /api/fonts`

현재 인증 session의 사용자별 폰트 목록과 용량 제한 정보를 반환한다. owner는 owner scope, 일반 사용자는 `data/user-data/<userId>` scope를 사용한다.

### `POST /api/fonts/upload`

현재 인증 session의 사용자별 font scope에 raw font file을 업로드한다. 일반 reader도 자신의 계정 범위에서 업로드할 수 있다.

헤더:

- `X-Font-Filename`
- `X-Font-Family`

제약:

- 허용 확장자: `.ttf`, `.otf`, `.woff`, `.woff2`
- signature 검사 필요
- 단일 파일/전체 용량/파일 수 제한 적용

### `DELETE /api/fonts/:filename`

현재 인증 session의 사용자별 font scope 안의 폰트를 삭제한다. 다른 사용자의 폰트는 삭제하지 않는다.

### `GET /api/fonts/file/:filename`

인증된 사용자에게 자신의 font scope 안의 폰트 파일을 inline 응답한다.

## Block Manifest

### `GET /api/novels/:novelId/block-manifest`

단일 파일 소설의 chunk별 block manifest를 반환한다.

쿼리 전처리 옵션은 본문 API와 동일하다.

### `GET /api/novels/:novelId/episodes/:episodeId/block-manifest`

폴더형 소설의 특정 에피소드에 대한 chunk별 block manifest를 반환한다.

응답 핵심 필드:

```json
{
  "version": 1,
  "novelId": "...",
  "episodeId": "...",
  "preprocessSignature": "rn1-cs1-cb1-sd1-db0-po0-ag0",
  "contentHash": "...",
  "chunkBase": 1,
  "blockBase": 0,
  "totalChunks": 12,
  "totalBlocks": 5421,
  "totalChars": 580320,
  "chunks": [
    {
      "chunk": 1,
      "blockStart": 0,
      "blockCount": 83,
      "charStart": 0,
      "charEnd": 48210
    }
  ]
}
```

chunk 번호는 기존 현재 구현의 본문 API와 같은 1-base다. block index는 프론트의 global block 좌표계와 같은 0-base다. `totalChars`는 v20에서 추가한 선택 필드이며, 검색 결과 위치 비율을 문자 좌표 기준으로 보정하는 데 사용한다.

## 다음 API 추가 후보

v21에서 서버 `app.js`에 남아 있던 상태 normalization/helper는 `server/services/state-normalizer.js`로 이전되었다. v22에서는 상태 write/read envelope 흐름이 `server/services/state-write-service.js`로 이전되었다. v23에서는 동기화 충돌 판단과 기기 우선순위 요약을 `server/services/sync-policy-service.js`로 분리했다. API 경로는 변경하지 않았고, 기존 응답 필드는 유지했다. v23의 `syncPolicySummary`는 선택 필드다.

## v24 프론트 기기 관리 UI 사용 필드

v24는 API 경로를 추가하지 않고 v23에서 추가된 선택 필드 `syncPolicySummary`를 프론트에서 사용한다.

사용 API:

```text
GET /api/user-state
PUT /api/user-state/shared
PUT /api/user-state/device
PUT /api/user-state/progress
```

프론트가 사용하는 `syncPolicySummary` 핵심 필드:

```json
{
  "currentDeviceId": "dev_current",
  "preferredDeviceId": "dev_preferred",
  "effectiveDeviceId": "dev_preferred",
  "devices": [
    {
      "id": "dev_current",
      "name": "Windows",
      "lastSeenAt": 1710000000000,
      "syncVersion": 12,
      "isCurrent": true,
      "isPreferred": false
    }
  ],
  "share": {
    "otherDeviceAlert": true,
    "otherDeviceConnectToast": true
  },
  "progressAuthority": {
    "shouldOfferRemoteResume": true,
    "sourceDeviceId": "dev_other",
    "sourceDeviceName": "Android",
    "sourceSavedAt": 1710000000000,
    "lastRead": {
      "novelId": "...",
      "episodeId": null,
      "chunk": 1,
      "totalChunks": 10,
      "globalBlockIndex": 120,
      "documentRatio": 0.42
    }
  }
}
```

`syncPolicySummary`는 계속 선택 필드다. 이 필드가 없더라도 기존 API 소비자는 영향을 받지 않는다.

## v25 API 계약 변경 여부

v25는 유지보수/최적화 단계이며 API 경로와 응답 형식을 변경하지 않는다.

변경된 내부 동작:

- block manifest 응답은 동일하지만 서버 내부에서 bounded LRU cache를 사용한다.
- `GET /api/user-state`, `PUT /api/user-state/device` 계약은 v24와 동일하다.
- 프론트의 prefetch, 가상화 렌더, periodic device sync 수명 관리만 보강했다.

## v26 API 계약 변경 여부

v26은 유지보수/버그 수정 단계이며 API 경로는 추가하거나 변경하지 않는다.

선택 필드 보강:

```json
{
  "syncPolicySummary": {
    "progressAuthority": {
      "lastRead": {
        "globalBlockIndex": 120,
        "blockIndex": 3,
        "charIndex": 42,
        "documentRatio": 0.42,
        "sourceDeviceId": "dev_other",
        "sourceDeviceName": "Android",
        "sourceSavedAt": 1710000000000
      }
    }
  }
}
```

기존 필드는 제거하지 않았다. `blockIndex`, `charIndex`, `sourceDeviceId`, `sourceDeviceName`, `sourceSavedAt`는 선택 필드다.

## v27 API 계약 변경 여부

v27은 유지보수/프론트 런타임 최적화 단계이며 API 경로와 응답 형식은 추가하거나 변경하지 않는다.

내부 변경만 있다.

```text
라이브러리 목록 이벤트 위임
검색 결과 windowing 렌더링
reader/jump panel listener cleanup
manifest pending request identity guard
virtual row index map
```

기존 chunk API, block manifest API, user-state API 계약은 v26과 동일하다.

## v28 API 계약 변경 여부

v28은 유지보수 및 smoke test 보강 단계이며 API 경로와 응답 형식은 추가하거나 변경하지 않는다.

추가된 것은 테스트 스크립트뿐이다.

```text
npm run smoke:server
```

이 smoke test는 기존 API 계약을 실제 HTTP 경로로 확인한다.

검증 대상:

```text
POST /api/login
GET  /api/csrf
GET  /api/time
GET  /api/user-state
PUT  /api/user-state/device
GET  /api/novels
GET  /api/novels/:novelId/content
GET  /api/novels/:novelId/block-manifest
```

## v29 API 계약 변경 여부

v29는 유지보수 및 smoke test 확대 단계이며 API 경로와 응답 형식은 추가하거나 변경하지 않는다.

확대된 smoke test 대상:

```text
POST /api/login
GET  /api/csrf
GET  /api/time
GET  /api/user-state
PUT  /api/user-state/device
GET  /api/novels
GET  /api/novels/:novelId/content
GET  /api/novels/:novelId/block-manifest
GET  /api/novels/:novelId/episodes/:episodeId
GET  /api/novels/:novelId/episodes/:episodeId/block-manifest
GET  /api/recovery-status
GET  /api/fonts
POST /api/fonts/upload
GET  /api/fonts/file/:filename
DELETE /api/fonts/:filename
```

기존 API 소비자 관점의 계약 변화는 없다.

## v30 API 계약 변경 여부

v30은 Node 런타임 호환성 유지보수 단계이며 API 경로와 응답 형식을 변경하지 않는다.

변경 대상은 smoke test 스크립트와 서버 내부 CJS 문법 호환성이다.

기존 v29 smoke test 대상 API는 그대로 유지된다.

## v31 API 계약 변경 여부

v31은 device state 저장 경로의 내부 helper 누락을 수정한 유지보수 단계이며 API 경로와 응답 형식을 변경하지 않는다.

수정 대상은 내부 stale 판단 helper이다.

```text
PUT /api/user-state/device
```

기존 요청/응답 계약과 stale reason은 유지된다.

## v32 Smoke Test Coverage

`tools/smoke_server_http.js`는 실제 Express 서버를 임시 포트로 띄운 뒤 핵심 API를 검증한다.

검증 범위:

```text
POST   /api/login
GET    /api/csrf
GET    /api/time
GET    /api/user-state
PUT    /api/user-state/device
GET    /api/novels
GET    /api/novels/:novelId/content
GET    /api/novels/:novelId/block-manifest
GET    /api/novels/:novelId/episodes/:episodeId
GET    /api/novels/:novelId/episodes/:episodeId/block-manifest
GET    /api/recovery-status
GET    /api/fonts
POST   /api/fonts/upload
GET    /api/fonts/file/:filename
DELETE /api/fonts/:filename
PATCH  /api/novels/:novelId/move
PATCH  /api/novels/:novelId/episodes/:episodeId/rename
DELETE /api/novels/:novelId/episodes/:episodeId
PATCH  /api/episodes/:novelId/:episodeId/move
PATCH  /api/folders/rename
PATCH  /api/folders/move
DELETE /api/folders
```

fileops 검증은 `test_novels/__smoke_fileops_*` 임시 fixture만 대상으로 수행한다.

## v33 API 계약 변경 여부

v33은 프론트 검색/동기화 UI 유지보수 단계이며 API 경로와 응답 형식을 변경하지 않는다.

변경 대상은 다음 사용자 인터페이스 동작이다.

```text
검색 모달 표시/닫기 레이어 처리
검색 결과 windowing 키보드 이동
원격 위치 dock 버튼 handler cleanup
```

기존 v32 smoke test 대상 API는 그대로 유지된다.


## v34 API 계약 변경 여부

v34는 API 경로를 추가하거나 변경하지 않는다.

다만 상태 저장 payload의 선택 preference 필드로 다음 값을 보존한다.

```text
shared.viewerPrefs.customCssShared
device.prefs.customCssDevice
```

두 필드는 사용자 CSS 편집기 이관을 위한 값이다. 기존 클라이언트는 이 필드를 무시해도 정상 동작한다.

v34 smoke test는 `PUT /api/user-state/shared`, `PUT /api/user-state/device`에서 이 필드들이 보존되는지 확인한다.

## v35 API 계약 변경 여부

v35는 API 경로를 추가하거나 변경하지 않는다.

기존 상태 API의 선택 preference 보존 범위만 확대한다.

```text
GET  /api/user-state
PUT  /api/user-state/shared
PUT  /api/user-state/device
PUT  /api/user-state/progress
```

`shared.viewerPrefs`에 아래 선택 필드가 포함될 수 있다.

```json
{
  "shortcuts": {
    "searchOpen": "Ctrl+F",
    "readerNext": "ArrowRight"
  },
  "serverCommNotify": true,
  "serverCommNotifyInterval": 9,
  "safeRemainingShow": true,
  "safeClockPos": "left",
  "safeProgressPos": "right",
  "safeNetworkPos": "auto"
}
```

기존 클라이언트는 이 필드를 무시해도 정상 동작한다. v35 smoke test는 단축키와 서버 통신 알림 preference가 서버 정규화 이후에도 보존되는지 확인한다.

## v36 optional viewerPrefs fields

`PUT /api/user-state/shared`의 `viewerPrefs`는 v36부터 전처리 프리셋 관련 선택 필드를 보존한다.

```json
{
  "viewerPrefs": {
    "preprocess": {
      "removeNoise": false,
      "chapterSpacing": true,
      "collapseBreaks": false,
      "splitDense": false,
      "dialogueBreak": false,
      "paragraphOptimize": false,
      "aggressive": false
    },
    "preprocessPresetId": "preset-basic",
    "preprocessPresetApplyKeys": {
      "removeNoise": true,
      "chapterSpacing": true,
      "collapseBreaks": true,
      "splitDense": true,
      "dialogueBreak": true,
      "paragraphOptimize": true,
      "aggressive": true
    },
    "preprocessPresets": []
  }
}
```

응답 형식과 API 경로는 기존과 동일하다.

## v37 optional theme viewerPrefs fields

v37부터 `PUT /api/user-state/shared`의 `viewerPrefs`는 테마 편집기 사용자 테마 관련 선택 필드를 보존한다.

```json
{
  "viewerPrefs": {
    "themeColors": {
      "bg": "#101820",
      "surface": "#18222c",
      "text": "#f0f0e8",
      "accent": "#8aa6a3",
      "readerBg": "#0f151a",
      "readerText": "#e7e2d8"
    },
    "themePresetId": "smoke-theme",
    "themeCustomThemes": [
      {
        "id": "smoke-theme",
        "name": "Smoke Theme",
        "colors": {},
        "updatedAt": 0
      }
    ]
  }
}
```

`themeCustomThemes`는 최대 24개로 제한된다. API 경로와 기존 응답 형식은 변경하지 않는다.

## v38 optional font viewerPrefs/device prefs fields

v38부터 글꼴 적용 설정은 기존 `fontFamily` 호환 필드를 유지하면서 shared/device 계층을 명시적으로 분리한다.

Shared viewer preference 선택 필드:

```json
{
  "viewerPrefs": {
    "fontFamily": "var(--font-nanum-g)",
    "fontFamilyShared": "var(--font-nanum-g)"
  }
}
```

Device preference 선택 필드:

```json
{
  "deviceId": "example-device-01",
  "prefs": {
    "fontFamilyDevice": "var(--font-coding)"
  }
}
```

프론트 적용 우선순위는 `fontFamilyDevice` → `fontFamilyShared/fontFamily` → 기본 글꼴이다. API 경로와 기존 응답 envelope는 변경하지 않는다.

## v39 additive contract — Recovery policies

`GET /api/recovery-status` keeps all existing fields and adds `recoveryPolicies`.

```json
{
  "recoveryPolicies": {
    "scopedImport": true,
    "importPreview": true,
    "destructiveClientActionsRequireConfirm": true,
    "sharedDeviceRestoreDefault": false,
    "serverStateRestoreRequiresExplicitScope": true,
    "cacheClearScope": "client-indexeddb-only",
    "backupSnapshotBeforeServerWrite": true
  }
}
```

This is additive and does not change existing recovery status consumers.


## v40 client behavior note — Offline/prefetch status

No server API route or response envelope is changed in v40. The client continues to fetch reader content by chunk and cache chunk payloads in IndexedDB. The new offline/prefetch status layer observes existing client-side state only:

- current reader chunk and total chunks
- IndexedDB reader cache coverage around the current chunk
- prefetch queue pending/running/result counters
- browser online/offline and Network Information API hints when available

Existing consumers of `/api/novels`, `/api/content`, block manifest, `/api/user-state*`, and `/api/recovery-status` remain compatible.

## v41 optional viewerPrefs fields

v41 does not add or change API routes. It only expands the optional `shared.viewerPrefs` preservation set for browser fullscreen safe-area calibration.

```json
{
  "viewerPrefs": {
    "safeViewportAutoFit": true,
    "safeTopInsetExtra": 0,
    "safeBottomInsetExtra": 0
  }
}
```

These fields are additive and may be ignored by older clients. The frontend uses them to adjust CSS variables derived from `visualViewport` when browser fullscreen differs from PWA standalone layout.


## v42 safe-area follow-up

No route or response envelope changes. v42 reuses the v41 optional safe-area preference fields and widens the client-side accepted manual correction range:

- `safeTopInsetExtra`: -12 to 96
- `safeBottomInsetExtra`: -12 to 120

These fields remain optional under `shared.viewerPrefs`.

## v43 client behavior note — Read data management and manual safe-area tuning

No API route or response envelope changes are introduced in v43.

Safe-area preferences remain optional under `shared.viewerPrefs`, but the frontend now treats manual tuning as the default because browser fullscreen viewport reporting differs by browser.

```json
{
  "viewerPrefs": {
    "safeViewportAutoFit": false,
    "safeTopInsetExtra": 0,
    "safeBottomInsetExtra": 0
  }
}
```

Client-side accepted ranges:

- `safeTopInsetExtra`: -12 to 140
- `safeBottomInsetExtra`: -12 to 180

The existing shared read-data fields are also exercised by the smoke test:

```json
{
  "progress": { "lastRead": {}, "byNovel": {}, "positions": {}, "readMeta": {} },
  "bookmarks": [],
  "recents": [],
  "favorites": []
}
```

These fields already belonged to the `/api/user-state/shared` contract; v43 only improves the frontend management UI and validation coverage.

## v44 additive sync policy summary fields

`GET /api/user-state`, `PUT /api/user-state/shared`, `PUT /api/user-state/device`, and `PUT /api/user-state/progress` may include the following additive fields under `syncPolicySummary.progressAuthority`:

```json
{
  "isPreferredAuthoritative": true,
  "blockedByPreferredDevice": false
}
```

`shouldOfferRemoteResume` now respects preferred-device authority. If a preferred device is selected and the latest shared `lastRead` is from a non-preferred device, `blockedByPreferredDevice` is `true` and `shouldOfferRemoteResume` is `false`.

## v45 additive file operation routes

v45 adds two mutation routes for frontend library operation parity:

```text
PATCH  /api/novels/:novelId/rename
DELETE /api/novels/:novelId
```

`PATCH /api/novels/:novelId/rename` body:

```json
{
  "title": "New title"
}
```

Successful response:

```json
{
  "success": true,
  "type": "novel",
  "novelId": "...",
  "oldTitle": "Old title",
  "newTitle": "New title"
}
```

`DELETE /api/novels/:novelId` successful response:

```json
{
  "success": true,
  "type": "novel",
  "novelId": "...",
  "deleted": "Title"
}
```

For a single-file novel, rename/delete affects the `.txt` file. For a multi-file novel, rename/delete affects the episode folder. Both routes require the same authenticated session, same-origin check, and CSRF token as existing file operation routes.

## v46 search UX compatibility note

v46 does not add or remove server routes. Search still uses the existing content endpoints:

```text
GET /api/novels/:novelId/content?chunk=N
GET /api/novels/:novelId/episodes/:episodeId?chunk=N
```

The added search remocon state is client-local UI state only. The draggable remocon position is stored in browser localStorage as `txt-reader.rebuild.searchRemotePosition`; it is not synchronized through `/api/user-state`.

## v47 Library drag-and-drop note

v47은 라이브러리 드래그 앤 드롭 이동 UX를 프론트에 추가했지만 새 API를 추가하지 않는다. 기존 fileops move API를 그대로 사용한다.

- `PATCH /api/novels/:novelId/move`
- `PATCH /api/episodes/:novelId/:episodeId/move`
- `PATCH /api/folders/move`

DnD는 클라이언트 UI 상태이며 서버 저장 schema를 변경하지 않는다.

## v48 Library DnD conflict handling note

v48 adds no API route and no state schema field.

The frontend continues to call the existing move routes:

```text
PATCH /api/novels/:novelId/move
PATCH /api/episodes/:novelId/:episodeId/move
PATCH /api/folders/move
```

The client now performs the same class of validation before action-sheet moves and drag-and-drop moves. The server remains the final guard for invalid paths. `tools/smoke_server_http.js` now verifies that moving a folder into one of its descendants is rejected.

## v49 Safe-area viewport profile preferences

`PUT /api/user-state/shared`의 `viewerPrefs`에는 다음 선택 필드가 추가 보존된다. 기존 API route와 envelope는 변경하지 않는다.

```json
{
  "safeViewportProfileId": "safe-profile-id",
  "safeViewportProfiles": [
    {
      "id": "safe-profile-id",
      "name": "Chrome 전체화면",
      "contextKey": "Chrome|browser-fullscreen|mobile",
      "contextLabel": "브라우저 전체화면 · Chrome",
      "uaKey": "Chrome",
      "displayMode": "browser-fullscreen",
      "isBrowserFullscreen": true,
      "isStandalone": false,
      "safeViewportAutoFit": false,
      "safeTopInsetExtra": 48,
      "safeBottomInsetExtra": 56,
      "updatedAt": 0
    }
  ]
}
```

`safeViewportProfiles`는 최대 16개까지 보존한다.

## v50 API note

v50 does not add or change server API routes. Safe-area sampling fields are runtime-only client diagnostics and are not persisted through `/api/user-state`.

## v51 Search/offline UI note

v51 does not add or change server API routes. The search UI still reads text through the existing content endpoints:

```text
GET /api/novels/:novelId/content?chunk=N
GET /api/novels/:novelId/episodes/:episodeId?chunk=N
```

Search source statistics are client runtime state only. They are not persisted through `/api/user-state`.

`tools/smoke_server_http.js` includes static assertions for the cache-aware search implementation and reports `searchOfflineCache: true` when the full server smoke test can run.

## v52 Search retry/offline coverage note

v52 adds no server API route and no persisted state field.

Search retry continues to use the existing content APIs for specific chunk numbers:

```text
GET /api/novels/:novelId/content?chunk=N
GET /api/novels/:novelId/episodes/:episodeId?chunk=N
```

The frontend records failed and offline-skipped chunk lists as runtime search state only. The new offline searchable range preview checks loaded chunks, in-memory search text cache, and IndexedDB reader cache before deciding how much of the current text is searchable offline.

`tools/smoke_server_http.js` includes static assertions for the retry/coverage-preview implementation and reports `searchRetryChunks: true` when the full server smoke test can run.

## v53 Mobile library UX note

v53 does not add or change server API routes. It changes frontend library rendering only.

- Existing library API and fileops API contracts remain unchanged.
- The novel list card meta is now a UI summary and no longer displays raw file name or file path by default.
- Smoke output adds static verification flags: `mobileLibraryDrawer` and `libraryMetaSummary`.

## v54 Safe-area UI/Cache Notes

No API route changed in v54.

Client-only changes:

- `app-shell.html` is requested with `?v=rebuild-v56` and `cache: no-cache`.
- Mobile and desktop pages reference `styles/app.css?v=rebuild-v56` and matching ESM entry versions.
- The Safe-area correction shortcut is UI-only and reuses existing `shared.viewerPrefs.safeViewport*` fields.

## v55 Safe-area template state

No route or envelope changes were introduced in v55. Safe-area recommendation templates write to the existing `shared.viewerPrefs.safeViewportProfiles` and `shared.viewerPrefs.safeViewportProfileId` fields.

The client cache-buster version is `rebuild-v56`.

## v56 Safe-area UI note

v56 changes only the client settings layout. No API route, response envelope, or persisted state schema changed. Existing `shared.viewerPrefs.safeViewport*` fields continue to store the Safe-area correction values and user profiles.

The client cache-buster version is `rebuild-v56`.

## Rebuild v57 client-only search diagnostics

v57 does not add or change server routes. It adds client-side search result filters and Recovery Center search diagnostics.

Relevant existing endpoints remain unchanged:

```text
GET /api/novels/:novelId/content?chunk=N
GET /api/novels/:novelId/episodes/:episodeId?chunk=N
GET /api/user-state
PUT /api/user-state/shared
PUT /api/user-state/device
```

The client cache-buster version is `rebuild-v57`.

## v58 read-data import preview

No server API changed in v58. Read-data import preview is a client-side workflow over the existing read-data state buckets:

```text
progress
bookmarks
recents
favorites
```

The client creates a local rollback snapshot before applying imported data:

```text
txt-reader.rebuild.readDataRollbackSnapshot
```

The client cache-buster version is `rebuild-v59`.

## v59 additive preference

No API route changed. The following optional shared viewer preference may be preserved by `/api/user-state`:

```json
{
  "shared": {
    "viewerPrefs": {
      "libraryDndHoverOpenDelay": 650
    }
  }
}
```

Valid UI range is 250ms to 1500ms. Older clients may ignore the field.

Current v612 clients no longer expose or persist this legacy preference. Folder hover-open uses a fixed 650ms runtime constant; the server drops the legacy field during viewer preference normalization.


## v60 Search/offline migration follow-up

- Client cache-busters were updated to `rebuild-v61`.
- Full-text search now supports `캐시된 범위만 검색`, which scans only loaded, memory-cached, and IndexedDB reader-cached chunks without network fetches.
- The search retry bar now exposes chunk-level retry buttons for failed/offline-missing chunks while keeping bulk retry.
- Recovery Center search diagnostics can open search directly in cache-only full-text mode and reports cache-only excluded chunk counts.
- No server route or API envelope changed.

## v61 migration note

- Recovery Center search/offline diagnostics now links search coverage to offline cache actions.
- Added selected chunk offline preparation through `prepareOfflineChunks(app, chunks, options)`.
- Existing offline preparation delegates to the selected-chunk helper using the current nearby range.
- Fixed search coverage summary rendering to pass `app` explicitly into `describeCoveragePreview()`.
- Client cache-busters were updated to `rebuild-v61`.

## v62 read-data import UI note

No server API route changed in v62. Read-data import conflict details and rollback restore are client-side UI/state features. Rollback remains local-only under `txt-reader.rebuild.readDataRollbackSnapshot`, and the existing read-data buckets remain `progress`, `bookmarks`, `recents`, and `favorites`.


## v427 font API scope

<!-- v427-account-font-scope-ui-pass -->

- `GET /api/fonts`는 현재 로그인 세션의 글꼴 scope만 반환한다. 일반 사용자는 자기 `data/user-data/<userId>/font-library.json` 기준 목록만 본다.
- `POST /api/fonts/upload`는 owner-only가 아니라 로그인한 owner/user scope에 저장한다. 일반 사용자는 자기 계정 글꼴만 업로드한다.
- `DELETE /api/fonts/:filename`은 현재 세션 scope 안의 파일만 삭제한다.
- `GET /api/fonts/file/:filename`은 현재 세션 scope 안의 파일만 다운로드한다.

## v566 shelf endpoints

- `GET /api/novels/shelf?scope=all|favorites|recent&sort=title|recent&q=&cursor=&limit=48` returns authenticated, ACL-filtered work summaries. The payload does not contain `episodes`.
- `GET /api/novels/:novelId/meta` returns one ACL-filtered work summary.
- `GET /api/novels/:novelId/episodes` returns only episode IDs, titles, and file names after novel-level ACL validation.
- Shelf responses use private revalidation with ETag and vary by authenticated access scope, library signature, query, and user shelf state.

## v588 metadata access contract

- Access snapshot exposes `appPermissions.metadataAccess` and `metadataAccessAllowed`.
- `/metadata.html` and metadata provider/novel APIs return 403 for normal users without the explicit grant.
- Mutation routes additionally require owner or full-library access.
- Cover assets retain the existing library ACL and are not gated by workspace permission.

## v590 메타데이터 문서 접근 오류 계약

`GET /metadata.html`은 인증 후에도 owner 또는 `appPermissions.metadataAccess === true`인 사용자만 허용한다. 권한이 없으면 HTML이나 일반 문자열을 반환하지 않고 다음 JSON 오류를 반환한다.

```json
{
  "ok": false,
  "error": "metadata_access_required",
  "message": "메타데이터 화면 접근 권한이 없습니다. owner에게 메타데이터 접근 권한을 요청하세요."
}
```

상태 코드는 `403`, 캐시 정책은 `no-store`다. 공급자·작품 메타데이터 API도 같은 `metadata_access_required` 오류 코드를 유지한다.

<!-- v590-metadata-document-access-contract-pass -->

## v593 metadata profile·logout 계약

- owner 전용 browser profile API는 5개 builtin provider를 지원한다. provider descriptor가 지원하지 않는 host/path로 이동하거나 수집 결과가 외부로 redirect되면 거부한다.
- 일반 사용자 metadata 권한은 `/api/user-access/snapshot`의 `metadataAccessAllowed`와 서버 route middleware가 일치해야 한다. UI hidden 상태만으로 권한을 대체하지 않는다.
- `/api/logout` 성공 후 서재와 metadata page는 `/login.html`로 이동한다. 서재는 reader progress와 device sync를 먼저 시도한다.

<!-- v593-api-metadata-logout-pass -->

<!-- v662-api-contract-pass -->
