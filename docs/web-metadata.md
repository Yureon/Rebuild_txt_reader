# v681 Metadata 적용 출처 필터 계약

- 직접 입력 저장은 applied record의 `providerId: manual`을 사용한다.
- Metadata 작품 목록의 `적용 출처` 선택에는 `수동 입력 (직접 추가)`가 항상 포함된다.
- 선택 시 `/api/novels/shelf?metadataProvider=manual`을 사용하며, 상태·검색·폴더·cursor와 조합된다.
- 상세 화면의 적용 출처 표시는 `manual` 원문 대신 `수동 입력`으로 출력한다.
- 기존 applied/candidate shard와 migration은 변경하지 않는다.

<!-- v681-web-metadata-manual-filter-pass -->

# v680 Metadata 테마 계약

Metadata 독립 페이지는 `/api/theme-bootstrap`을 먼저 호출해 session kind와 user ID를 확인하고 해당 scope로 local state를 생성한다. server theme prefs를 merge한 뒤 page CSS variables, body dataset, theme-color를 적용한다. 폴더 검색 disclosure·pagination·theme input 스타일과 loaded-list continuity는 v679 계약을 유지한다.

<!-- v680-web-metadata-theme-pass -->

# v679 Metadata UI 계약

기준 버전: `rebuild-v679`

- `#metadata-work-folder-query`는 `--bg2`, `--surface`, `--text`, `--text3`, `--border`, `--accent2`를 사용한다.
- search/autofill/focus 상태에서도 브라우저 기본 흰색 control이 노출되지 않는다.
- folder search/pagination API와 loaded-list continuity는 v677 계약을 유지한다.
- Metadata Helper popup은 380px intrinsic width와 action/shortcut 계약을 사용한다.

<!-- v679-web-metadata-theme-pass -->

# 웹 메타데이터 현재 계약

기준 버전: `rebuild-v676`

## 공급자와 인증 경로

기본 공급자는 네이버 시리즈, 카카오페이지, 노벨피아, 문피아, 조아라와 설정된 추가 공급자다. 자동 수집은 서버 Playwright 영구 프로필(`metadata-browser-profiles`)을 사용하고, 사용자의 현재 브라우저 로그인 세션은 Metadata Helper 확장 프로그램을 사용한다. Owner 설정은 `/admin/users.html#metadata`, 작품 관리와 수집 작업은 `metadata.html`에서 수행한다.

`METADATA_PLAYWRIGHT_ENABLED`, `METADATA_PLAYWRIGHT_HEADLESS`, provider별 concurrency와 4.5~6.0초 cooldown을 운영 환경에 맞게 설정한다. 공급자 실패는 다음 활성 공급자로 fallback하되 provider별 완료 후 cooldown을 유지한다. 실제 5개 공급자 계정 로그인, 성인 인증, redirect와 anti-bot DOM은 실환경에서 별도 검증한다.

## 네트워크·저장 보안

외부 요청은 HTTPS 443만 허용하고 loopback, private, link-local 주소를 차단한다. Playwright API fast path는 검증한 공개 DNS 주소를 실제 socket에 pin한다. 응답과 표지는 크기, host allowlist, content type, magic byte를 확인하며 cover는 content-addressed asset으로 저장한다. Cookie, Authorization, raw HTML과 로그인 입력값은 Helper import payload에 포함하지 않는다.

## Candidate resident 경계

Candidate/applied 저장은 각각 32 shard와 manifest를 사용한다. Candidate 기본 resident 상한은 20,000개이며 작품별 상한은 30개다. applied storage를 먼저 읽어 적용 참조를 보호한 뒤, 격리된 Node loader가 32 shard를 순차 파싱하고 global/per-work bounded selector로 남길 후보만 부모 프로세스에 반환한다. logical resident byte 상한의 기본값은 48 MiB다. 단일 index 값은 문자열 하나로 저장하고 실제 collision에서만 배열로 승격한다. 고정 작품 수 상한 없이 전체 catalog를 UI에 materialize하지 않는다.

100,001 후보 합성 fixture에서 full load 대비 bounded load의 retained 후보는 20,001개였고 main-process heap 증가는 약 5배 낮았다. 이 수치는 실제 N100/HDD/SMB의 startup·steady RSS 개선 배수로 단정하지 않는다.

## 관리 화면 연속성

Metadata 관리 API는 library-relative folder prefix facet과 반복 `folder` query를 제공한다. UI에서 폴더별 필터를 선택할 수 있으며, 후보 적용·수동 저장·Helper import와 job 완료 뒤에는 선택된 작품 행과 요약만 갱신한다. 전체 재조회가 필요한 경우 이미 불러온 item 수까지 복원해 목록이 1페이지로 돌아가지 않는다.

## 환경 경계

실제 provider 계정, Playwright Chromium, Tunnel/NPM, 50k/100k 운영 데이터, N100 CPU/event-loop/RSS는 실행한 경우에만 통과로 기록한다.

<!-- v584-web-metadata-doc-pass -->
<!-- v586-web-metadata-owner-settings-pass -->
<!-- v587-web-metadata-login-footer-pass -->
<!-- v588-web-metadata-access-pass -->
<!-- v593-web-metadata-playwright-access-pass -->
<!-- v676-web-metadata-bounded-load-pass -->
