# v606 content worker 종료 계약

서버 종료 시 queued/running content build는 취소되고 worker terminate 완료를 기다린다. worker 종료 실패는 shutdown failure로 전파하며, reader fileChar·normalized range-read 형식은 변경하지 않는다. 기준 marker는 `rebuild-v613`이다.

기준 버전: `rebuild-v605`

# v573 대용량 정규화 본문 캐시 설계

기준 버전: `rebuild-v594`

## 목적

대형 TXT의 cold build는 v571의 streaming decode/normalize/write 구조를 사용하고, warm request는 전체 정규화 본문을 메모리 또는 Node 메인 이벤트 루프에 다시 올리지 않는다. 리더의 `fileChar`는 JavaScript UTF-16 code unit 좌표이며 변경하지 않는다.

## 저장 형식

`data/normalized_content/` 아래에 cache key별로 다음 파일을 둔다.

- `<key>.text`: UTF-16LE 정규화 본문
- `<key>.index.json`: `fileChar` 청크 경계, 청크별 SHA-256, 정규화 통계
- `<key>.meta.json`: 캐시 identity와 완료 메타데이터

본문과 index는 임시 파일에 쓰고 `fsync`/close 후 rename하며, meta를 마지막에 확정한다. 임시 파일과 장문 `.line.tmp` spool은 `0600`, 무작위 suffix, cache-root containment를 사용한다.

## 캐시 identity와 마이그레이션

cache key에는 canonical 원본 경로 hash, 원본 stat signature, 전처리 옵션, chunk 크기, 정규화 버전과 chunk-index 버전이 포함된다.

- normalized cache schema: `2`
- normalization contract: `v572-normalization-contract-2`
- chunk index: `v573-filechar-chunk-index-2`
- chunk hash: `sha256-utf16le-v1`

chunk-index 버전이 변경됐으므로 v572 이하 normalized cache는 miss 처리된다. 서버 시작 시 8만 파일을 일괄 변환하지 않고 해당 파일 최초 접근 시 worker가 재생성한다. 롤백이 필요하면 앱을 중지한 뒤 `data/normalized_content`만 삭제할 수 있으며 계정·진행도·북마크에는 손대지 않는다.

## cold build

- 원본 앞부분 최대 64KiB를 반복형 exact read로 채워 인코딩을 판정한다.
- UTF-8/BOM, CP949, UTF-16LE/BE를 streaming decoder로 처리한다.
- legacy와 동일한 BOM → CRLF/CR → zero-width → tab/line 처리 순서를 유지한다.
- 정규화 본문, 전체 논리 SHA-1, format stats, chunk boundary와 청크별 UTF-16LE SHA-256을 점진 생성한다.
- 대형 worker는 전체 normalized text를 메인 프로세스에 반환하지 않는다.

## warm range read와 무결성

meta/index/regular-file/symlink/크기/경계/항목 상한은 진입 시 검증한다. 요청 경로에서는 `.text` 전체 SHA-1을 동기 계산하지 않는다. 요청된 청크의 정확한 UTF-16LE byte range만 반복 읽고 index의 청크 SHA-256과 비교한다.

불일치 시:

1. 해당 cache key를 invalid로 표시한다.
2. 같은 key의 메모리 entry를 제거한다.
3. 정규화 캐시 파일을 정리한다.
4. 같은 요청에서 worker rebuild를 한 번 수행한다.
5. 재검증도 실패하면 503 계열 오류를 반환하며 메인 스레드 전체 파일 fallback은 하지 않는다.

## 동시성·정리

- 동일 파일/옵션 cold miss는 process-local inflight 작업을 공유한다.
- `.text/.index/.meta`와 활성 `.tmp/.line.tmp`는 disk janitor 보호 대상이다.
- janitor는 후보 수집 시와 실제 unlink 직전에 사용 중 상태를 다시 확인한다.
- worker queue 상한, `503`/`Retry-After`, abort 계약은 유지한다.

## 보안 경계

- cache filename은 원본 경로나 사용자 입력이 아닌 SHA-256 key다.
- cache는 `public` 정적 root 밖에 있으며 URL로 직접 제공하지 않는다.
- API가 cache path/key를 입력으로 받지 않는다.
- 작품 ACL 검사를 통과한 content/block-manifest 경로만 cache를 읽는다.
- regular file, symlink 거부, root containment, JSON/index 크기와 chunk count 상한을 검증한다.

## 알려진 제한

- inflight coalescing은 단일 Node 프로세스 내부 범위다.
- `dialogueBreak`/`paragraphOptimize`가 활성화된 비정상 장문은 아직 line-buffered다.
- 실제 운영 SMB 단절, 디스크 부족, Docker 장시간 RSS와 다중 사용자 부하는 별도 운영 검증이 필요하다.


## v591 cache identity와 비동기 검증

source path authorization은 library route에서 먼저 수행한다. normalized cache key는 `path.resolve` source identity를 사용해 청크 요청마다 source filesystem `realpathSync`를 호출하지 않는다. 기존 cache가 symlink canonical path로 생성된 경우 새 key로 on-access 재생성될 수 있으며 본문 좌표·정규화 버전 계약은 변경되지 않는다. metadata/index/text regular-file 검증은 async chunk 경로에서 비동기로 수행한다.

<!-- v591-normalized-cache-async-validation-pass -->
