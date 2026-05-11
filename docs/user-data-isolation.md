# 사용자별 개인 데이터 분리 정책

기준 버전: rebuild-v553

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
