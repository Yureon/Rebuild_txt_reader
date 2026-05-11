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

읽기 진행도만 빠르게 저장한다.

### `PUT /api/user-state/device`

기기별 상태를 저장한다.

### `GET /api/sync`

구형 호환 동기화 조회 엔드포인트다.

### `POST /api/sync`

구형 호환 동기화 저장 엔드포인트다.

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
