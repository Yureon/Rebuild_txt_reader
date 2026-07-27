# TXT Reader Multi 현재 상태 — v682

- 제품: `v682`
- package: `6.82.0`
- build: `rebuild-v682`
- 완료: Owner 라이브러리 정리/재배치 PowerShell의 Windows PowerShell 5.1 호환 상대경로 계산
- 보존: root containment, reparse-point 검사, dry-run/Apply, Metadata 수동 출처 필터, 사용자별 theme, Reader locator, PWA fail-closed
- 실환경 확인 필요: 실제 Windows PowerShell 5.1에서 dry-run과 Apply fixture

<!-- v682-project-status-pass -->

# TXT Reader Multi 현재 상태 — v681

- 제품: `v681`
- package: `6.81.0`
- build: `rebuild-v681`
- 완료: Metadata 적용 출처 필터에 `수동 입력 (직접 추가)` 추가, `providerId: manual` 전용 판정, URL·페이지네이션·폴더 필터 상태 유지
- 보존: Owner 로그인 팔레트, 사용자별 theme bootstrap, Reader locator, Metadata resident cap, library cursor, 사용자 ACL, PWA fail-closed
- 실환경 확인 필요: 대규모 작품 목록에서 복합 필터 조합과 실제 브라우저 UI

<!-- v681-project-status-pass -->

# TXT Reader Multi 현재 상태 — v680

- 제품: `v680`
- package: `6.80.0`
- build: `rebuild-v680`
- 완료: 로그인 Owner 팔레트, 사용자별 theme first-paint scope, 로그인 theme prime, Metadata 독립 theme bootstrap, body/theme-color runtime 동기화
- 보존: Reader locator, Metadata bounded resident, library cursor, 사용자 ACL, PWA fail-closed
- 실환경 확인 필요: Chrome·Whale·Samsung Internet의 autofill/standalone 첫 화면, 다중 탭 사용자 전환

<!-- v680-project-status-pass -->

# TXT Reader Multi 현재 상태 — v679

- 제품: `v679`
- package: `6.79.0`
- build: `rebuild-v679`

## 완료

- Metadata 폴더 검색 입력의 dark/light/custom theme 스타일
- v679 HTML·Service Worker·precompressed cache namespace 동기화
- Metadata Helper 380px fixed popup width와 빈 action 숨김
- 관련 current-release 회귀 추가

## 유지

v677의 Metadata hard cap·incremental eviction, 80k tree cursor paging, no-follow filesystem 경계, Reader locator와 사용자 격리 계약을 유지한다.

<!-- v679-project-status-pass -->

# TXT Reader Multi 현재 상태

## 기준

- 제품: `v676`
- package: `6.76.0`
- build: `rebuild-v676`

## v676 완료

- Metadata 32-shard streaming bounded load, global 20k·작품별 cap·applied 보호
- proxy header 유효 IP 검증과 loopback-only 기본 source
- abort 무시 prefetch의 active orphan circuit
- 순서 밖 close를 견디는 modal stack/inert/focus 복구
- progress journal과 font file의 no-follow handle 경계
- font I/O 오류의 404 축소 제거
- Metadata 적용 뒤 load-more 위치와 선택 행 연속성 유지
- Metadata 폴더 facet/filter
- 확장 프로그램 action shortcut과 좁은 popup 반응형 UI
- Compose YAML 문법과 current smoke 등록 gate

## 유지 계약

Reader `fileChar`와 locator, candidate/applied 32-shard, durable commit-before-publish, provider별 쿨타임, 사용자별 state/font/browser storage scope, mixed-build executable fail-closed를 유지한다.

## 다음 우선순위

1. N100에서 50k/100k 실제 candidate startup/steady RSS와 multi-user progress write 측정
2. 실제 Tunnel→NPM source CIDR과 origin firewall 검증
3. 80k HDD/SMB disconnect/reconnect·journal recovery 검증
4. Whale/Samsung Internet/standalone PWA와 extension shortcut 충돌 검증
5. 실제 provider 로그인·성인 인증·anti-bot 회귀

실행하지 않은 실제 환경은 통과로 기록하지 않는다.

<!-- v676-project-status-pass -->
