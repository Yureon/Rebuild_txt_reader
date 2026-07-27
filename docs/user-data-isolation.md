# 사용자 데이터 격리 — v682 current

PowerShell 5.1 호환 변경은 사용자 ACL이나 서버 저장 경계를 변경하지 않는다. 스크립트 plan은 기존 Owner 권한 경로에서만 생성되며 선택된 library root와 destination root 밖으로 나가는 경로를 계속 거부한다.

<!-- v682-user-data-pass -->

# 사용자 데이터 격리 — v681 current

수동 입력 출처 필터는 인증된 사용자의 library ACL로 제한된 shelf 결과에만 적용된다. 다른 사용자의 applied metadata나 작품 목록을 추가로 노출하지 않는다.

<!-- v681-user-data-pass -->

# 사용자 데이터 격리 — v680 current

테마 첫 화면은 active user scope와 사용자별 prefs key를 사용한다. 로그인 시 새 session의 user ID로 scope를 교체하고 해당 사용자 theme만 merge한다. Metadata 페이지도 session 응답에서 scope를 확정한 뒤 state를 생성한다. Owner는 별도 `owner` scope와 고정 palette를 사용한다. progress, bookmark, recent, favorite, font, ACL과 `accessVersion` 경계는 변경하지 않는다.

<!-- v680-user-data-pass -->

# 사용자 데이터 격리 — v679 current

v679은 사용자별 progress/font/browser storage scope, library ACL과 `accessVersion` 계약을 변경하지 않는다. Metadata folder query UI와 extension popup 변경은 사용자 데이터 저장 형식에 영향을 주지 않는다.

<!-- v679-user-data-pass -->

# 사용자 데이터 격리 — v676 current

기준 버전: `rebuild-v676`

# v674 현재 사용자 데이터 격리

기준 버전은 package `6.74.0`, runtime `rebuild-v674`이다.

- Reader progress localStorage/IndexedDB key와 bounded snapshot은 user ID와 `accessVersion` scope를 유지한다.
- hydration·로그아웃·사용자 전환에서 다른 scope의 resident map을 재사용하지 않는다.
- 서버 device retention은 current/preferred device를 보존하고 `deviceProfiles`, 두 sync metadata map, policy device 목록을 같은 bounded key set으로 정리한다.
- bookmark, recent, favorite, tag, font 및 Reader locator의 기존 사용자 경계와 공개 형식은 바꾸지 않는다.

<!-- v674-user-data-current-pass -->

## 과거 릴리스 기록

# 사용자 데이터 격리 — v666 확인

비인증 autofill guard는 현재 문서의 입력 요소만 조정하며 로그인 ID·비밀번호·검색어를 공유 storage나 다른 사용자 scope에 복사하지 않는다.

<!-- v666-user-data-isolation-pass -->

# 사용자 데이터 격리 — v665 확인

수동 표지와 applied metadata는 기존 library/metadata 권한 경계를 유지하며 진행도·북마크·최근·즐겨찾기·설정·글꼴의 사용자 scope를 변경하지 않는다.

<!-- v665-user-data-isolation-pass -->

# v664 사용자 데이터 격리

이어보기 제목과 위치는 현재 로그인 사용자의 catalog·progress snapshot 범위에서만 계산한다. 다른 사용자 state를 조회하거나 공유하지 않는다.

<!-- v664-user-data-isolation-pass -->

기준 버전: rebuild-v664

기준 버전: rebuild-v663

사용자 글꼴 URL은 현재 session의 `/api/fonts/file/` scope에서만 로드하며 다른 사용자 font 경로를 재사용하지 않는다.

<!-- v663-user-data-isolation-pass -->

기준 버전: rebuild-v663

# v661 사용자 범위 비영향

파일 작업·metadata queue·정리 후보 cache·로그인 telemetry 변경은 사용자 state, 진행도, 북마크, 설정, 글꼴, 브라우저 저장소의 기존 사용자별 경계를 변경하지 않는다. 로그인 telemetry sidecar는 계정 ID별 마지막 로그인 시각만 보관하며 독서 데이터는 포함하지 않는다.

<!-- v661-user-data-isolation-pass -->

기준 버전: rebuild-v660

# v660 사용자 데이터 격리 감사

- 개인 state·snapshot·설정·진행도·북마크·최근·즐겨찾기·태그는 `data/user-data/<userId>` state bundle로 분리한다.
- 사용자 글꼴은 user-data 하위 경로, browser localStorage/IndexedDB/cache는 userId 또는 userId+accessVersion으로 분리한다.
- 라이브러리와 metadata는 공유/권한 기반 예외 영역이다.
- accounts/session/signup-code/audit/site-language/server cache는 시스템 운영 전역 저장소이며 개인 독서 state가 아니다.
- 관련 실행형 회귀에서 교차 사용자 개인 데이터 경로는 발견되지 않았다.

<!-- v660-user-data-isolation-pass -->

기준 버전: rebuild-v659

기준 버전: rebuild-v655

# v655 사용자 데이터 격리

Windows 폴더 접기와 설정 UI 상태는 현재 브라우저의 사용자 범위 로컬 상태에만 저장된다. 최근·즐겨찾기와 관리자 정리 후보 계약은 기존 사용자 격리 경계를 유지한다.

<!-- v655-user-data-isolation-pass -->

기준 버전: rebuild-v654

# v654 사용자 데이터 격리

최근·즐겨찾기 범위 제거는 현재 로그인 사용자의 `recents`와 `favorites`만 갱신한다. 대표 작품의 progress alias를 함께 정리하되 다른 사용자의 진행도·북마크·설정 및 공용 catalog에는 영향을 주지 않는다.

<!-- v654-user-data-isolation-pass -->

기준 버전: rebuild-v654

기준 버전: rebuild-v650

기준 버전: rebuild-v649
기준 버전: `rebuild-v649`

# v648 사용자 데이터 격리

기준 버전: rebuild-v648

설정 진단과 Reader 검색 모달 수정은 사용자별 진행도·북마크·설정·글꼴·ACL 저장 위치를 변경하지 않는다.

<!-- v648-user-data-isolation-pass -->

# v646 사용자 데이터 격리

기준 버전: rebuild-v646

서재 안정화는 공용 작품 catalog의 읽기 경로만 변경하며 사용자별 진행도·북마크·설정·글꼴 저장 위치를 변경하지 않는다. 공유되는 것은 owner가 보유한 라이브러리 파일뿐이다.

<!-- v646-user-data-isolation-pass -->

# v645 사용자 데이터 격리

기준 버전: rebuild-v645

network/search badge와 modal UI 변경은 사용자별 진행도, 북마크, 설정, font, library ACL 저장 위치를 변경하지 않는다. 공유되는 것은 owner가 보유한 라이브러리 파일뿐이다.

<!-- v645-user-data-isolation-pass -->

# v638 사용자 데이터 격리

기준 버전: rebuild-v644


## v643 사용자·locale 격리

Owner 언어 선택은 `__owner__` local storage scope에 저장되어 일반 사용자 설정을 덮어쓰지 않는다. metadata locale 제한은 provider 노출과 수집 동작만 막으며 사용자별 진행도·북마크·태그·library ACL에는 영향을 주지 않는다. library organization endpoint는 Owner만 호출할 수 있고 사용자별 파일 접근 권한을 확장하지 않는다.

기준: `rebuild-v644`.

<!-- v643-user-data-isolation-pass -->


기준 버전: rebuild-v642


## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

metadata candidate group은 공유 작품 후보 저장소의 동등성 표현이며 사용자 권한을 우회하지 않는다. 조회·적용·삭제 route는 기존 library/metadata ACL과 CSRF/same-origin guard를 그대로 사용한다. 사용자별 진행도·북마크·설정 계약에는 변경이 없다.

<!-- /v638-current-summary -->


기준 버전: rebuild-v641

Service Worker와 표지 무결성 변경은 사용자별 진행도·북마크·설정·글꼴·메타데이터 권한 경계를 변경하지 않는다. 공유되는 것은 owner가 보유한 라이브러리 파일뿐이며 기존 user-scoped state/font 저장 계약을 유지한다.

<!-- v637-user-data-isolation-current-pass -->

# v636 탭·표지 상태 격리

기준 버전: rebuild-v636

Service Worker stale-client 상태는 browser client ID 단위로 처리한다. 표지 pending lease는 전역 cache asset 보호 정보이며 사용자 metadata 접근 권한을 부여하지 않는다. 표지 조회는 기존 사용자별 cover access scope 검사를 계속 사용한다.

<!-- v636-isolation-pass -->

# v635 사용자 데이터 격리 기준

기준 버전: rebuild-v635

기준 버전: `rebuild-v635`. 표지 asset lease는 process 내부의 임시 prune 보호 정보이며 사용자 메타데이터 권한을 확장하지 않는다. 표지 조회와 수동 적용은 기존 novel/library ACL을 그대로 사용한다.

<!-- v635-user-data-isolation-pass -->

# v627 업데이트 권한 격리

기준 버전: rebuild-v634

기준 버전: `rebuild-v634`

- update authorization은 현재 session의 사용자 snapshot을 사용한다.
- 일반 사용자는 usable library scope와 metadata permission을 모두 만족해야 한다.
- 다른 사용자의 browser state나 UI 표시만으로 update 권한을 승격하지 않는다.

<!-- v627-system-update-dual-permission-pass -->

# v614 브라우저 사용자 데이터 격리

기준 버전: `rebuild-v626`

<!-- v614-client-user-scope-isolation-pass -->

- `localStorage` 사용자 상태 키는 `txt-reader.rebuild.scope.<userId>.*` namespace를 사용한다.
- 전체 진행도 IndexedDB record key는 `current::<userId>`로 분리한다.
- reader chunk와 search manifest cache record는 `userId` 및 `accessVersion`을 포함한다.
- 로그인 사용자 확정 전에 이전 계정 상태를 hydrate하지 않는다.
- 제한 계정은 첫 진입과 직접 리더 URL 진입에서도 `includeNovelIds` 상세 snapshot을 확인하고 허용되지 않은 로컬 진행도·cache를 제거한다.
- 사용자 소유자가 없는 v612 이전 browser cache는 자동 이관하지 않고 제거한다.
- 로그아웃 후 열린 IndexedDB handle과 메모리 상태를 폐기하고 `anonymous` scope로 전환한다.

기준 버전: rebuild-v626

# v606 사용자 격리 보강

폴더 제한 계정의 cover access scope는 정규화된 folder 권한과 library generation을 cache key로 사용한다. 동일한 권한 scope만 공유하며 owner/all-library 경로와 제한 경로를 혼합하지 않는다. 기준 marker는 `rebuild-v626`이다.

## v604 사용자 상태·작업 격리

- 사용자별 상태 bundle과 snapshot queue는 user ID별로 분리되고 bounded bundle cache를 사용한다.
- 관리자 사용자 삭제 중 account persistence가 실패하면 삭제 전 snapshot으로 해당 사용자의 개인 상태만 복원한다.
- font·site language mutation queue도 owner/user scope별로 분리한다.
- 다른 사용자 revision이나 실패한 admin mutation이 현재 사용자의 shared/progress/device 상태를 변경하지 않는다.

기준 버전: `rebuild-v605`

## v601 태그 격리·이관

사용자 태그 정의·작품별 적용·facet cache는 로그인 사용자 ID와 접근 권한 signature에 귀속된다. 내보내기·가져오기·rollback도 현재 사용자의 shared state만 변경한다.

기준 버전: `rebuild-v605`

## v600 태그 데이터

`shared.userTags`와 `shared.novelUserTags`는 개인 서재 데이터다. export/import 및 사용자 상태 삭제 정책은 즐겨찾기·최근 항목과 동일하게 적용되며 계정 간 공유하지 않는다.


# 사용자별 개인 데이터 분리 정책

기준 버전: rebuild-v605

<!-- v427-user-data-isolation-doc-pass -->

## 목표

이 프로젝트의 멀티유저 기준은 단순하다.

- 공유되는 것은 owner가 보유한 라이브러리 파일뿐이다.
- 일반 사용자는 owner가 설정한 `libraryAccess` 범위 안에서만 라이브러리 파일을 읽는다.
- 라이브러리 파일을 제외한 개인 데이터는 사용자 계정별로 독립된다.

## 공유되는 데이터

| 항목 | 공유 방식 |
|---|---|
| 원본 라이브러리 파일 | owner 서버의 library root를 공유한다. |
| 라이브러리 접근 범위 | owner 콘솔의 사용자별 `libraryAccess` 정책으로 제한한다. |
| 폴더/파일 목록 | `/api/novels` 응답 단계에서 사용자 권한에 맞게 필터링한다. |
| 본문/content/search/block manifest | 요청한 파일이 사용자 접근 범위 안에 있을 때만 허용한다. |

## 사용자별로 분리되는 데이터

| 항목 | 저장/분리 기준 |
|---|---|
| 독서 위치/state | `data/user-data/<userId>/state.json` |
| 사용자 snapshot | `data/user-data/<userId>/snapshots` 계열 |
| 사용자 설정/shared prefs | 로그인 사용자 state 안에 저장한다. |
| 이 기기 override | 브라우저/기기 로컬 설정과 device sync 범위로 다룬다. |
| 사용자 글꼴 파일 | `data/user-data/<userId>/fonts` |
| 사용자 글꼴 metadata | `data/user-data/<userId>/font-library.json` |
| owner 글꼴 | `data/fonts`, `data/font-library.json` owner scope에만 남긴다. |

## 글꼴 분리 기준

<!-- v427-account-font-scope-ui-pass -->

사용자 글꼴은 `내 계정 전용 글꼴`이다.

- 일반 사용자는 자기 계정 scope로 글꼴을 업로드한다.
- 일반 사용자는 자기 계정 scope의 글꼴만 목록/다운로드/삭제할 수 있다.
- owner 글꼴과 일반 사용자 글꼴은 서로 보이지 않는다.
- 사용자 A와 사용자 B가 같은 family 이름을 업로드해도 각자의 scope 안에서만 중복 검사를 한다.
- 글꼴 선택 UI의 `내 계정 적용`은 현재 로그인 계정의 기본 글꼴 값을 변경한다.
- `이 기기 적용`은 현재 브라우저/기기의 override로만 사용한다.

## 금지되는 결합

- 일반 사용자 state를 owner 전역 state에 저장하지 않는다.
- 일반 사용자 글꼴을 `data/fonts` 전역 저장소에 저장하지 않는다.
- 다른 사용자의 글꼴 filename을 알고 있어도 다운로드/삭제할 수 없어야 한다.
- 라이브러리 권한 검사를 우회해 `/api/content`, `/api/search`, `/api/block-manifest`를 호출할 수 없어야 한다.

## v427 점검 항목

- `font-account-scope-ui-smoke.js`는 설정 UI 문구가 `내 계정 전용 글꼴`, `내 계정 적용`, `계정 적용됨`으로 표시되는지 확인한다.
- `personal-data-isolation-doc-smoke.js`는 공유/독립 데이터 경계를 문서와 server scope 구현 기준으로 확인한다.
- `multi-user-isolation-boundary-smoke.js`는 state 경로와 font scope 경로가 사용자별로 분리되는지 확인한다.

<!-- v662-user-data-isolation-pass -->
# v674 사용자 상태 보존 경계

브라우저 진행도 fallback의 bounded snapshot cache는 user scope와 `accessVersion`별로 분리한다. hydration 또는 사용자 전환 시 다른 scope의 resident map을 재사용하지 않으며, 로그아웃/초기화는 해당 cache를 비운다. 서버 device retention은 current/preferred device를 보존하면서 `deviceProfiles`, 두 sync metadata map과 policy device 목록을 같은 bounded set으로 정리한다.

Reader locator와 `fileChar`, bookmark, recent, favorite, tag, font, localStorage/IndexedDB key의 기존 사용자 경계는 변경하지 않는다.

<!-- v674-user-data-bounded-scope-pass -->
## Progress journal scope · v675

progress journal은 기존 per-user sync data path 아래에 생성되며 route novel ID와 normalized snapshot만 기록한다. user bundle/path resolution과 `accessVersion` 경계를 우회하지 않는다. 다른 사용자의 journal을 공유하거나 global path에 합치지 않는다.

<!-- v675-user-data-progress-scope-pass -->
## v676 사용자 상태 sidecar

Progress journal은 사용자별 sync-state path에만 생성되고 root 밖 symlink·비정규 sidecar를 거부한다. Metadata folder filter는 catalog 조회 범위일 뿐 사용자 ACL이나 library root를 확장하지 않는다.

<!-- v676-user-data-progress-scope-pass -->
