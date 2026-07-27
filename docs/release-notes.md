# 현재 릴리스 변경 사항 — v682

기준은 package `6.82.0`, runtime build `rebuild-v682`이다.

1. Owner 라이브러리 정리/재배치 스크립트에서 Windows PowerShell 5.1에 없는 `[System.IO.Path]::GetRelativePath()` 호출을 제거했다.
2. `GetFullPath` 정규화, case-insensitive root containment와 prefix substring을 사용하는 `Get-RelativePathCompat`를 추가했다.
3. candidate가 root 자체인 경우 빈 상대경로를 정상 처리한다.
4. 기존 reparse-point 거부, dry-run, `-Apply`, target collision과 root overlap 방지는 유지한다.
5. 공개 API와 저장 schema migration은 없다.

<!-- v682-release-notes-pass -->

# 현재 릴리스 변경 사항 — v681

기준은 package `6.81.0`, runtime build `rebuild-v681`이다.

1. Metadata 관리의 `적용 Provider` 필터를 `적용 출처`로 명확히 표시한다.
2. 직접 입력으로 저장된 Metadata(`providerId: manual`)를 `수동 입력 (직접 추가)` 옵션으로 필터링할 수 있다.
3. 수동 입력 필터는 기존 Provider·메타데이터 상태·폴더·검색·cursor pagination과 함께 동작한다.
4. 한국어 Provider 수집이 비활성인 locale에서도 수동 입력 출처 필터는 유지한다.
5. 공개 저장 schema migration은 없으며 기존 manual 적용 레코드를 그대로 사용한다.

<!-- v681-release-notes-pass -->

# 현재 릴리스 변경 사항 — v680

기준은 package `6.80.0`, runtime build `rebuild-v680`이다.

1. 로그인 화면을 Owner 관리 화면의 검정·녹색 팔레트로 통일했다.
2. 로그인 성공 시 사용자별 theme scope와 theme-only prefs를 redirect 전에 prime한다.
3. 서재·Reader·사이트는 사용자 scope 기반 첫 화면 테마와 server hydration을 유지한다.
4. Metadata 독립 페이지는 session theme bootstrap 후 state를 생성해 anonymous/이전 사용자 테마 노출을 줄였다.
5. theme 변경 시 html/body, background와 browser theme-color를 함께 갱신한다.
6. 사용자 상태·Reader locator·Metadata 저장 schema migration은 없다.

<!-- v680-release-notes-pass -->

# 현재 릴리스 변경 사항 — v679

기준은 package `6.79.0`, runtime build `rebuild-v679`이다.

## 수정

1. Metadata 폴더 검색 입력을 theme variable 기반 background/text/border/placeholder/focus/autofill style로 소유한다.
2. HTML cachebuster와 Service Worker cache namespace를 v679로 갱신해 기존 v677 CSS 재사용을 차단한다.
3. Metadata Helper popup의 `100vw` 순환 축소를 제거하고 380px fixed intrinsic width로 고정한다.
4. 단축키 표시와 빈 action 숨김 계약을 유지하고 회귀 검사를 추가한다.

공개 API·저장 schema migration은 없다.

<!-- v679-release-notes-pass -->

# 현재 릴리스 변경 사항 — v676

기준은 package `6.76.0`, runtime build `rebuild-v676`이다.

## 구조적 수정

1. **Metadata bounded resident load**: 32 candidate shard를 한 번에 객체화하지 않고 shard별로 읽으며 global 20,000개·작품별 cap을 score/recency 기준으로 선택한다. applied 참조는 cap 밖이어도 보존하고, 제거가 발생하면 shard rewrite를 예약한다.
2. **Trusted proxy 입력 경계**: 기본 신뢰 source는 loopback뿐이다. socket peer가 `TRUSTED_PROXY_CIDRS`에 속하고 전달 header가 `net.isIP()`를 통과할 때만 client IP와 rate-limit key로 사용한다.
3. **Prefetch orphan circuit**: watchdog 이후에도 끝나지 않는 downstream 작업을 active orphan으로 추적하고 상한에 도달하면 circuit을 열어 추가 orphan 생성을 제한한다.
4. **Modal stack 복구**: 중첩 dialog를 순서와 다르게 닫아도 active stack을 다시 계산해 background inert/aria-hidden과 focus를 올바르게 복원한다.
5. **Filesystem no-follow 확대**: progress NDJSON sidecar와 font stream 모두 `lstat/realpath/O_NOFOLLOW/fstat` 경계를 사용한다. font의 `EIO`·권한·FD 오류는 404로 축소하지 않고 5xx 경로로 전파한다.
6. **Metadata 목록 연속성**: 후보 적용, 수동 저장, 확장 import와 job 완료 후 전체 목록을 1페이지로 초기화하지 않고 선택 행과 요약만 갱신한다. 전체 재조회가 필요한 경우 이미 불러온 항목 수까지 복원한다.
7. **Metadata 폴더 필터**: 작품 API가 정규화된 folder prefix facet과 반복 `folder` query를 제공하고 관리 화면에서 폴더별 필터를 선택할 수 있다.
8. **Metadata Helper UI/단축키**: `_execute_action` 명령으로 기본 `Ctrl+Shift+Y`(macOS `Command+Shift+Y`)를 제공하고 실제 지정 단축키를 popup에 표시한다. 280px 이하에서도 flow label·버튼·상태 카드가 겹치지 않도록 반응형 layout을 적용한다.
9. **Compose/검증 정리**: 세 Compose 파일의 environment 목록 문법을 고정하고, 모든 v676 smoke를 quick/full/release verifier에 등록하는 active-check gate를 추가한다.

## 호환성과 migration

공개 API schema migration은 없다. 기존 metadata shard, progress full-state JSON과 journal을 읽는다. Reader `fileChar`, bookmark/search/resume locator, provider별 완료 후 cooldown, candidate/applied 32-shard와 PWA mixed-build fail-closed를 유지한다.

실제 N100, 80k HDD/SMB, Tunnel→NPM, 제품 브라우저와 live provider는 실행한 경우에만 통과로 기록한다. 최종 수치는 `txt_reader_v676_validation.json`과 `v676_final_independent_verification.json`을 기준으로 한다.

<!-- v676-release-notes-pass -->
