#!/usr/bin/env bash
set -Eeuo pipefail

ARCHUB_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
readonly ARCHUB_SCRIPT_DIR
# shellcheck source=common.sh
. "$ARCHUB_SCRIPT_DIR/common.sh"

archub_usage() {
    cat <<'EOF'
Usage: bash deployment/preflight_backup.sh

Creates a private, consistent production backup and a secret-safe JSON report.
It never changes application code, uploads, configuration contents, or the live DB.
It may tighten the live .env file permissions to 0600 before backup.
EOF
}

if [ "$#" -ne 0 ]; then
    if [ "${1:-}" = '--help' ] || [ "${1:-}" = '-h' ]; then
        archub_usage
        exit 0
    fi
    archub_usage >&2
    exit 2
fi

umask 077
archub_require_server_layout "$ARCHUB_SCRIPT_DIR/preflight_helper.py"
archub_acquire_deploy_lock
archub_create_backup "$ARCHUB_SCRIPT_DIR/preflight_helper.py"
archub_log 'PREFLIGHT_STATUS=success'
