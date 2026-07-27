# =========================================
# TXT Reader - production image
# =========================================
FROM node:20.20.2-bookworm-slim

WORKDIR /app

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Dependency metadata is copied first so application edits reuse the npm layer.
COPY --chown=node:node package.json package-lock.json ./
COPY .npmrc ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --omit=dev --no-audit --no-fund \
  && npx playwright install --with-deps chromium \
  && chmod -R a+rX /ms-playwright \
  && npm cache clean --force

# Copy only files required by the production service after Chromium installation.
# Release, migration, and smoke tools stay outside the runtime image.
COPY --chown=node:node server.js ./server.js
COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node site-language-packs ./site-language-packs
COPY --chown=node:node docker-entrypoint.sh /app/docker-entrypoint.sh

ENV NODE_ENV=production \
    HOME=/tmp \
    PORT=3000 \
    TXT_READER_DATA_DIR=/app/data \
    LIBRARY_PATH=/library \
    DEPLOYMENT_MODE=direct \
    REQUIRE_STRICT_ORIGIN=1 \
    USER_PASSWORD_MIN_LENGTH=8 \
    ALLOW_CLOUDFLARE_INSIGHTS=0 \
    ALLOW_BLOB_WORKER=0 \
    LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS=30000 \
    CONTENT_WORKER_POOL_SIZE=0 \
    CONTENT_WORKER_QUEUE_MAX=8 \
    CONTENT_WORKER_IDLE_TTL_MS=30000 \
    CONTENT_MAIN_THREAD_FALLBACK_MAX_BYTES=8388608 \
    CONTENT_DISK_CACHE_MIN_BYTES=1048576 \
    SHUTDOWN_GRACE_MS=45000 \
    SHUTDOWN_HTTP_DRAIN_MS=10000

RUN chmod 0755 /app/docker-entrypoint.sh \
  && mkdir -p \
    /app/data \
    /app/data/user-data \
    /app/data/site-languages \
    /app/data/metadata-browser-profiles \
    /library \
  && chown -R node:node /app /library

# uid 1000 keeps compatibility with existing bind-volume deployments; gid 0
# preserves group-writable volume compatibility used by the compose file.
USER 1000:0

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "server.js"]
