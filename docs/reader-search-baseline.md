# Reader and search baseline

기준 버전: rebuild-v390

현재 안정 흐름은 v314 reader/search anchoring baseline을 보존한다. 아래 파일은 사용자가 명시적으로 요청하기 전까지 수정하지 않는다.

```text
public/scripts/rebuild/features/reader.mjs
public/scripts/rebuild/features/reader/coordinates.mjs
public/scripts/rebuild/features/reader/jump-panel.mjs
public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs
public/scripts/rebuild/features/reader/navigation-intent.mjs
public/scripts/rebuild/features/reader/progress.mjs
public/scripts/rebuild/features/reader/virtual-layout.mjs
public/scripts/rebuild/features/search.mjs
public/scripts/rebuild/features/search/results-view.mjs
```

## v488 reader anchoring stability contract

- v487은 사용자가 실제 체감상 append/prepend 튐이 사라졌다고 평가한 reader 안정 기준점이다.
- `docs/reader-anchoring-stability-contract.md`를 새 기준 문서로 추가했다.
- 최적화/리팩터링/중복 제거 작업에서 아래 항목은 건드리지 않는다.
  - 서버 block manifest의 block별 char range
  - append/prepend fileChar anchor restore
  - native forward/backward measure freeze
  - 하단 slider의 fileChar 우선 progress
  - touch-coast slider settle
- 검증 marker: `v488-reader-anchoring-stability-contract-pass`.

## 절대 재도입 금지

- explicit seek transaction
- manifest-addressed seek
- manifest/global-block page navigation
- top-align retry seek
- viewport target verify/retry
- programmatic-seek-scroll gate
- seekSeq/latest-wins를 reader anchor pipeline에 직접 연결
- requireExact 기반 block jump fallback 차단
- globalBlockAddress 기반 projected char fallback
- `resolveGlobalBlockAddress()`
- `findVirtualRowByChunkChar()`
- `getViewportBodyBlockSpan()`
- `READER_MANIFEST_ADDRESSED_SEEK_PASS`
- `READER_EXPLICIT_SEEK_TOP_ALIGN_PASS`
- `READER_VIEWPORT_TARGET_VERIFY_PASS`

## v349 예외

사용자 요청으로 검색 리모컨 pill compaction만 search 계열에 최소 적용했다. block jump, slider, virtual-layout은 수정하지 않았다.


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

- 100% ratio 이동은 검색/블럭 점프용 pending target pipeline과 분리한다.
- 마지막 row를 center/start로 다시 맞추는 후속 `scrollIntoView`를 남기지 않아 다중 화수 마지막 부근에서 본문이 위로 당겨지는 현상을 막는다.
- 다음 화 이동은 한 번의 overscroll에 한 화만 열리도록 boundary lock을 적용한다.
- 검증 marker: v359-reader-bottom-ratio-boundary-lock-smoke-pass.

## v360 reader episode bottom anchor update

- 폴더형 다중 화수의 마지막 chunk가 이미 로드된 90~100% 구간에서는 top-row anchor 대신 bottom-distance anchor를 우선한다.
- render window patch/replacement, spacer sync, measure commit 후 `reader.scrollHeight - reader.clientHeight - scrollTop` 기준의 하단 잔여 거리를 보존한다.
- pending scroll target이 있는 검색/블럭 점프/명시 이동에는 개입하지 않는다.
- 검증 marker: v360-reader-episode-bottom-anchor-smoke-pass.

## v361 jump panel episode selection update

- 블럭 점프창에 폴더형 다중 화수용 `화` 선택 드롭다운을 추가했다.
- 현재 화를 선택한 상태에서는 기존 블럭/퍼센트 점프 동작을 유지한다.
- 다른 화를 선택하면 선택한 화의 시작 위치 또는 입력한 블럭 번호로 이동한다.
- 검색, 슬라이더, episode boundary, virtual-layout anchor pipeline에는 개입하지 않는다.
- 검증 marker: v361-reader-jump-panel-episode-select-smoke-pass.


## v362 jump panel and boundary mode UI update

- 블럭 점프창의 화 선택 드롭다운은 파일명/화 제목만 표시한다. 인덱스 번호 접두사는 붙이지 않는다.
- 화 제목이 숫자만 있는 경우 표시명 뒤에 `화`를 붙인다.
- 다른 화를 선택하면 완료 버튼을 누르지 않아도 해당 화 시작 위치로 즉시 이동한다.
- 설정의 화 경계 이동은 select 대신 `수동`/`자동` 버튼으로 선택한다.
- 검색, slider, block jump, virtual-layout anchor pipeline은 변경하지 않는다.
- 검증 marker: v362-reader-jump-panel-episode-select-smoke-pass.

## v363 multi-episode full search

- 폴더형 다중 화수 작품에서 전체 검색은 현재 episode만이 아니라 `current.novel.episodes` 전체를 대상으로 한다.
- 각 episode는 독립 content endpoint로 chunk 1부터 검색하며, 응답의 `totalChunks`에 따라 해당 episode의 남은 chunk를 확장 검색한다.
- 결과는 `episodeIndex → chunk → index` 순서로 정렬한다.
- 다른 episode의 결과를 선택하면 검색 세션을 유지한 채 해당 episode를 열고 `searchIndex`로 이동한다.
- 검색/이동 보강은 reader anchor pipeline, slider, block jump 구조를 변경하지 않는다.


## v364 search stabilization

- 단일 검색 이동 실패 표시에서 누락된 search marker 상수를 보완했다.
- 전체 검색 중 결과 목록을 점진 반영하는 `txt-reader-search-results` 이벤트를 추가했다.
- 다중 화수 전체 검색의 비현재 화수 chunk fetch는 bounded concurrency로 처리해 순차 네트워크 fetch 병목을 줄였다.
- 검증: `npm run smoke:search` (`v364-search-runtime-smoke-pass`).


## v366 검색창 하단 정보 정리

- 검색 결과 목록 아래에는 진행률, 처리 수, 결과 수, 다중 화수 진행도를 한 줄 상태로 표시합니다.
- 전체 본문 검색 체크만으로 상세 retry/detail 영역을 상시 표시하지 않습니다. 실패, 누락, 이동 실패처럼 사용자가 조치할 정보가 있을 때만 하단 상세 영역을 표시합니다.
- 검색 결과 클릭이나 검색 리모컨 이동 중에도 진행 중인 검색 작업은 계속됩니다.
