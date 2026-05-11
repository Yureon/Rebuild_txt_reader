#!/bin/sh
set -eu

SRC_DIR="${SITE_LANGUAGE_PACK_SOURCE_DIR:-./site-language-packs}"
DEST_DIR="${SITE_LANGUAGE_PACK_DEST_DIR:-./data/site-languages}"
APP_UID="${APP_UID:-1000}"
APP_RUNTIME_GID="${APP_RUNTIME_GID:-0}"

log() { printf '%s\n' "[txt-reader language-packs] $*" >&2; }

if [ ! -d "$SRC_DIR" ]; then
  log "ERROR: source directory not found: $SRC_DIR"
  exit 1
fi

mkdir -p "$DEST_DIR"
count=0
for file in "$SRC_DIR"/*.json; do
  [ -e "$file" ] || continue
  base=$(basename "$file")
  cp "$file" "$DEST_DIR/$base"
  count=$((count + 1))
done

# Best-effort permission normalization for the runtime model used by the Docker image.
# The app runs as uid=1000, gid=0 by default. If chown is blocked by LXC/SMB/NFS, keep going.
chown -R "$APP_UID:$APP_RUNTIME_GID" "$DEST_DIR" 2>/dev/null || true
find "$DEST_DIR" -type d -exec chmod 0775 {} \; 2>/dev/null || true
find "$DEST_DIR" -type f -name '*.json' -exec chmod 0664 {} \; 2>/dev/null || true

log "installed $count language pack(s) to $DEST_DIR"
