# Cloudflare Tunnel + Nginx Proxy Manager

기준 버전: `rebuild-v663`

## 권장 경로

```text
브라우저 HTTPS
  → Cloudflare Edge
  → cloudflared outbound tunnel
  → 10.250.4.240 NPM:80 HTTP
  → 10.250.4.246:3000 HTTP
```

공유기 포트포워딩은 필요하지 않다. 외부 WAN에서 NPM 관리자 포트 `81`뿐 아니라 NPM service entry `80/443`과 Node 앱 포트 `3000`에도 직접 접근할 수 없어야 한다.

## Cloudflare Tunnel public hostname

- Service: `HTTP`
- URL: cloudflared와 NPM이 같은 CT이면 `http://127.0.0.1:80`, 다른 CT이면 `http://10.250.4.240:80`
- HTTP Host Header: 실제 공개 도메인
- No TLS Verify / Origin Server Name: HTTP origin에서는 사용하지 않음

## NPM Proxy Host

| 항목 | 값 |
|---|---|
| Domain Names | 실제 공개 도메인 |
| Scheme | `http` |
| Forward Hostname / IP | `10.250.4.246` |
| Forward Port | `3000` |
| Cache Assets | OFF |
| Block Common Exploits | ON |
| Websockets Support | OFF |

### SSL 탭

Tunnel이 NPM `80/http`로 연결되는 현재 구조에서는 다음처럼 설정한다.

| 항목 | 값 |
|---|---|
| SSL Certificate | None |
| Force SSL | OFF |
| HTTP/2 Support | OFF |
| HSTS Enabled | OFF |
| HSTS Subdomains | OFF |

NPM의 wildcard 인증서는 이 HTTP origin 경로에서 사용되지 않는다. 외부 TLS, Always Use HTTPS, HSTS는 Cloudflare에서 담당한다. NPM Force SSL을 켜면 Tunnel이 HTTP로 들어올 때 같은 외부 HTTPS URL로 반복 redirect할 수 있다.

### Advanced

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Host $host;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $http_x_forwarded_proto;
proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;
proxy_set_header CF-Visitor $http_cf_visitor;
proxy_set_header CF-Ray $http_cf_ray;

client_max_body_size 16m;
proxy_connect_timeout 15s;
proxy_send_timeout 120s;
proxy_read_timeout 120s;
```

NPM이 `X-Forwarded-Proto`를 비우거나 `http`로 덮어쓰더라도 `DEPLOYMENT_MODE=cloudflare-tunnel`에서는 정상 Cloudflare 요청의 `CF-Visitor.scheme=https`를 보조 신호로 사용한다. 이 신뢰는 NPM과 앱의 WAN 직접 접근이 막혀 있을 때만 안전하다.

## 앱 `.env`

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
TXT_READER_BIND_ADDRESS=0.0.0.0

URL=https://reader.example.com
APP_ORIGIN=https://reader.example.com
DEPLOYMENT_MODE=cloudflare-tunnel
REQUIRE_STRICT_ORIGIN=1
TRUST_PROXY=1
CLIENT_IP_HEADER=CF-Connecting-IP

# Cloudflare Web Analytics/Browser Insights 자동 주입을 실제로 사용할 때만 1
ALLOW_CLOUDFLARE_INSIGHTS=0
ALLOW_BLOB_WORKER=0
```

Proxmox/CT 방화벽에서는 앱 `3000/tcp`를 NPM 주소 `10.250.4.240`에서만 허용하는 구성이 가장 안전하다.

## 표지 redirect 진단

인증 cookie가 없으면 API는 401 또는 권한에 따라 404를 반환할 수 있지만 `Location` redirect를 반환해서는 안 된다.

```bash
# 앱 직접
curl -sS -D - -o /dev/null \
  -H 'Cookie: __Host-session_token=<session>' \
  http://10.250.4.246:3000/api/metadata/covers/<assetId>

# NPM 내부 HTTP
curl -sS -D - -o /dev/null \
  -H 'Host: reader.example.com' \
  -H 'Cookie: __Host-session_token=<session>' \
  http://10.250.4.240/api/metadata/covers/<assetId>
```

정상 200 표지 응답에는 `X-Txt-Reader-Asset: metadata-cover-v663`가 있다. 앱 직접과 NPM 내부 요청이 redirect하지 않는데 외부 도메인만 반복 redirect하면 Cloudflare rule, Tunnel public hostname 또는 NPM SSL redirect 설정을 확인한다.

## Cache rule

Cloudflare와 NPM은 다음 경로를 edge cache하지 않는다.

```text
/api/*
/admin/*
/login.html
/library.html
/metadata.html
/site.html
/mobile.html
/sw.js
/version.json
```

버전 query가 붙은 정적 자산은 앱의 `Cache-Control`과 Service Worker 계약을 그대로 사용한다.

<!-- v663-proxy-tunnel-pass -->

## 위험한 우회 경로

```text
외부 사용자 → 공유기 포트포워딩/WAN → NPM:80/443/81 → Node:3000
외부 사용자 → 공유기 포트포워딩/WAN → Node:3000
```

## WAN exposure checklist for Cloudflare Tunnel + NPM

- Router port forwarding does not expose NPM `80`, `443`, or `81`.
- Router port forwarding does not expose the Node app port `3000`.
- NPM admin UI is reachable only from LAN/VPN/management networks.
- Public DNS points to Cloudflare Tunnel, not an unproxied origin A/AAAA record.
