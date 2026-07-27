#!/bin/sh
set -eu

DATA_DIR="${TXT_READER_DATA_DIR:-${DATA_DIR:-/app/data}}"
export TXT_READER_DATA_DIR="$DATA_DIR"
APP_UID="1000"
APP_GID="1000"
RUNTIME_GID_HINT="0"
WRITE_CHECK_ERROR="/tmp/txt-reader-write-check.$$.err"
USER_DATA_ERROR="/tmp/txt-reader-user-data-mkdir.$$.err"

cleanup_probe_logs() {
  rm -f "$WRITE_CHECK_ERROR" "$USER_DATA_ERROR" 2>/dev/null || true
}
trap cleanup_probe_logs 0 HUP INT TERM

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
  log "The image uses the fixed runtime identity UID ${APP_UID}, primary GID ${RUNTIME_GID_HINT}. APP_UID/APP_GID do not change the container user."
  log "If ./data is on SMB/CIFS/NFS, mount it with uid=${APP_UID},gid=${APP_GID},file_mode=0664,dir_mode=0775 or uid=${APP_UID},gid=${RUNTIME_GID_HINT},file_mode=0664,dir_mode=0775."
}

write_check_directory() {
  check_parent="$1"
  check_root="$check_parent/.write-check.$$"
  check_file="$check_root/probe"
  if mkdir "$check_root" 2>>"$WRITE_CHECK_ERROR" \
    && printf 'ok\n' > "$check_file" 2>>"$WRITE_CHECK_ERROR"; then
    rm -f "$check_file"
    rmdir "$check_root" 2>/dev/null
    return 0
  fi
  rm -f "$check_file" 2>/dev/null || true
  rmdir "$check_root" 2>/dev/null || true
  return 1
}

if [ ! -d "$DATA_DIR" ]; then
  log "ERROR: $DATA_DIR does not exist. Check the docker compose volume mapping for /app/data."
  show_data_hint
  exit 70
fi

mkdir -p "$DATA_DIR/user-data" 2>"$USER_DATA_ERROR" || true

if [ -d "$DATA_DIR/user-data" ] \
  && write_check_directory "$DATA_DIR" \
  && write_check_directory "$DATA_DIR/user-data"; then
trap - 0 HUP INT TERM
  cleanup_probe_logs
  exec "$@"
fi

log "ERROR: $DATA_DIR is not writable by the container user."
if [ -s "$WRITE_CHECK_ERROR" ]; then
  log "Write-check error: $(tail -1 "$WRITE_CHECK_ERROR")"
fi
if [ -s "$USER_DATA_ERROR" ]; then
  log "user-data mkdir detail: $(tail -1 "$USER_DATA_ERROR")"
fi
show_data_hint
exit 70
