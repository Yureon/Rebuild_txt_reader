# TxT Reader Multi

Self-hosted TXT web novel reader for large Korean novel libraries.  
The project is a Node.js/Express server with a vanilla JavaScript ESM client. It supports chunk-based TXT reading, folder-style multi-episode works, multi-user access control, owner-managed invite codes, and adaptive search performance tuning.

Current baseline: `rebuild-v564`

\---

## Features

* **Large TXT reader**

  * Chunk-based loading for large text files
  * Single-file and folder-based multi-episode reading
  * Reader anchoring, slider navigation, bookmarks, recent items, and reading-state sync
* **Multi-user mode**

  * Owner-only admin console
  * User creation, editing, activation/deactivation, password reset, and session invalidation
  * Folder-prefix library ACL
  * Invite/signup code management
  * Per-user and per-invite-code full-search permission
* **Search**

  * Cache-first search by default
  * Optional full search through server content APIs
  * Full-search toggle hidden for users without permission
  * Server-side permission guard for full-search requests
  * Adaptive search profile based on available CPU, cgroup/cpuset limits, memory, and storage profile
* **Performance and stability**

  * Bounded content worker pool for heavy TXT preprocessing
  * Abort propagation for cancelled search/content requests
  * Windowed multi-file block manifest generation
  * Client-side chunk and coordinate cache pruning
  * IndexedDB cache limits
* **Deployment**

  * Docker Compose support
  * Proxmox LXC-friendly non-root container mode
  * Cloudflare Tunnel and Nginx Proxy Manager deployment examples
  * Production cookie/origin/CSP hardening
  * Healthcheck endpoint: `/healthz`

\---

## Repository layout

```text
.
├── server.js
├── server/                         # Express server, auth, APIs, cache/services
├── public/                         # Reader/admin/login frontend
├── tools/                          # Smoke tests, packaging, permission helper scripts
├── docs/                           # Deployment, security, smoke tests, ACL and operations docs
├── Dockerfile
├── docker-compose.yml
├── docker-compose.example.yml
├── docker-compose.cloudflare-tunnel.example.yml
├── docker-entrypoint.sh
├── .env.example
└── package.json
```

\---

## Requirements

### Native Node.js

* Node.js 20 or newer recommended
* npm

### Docker

* Docker Engine
* Docker Compose plugin
* A writable local app-data directory mounted to `/app/data`
* A TXT library directory mounted read-only to `/library`

For Proxmox LXC, enable Docker-compatible nesting/keyctl settings on the LXC container before installing Docker.

\---

## Quick start: Node.js

```bash
cp .env.example .env
npm install --no-audit --no-fund
node server.js
```

Open:

```text
http://localhost:3000
```

The owner account is configured with `LOGINID` and `LOGINPW` in `.env`. The owner account is for administration, not normal reading.

\---

## Quick start: Docker Compose

### 1\. Prepare `.env`

```bash
cp .env.example .env
```

Edit at least these values:

```env
LOGINID=owner\_admin
LOGINPW=change\_this\_to\_14\_chars\_or\_more
URL=http://localhost:3000
APP\_ORIGIN=http://localhost:3000
LIBRARY\_PATH=/absolute/path/to/novels
SESSION\_STORE\_SECRET=change\_this\_to\_a\_long\_random\_secret\_32\_chars\_or\_more
```

### 2\. Prepare app data directory

`/app/data` stores accounts, sessions, user state, audit logs, and runtime caches. It must be writable by the container process.

The v556 image runs as:

```text
UID 1000
primary GID 0
```

This is still non-root execution because the UID is not `0`. The primary GID is `0` to support both common bind-mount layouts in Proxmox LXC and similar environments.

Supported app-data permission layouts:

```bash
# Layout A: 1000:1000 owner-write
mkdir -p ./data/user-data
chown -R 1000:1000 ./data
chmod -R u+rwX,g+rwX ./data
```

or:

```bash
# Layout B: 0:0 group-write
mkdir -p ./data/user-data
chgrp -R 0 ./data
chmod -R g+rwX ./data
```

The helper script applies the recommended local permission layout:

```bash
sh tools/fix\_docker\_data\_permissions.sh
```

### 3\. Start

```bash
docker compose up -d --build
```

Check logs and health:

```bash
docker logs --tail=100 txt\_reader
docker stats --no-stream txt\_reader
curl http://127.0.0.1:3000/healthz
```

\---

## Docker volume model

The default compose file uses:

```yaml
volumes:
  - type: bind
    source: ./data
    target: /app/data
    bind:
      create\_host\_path: false
  - ${LIBRARY\_PATH}:/library:ro
```

Important points:

* `./data` must exist before `docker compose up`.
* `create\_host\_path: false` prevents Docker Compose from silently creating `./data` as a wrong `root:root` directory.
* `/app/data` must be writable.
* `/library` can be read-only and may point to a large TXT library.
* If the TXT library is on SMB/CIFS/NFS, keep only the novel library there. Prefer local LXC storage for `./data`.

If the container logs show:

```text
/app/data is not writable by the container user
```

check:

```bash
docker inspect txt\_reader --format '{{range .Mounts}}{{println .Type .Source "->" .Destination "RW=" .RW}}{{end}}'
ls -ldn ./data ./data/user-data
```

Fix with one of the supported layouts above.

\---

## Environment variables

Core settings:

|Variable|Purpose|
|-|-|
|`LOGINID`|Owner/admin login ID|
|`LOGINPW`|Owner/admin password|
|`OWNER\_PASSWORD\_MIN\_LENGTH`|Owner password minimum length; default `14`, lower bound `10`|
|`USER\_PASSWORD\_MIN\_LENGTH`|Normal user password minimum length; default `8`|
|`PORT`|App port; default `3000`|
|`HOST`|Bind address. Use `0.0.0.0` for Docker/NPM, `127.0.0.1` for local-only tunnel setups|
|`URL`|Public or local app origin|
|`APP\_ORIGIN`|Allowed browser origin list; comma-separated values supported|
|`LIBRARY\_PATH`|Host TXT library path used by Docker Compose|
|`SESSION\_STORE\_SECRET`|Long random secret for session store HMAC; set in production|

Security and proxy settings:

|Variable|Purpose|
|-|-|
|`NODE\_ENV`|Set `production` for HTTPS/cookie hardening|
|`DEPLOYMENT\_MODE`|`direct`, `trusted-proxy`, or `cloudflare-tunnel`|
|`REQUIRE\_STRICT\_ORIGIN`|Require Origin/Fetch Metadata checks for unsafe methods|
|`CLIENT\_IP\_HEADER`|Trusted client IP header, for example `CF-Connecting-IP`|
|`ALLOW\_CLOUDFLARE\_INSIGHTS`|Optional CSP allowance; default `0`|
|`ALLOW\_BLOB\_WORKER`|Optional CSP allowance; default `0`|

Search and content performance:

|Variable|Purpose|
|-|-|
|`CONTENT\_WORKER\_THREADS\_ENABLED`|Enable worker-thread pool for heavy TXT preprocessing|
|`CONTENT\_WORKER\_POOL\_SIZE`|`0` means automatic pool size|
|`SEARCH\_PERFORMANCE\_PROFILE`|`auto`, `safe`, `balanced`, `n100\_2core`, `fast`, `aggressive`|
|`SEARCH\_STORAGE\_PROFILE`|`auto`, `local`, `network`, `slow`|
|`SEARCH\_SERVER\_CORES`|Manual core override; `0` means automatic|
|`SEARCH\_FULL\_CONCURRENCY\_MAX`|Manual full-search concurrency override|
|`SEARCH\_LIVE\_CONCURRENCY\_MAX`|Manual live-search concurrency override|
|`SEARCH\_MULTI\_EPISODE\_CONCURRENCY\_MAX`|Manual multi-episode search concurrency override|
|`SEARCH\_CACHE\_ONLY\_CONCURRENCY`|Manual cache-only search concurrency override|
|`SEARCH\_WORKER\_BATCH\_MAX`|Manual frontend worker batch limit override|

Large-file/cache settings:

|Variable|Purpose|
|-|-|
|`MAX\_TEXT\_FILE\_BYTES`|Maximum TXT file size; default 100 MiB|
|`CONTENT\_FILE\_CACHE\_MAX\_BYTES`|In-memory content file cache size|
|`CONTENT\_FILE\_CACHE\_MAX\_ENTRIES`|In-memory content file cache entry count|
|`FOLDER\_BLOCK\_MANIFEST\_RADIUS`|Multi-file folder manifest window radius|
|`DISK\_CACHE\_AUTO\_PRUNE\_ENABLED`|Enable runtime cache pruning|
|`DISK\_CACHE\_PRUNE\_USAGE\_PCT`|Disk usage threshold for pruning|
|`DISK\_CACHE\_PRUNE\_TARGET\_USAGE\_PCT`|Target disk usage after pruning|

See `.env.example` for the full list and deployment examples.

\---

## User and permission model

There are two account types:

* **Owner account**

  * Configured through `.env`
  * Intended for administration only
  * Redirects to the user management console after login
* **Normal users**

  * Created by the owner, or registered through owner-issued signup codes
  * Can be granted folder-prefix access to the TXT library
  * Can be allowed or denied full-search permission

Full-search permission is enforced in two places:

1. The search modal hides the full-search toggle for users without permission.
2. The server rejects forced full-search requests from unauthorized users.

Signup codes can predefine permissions, including full-search availability, so newly registered users inherit the intended policy.

\---

## Search behavior

The reader uses cache-first search by default.

* **Full search OFF**

  * Searches visible chunks, memory cache, and IndexedDB cache.
  * Lower server load.
* **Full search ON**

  * Uses server content APIs to scan a broader/full range.
  * Requires user permission.
  * Uses adaptive concurrency limits.

For constrained servers such as an Intel N100 LXC with 2 CPU cores, keep:

```env
SEARCH\_PERFORMANCE\_PROFILE=auto
SEARCH\_STORAGE\_PROFILE=auto
```

The server will normally select a conservative profile. For network storage, set:

```env
SEARCH\_STORAGE\_PROFILE=network
```

or:

```env
SEARCH\_STORAGE\_PROFILE=slow
```

\---

## Reverse proxy and Cloudflare Tunnel

### Direct internal HTTP

```env
NODE\_ENV=
DEPLOYMENT\_MODE=direct
URL=http://192.168.1.100:3000
APP\_ORIGIN=http://192.168.1.100:3000
HOST=0.0.0.0
```

### HTTPS reverse proxy

```env
NODE\_ENV=production
DEPLOYMENT\_MODE=trusted-proxy
URL=https://reader.example.com
APP\_ORIGIN=https://reader.example.com
HOST=0.0.0.0
```

The proxy should forward HTTPS information, normally with:

```text
X-Forwarded-Proto: https
```

### Cloudflare Tunnel

```env
NODE\_ENV=production
DEPLOYMENT\_MODE=cloudflare-tunnel
URL=https://reader.example.com
APP\_ORIGIN=https://reader.example.com
CLIENT\_IP\_HEADER=CF-Connecting-IP
```

Security requirement: when trusting Cloudflare headers, do not expose the origin directly to the WAN. Block direct external access to Node port `3000`, NPM service ports `80/443`, and NPM admin port `81` unless they are only reachable through trusted internal/tunnel paths.

\---

## Common operations

### Start / stop

```bash
docker compose up -d --build
docker compose down
```

### Logs

```bash
docker logs -f --tail=100 txt\_reader
```

### Healthcheck

```bash
curl http://127.0.0.1:3000/healthz
```

### Check CPU usage

```bash
docker stats --no-stream txt\_reader
```

### Verify `/app/data` mount

```bash
docker inspect txt\_reader --format '{{range .Mounts}}{{println .Type .Source "->" .Destination "RW=" .RW}}{{end}}'
```

### Fix Docker data permissions

```bash
cd /opt/txt\_reader
mkdir -p ./data/user-data
sh tools/fix\_docker\_data\_permissions.sh
```

\---

## Development and validation

Install dependencies:

```bash
npm install --no-audit --no-fund
```

Run checks:

```bash
npm run check
npm run smoke:quick
```

Available smoke groups include:

```bash
npm run smoke:server
npm run smoke:frontend
npm run smoke:search
npm run smoke:cache
npm run smoke:security
npm run smoke:reader
npm run smoke:settings
npm run smoke:docs
npm run smoke:full
```

Release/archive validation:

```bash
npm run release:verify -- <zip-file>
```

\---

## Packaging notes

Deployment archives should not include runtime or local-only data:

* `node\_modules/`
* `data/`
* `sync\_data.json`
* `test\_novels/`
* `.npm-cache/`

`package-lock.json` should remain a normal file, not a symlink.

\---

## Troubleshooting

### `/app/data is not writable by the container user`

Check current permissions:

```bash
ls -ldn ./data ./data/user-data
```

Check container mount:

```bash
docker inspect txt\_reader --format '{{range .Mounts}}{{println .Type .Source "->" .Destination "RW=" .RW}}{{end}}'
```

Use one of these fixes:

```bash
# Owner-write layout
chown -R 1000:1000 ./data
chmod -R u+rwX,g+rwX ./data
```

or:

```bash
# Group-root layout
chgrp -R 0 ./data
chmod -R g+rwX ./data
```

If `chown` or `chmod` is not permitted, the app-data directory is likely on SMB/CIFS/NFS or a restricted LXC mount. Move `./data` to local LXC storage and mount only the novel library from network storage.

### `su-exec: setgroups(...) Operation not permitted`

Older images that used `su-exec` can fail inside unprivileged Proxmox LXC. v556 does not use `su-exec`; rebuild the image and recreate the container:

```bash
docker compose down
docker compose up -d --build --force-recreate
```

### CPU remains high after stopping search

Check whether the server is doing content preprocessing or state writes:

```bash
docker stats --no-stream txt\_reader
pidstat -u -t -p $(pgrep -f "node server.js" | head -1) 1 5
```

Also check logs for repeated write permission errors:

```bash
docker logs --tail=200 txt\_reader
```

\---

## Documentation

Additional documentation is available under `docs/`:

* `docs/deployment-guide.md`
* `docs/proxy-tunnel-setup.md`
* `docs/operations-checklist.md`
* `docs/security.md`
* `docs/smoke-tests.md`
* `docs/multi-user-access-control.md`
* `docs/performance-cache.md`
* `docs/production-diagnostics.md`
* `docs/reader-anchoring-stability-contract.md`
* `docs/reader-search-baseline.md`

\---

## License

No license file is included in this archive. Add a `LICENSE` file before publishing publicly if redistribution terms should be explicit.

