# TXT Reader project docs

기준 버전: rebuild-v544

이 폴더는 v350부터 버전별 누적 문서를 성격별 문서로 통합한다. 이전처럼 `rebuild-phaseNNN.md`, `worklist-vNNN.md`, `deployment-guide-vNNN.md`를 계속 추가하지 않는다.

## 문서 목록

- `deployment-guide.md`: 운영 배포, `.env`, reverse proxy, healthcheck
- `security.md`: Origin/Fetch Metadata, session cookie, rate limit, fileops, public asset allowlist
- `performance-cache.md`: precompressed static, library deep signature cache
- `reader-search-baseline.md`: v314 reader/search anchoring baseline 보존 원칙 및 금지 목록
- `reader-anchoring-stability-contract.md`: v487 이후 안정화된 reader anchoring/slider/fileChar 좌표계 보호 계약
- `smoke-tests.md`: smoke test 실행 기준과 문서 독립화 정책
- `release-history.md`: 과거 버전별 문서와 guard marker archive
- `handoff.md`: 다음 작업자용 인수인계
- `api-contract.md`: API 계약
- `operations-checklist.md`: owner 운영 체크리스트
- `production-diagnostics.md`: production/HTTPS/reverse proxy 진단 절차

Cloudflare Tunnel 모드 문서는 `CF-Visitor` 신뢰의 전제 조건을 포함한다. NPM 관리자 포트뿐 아니라 NPM service entry `80/443`과 Node 앱 포트도 WAN에서 직접 접근 불가능해야 한다.


## Smoke test quick start

```bash
npm install --no-audit --no-fund --package-lock=false
npm run smoke:quick
npm run smoke
npm run smoke:frontend
```

`package-lock.json`은 v530부터 배포 ZIP에 포함한다. 운영 배포는 lockfile 기반 `npm ci`/Docker build를 사용한다. 전체 검증은 `npm run smoke:full`을 사용한다.

## 정책

1. 현재 산출 기준은 rebuild-v544이다.
2. reader/search/block jump/slider/virtual-layout은 사용자가 명시 요청하기 전까지 수정하지 않는다. 특히 v487 안정 기준의 fileChar 좌표계, append/prepend fileChar anchor, native measure freeze는 `reader-anchoring-stability-contract.md`를 먼저 읽지 않고 최적화하지 않는다.
3. smoke test는 문서 파일 존재 여부가 아니라 소스/런타임 동작을 우선 검사한다.
4. `package-lock.json`은 v530부터 ZIP에 포함한다.


## v356 reader episode boundary update

- 폴더형 다중 화수의 100% 부근 measure 보정은 bottom-distance anchor로 보강한다.
- 기능 > 읽기 조작 > 화 경계 이동에서 수동, 슬라이더 100%, 끝까지 스크롤 자동 다음 화 모드를 선택한다.
- 검증 marker: v356-reader-episode-boundary-mode-smoke-pass.
## v357 reader episode boundary update

- v356의 슬라이더 100% 다음 화 이동과 near-bottom 자동 전환은 제거했다.
- 폴더형 작품에서는 현재 화가 실제 100% 바닥에 있을 때 사용자가 한 번 더 아래로 스크롤하는 경우에만 다음 화를 연다.
- 슬라이더 100%는 다음 화로 넘기지 않고 현재 화의 실제 바닥으로 이동한다.
- v356 episode bottom-distance anchor는 제거하고 v355 append anchor 보강은 유지한다.
- 검증 marker: v357-reader-episode-boundary-scroll-beyond-smoke-pass.

## v358 reader scroll-buffer patch anchor update

- 폴더형 다중 화수의 80~90% 부근 chunk append 이후 active render window patch가 spacer 높이를 바꿀 때 render-window anchor를 복원한다.
- 적용 범위는 최근 scroll-buffer append/forward 방향으로 제한하고, pending scroll target이 있는 검색/슬라이더/명시 점프에는 개입하지 않는다.
- 다음 화 자동 전환/무한스크롤 동작은 v357의 축소 정책을 유지한다.
- 검증 marker: v358-reader-scroll-buffer-patch-anchor-smoke-pass.

## v359 reader bottom/boundary lock update

- 슬라이더/퍼센트 100% 이동은 row `scrollIntoView` 후속 보정을 남기지 않고, 마지막 chunk의 실제 하단으로 직접 이동한다.
- 이 변경은 100% 도달 후 마지막 row가 중앙 정렬되며 본문이 위로 끌려 올라가는 현상을 막기 위한 것이다.
- `100%에서 더 아래로 스크롤하면 다음 화` 전환은 opening/cooldown lock으로 한 번에 한 화만 열리게 한다.
- 검증 marker: v359-reader-bottom-ratio-boundary-lock-smoke-pass.

## v360 reader bottom anchor note

- 폴더형 다중 화수의 마지막 chunk 90~100% 구간에서 bottom-distance anchor를 보존한다.
- 검증 marker: v360-reader-episode-bottom-anchor-smoke-pass.

## v363 검색 개선 요약

- 폴더형 다중 화수 작품에서 `전체 본문 검색`은 현재 화가 아니라 작품의 모든 화를 순차적으로 검색한다.
- 검색 결과를 누르면 다른 화의 결과라도 해당 화를 열고 목표 chunk/searchIndex로 이동한다.
- 검색 전용 smoke: `npm run smoke:search`


## v364 검색 안정화 요약

- 단일 검색 이동 실패 표시에서 누락된 search marker 상수를 보완했다.
- 전체 검색 중 결과 목록을 점진 반영하는 `txt-reader-search-results` 이벤트를 추가했다.
- 다중 화수 전체 검색의 비현재 화수 chunk fetch는 bounded concurrency로 처리해 순차 네트워크 fetch 병목을 줄였다.
- 검증: `npm run smoke:search` (`v364-search-runtime-smoke-pass`).

## v411 문서 추가

- `proxy-tunnel-setup.md`: Nginx Proxy Manager / Cloudflare Tunnel 설정 예시
- 운영 진단 finding별 복구 가이드와 owner 콘솔 배포 전 점검 흐름
- 검색 모달 기본값 변경: 전체검색 OFF = 서버 요청 없는 캐시 검색


## v417 문서 추가

- skeleton UI first paint / library / reader / search / owner console 경로를 운영 체크리스트와 smoke 문서에 추가했다.


## v417 owner actions / release verify

- owner 콘솔의 사용자 생성, 수정, 활성 전환, 세션 강제 만료, 계정 삭제, 비밀번호 초기화 wiring은 `public/scripts/admin/actions.js`로 분리한다.
- 운영 진단과 배포 전 점검은 카드형 요약과 `details` 기반 원본 JSON을 함께 제공한다.
- `npm run release:verify -- <zip>`는 ZIP integrity, 금지 항목, precompressed hash, current-version lint, owner split smoke, frontend check를 clean extract에서 확인한다.
- 검색 모달에서 제거된 대소문자 구분/캐시 전용 옵션은 `search-option-dead-code-smoke`로 재도입을 방지한다.

- `user-data-isolation.md`: 라이브러리 파일 공유와 사용자별 개인 데이터 분리 정책.
