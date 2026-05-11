# NPM / Cloudflare Tunnel setup

기준 버전: rebuild-v534

이 문서는 `txt_reader_multi`를 Nginx Proxy Manager 또는 Cloudflare Tunnel 뒤에서 운영할 때 필요한 최소 설정을 정리한다.

## 1. 공통 원칙

- 브라우저 주소창의 origin을 `APP_ORIGIN`과 `URL`에 입력한다.
- production 외부망은 HTTPS 전제로 운영한다.
- reverse proxy/tunnel은 원래 요청 scheme을 앱에 전달해야 한다.
- owner 콘솔의 `운영 상태 > 배포 전 점검`에서 `production_https`, `forwarded_proto`, `app_origin`, `storage_writable`, `library_readable` 항목을 확인한다.

## 2. Nginx Proxy Manager

`.env` 예시:

```env
NODE_ENV=production
DEPLOYMENT_MODE=trusted-proxy
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=0.0.0.0
PORT=3000
```

NPM Proxy Host 예시:

| 항목 | 값 |
|---|---|
| Domain Names | `reader.example.com` |
| Scheme | `http` |
| Forward Hostname / IP | 앱 컨테이너 이름 또는 내부 IP |
| Forward Port | `3000` |
| Websockets Support | ON |
| Block Common Exploits | ON |
| SSL | Let’s Encrypt 또는 기존 인증서 |
| Force SSL | ON |
| HTTP/2 Support | ON |

Advanced location/header가 필요하면 다음 값이 기준이다.

```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection $connection_upgrade;
```

## 3. Cloudflare Tunnel sidecar

`.env` 예시:

```env
NODE_ENV=production
DEPLOYMENT_MODE=cloudflare-tunnel
URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
HOST=127.0.0.1
PORT=3000
CLIENT_IP_HEADER=CF-Connecting-IP
```

Compose sidecar 예시는 루트의 `docker-compose.cloudflare-tunnel.example.yml`을 참고한다.

운영 기준:

1. Cloudflare Zero Trust에서 Tunnel을 만든다.
2. public hostname을 앱 origin으로 연결한다.
3. token은 compose 파일에 직접 쓰지 말고 `.env` 또는 secret으로 주입한다.
4. owner 콘솔 `배포 전 점검`에서 `forwarded_proto=https`, `APP_ORIGIN=https://...` 조합을 확인한다.


### Cloudflare Tunnel + NPM에서 `x-forwarded-proto=http`가 되는 경우

일부 Nginx Proxy Manager 구성은 Cloudflare Tunnel이 전달한 HTTPS 정보를 Node 앱으로 넘기기 전에 `X-Forwarded-Proto`를 `$scheme` 기준 `http`로 다시 덮어쓴다. v525부터 `DEPLOYMENT_MODE=cloudflare-tunnel`에서는 Cloudflare가 전달한 `CF-Visitor: {"scheme":"https"}`를 production HTTPS 판정의 보조 신호로 신뢰한다.

전제 조건:

- origin Node/NPM은 Cloudflare Tunnel 외부로 직접 노출하지 않는다.
- 외부 WAN에서 NPM 관리자 포트 `81`뿐 아니라 NPM service entry `80/443`과 Node 앱 포트 `3000`에도 직접 접근할 수 없어야 한다.
- 공유기 포트포워딩, Proxmox/LXC 방화벽, Docker/LXC host 방화벽, 클라우드 보안그룹 중 어느 곳에도 `80/443/81/3000` 우회 경로를 열지 않는다.
- `.env`는 `NODE_ENV=production`, `DEPLOYMENT_MODE=cloudflare-tunnel`, `APP_ORIGIN=https://...`, `CLIENT_IP_HEADER=CF-Connecting-IP`를 사용한다.
- Cloudflare가 `cf-visitor`와 `cf-connecting-ip` 헤더를 Node까지 전달한다.

안전한 경로:

```text
외부 사용자 -> Cloudflare -> cloudflared outbound tunnel -> 내부 NPM:80 -> Node:3000
```

위험한 우회 경로:

```text
외부 사용자 -> 공유기 포트포워딩/WAN -> NPM:80/443 -> Node:3000
외부 사용자 -> 공유기 포트포워딩/WAN -> Node:3000
```

후자의 경로가 열려 있으면 외부 클라이언트가 `CF-Visitor`, `CF-Connecting-IP`, `X-Forwarded-Proto`를 직접 위조할 수 있으므로 Cloudflare Tunnel 모드의 HTTPS 신뢰가 안전하지 않다.

진단 오류가 `x-forwarded-proto=http`이지만 `cf-visitor={"scheme":"https"}`라면 v525 이후 로그인 HTTPS gate는 통과해야 한다. 단, 위 우회 경로가 닫혀 있는 경우에만 이 판정을 신뢰한다.

## 4. 진단 등급 해석

| 등급 | 의미 | 조치 |
|---|---|---|
| ok | 운영에 필요한 조건 충족 | 추가 조치 없음 |
| warn | 동작은 가능하지만 외부망 운영 전 확인 필요 | 안내된 fix를 확인 |
| error | 로그인, 쿠키, 저장소, 라이브러리 동작 실패 가능 | 배포 전 반드시 수정 |

## 5. 자주 발생하는 문제

### production인데 로그인 후 되돌아감

대개 HTTPS 또는 `X-Forwarded-Proto: https` 인식 실패다. `DEPLOYMENT_MODE=trusted-proxy` 또는 `cloudflare-tunnel`과 proxy header를 확인한다.

### `APP_ORIGIN mismatch` 경고

접속 주소와 `.env`의 `APP_ORIGIN`/`URL`이 다르다. 내부망과 외부망을 동시에 쓰면 쉼표로 둘 다 입력한다.

### 라이브러리 0개 또는 readable 오류

컨테이너 내부에서 `LIBRARY_PATH`가 실제 TXT 경로로 mount되었는지 확인한다.

## 6. Cloudflare/NPM cache rule 기준

- Cloudflare/NPM은 `Cache-Control`, `ETag`, `Vary` 응답 헤더를 제거하거나 덮어쓰지 않는다.
- `/api/*`, `/login.html`, `/site.html`, `/mobile.html`, `/admin/*`는 Cloudflare edge cache 대상에서 제외한다.
- HTML은 `no-store`로 두고, reader API는 private revalidation only로 둔다.
- `/scripts/rebuild/*.mjs?v=rebuild-vXXX`처럼 version query가 붙은 rebuild asset만 장기 immutable cache 대상으로 둔다.
- query 없는 ESM import 경로는 stale cache 위험이 있으므로 별도 장기 cache rule을 걸지 않는다.


## v526 owner diagnostics alignment

v525 only fixed the login HTTPS gate. v526 also aligns owner 운영 상태 with the same trust model. In `DEPLOYMENT_MODE=cloudflare-tunnel`, the diagnostics endpoint reports:

- `request.forwardedProto`: raw proxy value, often `http` when NPM rewrites it.
- `request.cloudflareVisitorScheme`: parsed `CF-Visitor.scheme`.
- `request.cloudflareVisitorHttpsTrusted`: true only for cloudflare-tunnel mode with `scheme=https`.
- `request.effectiveProtocol`: the protocol used for production cookie / owner status judgment.

If `X-Forwarded-Proto=http` and `CF-Visitor={"scheme":"https"}`, owner diagnostics should show `production_https=ok` and `forwarded_proto_cf_visitor=ok`, not `forwarded_proto_mismatch=error`.

### WAN exposure checklist for Cloudflare Tunnel + NPM

Before relying on `CF-Visitor` trust, verify these are true:

- Router port forwarding does not expose NPM `80`, `443`, or `81`.
- Router port forwarding does not expose the Node app port, usually `3000`.
- NPM admin UI is reachable only from LAN/VPN/management network.
- NPM proxy hosts are reached from WAN only through Cloudflare Tunnel public hostnames.
- Node app binds to `127.0.0.1`, a Docker internal network, or a LAN-only address; it is not a public WAN listener.
- DNS for the public reader domain points only to Cloudflare/Tunnel, not to the origin IP by an unproxied A/AAAA record.

## Cloudflare Tunnel 노출 진단

Owner 운영 상태는 `v528-cloudflare-tunnel-exposure-diagnostics-pass` 기준으로 현재 요청에 Cloudflare 계열 header가 있는지 표시한다. 이 진단은 현재 요청이 Cloudflare를 경유했는지 판단하는 보조 정보이며, 공유기/WAN에서 NPM 80/443/81 또는 Node 앱 포트가 직접 열려 있는지 서버 단독으로 확정하지 않는다.

반드시 별도로 확인할 항목:

- WAN -> NPM 80 직접 접근 차단
- WAN -> NPM 443 직접 접근 차단
- WAN -> NPM 관리자 81 직접 접근 차단
- WAN -> Node 앱 포트 직접 접근 차단
- 외부 진입점은 Cloudflare Tunnel public hostname만 사용

이 조건이 깨지면 외부 클라이언트가 `CF-Visitor`, `CF-Connecting-IP`, `X-Forwarded-*` header를 위조할 수 있으므로 `DEPLOYMENT_MODE=cloudflare-tunnel`의 신뢰 모델이 약해진다.
