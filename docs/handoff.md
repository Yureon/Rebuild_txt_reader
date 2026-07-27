# TXT Reader Multi v682 인수인계

기준은 `txt_reader_v682.zip`, package `6.82.0`, build `rebuild-v682`이다. 새 작업은 ZIP checksum, archive safety, clean extract와 `package-manifest-v682.json` 전수 대조 후 시작한다.

보존 계약:

- 생성 PowerShell은 Windows PowerShell 5.1에 없는 `System.IO.Path.GetRelativePath`를 사용하지 않는다.
- 상대경로 계산 전 root/candidate를 정규화하고 root containment와 reparse-point 검사를 유지한다.
- Metadata 수동 입력 필터, 사용자별 theme, Reader locator, library cursor와 PWA fail-closed를 유지한다.

<!-- v682-handoff-pass -->

# TXT Reader Multi v681 인수인계

기준은 `txt_reader_v681.zip`, package `6.81.0`, build `rebuild-v681`이다. 새 작업은 ZIP checksum, archive safety, clean extract와 `package-manifest-v681.json` 전수 대조 후 시작한다.

보존 계약:

- 직접 입력 Metadata는 applied record의 `providerId: manual` 표식을 유지한다.
- Metadata 관리의 적용 출처 필터는 `manual`과 실제 Provider ID를 같은 API query 계약으로 전달한다.
- 수동 입력 필터의 URL·페이지네이션·폴더 필터 조합을 초기화하지 않는다.
- 로그인 Owner 팔레트, 사용자별 theme, Reader locator, Metadata hard cap, library cursor와 PWA fail-closed를 유지한다.

<!-- v681-handoff-pass -->

# TXT Reader Multi v680 인수인계

기준은 `txt_reader_v680.zip`, package `6.80.0`, build `rebuild-v680`이다. 새 작업은 ZIP checksum, archive safety, clean extract와 `package-manifest-v680.json` 전수 대조 후 시작한다.

보존 계약:

- 로그인 페이지는 이전 사용자 테마를 읽지 않고 Owner 콘솔 검정·녹색 팔레트를 사용한다.
- 로그인 성공 후 `activeThemeScope`와 사용자별 `scope.<userId>.prefs`를 prime한다.
- 서재·Reader는 사용자 scope bootstrap 후 state를 만들고, Metadata 독립 페이지는 `/api/theme-bootstrap` 후 state를 만든다.
- Owner와 일반 사용자 theme 응답을 분리하고 theme-only key allowlist를 유지한다.
- 기존 Reader locator, Metadata hard cap, tree cursor와 PWA fail-closed를 변경하지 않는다.

<!-- v680-handoff-pass -->

# TXT Reader Multi v679 인수인계

기준은 `txt_reader_v679.zip`, package `6.79.0`, build `rebuild-v679`이다. 새 작업은 ZIP checksum, archive safety, clean extract와 `package-manifest-v679.json` 전수 대조 후 시작한다.

보존 계약:

- Metadata folder query는 theme variable 기반 배경·글자·테두리·focus/autofill style을 사용한다.
- HTML cachebuster, Service Worker BUILD, precompressed 자산은 모두 `rebuild-v679`로 일치해야 한다.
- Metadata Helper popup은 380px intrinsic width이며 `100vw` 기반 순환 축소를 재도입하지 않는다.
- v677의 Metadata hard cap, tree cursor paging, no-follow filesystem 경계와 Reader locator 계약을 유지한다.

<!-- v679-handoff-pass -->

# TXT Reader Multi v676 인수인계

기준 소스는 `txt_reader_v676.zip`, package `6.76.0`, build `rebuild-v676`이다. 새 작업은 ZIP SHA-256, archive safety, clean extract, package manifest를 실제 검사한 뒤 시작한다.

## 반드시 보존할 v676 계약

- candidate shard는 전체 resident materialization 전에 global/per-work cap을 적용하고 applied candidate를 보존한다.
- proxy header는 loopback-only 기본 source와 명시 CIDR, 유효 IP 검사를 모두 통과해야 한다.
- progress journal과 font file은 realpath containment와 `O_NOFOLLOW` 열린 handle 경계를 우회하지 않는다.
- prefetch watchdog의 미종료 작업은 active orphan circuit 상한을 넘겨 추가 실행하지 않는다. 늦은 generation 결과는 현재 작업에 적용하지 않는다.
- modal stack은 중첩 순서와 다른 close에서도 background inert와 focus를 재계산한다.
- Metadata apply/import 뒤 이미 로드한 목록 수를 유지하며 폴더 filter를 URL·API·UI 전 계층에서 보존한다.
- Helper의 `_execute_action` shortcut과 280px popup 반응형 contract를 유지한다.
- Service Worker dual-failure 503, private API 비캐시와 executable handshake를 변경하지 않는다.
- Reader `fileChar`, append/prepend anchor, progress/bookmark/search locator, candidate/applied 32-shard, user/accessVersion scope를 변경하지 않는다.

## 환경 미검증

실제 N100, Docker/Podman, 80k HDD/SMB, Tunnel/NPM와 origin ACL, live provider 계정·anti-bot, Whale/Samsung Internet/standalone PWA, extension shortcut 충돌, arm64는 실행하지 않았다면 통과로 기록하지 않는다.

<!-- v676-handoff-pass -->

## Reader 안정화 보호

- **v488 reader 안정화 보호 인수인계**: `docs/reader-anchoring-stability-contract.md`의 fileChar·append/prepend anchor·slider commit-freeze 계약은 v676에서도 변경 금지 기준으로 유지한다.

<!-- v676-reader-stability-handoff-pass -->
