# PWA·오프라인 계약 — v682 current

기준 build는 `rebuild-v682`이다. 이번 변경은 Owner가 서버에서 다운로드하는 PowerShell 본문에 한정되며 PWA offline shell, private API 비캐시와 mixed-build executable fail-closed 계약은 유지한다.

<!-- v682-pwa-pass -->

# PWA·오프라인 계약 — v681 current

기준 build는 `rebuild-v681`이다. 수동 입력 출처 필터는 온라인 shelf API에 의존하며, 기존 private API 비캐시와 mixed-build executable fail-closed를 유지한다.

<!-- v681-pwa-pass -->

# PWA·오프라인 계약 — v680 current

기준 build는 `rebuild-v680`이다. 로그인은 네트워크가 필요하며 theme bootstrap 실패가 인증 성공 자체를 취소하지 않는다. 이미 scoped local prefs가 있는 사용자는 오프라인 shell에서도 해당 scope의 첫 화면 테마를 사용할 수 있다. private API 비캐시, mixed-build executable fail-closed와 navigation dual-failure 503 계약은 유지한다.

<!-- v680-pwa-current-pass -->

# PWA·오프라인 계약 — v679 current

기준 build는 `rebuild-v679`이다. 정적 cache namespace는 `txt-reader-static-rebuild-v679`이며 HTML asset query도 `?v=rebuild-v679`을 사용한다. v677 자산과 v679 HTML을 섞지 않고 mixed-build executable fail-closed, navigation dual-failure 503, private API 비캐시 계약을 유지한다.

<!-- v679-pwa-current-pass -->

# PWA·오프라인 현재 계약

- 기준 버전: `rebuild-v676`
- 정적 cache prefix: `txt-reader-static-rebuild-v676`
- navigation은 항상 network-first다.
- API와 인증 HTML은 CacheStorage에 저장하지 않는다.
- build-unique Service Worker와 `TXT_READER_CLIENT_BUILD_READY` handshake 전 executable 요청은 409 fail-closed다.
- network와 offline `caches.match('/offline.html')`가 동시에 실패해도 promise rejection을 밖으로 전파하지 않고 명시적인 503 `Response`를 반환한다.
- navigation 응답 후 client-state CacheStorage 영속화는 best-effort `waitUntil` 작업이며 `open`, `put`, quota 실패가 이미 확보한 navigation 응답을 깨뜨리지 않는다.

실제 Service Worker 종료·재시작, browser quota, multi-tab, Whale·Samsung Internet·standalone PWA lifecycle은 실행한 경우에만 통과로 기록한다.

<!-- v590-pwa-offline-contract-pass -->
<!-- v676-pwa-dual-failure-pass -->
