# v682 감사 해소 기록

라이브러리 재배치 PowerShell 생성기가 .NET Core 계열의 `System.IO.Path.GetRelativePath`에 의존해 Windows PowerShell 5.1에서 즉시 실패했다. root/candidate를 `GetFullPath`로 정규화하고 case-insensitive root containment를 확인한 뒤 prefix substring으로 상대경로를 계산하도록 수정했다. root 자체를 검사하는 경우 빈 상대경로를 정상 처리하며 기존 reparse-point 경계는 유지한다.

<!-- v682-audit-resolution-pass -->

# v681 감사 해소 기록

Metadata 수동 입력 레코드는 이미 `providerId: manual`로 저장됐지만 UI Provider 목록이 서버 표식을 노출하지 않아 필터링할 수 없었다. UI의 적용 출처 옵션, 표시명, API query와 서버 predicate를 동일한 `manual` 계약으로 연결했다.

<!-- v681-audit-resolution-pass -->

# v677 심층 감사 해소

v676 심층 감사의 10개 항목을 다음 구조로 해소했다: Metadata protected candidate hard cap, incremental eviction, tree cursor paging, state revision split, folder pagination, cover/audit no-follow, installed-runtime release gate, package-wide parser와 신규 대형 fixture 회귀. 실제 장비·배포 경계는 미검증으로 유지한다.

<!-- v677-audit-resolution-pass -->

# v674 전수 감사 해결 결과

| ID | 우선순위 | 영역 | 원인 | 상태 |
|---|---|---|---|---|
| V674-READ-01 | P1 | Reader 저장 | local fallback이 작은 진행도 저장마다 최대 100,000개 key를 열거·선택·직렬화 | 사용자 scope별 증분 bounded snapshot으로 해결 |
| V674-READ-02 | P1 | Reader prefetch | abort된 실행의 정리가 새 controller 상태를 덮을 수 있음 | 실행별 controller identity와 단일 pump로 해결 |
| V674-LIB-01 | P1 | 서재 | virtual failure가 대형 전체 DOM·작품별 bookmark scan으로 전환 | 500/300 안전 상한, bookmark index, collapsed lazy render로 해결 |
| V674-PWA-01 | P1 | PWA | navigation 성공 뒤 client-state CacheStorage 실패가 응답까지 실패시킴 | 응답과 best-effort 상태 작업 분리로 해결 |
| V674-DUR-01 | P0 | 파일 저장 | directory fsync의 실제 I/O 실패를 삼켜 durable 성공으로 오판 | 미지원 오류만 분류하고 실제 실패 전파로 해결 |
| V674-DUR-02 | P0 | 파일 작업 | rename/delete 뒤 영향받은 부모 directory sync 전 journal commit | mutation→directory sync→journal commit 순서로 해결 |
| V674-STATE-01 | P1 | 사용자 상태 | deviceProfiles와 syncMeta map이 고유 device마다 무제한 증가 | current/preferred 보존 bounded recent set으로 해결 |
| V674-META-01 | P1 | Metadata 보안 | Playwright 공개 IP 검사와 실제 연결 사이 DNS 재해석 가능 | socket pin 또는 fail-closed 경로로 해결 |
| V674-META-02 | P2 | Metadata locale | `Accept-Language: *`를 실제 locale 이름으로 오인해 CLI·Node 요청을 403 처리 | wildcard를 앱 기본 `ko`로 해석해 해결 |
| V674-TEST-01 | P2 | 검증 | Windows separator·ESM 위치·선택적 ZIP CLI가 코드 실패로 오분류 | portable path와 capability-blocked 계약으로 해결 |

합성 fixture와 결정적 실패 주입으로 닫은 항목만 완료로 기록한다. 실제 N100, 8만 파일 HDD/SMB, 외부 provider, Docker/Podman, Tunnel/NPM, 제품 브라우저와 arm64는 환경 미검증이다.

<!-- v674-audit-resolution-pass -->

# v673 전수 감사 해결 결과

| ID | 우선순위 | 영역 | 원인 | 상태 |
|---|---|---|---|---|
| V673-META-01 | P1 | Metadata | applied mutation·보호 조회가 전체 applied collection을 재색인·순회 | 증분 alias/work/candidate-reference index로 해결 |
| V673-META-02 | P1 | Metadata 저장 | 단일 applied gzip이 작은 수동 수정에도 전체 직렬화·압축 | 32개 revisioned shard와 작은 manifest로 해결 |
| V673-META-03 | P0 | 저장 내구성 | shard write 중 같은 shard 재변경 시 dirty flag 유실 가능 | dirty version snapshot·조건부 clear로 해결 |
| V673-META-04 | P1 | 저장·디스크 | 빈 신규 store가 첫 mutation에 32개 빈 shard를 생성 | revision-0 sparse shard 초기화로 해결 |
| V673-LIB-01 | P1 | 서재 | 일반 shelf가 전체 작품 사용자 태그·검색 key를 생성하고 tree 304도 O(N) 장식 후 판단 | tag context 재사용, final-page 장식, early ETag로 해결 |
| V673-LIB-02 | P1 | 작품 묶기 | 제목 앞부분만의 약한 coarse bucket이 거짓 거대 component와 pairwise 분석을 유발 | 제목 앞·뒤·길이 band bucket으로 해결 |
| V673-CACHE-01 | P1 | 디스크 캐시 | janitor가 삭제 상한과 무관하게 모든 후보 객체를 저장·전체 정렬 | bounded top-k heap으로 해결 |
| V673-TEST-01 | P2 | 검증 | v646 문자열 고정 회귀가 정확한 shard-ID dirty mark 계약을 실패로 오인 | 동작 계약 정규식으로 갱신 |

모든 성능 수치는 합성 fixture다. 실제 provider 계정, N100, Docker, 8만 파일 HDD/SMB와 브라우저 제품은 환경 미검증으로 남긴다.

<!-- v673-audit-resolution-pass -->

# v672 Metadata CPU 급증 해결 결과

| 심각도 | 원인 | v672 상태 |
|---|---|---|
| HIGH | candidate 한 건 저장마다 전체 candidate alias/work/content index 재생성 | 증분 index로 교체 |
| HIGH | 저장된 browser profile이 있으면 공개 요청도 Playwright 우선 | public/static transport-first로 변경 |
| HIGH | rendered page 재사용으로 background JS·timer·resource가 collector TTL 동안 잔존 | heavy resource 차단과 ephemeral page로 변경 |
| MEDIUM | JSON object traversal의 `queue.shift()`와 반복 normalization | cursor queue와 bounded LRU로 교체 |
| MEDIUM | 응답 내 JSON 문서를 제한 없이 순회·parse | 문서 수 32개·합산 8MiB 예산 추가 |
| LOW | collector context가 5분 유지되어 browser RSS·background activity가 오래 잔존 | 기본 idle TTL 90초로 단축 |

로컬 synthetic benchmark는 candidate mutation hotspot 개선을 확인한다. 실제 provider, browser process CPU/RSS, Docker 운영 부하는 환경 미검증이다.

<!-- v672-audit-resolution-pass -->

# v671 P0·P1 감사 해결 결과

| 우선순위 | 감사 항목 | v671 상태 |
|---|---|---|
| P0 | 진행도 포화 시 새 위치가 성공 응답 뒤 유실 | recency bounded retention과 current locator 보호로 해결 |
| P0 | metadata durable enqueue 저장 실패 뒤 handler 실행 | immutable staging, durable commit 후 publish로 해결 |
| P0 | custom selector event-loop block·stack overflow | iterative parser와 HTML/DOM/depth/query budget으로 해결 |
| P1 | metadata candidate monolithic parse/flush memory amplification | 32개 revisioned gzip shard와 dirty write로 완화 |
| P1 | queue transition마다 전체 clone/write | coalesced async checkpoint로 이동 |
| P1 | startup candidate compaction O(n²) | token index·union-find로 교체 |
| P1 | cleanup preview 전체 sort·removal object 생성 | bounded top-k, yield, sample response로 교체 |
| P1 | worker 부재 시 대형 TXT main-thread 처리 | 상한 초과 파일 503 fail-closed |
| P1 | library mutation journal 요청 경로 동기 fsync | serial async durable journal로 교체 |
| P1 | audit queue 무제한·이벤트별 fsync | bounded batching과 strict durable lane 적용 |

잔여 위험: metadata candidates는 shard load 후 메모리에 유지되며, user-state 전체 snapshot write amplification과 실제 SMB/Docker 부하는 후속 검토 대상이다.

<!-- v671-audit-resolution-pass -->

# v670 감사 결과

| 심각도 | 항목 | 상태 |
|---|---|---|
| MEDIUM | Whale/Chromium 네이티브 언어 선택 팝업이 앱 테마를 사용하지 않아 다크 테마에서 흰 배경·저대비 글자가 표시됨 | 앱 테마 변수로 렌더링하는 접근 가능한 custom listbox로 교체 |
| LOW | UI 글자 크기 `− / +` 버튼이 작고 네이티브 버튼처럼 보여 다른 설정 UI와 시각적으로 불일치 | 둥근 독립 버튼, 중앙 output, hover/focus/active 상태로 재설계 |
| MEDIUM | Reader의 개발자 탭에 일반 사용자가 자주 찾는 기기·독서 데이터·사용자 CSS 진입점이 없음 | 탭을 `고급`으로 변경하고 관리 도구를 상단, 개발자 디버그를 하단에 분리 |

실제 Whale 제품 UI는 환경 미검증이며 정적 DOM/CSS/이벤트 회귀와 기존 설정 모듈 검사를 수행한다.

<!-- v670-audit-resolution-pass -->

# v669 감사 결과

| 심각도 | 항목 | 상태 |
|---|---|---|
| MEDIUM | provider 쿨타임이 각 HTTP 요청 시작 시 예약되어 작품 수집 완료 기준이 아님 | provider collection coordinator로 이동하고 완료 시각 기준으로 변경 |
| MEDIUM | 동시 job에서 같은 provider의 이전 collection이 끝나기 전에 다음 collection이 진행될 수 있음 | provider별 tail로 collection 전체 직렬화 |
| LOW | UI의 `요청 간격` 문구가 실제 운영 의도를 오해하게 함 | `수집 완료 후 쿨타임`으로 명시하고 호환 필드명을 문서화 |

A/B provider 독립성은 가상 시계 실행형 회귀로 확인했다. 실제 외부 사이트 계정과 네트워크는 환경 미검증이다.

<!-- v670-audit-resolution-pass -->

# 전역 감사 결과와 잔여 위험

## v668에서 닫은 항목

| 심각도 | 항목 | 상태 |
|---|---|---|
| MEDIUM | standalone 서재가 공용 셸의 Reader loading skeleton과 본문 DOM을 삽입한 뒤 CSS로 숨김 | library 전용 shell로 구조 분리하고 Reader DOM을 응답 자체에서 제외 |
| MEDIUM | CSS 적용·Service Worker 자산 혼합 시 Reader skeleton이 순간 노출될 수 있음 | profile별 versioned shell URL과 runtime fail-closed 검사 추가 |
| LOW | 최초 warp page router가 defer라 route card가 한 프레임 보일 수 있음 | head의 parser-blocking external router로 이동 |

실제 Whale cold load와 구버전 Service Worker client의 업데이트 경계는 환경 검증이 필요하다.

<!-- v668-audit-resolution-pass -->

# 전역 감사 결과와 잔여 위험

## v666에서 닫은 항목

| 심각도 | 항목 | 상태 |
|---|---|---|
| HIGH | `autocomplete=off`가 있어도 서재 검색에 로그인 ID가 주입됨 | parser-start guard, vendor ignore, native autofill detection으로 해결 |
| HIGH | app shell/deferred fragment/동적 입력이 페이지별 속성 누락으로 보호되지 않음 | MutationObserver 기반 공통 정책으로 해결 |
| MEDIUM | Owner 사용자 생성·필터·metadata 입력이 현재 로그인 credential 대상으로 오인될 수 있음 | 실제 credential allowlist 외 모든 text/password 입력을 비인증으로 분류 |
| MEDIUM | 새 guard 자산 precache가 로그인 전 auth gate에 막힐 수 있음 | 두 자산 exact public allowlist 추가 |
| LOW | readonly 방어가 자동화·프로그램 focus를 영구 차단할 수 있음 | 사용자 intent 및 1.2초 fallback 해제 추가 |

브라우저와 확장 프로그램은 표준을 무시할 수 있으므로 실제 제품별 검증은 계속 필요하다. 사용자가 직접 편집한 값은 자동 제거하지 않는다.

<!-- v666-audit-resolution-pass -->

# 전역 감사 결과와 잔여 위험

이 문서는 과거 버전별 감사 문서를 대체하는 현재 기준표다. 상세 변경 이력은 `release-history.md`, 실행 가능한 검증은 `smoke-tests.md`, 운영 절차는 `operations-checklist.md`를 사용한다.

## 해결 상태

- 서버 쓰기 경로는 durable write 완료 전 성공을 반환하지 않는다.
- library mutation queue는 최대 길이, 대기 timeout, active watchdog, `503 + Retry-After` 계약을 가진다.
- metadata applied 수정은 후보 전체 store가 아니라 applied shard를 갱신한다.
- 사용자 진행도·북마크·최근·즐겨찾기·설정·글꼴은 사용자 scope와 `accessVersion` 경계를 유지한다.
- 표지 asset은 content hash, regular-file, symlink 금지, signature/extension, 전체 hash를 검증한다.
- 실행형 inline script/style과 원본-압축 sidecar 불일치를 패키징 gate에서 검사한다.

## 이번 v665에서 닫은 항목

| 심각도 | 항목 | 상태 |
|---|---|---|
| HIGH | 브라우저가 잘못된 MIME을 붙인 수동 표지가 raw parser에 도달하지 못함 | 바이너리 전송 고정 및 서버 signature 판정으로 해결 |
| MEDIUM | BMP 표지가 선택·저장 형식에서 누락됨 | BMP signature, 저장, 조회, 검증 지원 추가 |
| MEDIUM | HEIC/HEIF 실패가 일반 손상 이미지로만 표시됨 | 형식 판별 후 브라우저 호환 형식 변환 안내 추가 |
| MEDIUM | Docker 외 직접 Node 실행 계약과 `.env` 로딩 경로가 불명확함 | cwd 독립 Node launcher, CLI, config 검사 추가 |
| LOW | 버전별 문서가 canonical 문서와 중복됨 | 현재 문서와 release history로 통합 |

## 환경 미검증

다음은 코드 통과로 대체할 수 없다.

- 실제 Samsung Internet/Android PWA의 파일 선택기와 touch/focus
- 실제 Docker/Podman build 및 restart
- 실제 80,000개 HDD/SMB 부하·단절·재연결
- 실제 Cloudflare Tunnel/NPM 경계
- 실제 외부 metadata provider 계정과 네트워크
- arm64 QEMU

<!-- v665-audit-resolution-pass -->
<!-- v661-audit-durability-performance-pass -->
<!-- v641-audit-owner-library-extension-doc-pass -->
## v675 감사 해소

v674 보류 7건인 server progress write amplification, candidate resident index RSS, proxy header spoof boundary, abort-ignoring prefetch starvation, PWA dual failure, font symlink boundary, modal focus gaps를 구조적으로 수정했다. login→library skeleton 혼선과 낡은 Reader skeleton도 함께 수정했다.

<!-- v675-audit-resolution-pass -->
## v676 재감사 해소

50k/100k candidate resident RSS 경로는 shard별 bounded selection으로, 작품별 cap 누락은 per-work heap으로, invalid proxy header와 broad default는 IP validation·loopback default로 수정했다. prefetch orphan 누적, modal out-of-order close, font EIO 404, progress journal symlink, stale current gates와 57개 historical current-release check의 명시적 superseded registry도 추가해 해소했다.

<!-- v676-audit-resolution-pass -->
