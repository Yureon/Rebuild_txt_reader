#!/bin/sh
set -eu

APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"
APP_RUNTIME_GID="${APP_RUNTIME_GID:-0}"
DATA_DIR="${DATA_DIR:-./data}"
MODE="${DATA_PERMISSION_MODE:-owner}"

mkdir -p "$DATA_DIR/user-data"

case "$MODE" in
  owner)
    chown -R "$APP_UID:$APP_GID" "$DATA_DIR"
    chmod -R u+rwX,g+rwX "$DATA_DIR"
    printf 'txt-reader data directory is writable for UID:GID %s:%s -> %s\n' "$APP_UID" "$APP_GID" "$DATA_DIR"
    ;;
  group-root|runtime-group)
    chgrp -R "$APP_RUNTIME_GID" "$DATA_DIR"
    chmod -R g+rwX "$DATA_DIR"
    printf 'txt-reader data directory is writable for UID %s with runtime GID %s -> %s\n' "$APP_UID" "$APP_RUNTIME_GID" "$DATA_DIR"
    ;;
  *)
    printf 'Unsupported DATA_PERMISSION_MODE=%s. Use owner or group-root.\n' "$MODE" >&2
    exit 64
    ;;
esac
