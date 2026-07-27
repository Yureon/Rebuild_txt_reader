# TXT Reader Metadata Helper v6.76.0

현재 브라우저에서 사용자가 직접 로그인한 공식 작품 페이지의 정규화 메타데이터를 TXT Reader Multi로 가져오는 보조 확장 프로그램이다.

## 설치

1. TXT Reader Multi v676과 이 디렉터리를 같은 릴리스로 교체한다.
2. Chrome·Whale·Edge의 확장 프로그램 관리 화면에서 개발자 모드를 켠다.
3. `extensions/metadata-login-helper`를 압축해제된 확장 프로그램으로 로드한다.
4. manifest version이 `6.76.0`인지 확인한다.

## 열기와 단축키

- 툴바의 확장 아이콘을 누르거나 기본 `Ctrl+Shift+Y`를 사용한다.
- macOS 기본값은 `Command+Shift+Y`다.
- 브라우저나 다른 확장과 충돌하면 확장 프로그램 단축키 설정에서 재지정한다.
- popup 상단에는 브라우저에 실제 등록된 단축키가 표시된다.

## 사용

1. TXT Reader 작품 상세 또는 `/metadata.html`에서 브라우저 캡처를 시작한다.
2. Helper를 열어 일회용 pairing을 저장한다.
3. 지원 공급자의 공식 검색·상세 페이지로 이동한다.
4. 로그인이 필요하면 해당 브라우저에서 직접 로그인·연령 인증을 완료한다.
5. 공식 상세 페이지에서 Helper를 다시 열어 메타데이터를 캡처한다.
6. TXT Reader 탭으로 돌아와 Helper를 열고 후보를 import한다.

소설넷은 `https://ssn.so/series/<숫자>/` 형식만 상세 페이지로 인정한다. 네이버 시리즈·카카오페이지의 로그인 redirect는 원래 작품 URL을 보존하며 자동 복귀는 한 번만 시도한다.

## UI 계약

Popup은 일반 폭 390px, 최소 280px를 기준으로 하고 더 좁은 side panel에서는 100vw로 축소한다. 단계 버튼과 label은 생략 부호로 잘라내지 않고 줄바꿈하며 상태·오류 card와 action button은 한 열로 재배치된다. `prefers-reduced-motion`도 따른다.

## 보안 계약

- `cookies` 권한을 요청하지 않는다.
- Cookie, Authorization, raw HTML, 로그인 입력값, 계정 프로필, 이미지 바이너리를 TXT Reader에 전송하지 않는다.
- pairing은 작품·사용자에 묶인 일회용 token이며 만료 후 재사용할 수 없다.
- 상세 URL, 제목, 작가, 소개, 장르, 태그, 상태, 표지 URL과 필드 출처만 허용한다.
- 표지는 TXT Reader 서버가 공급자 allowlist와 magic-byte 검사를 거쳐 별도로 저장한다.

서버의 Playwright 영구 프로필과 Helper는 독립적인 인증 경로다.

<!-- v676-extension-shortcut-pass -->
