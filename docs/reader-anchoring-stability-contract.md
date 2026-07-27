# Reader anchoring stability contract

기준 버전: rebuild-v488

이 문서는 v487에서 사용자가 실제 체감상 안정 상태로 평가한 reader anchoring / slider / progress / chunk seam 로직을 보호하기 위한 작업 계약이다.

> 결론: **최적화, 코드 정리, 중복 제거, 성능 개선, 리팩터링을 이유로 아래 reader 좌표계 로직을 건드리지 않는다.**
> 수정이 필요하면 먼저 실제 재현 로그 또는 debug snapshot으로 원인을 확정하고, 하나의 원인만 최소 패치한다.

## 안정 기준점

- 안정 기준: `txt_reader_multi_v487.zip`
- cachebuster 기준: `rebuild-v487`에서 안정화 확인 후 v488 문서화
- v482~v487 사이에 reader 안정화를 위해 추가된 핵심 축은 아래 네 가지다.
  1. 서버 block manifest의 block별 char range
  2. append/prepend fileChar anchor restore
  3. native forward/backward measure freeze
  4. slider/progress의 fileChar 우선 좌표계와 touch-coast slider settle

v488은 이 안정 상태를 문서화하는 버전이다. reader runtime behavior는 의도적으로 변경하지 않는다.

## 건드리지 말아야 할 핵심 파일

아래 파일은 사용자 명시 요청 없이 최적화 대상으로 삼지 않는다.

```text
server/services/block-manifest-service.js
public/scripts/rebuild/features/reader.mjs
public/scripts/rebuild/features/reader/coordinates.mjs
public/scripts/rebuild/features/reader/virtual-layout.mjs
public/scripts/rebuild/features/reader/progress.mjs
public/scripts/rebuild/features/reader/chunk-window.mjs
public/scripts/rebuild/features/reader/scroll-side-effects.mjs
public/scripts/rebuild/features/reader/load-chunk-side-effects.mjs
public/scripts/rebuild/features/reader/virtual-layout-diagnostics.mjs
public/scripts/rebuild/features/recovery/snapshot-export.mjs
public/scripts/rebuild/features/devtools/report.mjs
```

특히 `virtual-layout.mjs`, `progress.mjs`, `coordinates.mjs`, `block-manifest-service.js`는 서로 강하게 결합되어 있다. 한 파일만 보며 “불필요해 보이는 guard”를 제거하면 append/prepend seam, 하단 slider, 100% 표시, fullscreen/복귀 anchoring이 동시에 깨질 수 있다.

## 유지해야 할 좌표계 원칙

### 1. source of truth는 fileCharIndex다

reader의 안정 좌표는 DOM scrollTop이나 현재 mounted chunk 높이가 아니라 파일/episode 내부 문자 좌표다.

```text
fileCharIndex / totalManifestChars
```

하단 slider thumb와 현재 episode progress는 가능한 한 이 좌표를 우선한다. `scrollTop / scrollHeight`, `bodyCount`, `chunk ratio`, `fallbackDocumentRatio`는 보조 또는 fallback이다.

### 2. 서버 manifest는 높이를 만들지 않는다

서버는 viewport, font, line-height, safe-area, 기기 렌더링을 알 수 없다. 따라서 서버 manifest는 height가 아니라 안정적인 문자 좌표만 제공한다.

보존해야 할 항목:

```text
totalChars
chunk.charStart
chunk.charEnd
chunk.blocks[].charStart
chunk.blocks[].charEnd
chunk.blocks[].localCharStart
chunk.blocks[].localCharEnd
folderCharStart
folderCharEnd
```

`block-manifest-service.js`의 block char range를 “payload가 커 보인다”는 이유로 제거하지 않는다. 이 정보는 append/prepend fileChar anchor의 기반이다.

### 3. append와 prepend는 대칭적으로 fileChar anchor를 사용한다

아래 두 축은 같이 유지해야 한다.

```text
enrichAppendAnchorWithFileChar()
applyAppendFileCharAnchor()
enrichPrependAnchorWithFileChar()
applyPrependFileCharAnchor()
```

append만 고치거나 prepend만 고치면, 아래 방향/위 방향 스크롤 체감이 다시 비대칭이 된다.

### 4. native scroll 중 measure commit은 즉시 scrollTop을 흔들면 안 된다

다중파일 active native scroll / touch inertia / append-prepend settle 구간에서는 measured row height를 cache에 반영하더라도, 그 즉시 scrollTop correction을 적용하면 “드득거림”이나 살짝 위/아래 튐이 발생할 수 있다.

보존해야 할 guard:

```text
resolveNativeForwardMeasureCommitFreeze()
resolveNativeBackwardMeasureCommitFreeze()
```

forward append와 backward prepend 모두 필요하다.

### 5. touch-coast 중 slider thumb는 흔들림을 줄인다

관성 스크롤 중 `navSlider.value`를 매 scrollTop 변화마다 확정 갱신하면 하단바가 관성까지 과하게 따라가 보인다. v485 이후 정책은 touch-coast 중 thumb 갱신을 완화하고 settle 후 확정한다.

보존해야 할 marker:

```text
v485-reader-slider-coast-thumb-settle-pass
```

### 6. 68~86% guard는 근본 좌표계가 아니다

68~86% seam guard는 과거 증상 방어용이다. 신규 최적화에서 이 범위 숫자를 조정하며 문제를 해결하려 하지 않는다. 우선 fileChar anchor, measure freeze, slider fileChar progress가 유지되는지 확인한다.

## 절대 금지 작업

아래 작업은 사용자 명시 요청과 실제 진단값 없이 수행하지 않는다.

1. `fileCharIndex` 기반 progress를 `scrollTop / scrollHeight` 기반으로 되돌리기
2. `chunk.blocks[]` char range 제거 또는 schema downgrade
3. append/prepend fileChar anchor helper 제거
4. native forward/backward measure freeze 제거
5. touch-coast slider settle 제거
6. `pendingScrollTarget` / `row.scrollIntoView()`를 slider seek 경로에 다시 끼워 넣기
7. 100% progress 표시를 단순히 `ratio >= 0.999` clamp로 처리하기
8. 다중파일 safe-area folder progress와 하단 slider current-episode progress를 섞기
9. “중복 guard 정리” 명목으로 append/prepend/seam/bottom anchor 조건 통합하기
10. 실제 기기 테스트 없이 Samsung Internet / iPad PWA anchoring 문제를 해결했다고 단정하기

## 수정이 필요한 경우의 절차

1. 먼저 실제 증상 분류
   - 단일파일 / 다중파일
   - 아래 방향 append / 위 방향 prepend
   - slider seek / native scroll / touch-coast / fullscreen 전환 / 백그라운드 복귀
   - 진행률 구간
2. debug snapshot 또는 devtools report 확인
   - `lastReaderSliderProgressDiagnostic`
   - `lastReaderCoordinatePolicy`
   - `lastAppendSeamProgressDiagnostic`
   - `lastAppendSeamScrollTopDiagnostic`
   - `lastPrependSeamScrollTopDiagnostic`
   - `lastAppendFileCharAnchorRestore`
   - `lastPrependFileCharAnchorRestore`
   - `lastNativeForwardMeasureFreeze`
   - `lastNativeBackwardMeasureFreeze`
3. 원인 1개만 선택
4. 해당 파일만 최소 변경
5. 기존 smoke와 신규 회귀 smoke를 같이 실행
6. 실제 기기 테스트를 하지 않았다면 최종 보고서에 반드시 “미수행”으로 표기

## 필수 smoke 묶음

reader 좌표계 변경 전후에는 최소한 아래를 실행한다.

```bash
node tools/checks/reader-slider-file-char-progress-smoke.js
node tools/checks/reader-slider-coast-thumb-settle-smoke.js
node tools/checks/reader-prepend-file-char-anchor-smoke.js
node tools/checks/reader-native-backward-measure-freeze-smoke.js
node tools/checks/reader-file-char-viewport-progress-smoke.js
node tools/checks/reader-append-file-char-anchor-smoke.js
node tools/checks/reader-native-forward-measure-freeze-smoke.js
node tools/checks/block-manifest-block-char-ranges-smoke.js
node tools/checks/reader-single-file-guard-scope-smoke.js
node tools/checks/reader-debug-snapshot-progress-smoke.js
```

이 문서 자체의 보호 smoke:

```bash
node tools/checks/reader-anchoring-stability-contract-smoke.js
```

## 다음 세션 인수인계 문장

다른 세션에서 이어서 작업할 때는 먼저 아래 문장을 전달한다.

```text
v487은 사용자가 실제 체감상 append/prepend 튐이 사라졌다고 평가한 reader 안정 기준점이다. 최적화/리팩터링/정리 작업에서 reader anchoring, slider progress, fileChar coordinate, block manifest char range, native measure freeze, append/prepend fileChar anchor를 건드리지 말 것. 관련 변경 전에는 docs/reader-anchoring-stability-contract.md를 읽고 reader-anchoring-stability-contract-smoke.js를 통과시킬 것.
```

## marker

`v488-reader-anchoring-stability-contract-pass`


## v489 보호 장치 확장

- `npm run smoke:reader` / standard smoke 흐름에 `reader-anchoring-stability-contract-smoke.js`를 포함해 reader 최적화 전 안정화 계약이 누락되지 않게 했다.
- 개발자 디버그 리포트 reader 섹션에 `v487 reader stability baseline` 요약을 노출해 다른 세션이 fileChar/manifest/measure-freeze 계열을 최적화 대상으로 오판하지 않도록 했다.
- `#safe-area-bar` CSS ownership guard는 동작 변경 없이 escaped ID selector를 사용해 중복 budget을 통과하도록 정리했다.

`v489-reader-stability-standard-smoke-link-pass`
`v489-safe-area-css-ownership-budget-pass`
