# =========================================
# TXT Reader - Dockerfile
# =========================================

FROM node:20-alpine

# -----------------------------------------
# App directory
# -----------------------------------------
WORKDIR /app

# -----------------------------------------
# Native module build dependencies
# Required for some npm packages on Alpine
# -----------------------------------------
RUN apk add --no-cache \
    python3 \
    make \
    g++

# -----------------------------------------
# Copy package metadata first
# (better Docker layer caching)
# -----------------------------------------
COPY package*.json ./
COPY .npmrc ./

# -----------------------------------------
# Install production dependencies
# -----------------------------------------
RUN if [ -f package-lock.json ]; then \
      npm ci --omit=dev --no-audit --no-fund; \
    else \
      npm install --omit=dev --no-audit --no-fund; \
    fi

# -----------------------------------------
# Copy application source
# -----------------------------------------
COPY . .

# -----------------------------------------
# Runtime environment
# -----------------------------------------
ENV NODE_ENV=production \
    PORT=3000 \
    LIBRARY_PATH=/library \
    DEPLOYMENT_MODE=direct \
    REQUIRE_STRICT_ORIGIN=1 \
    USER_PASSWORD_MIN_LENGTH=8 \
    ALLOW_CLOUDFLARE_INSIGHTS=0 \
    ALLOW_BLOB_WORKER=0 \
    LIBRARY_DEEP_SIGNATURE_CHECK_TTL_MS=2000

# -----------------------------------------
# Data directories
# -----------------------------------------
RUN mkdir -p \
    /app/data \
    /app/data/user-data \
    /app/data/site-languages

# -----------------------------------------
# Runtime user
# uid=1000
# gid=0
#
# Supports:
# - 1000:1000 writable volumes
# - 0:0 group-writable volumes
# -----------------------------------------
USER 1000:0

# -----------------------------------------
# Expose port
# -----------------------------------------
EXPOSE 3000

# -----------------------------------------
# Healthcheck
# -----------------------------------------
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

# -----------------------------------------
# Start server
# -----------------------------------------
CMD ["node", "server.js"]
