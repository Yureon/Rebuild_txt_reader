#!/bin/sh
set -eu

DATA_DIR="${DATA_DIR:-/app/data}"
APP_UID="${APP_UID:-1000}"
APP_GID="${APP_GID:-1000}"
RUNTIME_GID_HINT="${APP_RUNTIME_GID:-${RUNTIME_GID_HINT:-0}}"

log() {
  printf '%s\n' "[txt-reader entrypoint] $*" >&2
}

show_data_permissions() {
  log "Current $DATA_DIR permissions:"
  ls -ldn "$DATA_DIR" 2>&2 || true
  ls -ldn "$DATA_DIR/user-data" 2>&2 || true
}

show_data_hint() {
  log "Container process identity: $(id 2>/dev/null || true)"
  show_data_permissions
  log "Fix on the LXC/host side with either of these layouts:"
  log "  A) cd /opt/txt_reader && mkdir -p ./data/user-data && chown -R ${APP_UID}:${APP_GID} ./data && chmod -R u+rwX,g+rwX ./data"
  log "  B) cd /opt/txt_reader && mkdir -p ./data/user-data && chgrp -R ${RUNTIME_GID_HINT} ./data && chmod -R g+rwX ./data"
  log "The image runs as UID ${APP_UID} with primary GID ${RUNTIME_GID_HINT}, so both 1000:1000 owner-write and 0:0 group-write bind mounts are supported."
  log "If ./data is on SMB/CIFS/NFS, mount it with uid=${APP_UID},gid=${APP_GID},file_mode=0664,dir_mode=0775 or uid=${APP_UID},gid=${RUNTIME_GID_HINT},file_mode=0664,dir_mode=0775."
}

write_check_current_user() {
  check_root="$DATA_DIR/.write-check"
  check_file="$check_root/probe.$$"
  rm -rf "$check_root" 2>/dev/null || true
  mkdir -p "$check_root" 2>/tmp/txt-reader-write-check.err \
    && printf 'ok\n' > "$check_file" 2>>/tmp/txt-reader-write-check.err \
    && rm -f "$check_file" \
    && rmdir "$check_root" 2>/dev/null
}

if [ ! -d "$DATA_DIR" ]; then
  log "ERROR: $DATA_DIR does not exist. Check the docker compose volume mapping for /app/data."
  show_data_hint
  exit 70
fi

mkdir -p "$DATA_DIR/user-data" 2>/tmp/txt-reader-user-data-mkdir.err || true

if write_check_current_user; then
  exec "$@"
fi

log "ERROR: $DATA_DIR is not writable by the container user."
if [ -s /tmp/txt-reader-write-check.err ]; then
  log "Write-check error: $(tail -1 /tmp/txt-reader-write-check.err)"
fi
if [ -s /tmp/txt-reader-user-data-mkdir.err ]; then
  log "user-data mkdir detail: $(tail -1 /tmp/txt-reader-user-data-mkdir.err)"
fi
show_data_hint
exit 70
