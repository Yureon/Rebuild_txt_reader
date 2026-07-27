# v682 저장 구조

저장 schema 변경은 없다. 수정 대상은 Owner 관리 페이지에서 생성하는 일회성 PowerShell 스크립트 본문이며 Metadata, 진행도, 북마크, normalized content와 사용자 state 파일 형식은 유지한다.

<!-- v682-storage-pass -->

# v681 Metadata 저장 구조

직접 입력 적용 결과는 기존 applied shard의 `providerId: manual`을 유지한다. 새 필터를 위해 별도 저장 파일, index migration 또는 SQL schema를 만들지 않는다.

<!-- v681-storage-pass -->

# v680 테마 저장 구조

공개 schema migration은 없다. 브라우저는 활성 사용자 식별자로 `txt-reader.rebuild.activeThemeScope`를 사용하고 prefs는 기존 `txt-reader.rebuild.scope.<normalized-user-id>.prefs`에 저장한다. 로그인 theme prime은 같은 scoped prefs 문서에 theme allowlist를 merge하며 다른 설정을 삭제하지 않는다. 서버 authoritative theme는 기존 사용자 state의 shared viewer prefs와 device prefs를 사용한다.

<!-- v680-storage-pass -->

# v679 저장 구조

저장 schema 변경은 없다. Metadata candidate/applied shard, provenance snapshot, progress journal과 normalized content cache 형식은 v677과 동일하다. 이번 릴리스는 정적 UI 자산과 cache namespace만 변경한다.

<!-- v679-storage-pass -->

# 저장 구조 — v676 current

기준 버전: `rebuild-v676`

# v674 저장 내구성·bounded 상태

- 공통 JSON/gzip 원자 저장은 temp write와 file sync, rename 뒤 parent directory sync를 수행한다. 플랫폼이 명시적으로 지원하지 않는 directory sync 오류만 capability 차이로 분류하며 `EIO`, `ENOSPC`, `EACCES`, `EROFS`는 성공으로 축소하지 않는다.
- library file operation은 durable pending journal 뒤 filesystem mutation을 적용하고, source/target의 영향받은 parent directory를 sync한 다음에만 journal을 committed로 전환한다. mutation 뒤 sync가 실패하면 pending을 유지하고 `operationApplied`·`recoveryRequired`로 재시작 복구 필요성을 알린다.
- `deviceProfiles`, `syncMeta.deviceUpdatedAt`, `syncMeta.deviceVersions`, policy device 목록은 current/preferred device를 보존하는 동일 bounded recent set으로 정리한다.
- Reader 브라우저 fallback snapshot은 기존 저장 형식을 읽되 사용자 scope별 bounded 표현만 다음 저장에 기록한다. 서버 JSON schema와 Reader `fileChar` 의미는 바뀌지 않는다.

별도 SQL migration은 없다. rename이 이미 적용된 뒤 directory sync가 실패한 경우 호출자는 성공으로 재시도하지 말고 pending journal과 실제 filesystem을 재조정해야 한다.

<!-- v674-storage-durability-bounded-state-pass -->

# v673 Metadata shard 저장

- applied metadata는 32개 `work-metadata-applied-shards/*.json.gz`와 revisioned manifest를 authoritative 저장으로 사용한다.
- legacy `work-metadata-applied.json.gz`는 non-empty 데이터가 있을 때만 lazy migration한다.
- revision 0에서 없는 candidate/applied shard는 빈 shard로 해석하며 첫 mutation에 대상 shard만 생성한다.
- write 시작 전에 dirty 대상 payload를 snapshot하고, 완료 시 dirty version이 같을 때만 clear한다.

<!-- v673-storage-applied-shard-pass -->

# v671 저장 구조

## Metadata candidate shard

- main `work-metadata.json.gz`는 provider settings, revisions와 candidate shard manifest를 저장한다.
- candidate payload는 32개 gzip shard primary/backup에 저장한다.
- shard를 먼저 commit하고 main manifest를 마지막에 commit한다. load는 committed manifest revision과 정확히 일치하는 primary 또는 backup만 사용한다.
- partial newer shard와 older manifest를 혼합하지 않으며 exact revision이 없으면 fail-closed한다.
- legacy monolithic candidate payload는 load 후 shard로 migration한다.

## Queue·journal·audit

- metadata enqueue는 durable snapshot 후 in-memory publish한다. 일반 상태 checkpoint는 coalesced async write다.
- library mutation state는 serial async atomic write가 성공한 뒤 memory generation/tombstone을 publish한다.
- audit log queue는 bounded이며 batch append한다. library/auth/admin 중요 mutation은 즉시 durable lane을 사용한다.

<!-- v671-storage-p0-p1-pass -->

# 저장 구조 — v666 비영향

자동완성 guard는 DOM attribute와 일시적 readonly 상태만 사용하며 사용자 입력·credential을 별도 storage, log, telemetry에 저장하지 않는다.

<!-- v666-storage-durability-pass -->

# 저장 구조 — v665 추가 사항

수동 표지 asset은 기존 content-addressed cover directory와 pending lease를 유지한다. BMP도 `<sha256>.bmp`로 저장되며 조회 시 전체 content hash와 signature를 재검증한다. Node 직접 실행은 Docker와 같은 data directory 계약을 사용한다.

<!-- v665-storage-durability-pass -->

# v664 저장 계약

이어보기 선택창은 기존 진행률 snapshot을 읽기만 하며 저장 형식, atomic write, backup, journal 계약을 변경하지 않는다.

<!-- v664-storage-durability-pass -->

# v663 자산 저장 내구성

metadata cover content-addressed 저장소와 사용자 font scope 저장소의 기존 atomic write·ACL 계약은 유지한다. v663은 response 전송 방식을 explicit stream으로 변경하며 저장 형식과 prune 계약은 바꾸지 않는다.

<!-- v663-storage-durability-pass -->

# v661 저장 내구성 변경

- 파일 mutation은 pending journal을 먼저 저장하고 filesystem 작업 후 commit 결과를 확인한다. commit/abort 저장 실패를 성공으로 축소하지 않는다.
- metadata queue는 enqueue snapshot을 원자 저장한 뒤 worker를 깨운다.
- 로그인 시각은 `accounts.json.login-telemetry.json` sidecar에 비동기 직렬화하며 시작 시 계정 본문과 병합한다.
- 정리 후보 plan은 메모리에서 짧게 cache하고 같은 generation 요청을 병합한다. TTL 만료·수동 새로고침 또는 대표·제외 설정 변경 시 무효화한다.

<!-- v661-storage-durability-pass -->

# v649 durable mutation journal

- `library-catalog-cache.json.gz.state.json(.bak)` schema 2는 pending token과 compacted completed tombstone을 구분한다.
- filesystem mutation 전에 pending token을 원자 저장한다. 저장 실패 시 파일 작업은 시작하지 않는다.
- 완료 mutation은 novel IDs, category paths, relative paths의 unique set으로 압축하며 임의 개수 제한을 두지 않는다.
- catalog commit 후 해당 generation까지 tombstone을 제거한다.

<!-- v649-storage-mutation-journal-pass -->

# v648 metadata applied shard

- `data/work-metadata.json.gz` / `.bak`: 후보, provider 설정, 호환용 applied snapshot.
- `data/work-metadata-applied.json.gz` / `.bak`: 현재 적용된 metadata의 작은 authoritative shard.
- applied-only mutation은 shard만 원자 저장해 대형 후보 store 재압축을 피한다.
- main과 shard의 applied revision을 비교해 최신 상태를 선택한다. combined mutation에서 main commit 뒤 shard 교체가 실패하면 main의 높은 revision을 사용하고 다음 mutation 또는 재시작 repair에서 shard를 치유한다.
- applied-only write 자체가 실패하면 메모리 mutation을 rollback하고 성공으로 기록하지 않는다.

<!-- v648-metadata-applied-shard-storage-pass -->

# v648 서재 catalog mutation 저장 구조

- `data/library-catalog-cache.json.gz` / `.bak`: 마지막 정상 catalog 본문과 catalog generation.
- `data/library-catalog-cache.json.gz.state.json` / `.bak`: library root hash, mutation/committed generation, 최대 128개 tombstone.
- 파일 mutation은 작은 state sidecar를 먼저 원자 저장하고 기존 catalog에서 대상 항목을 가린다.
- 새 catalog gzip 저장 성공 뒤에만 committed generation을 승격한다. state가 새롭고 catalog가 오래된 재시작에서도 tombstone을 적용한다.
- root hash 불일치, path traversal, 손상 state는 사용하지 않는다.

<!-- v648-storage-catalog-mutation-pass -->

# v646 library catalog durable cache

- `data/library-catalog-cache.json.gz` / `.bak`: 마지막 정상 서재 catalog, root identity, directory signature.
- 서버 재시작 시 동기 복구 후 즉시 stale snapshot을 제공하고 filesystem 검증은 비동기로 실행한다.
- temp write, fsync, trusted-primary backup, atomic rename, directory fsync 계약을 사용한다.
- source TXT 본문이나 normalized content를 복제하지 않으며 package에는 포함하지 않는다.

<!-- v646-library-catalog-storage-pass -->

# v646 압축 저장 write 안정화

metadata와 fingerprint gzip primary/backup 형식은 유지한다. 상태는 flush당 한 번만 JSON 직렬화하며 같은 immutable buffer를 gzip에 전달한다. 이전 primary는 마지막으로 신뢰한 compressed SHA-256과 현재 파일 SHA가 일치할 때 backup으로 복사한다. 불일치하면 backup을 교체하지 않고 전체 parse 검증 fallback을 사용한다.

후보·provider 설정 revision은 applied presentation revision과 별도로 저장한다. 이 migration은 기존 schemaVersion 1을 읽으며, 과거 global revision은 최초 로드 시 세 revision의 안전한 초기값으로 사용한다.

<!-- v646-storage-write-stability-pass -->

# v642 metadata·fingerprint 압축 저장

## v644 fingerprint request-path 분리

서재 HTTP presentation은 압축 fingerprint cache를 읽기 전용으로 조회한다. stale refresh와 신규 sample enqueue는 응답 경로 밖의 지연된 background scheduler가 담당한다. cache 형식과 primary/backup 내구성 계약은 v642와 동일하다.

<!-- v644-storage-fingerprint-scheduling-pass -->

## v643 저장 구조 추가

provider 직접 설정은 기존 `work-metadata.json.gz`의 `settings.providers`에 저장되며 gzip primary/backup, atomic rename, rollback 계약을 유지한다. 라이브러리 정리 plan과 PowerShell은 서버 상태에 저장하지 않고 요청 시 catalog·적용 metadata에서 결정적으로 생성한다. 스크립트 실행 결과만 destination root의 `txt-reader-library-organization-result.json`에 기록된다.

<!-- v643-storage-pass -->


`work-metadata.json.gz`와 `library-content-fingerprints.json.gz`는 temp `0600` → file fsync → valid-primary backup → atomic rename → directory fsync 순서를 따른다. legacy JSON은 새 primary commit 뒤 durable remove한다. backup 복구 시 다음 flush가 primary를 치유한다.

<!-- v642-compressed-storage-architecture-pass -->

# v606 저장·종료 보강

- session create/delete의 외부 성공 시점은 session store flush 완료 시점이다.
- durable delete 실패 시 삭제 전 exp·metadata·CSRF ring을 복원하고 dirty retry가 복구 상태를 저장한다.
- content entry worker pool close는 queued/running 요청을 거절하고 모든 worker terminate 결과를 기다린다.

기준 버전: `rebuild-v613`

# v605 상태 저장 경계

사용자 상태의 ACL 필터는 저장 이후 응답 가공이 아니라 durable mutation 이전에 실행된다. 제한 권한 요청에서 허용되지 않은 작품 ID, 태그 할당, progress map과 position key는 디스크에 기록되지 않는다. `syncVersion`과 `updatedAt`의 비유한 값·비안전 정수는 400으로 거절하며, 기존 상태 로드 시 잘못된 sync meta 숫자는 0으로 정규화한다.

## v604 복구·원자 저장 계약

### v604 backup 복구 계약

공통 JSON 저장은 임시 파일 `0600` 작성, 파일 `fsync`, 유효한 primary만 backup으로 교체, atomic rename, 디렉터리 `fsync` 순서를 따른다. primary가 손상됐고 backup이 유효하면 backup을 읽은 뒤 primary를 자동 치유한다. account, signup code, session, metadata queue/store/profile, font metadata, site language가 이 계약을 사용한다.

- JSON 파일 저장은 unique temp → file fsync → atomic rename → directory fsync 순서를 사용한다.
- session, sync state, user state, metadata queue, font metadata, site language는 pending write를 직렬화한다.
- user state 관리자 작업은 user ID별 queue에서 snapshot·restore·reset 순서를 보존한다.
- 사용자 shared/progress/device API 쓰기는 직렬화하며 durable flush가 실패하면 요청 전 메모리 상태로 rollback한 뒤 503을 반환한다.
- server shutdown은 모든 final flush 결과를 검사하고 `{ok:false}`, `false`, rejected result를 실패로 처리한다.
- 별도 DB migration은 없으며 기존 JSON/JSONL 형식과 normalize 호환성을 유지한다.

기준 버전: `rebuild-v605`

## v601 사용자 태그 이관·상태 안전성

- `shared.userTags`와 `shared.novelUserTags`는 기존 JSON 저장 형식을 유지한다.
- 독서 데이터 export/import/rollback에 두 필드를 포함하며 정의되지 않은 적용값과 위험한 record key는 정규화에서 제거한다.
- DB migration과 별도 저장소 migration은 없다.

기준 버전: `rebuild-v605`

## v600 사용자 상태 확장

`data/users/<user-id>/sync_data.json`의 `shared` 객체에 선택적 `userTags` 배열과 `novelUserTags` 객체를 저장한다. 기존 파일은 필드가 없으면 빈 배열·빈 객체로 정규화되므로 별도 migration이 필요 없다. 태그는 계정별 상태이며 library 원본 TXT나 metadata store를 수정하지 않는다.


# 저장소·런타임 구조

기준 버전: `rebuild-v605`

## 서버 런타임

- Node.js 20 계열
- Express 4 HTTP 서버
- Vanilla JavaScript ESM 프런트엔드
- `package.json`과 lockfile에는 Fastify 및 SQLite 의존성이 없다.

## 영속 저장소

TXT Reader Multi는 SQLite 데이터베이스를 사용하지 않는다. 운영 상태는 `data/` 아래의 JSON·JSONL 파일과 사용자별 디렉터리에 저장한다.

주요 예:

- 계정: `data/accounts.json`
- 세션: `data/sessions.json`
- 통합 sync 상태: `data/sync_data.json`
  - v590 이하의 루트 `sync_data.json` 또는 `.bak`은 새 파일이 없을 때만 읽고, 원본을 삭제하지 않은 채 data 경로로 저장한다.
- 가입코드: `data/signup-codes.json`
- 감사 로그: `data/audit-log.jsonl`
- 메타데이터 상태·배치: `data/metadata-*.json`, `data/metadata-batches/*.jsonl`
- 사용자 상태: `data/user-data/<user>/state.json`
- Playwright 프로필: `data/metadata-browser-profiles/`
- 정규화 본문·청크 캐시: `data/normalized_content/`, `data/chunk_indexes/`, `data/content_chunks/`

정확한 경로는 `server/config/paths.js`가 단일 기준이다.

## 스키마 변경 정책

SQL migration은 존재하지 않는다. 이전 JSON 문서는 서비스별 normalize 함수에서 기본값과 필드를 보정하며, 쓰기 시 현재 형식으로 원자적 교체한다. 변경 시 다음을 지킨다.

1. 기존 필드의 의미를 임의로 바꾸지 않는다.
2. 새 권한은 안전한 기본값으로 차단한다.
3. 임시 파일 작성 후 rename을 사용한다.
4. JSONL은 append-only 또는 bounded rewrite 정책을 명시한다.
5. 사용자별 상태와 owner 상태의 경계를 유지한다.

<!-- v590-storage-architecture-contract-pass -->

<!-- v662-storage-durability-pass -->
## Progress delta journal · v675

`<syncPath>.progress.ndjson`은 한 줄 한 operation의 append-only sidecar다. append handle sync가 끝난 뒤 state mutation을 공개한다. startup replay는 shared version으로 중복을 건너뛰며, compact는 full JSON durable write 완료 후 journal을 truncate한다. 손상 line은 경고와 replay error count로 격리한다.

<!-- v675-storage-progress-journal-pass -->
## v676 progress journal boundary

`<syncPath>.progress.ndjson`은 lexical 경로만 검사하지 않는다. data root의 realpath containment, 기존 sidecar `lstat`, `O_NOFOLLOW` open과 열린 handle `fstat`를 사용하며 생성 시 부모 directory를 sync한다. symlink·비정규 파일은 replay, append, truncate 모두 거부한다.

<!-- v676-storage-progress-journal-pass -->
