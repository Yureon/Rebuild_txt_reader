# current 작품 유사도 묶음·메타데이터 저장소

기준 package는 `6.42.0`, runtime marker는 `rebuild-current`다.

<!-- v666-library-similarity-metadata-storage-doc-pass -->

## 작품 동일성 판정

단일 TXT 파일은 제목 25%, 작가 15%, 소개글 20%, 본문 시작 sample 30%, 본문 중간 sample 5%, 회차 범위 5%를 가용 신호 기준으로 재가중한다.

- 0.92 이상이고 본문 또는 metadata 근거가 강하면 자동 묶음한다.
- 0.82 이상 또는 본문 MinHash가 강하지만 제목 근거가 부족하면 `suspected-match`로 남긴다.
- 양쪽 작가가 명시됐고 서로 다르면 자동 묶지 않는다.
- 묶음은 complete-link 방식으로 구성해 구성원 모든 쌍이 자동 기준을 통과해야 한다.
- 관계는 `duplicate-copy`, `superseded`, `alternate-edition`, `suspected-match`로 구분한다.

## 본문 fingerprint

- 파일 전체를 읽지 않는다. 시작부 최대 128KiB와 약 25% 지점 최대 128KiB만 읽는다.
- BOM, 개행, 공백, URL, 배포·광고성 머리말을 정규화한다.
- SHA-256 exact hash와 문자 4-gram MinHash sketch를 함께 저장한다.
- 화면 갱신마다 기본 64개 파일만 회전식 저우선순위 queue에 넣는다.
- fingerprint cache는 경로·크기·mtime·normalization version으로 무효화한다.
- cache primary는 `library-content-fingerprints.json.gz`, backup은 `.gz.bak`이며 legacy JSON은 성공적인 gzip 저장 후 제거한다.

## 대표 파일

수동 고정, 회차 끝, 완결, 파일 크기, metadata 완성도, decode 오류율, 복사본 suffix, 수정 시각 순으로 품질 점수를 계산한다. 수정 시각은 최종 tie-breaker에만 사용한다. 모든 member ID를 `progressAliases`로 유지해 대표가 바뀌어도 진행도·북마크·최근 항목의 이전 ID를 복원할 수 있게 한다.

Owner의 작품 묶음 화면에서 대표를 직접 지정하거나 자동 선정으로 되돌릴 수 있고, 두 파일의 자동 묶음을 제외하거나 다시 허용할 수 있다. 자동 격리 script는 중복본과 이전본만 대상으로 하며 다른 판본과 의심 후보는 이동하지 않는다.

## 메타데이터 저장소

후보·적용 metadata·provider 설정은 `work-metadata.json.gz`에 gzip level 6으로 저장한다.

- unique temp 작성 → 파일 fsync → 유효 primary backup → atomic rename → directory fsync 순서다.
- 기존 `work-metadata.json`과 backup은 읽을 수 있으며 첫 압축 저장 성공 후 durable remove한다.
- primary 손상 시 `.gz.bak`을 읽고 다음 flush에서 primary를 복구한다.
- Owner API와 UI는 logical/compressed/backup/legacy/total bytes와 압축률을 표시한다.

## 후보 일괄 정리

Owner는 반드시 preview를 먼저 실행한다. 기본 정책은 다음과 같다.

- applied `candidateId`와 `coverCandidateId`는 항상 보호한다.
- 현재 서재에서 사라진 작품 후보는 기본 7일 후 orphan 정리 대상이다.
- 활성 작품의 오래된 미적용 후보는 기본 30일 이후 작품당 5개, provider당 1개를 남긴다.
- 실행은 serialized durable mutation 한 번과 gzip flush 한 번으로 처리한다.
- 저장 실패 시 삭제 전 후보를 메모리에 복원한다.
- 삭제된 후보의 cover는 즉시 지우지 않고 기존 cover orphan janitor가 최소 보존 기간 후 정리한다.

API:

- `GET /api/metadata/storage`
- `POST /api/metadata/storage/cleanup/preview`
- `POST /api/metadata/storage/cleanup`
- `POST /api/metadata/storage/rewrite`

모두 Owner 전용이며 write route는 same-origin, CSRF, rate limit을 적용한다.


<!-- v665-library-metadata-grouping-pass -->
