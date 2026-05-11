# Operations checklist

기준 버전: rebuild-v544

이 문서는 `txt_reader_multi` 계열을 실제 운영하기 전에 owner가 확인할 항목을 정리한다. 기능별 상세 설계는 `multi-user-access-control.md`, 배포 설정은 `deployment-guide.md`, 보안 정책은 `security.md`를 함께 본다.

## 1. 최초 배포 전

1. `.env.example`을 `.env`로 복사한다.
2. `LOGINID`와 `LOGINPW`를 owner 전용 계정으로 설정한다.
3. production 운영이면 `LOGINPW`를 공백 제거 기준 10글자 이상으로 설정한다.
4. `LIBRARY_PATH`가 실제 TXT 라이브러리 절대 경로를 가리키는지 확인한다.
5. `APP_ORIGIN`과 `URL`에는 브라우저 주소창에서 접속할 origin만 입력한다.
6. 내부망 HTTP이면 `NODE_ENV`를 비워두거나 development로 둔다.
7. 외부망 HTTPS이면 `NODE_ENV=production`과 `DEPLOYMENT_MODE=trusted-proxy` 또는 `cloudflare-tunnel`을 사용한다.
8. reverse proxy는 `X-Forwarded-Proto: https`를 전달해야 한다.
9. Cloudflare Tunnel 모드에서 `CF-Visitor`를 신뢰하려면 NPM 관리자 포트뿐 아니라 NPM `80/443`과 Node 앱 포트도 WAN에서 직접 접근 불가능해야 한다.
10. 공유기 포트포워딩, Proxmox/LXC 방화벽, Docker host 방화벽에서 `80/443/81/3000` 우회 경로가 없는지 확인한다.
11. `/healthz`가 200을 반환하는지 확인한다.

## 2. owner 로그인 확인

1. `/login.html`에서 `.env LOGINID / LOGINPW`로 로그인한다.
2. 로그인 후 `/admin/users.html`로 이동하는지 확인한다.
3. `운영 진단` 버튼을 눌러 다음을 확인한다.
   - `NODE_ENV`
   - `DEPLOYMENT_MODE`
   - request protocol
   - `x-forwarded-proto`
   - data dir writable
   - library path readable
4. production HTTP 오류가 표시되면 HTTPS 접속 또는 proxy header를 먼저 고친다.
5. Cloudflare Tunnel + NPM에서 `effective protocol: https`, `X-Forwarded-Proto: http`, `CF-Visitor: https · trusted` 조합은 허용된다. 단, WAN에서 NPM/Node 직접 접근 경로가 없어야 한다.

## 3. 가입코드 운영

1. owner 콘솔에서 가입코드를 발급한다.
2. 가입코드에는 권한 mode와 허용 폴더를 미리 설정한다.
3. 가입코드 원문은 발급 직후 한 번만 표시되므로 즉시 복사한다.
4. 기본은 1회용 코드로 운영한다.
5. 만료일과 사용 가능 횟수를 필요 이상 길게 잡지 않는다.
6. 가입 후 일반 user가 `/site.html`로 로그인되는지 확인한다.
7. `/api/novels` 목록이 코드에 설정된 권한대로 제한되는지 확인한다.
8. 사용이 끝난 코드는 폐기한다.

## 4. 사용자 권한 관리

1. 권한 mode를 `none`, `all`, `folders` 중 하나로 정한다.
2. `folders`는 지정 폴더와 모든 하위 폴더를 허용한다.
3. 저장 전 `권한 변경 영향 미리보기`를 실행한다.
4. 추가/회수될 작품 수와 샘플을 확인한다.
5. 저장 후 `목록 미리보기`로 실제 접근 가능 목록을 재확인한다.
6. 권한 회수 후 해당 사용자가 열람 중인 작품이 닫히고 목록으로 복귀하는지 확인한다.
7. `작가A`와 `작가A_다른폴더`가 segment prefix 기준으로 분리되는지 확인한다.
8. `folderMutationAccess.moveFolders/deleteFolders`는 `libraryAccess` 밖 폴더를 포함하지 않게 설정한다. 저장 단계에서 이 조건을 벗어나면 거부되어야 한다.
9. 이동 권한 없는 폴더의 action sheet 이동 버튼과 drag 기능이 숨겨지는지 확인한다.
10. 삭제 권한 없는 폴더의 삭제 버튼이 숨겨지는지 확인한다.
11. 일반 user의 폴더 이동 target이 `libraryAccess` 밖이면 UI와 서버에서 거부되는지 확인한다.
12. 일반 user의 폴더 삭제는 `DELETE:<categoryPath>` 확인값이 없으면 서버에서 거부되는지 확인한다.
13. 허용된 폴더 이동/삭제가 `library.folder.move` / `library.folder.delete` audit event로 기록되는지 확인한다.

## 5. 계정 / 세션 운영

1. 일반 user가 비밀번호를 분실하면 owner 콘솔에서 임시 비밀번호를 발급한다.
2. 비밀번호 초기화 후 대상 user의 기존 세션은 만료된다.
3. 사용자를 비활성화하면 기존 세션도 유효하지 않아야 한다.
4. 사용자를 다시 활성화해도 비활성화 이전 세션이 되살아나면 안 된다.
5. `세션 강제 만료`는 `REVOKE` 확인문구를 요구한다.
6. 삭제 작업은 `DELETE:<username>` 확인문구를 요구한다.
7. 삭제 시 독서 데이터는 `preserve` 또는 `reset` 정책을 명시한다.

## 6. 사용자 state / snapshot

1. `독서 데이터 내보내기`로 현재 user state를 다운로드할 수 있는지 확인한다.
2. `현재 상태 snapshot 생성`을 실행해 snapshot 목록에 표시되는지 확인한다.
3. reset/delete-reset/restore 전 자동 snapshot이 생성되는지 확인한다.
4. snapshot restore는 `RESTORE` 확인문구를 요구한다.
5. 자동 snapshot은 retention 정책에 따라 정리된다.
6. 운영 전 중요한 사용자 state는 별도 백업한다.

## 7. 감사 로그

1. owner 콘솔에서 `감사 로그` 버튼을 누른다.
2. 사용자 생성, 권한 변경, 비밀번호 초기화, 세션 만료, state reset/delete가 기록되는지 확인한다.
3. 민감 필드는 `[redacted]`로 표시되어야 한다.
4. 필요 시 JSONL export를 다운로드한다.
5. audit log는 tail 조회와 rotate 정책을 사용하므로 장기 운영에서는 외부 백업 정책을 별도로 둔다.

## 8. 검색 / 캐시

1. 일반 검색은 허용된 content endpoint 범위에서 동작한다.
2. `서버 요청 없이 검색`은 표시 중이거나 IndexedDB/cache에 있는 chunk만 검색한다.
3. cache-only 검색에서 누락 chunk 수가 표시되는지 확인한다.
4. 권한 회수 후 reader cache와 search manifest가 제거되는지 확인한다.
5. Web Worker 검색이 실패해도 main thread fallback이 동작해야 한다.

## 9. reader 회귀 확인

seam anchoring은 안정화된 기준이므로 기능 추가 후 아래만 회귀 확인한다.

- 다중파일 1→2 chunk append seam 부근 흔들림
- 70~85% / 80~100% 구간 anchor 안정성
- 빠른 스크롤 후 관성 감소 시 튐
- 검색 리모컨 이동
- 블럭 점프
- 화 선택 점프

## 10. 배포 ZIP 확인

최종 ZIP은 다음을 포함하지 않아야 한다.

- `node_modules`
- `data`
- `sync_data.json`
- `sync_data.json.bak`
- `test_novels`
- `.npm-cache`
- `package-lock.json`

## 11. v411 운영 진단 등급 / 복구 가이드

owner 콘솔 `운영 상태` 탭의 `운영 진단`은 각 항목을 `ok`, `warn`, `error`로 분류한다.

- `error`: 배포 전 반드시 수정한다. production HTTPS, owner 비밀번호 정책, writable data volume, readable library path가 여기에 해당한다.
- `warn`: 동작은 가능하지만 외부망 운영 전 확인한다. `APP_ORIGIN` 누락/불일치, proxy header 누락이 여기에 해당한다.
- `ok`: 현재 요청과 설정이 충돌하지 않는다.

각 finding에는 `조치` 문구가 포함된다. owner 콘솔에서 조치 문구를 먼저 확인하고, 관련 문서 경로가 표시되면 해당 문서를 함께 확인한다.

## 12. v411 배포 전 점검 버튼

`운영 상태 > 배포 전 점검`은 다음을 한 번에 확인한다.

1. `/healthz` 응답
2. `/api/time` 응답
3. `/api/admin/diagnostics` 등급 및 체크리스트

점검 결과가 `error`면 ZIP 자체 문제가 아니라 운영 환경 조합 문제일 수 있다. `.env`, reverse proxy header, volume mount를 먼저 확인한다.

## 13. v411 검색 운영 변경

검색 모달 기본값은 `전체검색 OFF`다.

- OFF: 표시 중인 chunk, 메모리 cache, IndexedDB reader cache만 검색한다. 서버 content API를 호출하지 않는다.
- ON: 서버 content API를 사용해 현재 작품/에피소드 범위 전체를 검색한다.

대소문자 구분 옵션과 별도 캐시 전용 체크박스는 제거했다. 검색은 기본적으로 대소문자를 구분하지 않는다.


## 14. v417 스켈레톤 UI 점검

- 앱 셸 fragment가 도착하기 전 `#boot-skeleton`이 first paint placeholder로 표시된다.
- 라이브러리 목록 API 응답 전 `#novel-list .library-skeleton`이 표시되고, 실제 목록 렌더링 시 replaceChildren 경로로 제거된다.
- 본문 로딩 중 `#loading .reader-load-skeleton`이 표시되며 reader anchoring/virtual layout 파일은 변경하지 않는다.
- 검색 실행 중에는 `#nsearch-results .search-skeleton`이 표시되고, 검색 완료 시 기존 결과 window renderer가 사용된다.


## v417 owner actions / release verify

- owner 콘솔의 사용자 생성, 수정, 활성 전환, 세션 강제 만료, 계정 삭제, 비밀번호 초기화 wiring은 `public/scripts/admin/actions.js`로 분리한다.
- 운영 진단과 배포 전 점검은 카드형 요약과 `details` 기반 원본 JSON을 함께 제공한다.
- `npm run release:verify -- <zip>`는 ZIP integrity, 금지 항목, precompressed hash, current-version lint, owner split smoke, frontend check를 clean extract에서 확인한다.
- 검색 모달에서 제거된 대소문자 구분/캐시 전용 옵션은 `search-option-dead-code-smoke`로 재도입을 방지한다.
