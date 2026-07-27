# v682 운영 체크리스트

- Owner 관리 페이지에서 새 라이브러리 정리/재배치 `.ps1`을 다운로드한다.
- Windows PowerShell 5.1에서 먼저 dry-run으로 실행한다.
- 출력에 `GetRelativePath` method-not-found 오류가 없는지 확인한다.
- 검토 후에만 `-Apply`를 사용하며 기존 root containment와 reparse-point 거부가 유지되는지 확인한다.
- HTML, Service Worker와 precompressed 자산이 모두 `rebuild-v682`인지 확인한다.

<!-- v682-operations-pass -->

# v681 운영 체크리스트

- `metadataProvider=manual` 요청이 직접 입력 작품만 반환하는지 확인한다.
- HTML, ESM, Service Worker와 precompressed 자산이 모두 `rebuild-v681`인지 확인한다.
- 실제 브라우저에서 상태·폴더·검색과 수동 입력 필터를 복합 적용한다.

<!-- v681-operations-pass -->

# v680 운영 체크리스트

1. 로그인 페이지가 계정·브라우저의 과거 테마와 무관하게 Owner 팔레트로 표시되는지 확인한다.
2. 사용자 A와 B에 다른 테마를 지정한 뒤 로그아웃·재로그인하여 교차 오염이 없는지 확인한다.
3. 서재·Metadata·Reader·사이트 페이지를 이동하며 배경, 표면, 글자, accent, Reader 색이 유지되는지 확인한다.
4. Metadata 직접 URL 진입과 새 탭에서도 현재 session theme bootstrap이 적용되는지 확인한다.
5. HTML·Service Worker·precompressed 자산이 모두 `rebuild-v680`인지 확인한다.

<!-- v680-operations-current-pass -->

# v679 운영 체크리스트

1. Metadata 관리 화면에서 dark/light/custom theme 각각 folder search의 배경·글자·placeholder·focus ring을 확인한다.
2. 응답 HTML과 CSS URL이 `rebuild-v679`인지, Service Worker cache namespace가 v679인지 확인한다.
3. 확장 프로그램 popup이 380px로 열리고 세 단계와 안내 카드가 잘리지 않는지 확인한다.
4. 확장 프로그램 단축키와 빈 action 숨김을 확인한다.
5. 기존 v677 targeted/static 계약을 재실행한다.

<!-- v679-operations-current-pass -->

# 운영 체크리스트 — v676 current

기준 버전: `rebuild-v676`

# v674 운영 체크리스트

1. `txt_reader_v674.zip.sha256`과 ZIP SHA-256, archive entry 안전성, `package-manifest-v674.json` 전체 경로·byte·hash를 확인한다.
2. 재시작 뒤 pending library mutation journal이 있으면 실제 source/target 경로를 확인해 복구가 끝나기 전 같은 destructive operation을 반복하지 않는다.
3. `EIO`, `ENOSPC`, `EACCES`, `EROFS`가 directory sync 단계에서 발생하면 HTTP 성공으로 취급하지 말고 disk/SMB/read-only 상태를 먼저 복구한다.
4. device profile cap 정리 뒤 current/preferred device와 sync 충돌 화면이 유지되는지 확인한다.
5. metadata Playwright provider는 DNS rebinding 실패를 transport 오류로 기록하며 내부 주소로 우회하지 않는다.
6. PWA 업데이트에서 CacheStorage quota 실패가 있어도 navigation은 network response를 유지하고, 새 executable은 client handshake 전 409로 차단되는지 확인한다.
7. Quick·Full·독립 verifier의 환경 차단, static-only, code failure, timeout을 각각 기록한다.

실제 N100, HDD/SMB 단절·재연결, Docker/Podman, Tunnel/NPM, Whale/Samsung Internet/standalone PWA, arm64는 별도 운영 검증이 필요하다.

<!-- v674-operations-current-pass -->

# v673 운영 체크리스트

1. 기존 `work-metadata-applied.json.gz`가 있는 복제 환경에서 재시작 후 applied 32-shard migration과 revision 일치를 확인한다.
2. 수동 metadata 수정 시 대상 applied shard와 manifest만 변경되고 main candidate gzip이 다시 쓰이지 않는지 확인한다.
3. 8만 파일 서재에서 shelf p50/p95, tree conditional 304, variant grouping elapsed와 RSS를 기록한다.
4. disk cache 파일이 많은 환경에서 janitor `eligibleCandidates`, `retainedCandidates`, 삭제 수와 event-loop delay를 확인한다.
5. metadata shard write 중 EIO/ENOSPC/재시작을 주입해 primary/backup과 dirty 후속 flush를 확인한다.

<!-- v673-operations-current-pass -->

기준 버전: rebuild-v672

# 운영 체크리스트 — 현재 기준

기준: `v667` / `6.67.0` / `rebuild-v667`

## 입력 자동완성 점검

1. 로그인 후 서재 검색·태그 검색·본문 검색을 비운 상태로 새로고침한다.
2. 브라우저 저장 로그인 ID나 비밀번호가 일반 입력에 들어오지 않는지 확인한다.
3. Owner 폴더 검색·감사 검색·언어팩 입력·metadata 검색도 같은 방식으로 확인한다.
4. 실제 로그인 및 계정 비밀번호 변경에서는 credential manager가 정상 동작하는지 확인한다.
5. `/scripts/non-auth-autofill-guard.js`와 `/styles/non-auth-autofill-guard.css`가 200/304이며 Service Worker install을 막지 않는지 확인한다.

<!-- v667-operations-current-pass -->

# 운영 체크리스트 — 현재 기준

기준: `v665` / `6.65.0` / `rebuild-v665`

## 직접 Node 실행 사전 점검

1. `npm ci --omit=dev`
2. `node server.js --check-config`
3. 표시된 library/data 경로와 bind host/port 확인
4. `node server.js` 또는 `npm start`
5. `/healthz`, 로그인, 서재, Reader, 수동 표지 업로드 확인

`--check-config` 출력에는 session secret·password·token을 포함하지 않는다.

<!-- v665-operations-current-pass -->

# v664 운영 점검

- 서재 작품 열기에서 저장 위치가 있을 때 제목이 포함된 이어보기 선택창 표시
- 처음부터·이어보기 버튼이 각 위치로 이동
- 카드형→탐색기형 전환 후 최근·즐겨찾기 유지

<!-- v664-operations-current-pass -->

기준 버전: rebuild-v664


기준 버전: rebuild-v663

<!-- v663-operations-current-pass -->
# v661 운영 체크

1. 같은 파일 경로에 변경 요청을 집중시켜 queue full과 wait timeout이 `503` 및 `Retry-After`로 반환되는지 확인한다.
2. 요청 연결을 끊었을 때 대기 중인 파일 작업이 `FILEOPS_REQUEST_ABORTED`로 제거되는지 확인한다.
3. mutation journal 저장 실패를 유도해 `recoveryRequired`와 `fileOperationApplied`가 실제 상태와 일치하는지 확인한다.
4. metadata enqueue 직후 재시작해 durable queue에 작업이 남는지 확인한다.
5. 관리자 정리 후보 화면의 자동 갱신이 lightweight status API를 사용하고 전체 plan을 반복 생성하지 않는지 확인한다.
6. 독서 데이터가 많은 계정에서 modal이 80개씩 추가 렌더링되는지 확인한다.
7. 로그인 부하 중 event-loop 지연과 `accounts.json.login-telemetry.json` 저장 오류를 관찰한다.

<!-- v661-operations-pass -->

기준 버전: rebuild-v663

기준 버전: rebuild-v655

# v649 운영 체크

- data 디렉터리를 읽기 전용 또는 sidecar 경로 충돌 상태로 만든 뒤 삭제 요청이 503으로 실패하고 원본 파일이 남는지 확인한다.
- 128개를 초과하는 대량 삭제 후 catalog commit 전 재시작해 모든 삭제 항목이 계속 숨겨지는지 확인한다.
- 동일 본문 파일 1,000개 이상에서 grouping time·heap·alias count를 확인한다.
- Owner 권한 picker와 중복검사를 360px, 620px, 900px, 1180px에서 점검한다.
- release verifier timeout 뒤 `txt-reader-current-verify-*` 임시 디렉터리와 child process가 남지 않는지 확인한다.

<!-- v649-operations-pass -->

# v648 metadata 수동 수정 운영 체크

1. Provider 후보를 적용한 뒤 `work-metadata.json.gz`의 mtime/hash를 기록한다.
2. 수동 metadata를 수정하고 main hash가 유지되는지, `work-metadata-applied.json.gz`만 갱신되는지 확인한다.
3. 브라우저 네트워크에서 metadata 저장 뒤 전체 `/api/novels/shelf` cursor 연쇄 요청이 없는지 확인한다.
4. `metadataStore.appliedShardRepairNeeded`가 true면 main/shard revision을 확인하고 다음 안전한 applied write 또는 재시작 repair를 수행한다.

<!-- v648-operations-metadata-fast-path-pass -->

# v648 운영 체크

- 삭제·이동·이름 변경 직후 `library-catalog-cache.json.gz.state.json`의 generation과 tombstone이 기록되는지 확인한다.
- 새 catalog 저장 전 서버를 재시작해도 삭제된 작품이 다시 나타나지 않는지 확인한다.
- `library_warming`, `library_busy` 응답에 `Retry-After`가 있고 프록시가 이를 제거하지 않는지 확인한다.
- state sidecar write 실패와 catalog gzip write 실패를 별도로 진단하고, 실패 시 마지막 정상 목록이 유지되는지 확인한다.

<!-- v648-operations-catalog-mutation-pass -->

# v646 서재 장애 운영 확인

- `data/library-catalog-cache.json.gz`와 `.bak`이 생성되고 재시작 후 마지막 정상 목록이 먼저 표시되는지 확인한다.
- SMB를 일시 차단했을 때 요청마다 전체 scan이 반복되지 않고 `coldFailureBackoffUntil`이 증가하는지 Owner 진단에서 확인한다.
- metadata gzip을 삭제하거나 평문으로 되돌리지 않는다. 압축률보다 revision 무효화·retry storm·catalog 복구 상태를 먼저 확인한다.

<!-- v646-library-stability-operations-pass -->

# v646 운영 체크리스트

1. cold start에서 여러 client가 동시에 진입해도 실제 catalog build가 1개인지 확인한다.
2. 4초를 넘는 cold build는 `503 library_warming`과 `Retry-After`를 반환하고 background build가 계속 완료되는지 확인한다.
3. metadata 후보 수집 중 applied metadata가 바뀌지 않았다면 shelf cache가 반복 재생성되지 않는지 확인한다.
4. fingerprint verification만 수행될 때 presentation revision과 shelf cache key가 유지되는지 확인한다.
5. queue 초과 시 `library_shelf_busy`가 반환되고 CPU/RSS가 무제한 증가하지 않는지 확인한다.
6. client refresh 실패 후 기존 목록이 유지되는지 확인한다.
7. metadata gzip primary/backup과 압축률이 유지되고 backup이 손상 primary로 교체되지 않는지 확인한다.

실제 Docker·8만 파일 HDD/SMB·동시 metadata 수집을 실행하지 못하면 환경 차단으로 기록한다.

<!-- v646-operations-pass -->

# v645 운영 체크리스트

1. 320~700px viewport에서 `전체`·`최근`·`즐겨찾기`가 가로로 표시되는지 확인한다.
2. Reader를 스크롤해도 공용 맨 위 이동 버튼이 나타나지 않는지 확인한다.
3. 온라인 상태 badge가 cache 준비 상태 때문에 덮어쓰이지 않는지 확인한다.
4. 본문 검색 modal이 스타일과 safe area를 유지하고 버튼·Enter·이전/다음 이동이 동작하는지 확인한다.
5. cache-only와 서버 전체 검색의 badge·결과 source가 구분되는지 확인한다.

Android, actual network profile, Docker를 실행하지 못하면 환경 차단으로 기록한다.

<!-- v645-operations-pass -->

# v644 운영 체크리스트

## v644 운영 체크리스트

1. 모바일 360px, 412px, 700px에서 제목과 검색창이 전체 폭을 사용하는지 확인한다.
2. 진입 후 스크롤하지 않고 `/api/novels/shelf` 요청이 1회인지 확인한다.
3. 한 번의 짧은 스크롤에서 같은 activity로 page 요청이 연쇄되지 않는지 확인한다.
4. 제한 사용자에서 shelf가 전체 accessible ID 응답을 기다리지 않는지 확인한다.
5. `LIBRARY_FINGERPRINT_ENTRY_DELAY_MS` 이전에 fingerprint queue·bytesRead가 진입 때문에 증가하지 않는지 확인한다.
6. 실제 HDD/SMB에서 CPU, fan, disk queue를 기록한다.

Android, Docker, SMB를 실행하지 못하면 환경 차단으로 분리한다.

<!-- v644-operations-pass -->

## v643 운영 체크리스트

1. Owner 언어를 한국어/비한국어로 전환해 provider 카드와 수집 버튼의 표시·차단을 확인한다.
2. 사용자 생성/수정 및 가입코드의 접근 mode 세그먼트와 폴더 picker를 desktop, 760px, 520px viewport에서 확인한다.
3. 중복 정리 preview에서 후보 없음, fingerprint 계산 중, 제외 사유가 각각 표시되는지 확인한다.
4. 라이브러리 정리는 먼저 **복사** mode와 별도 destination으로 dry-run하고, plan hash·경로 sample·collision suffix를 검토한다.
5. PowerShell에 `-Apply`를 추가하기 전에 source/destination이 중첩되지 않는지, destination 용량이 충분한지 확인한다.
6. provider 설정 저장 후 재기동하여 enabled/priority/threshold/interval/search limit가 유지되는지 확인한다.

PowerShell, SMB, Docker, Playwright 또는 외부 provider가 없는 환경의 결과는 `환경 차단`으로 기록한다.

<!-- v643-operations-pass -->


1. Owner 메타데이터 저장소에서 압축률과 legacy bytes를 확인한다.
2. 후보 정리는 preview 결과와 applied 보호 수를 확인한 뒤 실행한다.
3. 작품 묶음 화면에서 의심 후보, 다른 판본, 대표 선정 이유를 검토한다.
4. 자동 격리 script는 dry-run 후 중복본·이전본만 적용한다.
5. 대규모 서재에서는 fingerprint queue와 bytesRead가 지속적으로 증가하되 서버 I/O를 압도하지 않는지 관찰한다.

<!-- v642-operations-pass -->

# v638 운영 체크리스트

## v641 배포 전 필수 확인

1. `node tools/predeploy_environment_gate.js`
2. `node tools/dependency_audit_gate.js`
3. `node tools/run_smoke_tests.js --quick`
4. 가능한 환경에서 `RUN_LIVE_PROVIDER_CHECKS=1 node tools/checks/metadata-ssn-live-contract-v641.js`
5. Owner 권한 picker, 폴더 보기 최근·즐겨찾기 토글, 카드 태그 버튼, 맨 위 이동 버튼, 확장 자동 캡처 확인

환경 gate의 blocked 항목은 성공으로 간주하지 않는다.

<!-- v641-current-doc-pass -->

## v639 배포 전 전수 감사

- 로그인 전 전역 자산, 동일 metadata 묶음 표지, 서버 필드 무결성, HTTPS 출처 URL, 중첩 scroll-to-top을 수정했다.
- 상세 근거와 미실행 위험은 `docs/audit-resolution.md`를 기준으로 한다.
- 당시 package version은 `6.39.0`, runtime marker는 `rebuild-v639`였다.
<!-- v638-current-summary -->

## v638 배포 직후

- 로그인→서재→로그아웃→로그인 순환 확인
- background/deferred 탭이 있는 상태의 업데이트 확인
- Service Worker client-state cache가 navigation 반복 후 bounded인지 확인
- 동일 작품의 여러 provider 후보가 한 묶음으로 표시되고 provenance가 남는지 확인
- 묶음 적용·삭제 후 metadata store flush 상태와 audit log 확인
- nested scroll 화면의 맨 위 이동 버튼 확인

<!-- /v638-current-summary -->


기준 버전: `rebuild-v641`

## 업데이트/PWA

- `/healthz`, HTML badge, `X-TXT-Reader-Build`, `/sw-rebuild-v641.js`가 모두 `rebuild-v641`인지 확인한다.
- 여러 탭에서 한 탭만 update apply하고 다른 탭은 독서 상태 저장 후 deferred를 선택해 stale executable이 409인지 확인한다.
- Service Worker process를 종료·재시작한 뒤 deferred tab이 current로 오인되지 않는지 확인한다.
- CDN의 stale HTML/entry URL을 재현할 수 있으면 old/future JS 요청이 current JS 200이 아니라 409인지 확인한다.
- reload loop가 없고 페이지당 controllerchange reload가 한 번인지 확인한다.

## 표지

- `METADATA_COVER_DIR`에서 `.pending-cover-leases.json` write/fsync/rename/directory fsync가 가능한지 확인한다.
- 업로드 직후 재시작, 손상 sidecar, quota 초과, flush 실패를 주입해 참조되지 않은 asset lease가 즉시 해제되지 않는지 확인한다.
- 존재하지 않는 ID, 비 SHA-256 ID, symlink, MIME/signature 위조, 외부 URL이 거절되는지 확인한다.
- durable applied metadata의 asset ID와 canonical URL이 일치한 뒤 lease가 제거되는지 확인한다.

## Reader·데이터

- update 직전 진행도 flush, 다른 탭 충돌, bookmark/search/fileChar 복원을 확인한다.
- SMB disconnect와 source 변경 중 scan에서 마지막 정상 snapshot과 realpath 경계가 유지되는지 확인한다.

실환경 차단 항목은 성공으로 기록하지 않고 Playwright Chromium, Docker/Podman, Samsung Internet, Cloudflare edge, provider 계정, SMB 장시간, arm64 QEMU로 구분한다.

<!-- v637-operations-pass -->

# v606 운영 체크

- `/healthz` build가 `rebuild-v613`인지 확인한다.
- data volume을 read-only로 잘못 마운트하지 않았는지 login/logout durable smoke로 확인한다.
- 종료 로그에서 content worker termination failure와 session final flush failure가 없는지 확인한다.
- 제한 계정으로 표지 다량 로드 시 다른 폴더의 자산이 노출되지 않는지 확인한다.

## v605 배포 전 운영 확인

- 서버 종료 중 세션·사용자 상태·메타데이터 큐 저장을 실패시키면 프로세스가 정상 성공으로 종료하지 않는지 확인한다.
- 사용자 상태 복원·초기화 API가 durable write 전에 성공 응답을 반환하지 않는지 확인한다.
- 사용자 삭제의 계정 저장 실패를 유도했을 때 기존 독서 상태가 snapshot으로 복구되는지 확인한다.
- TXT 이동·삭제 중 cache build가 진행 중이면 worker abort 후 이전 cache가 다시 나타나지 않는지 확인한다.
- 회원가입·비밀번호 변경 중 다른 API 요청의 event-loop 지연이 과도하게 증가하지 않는지 확인한다.
- 고유 태그 수천 개에서 필터 DOM이 180개 window를 넘지 않고 검색·다음 태그가 동작하는지 확인한다.
- `/healthz`와 `X-TXT-Reader-Build`, owner/metadata badge가 모두 `rebuild-v605`/`v605`인지 확인한다.

기준 버전: `rebuild-v605`

## v601 서재 태그 운영 확인

- 필터 panel과 옵션 목록 scrollbar가 테마형 thin 스타일인지 확인한다.
- 자동 모드 설명에 전체 태그 수·평균 빈도·숨김 수가 표시되는지 확인한다.
- 희소한 사용자 태그와 현재 선택된 태그가 자동 모드에서도 유지되는지 확인한다.
- `/api/novels/shelf/filters`의 `tagDistribution.histogram` 합이 `distinct`와 일치하는지 확인한다.
- 수천 권 서재에서 facet 재계산 시 작품별 파생이 한 번만 수행되고 응답 cache가 사용자·ACL·태그 상태별로 분리되는지 확인한다.
- release dry-run에서 manifest diff 문서 계획이 `ReferenceError` 없이 생성되는지 확인한다.

## v600 서재·태그·pacing 확인

- [ ] 폴더 트리와 윈도우형에서 최근 항목·즐겨찾기가 한 패널에서 탭으로 전환된다.
- [ ] 서재 상단 태그 관리에서 태그를 생성·삭제할 수 있다.
- [ ] 작품 메뉴의 사용자 태그에서 태그를 적용하고 카드·검색·필터에 즉시 반영된다.
- [ ] 다른 사용자 계정에 태그가 노출되지 않는다.
- [ ] owner 메타데이터 provider 카드가 `같은 공급자 수집 완료 후 4.5~6.0초 · 기준 3.0초`를 표시한다.
- [ ] `.env`에 구형 `METADATA_REQUEST_INTERVAL_MS=1200`이 남아 있어도 `/api/admin/metadata/providers`의 범위가 4500~6000ms다.

## v595 배포 후 초기 로드 확인

- `/library.html` 첫 진입에서 영어 언어팩과 사용자 언어 편집기 모듈이 요청되지 않는지 확인한다.
- 사이트 언어를 English로 바꾸면 `site-language-en.mjs`가 한 번 로드되고 즉시 UI가 재적용되는지 확인한다.
- 권한 변경이 없는 일반 진입에서 reader cache maintenance 모듈이 요청되지 않는지 확인한다.

<!-- v595-initial-load-operations-pass -->

## v594 UX 배포 점검

- 비로그인 `/scripts/theme-boot.js?v=rebuild-v594`가 200 JavaScript로 응답하는지 확인한다.
- `/metadata.html` badge는 `v594`, `/healthz` build는 `rebuild-v594`여야 한다.
- 모바일 metadata header에는 중복 전체 수집 버튼이 없어야 하며, 새로고침·서재·로그아웃은 overflow menu에서 제공한다.
- owner console의 로그아웃이 실제 세션을 종료하는지 확인한다.

<!-- v594-operations-ux-pass -->

## v578 메타데이터 전체 수집·다크 테마 운영 확인

- [ ] 다크 앰버 프리셋에서 `/library.html`과 `/metadata.html`의 배경/카드가 과도한 단색 검정·갈색 블록처럼 보이지 않는다.
- [ ] 로그인·서재·리더·메타데이터 사이 이동 시 흰색 초기 페인트가 보이지 않는다.
- [ ] `/metadata.html` 상단 `전체 미수집 수집` 버튼이 보이며, 실행 전 전체 대상 확인 문구가 표시된다.
- [ ] 전체 수집은 하나의 `collect-bulk` 작업으로 표시되고 처리/성공/실패/후보 없음 카운터가 증가한다.
- [ ] 취소 후 `data/metadata-batches/mb_*.jsonl` 파일이 제거된다.
- [ ] 네이버 실패 시 다음 활성 공급자 시도가 작업 기록에 남는다.
- [ ] 기본 `METADATA_REQUEST_INTERVAL_MS=3000`에서 같은 공급자의 다음 작품 수집이 이전 작품 수집 완료 후 4.5~6.0초 뒤 시작한다.
- [ ] A 공급자의 쿨타임 중에도 B 공급자의 첫 작품 수집은 B 자체 상태만 확인하고 시작한다.
- [ ] 실제 대량 실행 전 Playwright 프로필 또는 Helper 상태, priority, 활성화와 서비스 정책을 확인한다.

## v577 서재·메타데이터 화면 운영 확인

- [ ] 로그인 후 `/library.html`이 카드형으로 열리고, `?view=files`일 때만 트리로 직접 진입한다.
- [ ] 카드형/폴더 트리 버튼이 PC·모바일에서 모두 보이고 상태가 즉시 전환된다.
- [ ] `/metadata.html`에서 작품 pagination, 후보 적용, 작업 취소, 공급자 설정 권한이 계정에 맞게 표시된다.
- [ ] 설정 모달에서 언어 편집·비밀번호·테마·폰트 등 하위 모달이 항상 위에 표시되고 닫은 뒤 focus가 복원된다.
- [ ] reverse proxy가 `library.html`과 `metadata.html`의 no-store를 장기 캐시로 덮어쓰지 않는다.

## v584 웹 메타데이터 인증 운영 확인

- [ ] `METADATA_FETCH_ENABLED`와 `METADATA_PLAYWRIGHT_ENABLED` 정책을 확인했다.
- [ ] Docker 재빌드 뒤 Chromium 실행과 `/app/data/metadata-browser-profiles` 쓰기 권한을 확인했다.
- [ ] 공급자 ID·비밀번호를 `.env`, 로그, JSON, release ZIP에 저장하지 않는다.
- [ ] owner만 서버 브라우저 로그인·프로필 삭제를 수행할 수 있다.
- [ ] `data` 백업에 Playwright 프로필을 포함할 경우 암호화·접근권한 정책을 적용한다.
- [ ] Helper manifest에 `cookies` 권한이 없는지 확인한다.
- [ ] 공급자별 수집 완료 후 쿨타임과 큐 동시성을 낮게 유지한다.
- [ ] 자동 검색 후보의 제목·작가·출처를 검토한 뒤 적용한다.
- [ ] 표지 API가 제한 사용자의 허용 작품 외 asset을 404로 반환하는지 확인한다.
- [ ] 공급자 parser 실패가 기존 적용 결과를 지우지 않는지 확인한다.
- [ ] 실제 서비스 약관·robots·개인 사용 범위를 운영자가 확인했다.

## v575 서재 탐색 및 필터 운영 확인

- [ ] 리더에서 목록을 열면 현재 작품 카드가 화면 중앙 부근에 표시된다.
- [ ] 파일 탐색 탭으로 바꾸면 현재 작품 폴더가 펼쳐지고 현재 작품·회차 행이 표시된다.
- [ ] 필터를 여러 개 적용했을 때 같은 항목은 OR, 다른 항목은 AND로 동작한다.
- [ ] 8만 파일 환경에서 `/api/novels/tree` 응답에 회차 배열이 포함되지 않는다.
- [ ] 최종 `package-manifest-v575.json`이 clean extract 파일 집합·bytes·SHA-256과 일치한다.

## v574 서재·리더 분리 및 묶음 표시 확인

- [ ] 로그인 후 기본 진입이 `/library.html`이고 리더 본문 DOM이 화면에 표시되지 않는다.
- [ ] 작품 카드를 선택하면 기기 프로필에 따라 `/site.html?novelId=...` 또는 `/mobile.html?novelId=...`로 전체 페이지 이동한다.
- [ ] 리더 상단의 서재 복귀 버튼이 `/library.html`로 이동한다.
- [ ] `작품명 1화/2화`와 `작품명 001/002/003` fixture가 각각 하나의 다중 회차 카드로 표시되고, 합본 범위 파일은 묶이지 않는다.
- [ ] 중복·이전 판본 카드는 대표 판본 하나만 표시하며 `중복·이전 판본 N개 묶음` 안내가 보인다.
- [ ] 원본 `/api/novels`와 파일 탐색에서는 묶인 실제 파일이 모두 유지된다.
- [ ] 가상 회차 그룹 전체의 이동·이름 변경·삭제가 차단되고 개별 회차 파일 작업만 허용된다.
- [ ] final ZIP의 `package-manifest-v574.json`은 manifest 자신을 제외한 모든 파일의 bytes/SHA-256과 일치한다.

## v573 배포 전 추가 확인

- [ ] 하위 SMB 폴더를 잠시 분리해도 기존 서재 snapshot이 유지되고 owner 진단의 refresh error가 남는다.
- [ ] 재연결 후 다음 signature/refresh에서 정상 서재가 갱신된다.
- [ ] `data/normalized_content` v572 cache는 최초 접근 시 v573 index로 재생성되며 시작 시 전수 변환하지 않는다.
- [ ] warm 대형 작품 요청 중 Node event-loop가 전체 cache hash 때문에 장시간 정지하지 않는다.
- [ ] `/app/data`가 UID 1000 owner-write 또는 GID 0 group-write이며 entrypoint write probe를 통과한다.
- [ ] `npm run release:verify -- <zip> --with-server`가 manifest content와 dependency-sensitive smoke를 모두 실행한다.

## v570 normalized content cache 운영 확인

- [ ] `./data/normalized_content`를 포함한 `/app/data`가 UID 1000 또는 GID 0에 쓰기 가능하다.
- [ ] `CONTENT_DISK_CACHE_MIN_BYTES` 기본 1048576이 운영 RAM·disk 정책에 맞다.
- [ ] 첫 대형 작품 접근 후 `.text`, `.index.json`, `.meta.json`이 생성되고 재접근 시 worker build가 반복되지 않는다.
- [ ] disk 부족/SMB 단절 시 민감한 실제 경로가 HTTP 오류에 노출되지 않는다.
- [ ] 롤백 전 앱을 중지하며, 필요 시 `data/normalized_content`만 별도로 삭제한다.

## v572 streaming cold-build 운영 확인

- cold 대형 파일 접근 뒤 owner diagnostics의 `normalizedCacheStreamingBuilds`가 증가하는지 확인한다.
- `data/normalized_content`에 오래 지속되는 `*.line.tmp`가 없는지 확인한다. 처리 중에는 정상이며 완료/실패 뒤 제거되어야 한다.
- 실제 SMB에서 20/50MiB 파일 첫 열기 RSS·응답 시간을 기록하고 로컬 합성 수치를 운영 보장으로 사용하지 않는다.
- advanced dialogue/paragraph 옵션과 비정상적으로 긴 단일 문단을 함께 쓰는 경우 worker RSS를 별도 관찰한다.

# Operations checklist

기준 버전: rebuild-v605

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
12. 실제 SMB/외장 HDD에서는 owner 진단에서 signature 검사 시간과 effective TTL을 확인하고, 변경 후 `lastBuildMs`가 API 사용을 방해하지 않는지 확인한다.
13. `CONTENT_WORKER_POOL_SIZE=1`, `CONTENT_WORKER_QUEUE_MAX=8` 기본값을 실제 RSS 측정 없이 올리지 않는다.

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
6. 가입 후 일반 user가 `/library.html`로 로그인되고, 작품 선택 시 독립 리더 페이지로 이동하는지 확인한다.
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

활성 통합 sync 파일은 `data/sync_data.json`이며 data volume 백업 대상이다. 기존 루트 `sync_data.json(.bak)`은 v591 최초 이관 확인 전까지 보관한다.

최종 ZIP은 다음을 포함하지 않아야 한다.

`package-lock.json`은 일반 파일로 반드시 포함하고, 아래 런타임·비밀·캐시 항목만 제외한다.

- `node_modules`
- `data`
- `sync_data.json`
- `sync_data.json.bak`
- `test_novels`
- `.npm-cache`

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


## v590 정적 자산·컨테이너 버전 확인

```bash
docker compose up -d --build --force-recreate txt_reader
curl -sS http://127.0.0.1:3000/healthz
curl -sSI http://127.0.0.1:3000/metadata.html | grep -i 'x-txt-reader-build\|cache-control'
```

`/healthz`의 `build`와 `X-TXT-Reader-Build`는 `rebuild-v605`이어야 하며 메타데이터 화면 제목 옆에는 `v605`이 표시되어야 한다. 이전 Cookie UI 또는 1.8~2.4초 요청 간격이 보이면 이전 이미지·환경값·정적 자산을 제공하고 있는 상태다. v604는 3000ms 미만의 구형 기준값을 3000ms로 보정한다.



## v592 종료·파일 조작 확인

- 종료 로그 이후 active metadata 수집 handler가 남지 않고 queue/store 상태가 최종 저장되는지 확인한다.
- SMB 라이브러리의 rename/move/delete는 async 직렬 mutation queue를 사용한다. 대형 폴더 이동 전에 전체 재귀 scan을 수행하지 않는다.
- service worker static cache는 동일 path의 query 변형을 별도 entry로 누적하지 않으며 최대 512개로 제한된다.

<!-- v592-deployment-lifecycle-check-pass -->

## v593 metadata·로그아웃·종료 점검

- metadata 권한 없는 계정에서 서재 metadata 링크와 작품 action이 보이지 않고 `/metadata.html`은 403인지 확인한다.
- 서재와 metadata 페이지의 로그아웃 버튼이 세션을 종료하고 로그인 화면으로 이동하는지 확인한다.
- 서재 로그아웃 직전 읽던 위치가 다시 로그인한 뒤 복원되는지 확인한다.
- 5개 공급자 profile login/재로그인/삭제가 owner 콘솔에서 동작하는지 확인한다.
- 수집 중 SIGTERM에서 active request drain 후 queue/profile/audit persistence가 완료되는지 확인한다.

<!-- v593-operations-provider-logout-pass -->
## v640 배포 후 확인

- Owner 메타데이터 설정에서 소설넷이 priority 5, 공개 검색 전용으로 표시되는지 확인한다.
- 소설넷 검색 1건을 실행해 검색 결과와 상세 metadata가 수집되는지 확인한다.
- 사용자 생성·수정 tab의 folder picker가 page horizontal overflow 없이 표시되는지 확인한다.
- Playwright 로그인 modal을 desktop/mobile에서 열어 browser pane과 controls가 겹치지 않는지 확인한다.

<!-- v640-operations-check-pass -->

## v648 설정·본문 검색 확인

- 설정 화면을 열 때 `getLibraryCurrentWindowRows is not defined` toast가 발생하지 않는지 확인한다.
- 모바일 Reader 검색을 열었을 때 빈 상태 panel이 viewport 대부분을 점유하지 않는지 확인한다.
- 사용자 정의 dark 색상에서 결과 영역이 흰색으로 분리되지 않는지 확인한다.
- 실제 브라우저 검증을 하지 않았다면 환경 차단으로 기록한다.

<!-- v648-operations-checklist-pass -->
## v675 운영 확인

progress journal entry/byte와 replay error, metadata candidate/index count, prefetch timeout count를 진단에서 확인한다. 프록시 배포는 실제 proxy/container subnet만 `TRUSTED_PROXY_CIDRS`에 넣고 origin WAN 접근을 방화벽에서 차단한다. 배포 전 library entry에 Reader skeleton이 없는지 확인한다.

<!-- v675-operations-current-pass -->
## v676 운영 확인

- 세 Compose 파일을 YAML parser로 검사하고 `TRUSTED_PROXY_CIDRS`가 `- KEY=value` 목록인지 확인한다.
- origin firewall과 실제 proxy source CIDR을 확인하고 기본 loopback 신뢰를 운영 CIDR로 명시적으로 확장한다.
- candidate 20k cap, per-work cap, applied 보호와 shard rewrite 상태를 진단한다.
- extension shortcut은 브라우저 확장 단축키 화면에서 충돌 여부를 확인한다.
- Metadata folder filter와 apply 후 load-more 위치를 실제 2페이지 이상에서 확인한다.

<!-- v676-operations-current-pass -->
