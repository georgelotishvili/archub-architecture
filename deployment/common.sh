#!/usr/bin/env bash

# Shared, server-side deployment primitives. This file must be sourced by the
# entry-point scripts; it is not intended to be executed directly.

readonly ARCHUB_DEPLOY_USER='archubge'
readonly ARCHUB_HOME_ROOT='/home/archubge'
readonly ARCHUB_APP_ROOT='/home/archubge/public_html/archub'
readonly ARCHUB_VENV_ROOT='/home/archubge/virtualenv/public_html/archub/3.11'
readonly ARCHUB_DOCROOT='/home/archubge/public_html/archub.ge'
readonly ARCHUB_BACKUP_ROOT='/home/archubge/backups'
readonly ARCHUB_PRIVATE_ROOT='/home/archubge/private/archub'
readonly ARCHUB_LOCK_FILE='/home/archubge/.archub-deploy.lock'
readonly ARCHUB_VENV_PYTHON="${ARCHUB_VENV_ROOT}/bin/python"

ARCHUB_BACKUP_DIR_RESULT=''
ARCHUB_PREFLIGHT_REPORT_RESULT=''

archub_log() {
    printf '[archub] %s\n' "$*"
}

archub_warn() {
    printf '[archub] WARNING: %s\n' "$*" >&2
}

archub_die() {
    printf '[archub] ERROR: %s\n' "$*" >&2
    exit 1
}

archub_require_command() {
    command -v "$1" >/dev/null 2>&1 || archub_die "Required command is unavailable: $1"
}

archub_secure_env_file() {
    local archub_env_path=$1
    local archub_expected_uid
    local archub_env_identity
    local archub_env_mode
    local archub_env_owner_uid

    [ ! -L "$archub_env_path" ] || \
        archub_die "Production .env must not be a symlink."
    [ -f "$archub_env_path" ] || archub_die "Production .env is missing."

    archub_expected_uid=$(id -u) || \
        archub_die "Could not determine the deployment user ID."
    chmod 600 -- "$archub_env_path" || \
        archub_die "Could not secure production .env permissions."

    [ ! -L "$archub_env_path" ] && [ -f "$archub_env_path" ] || \
        archub_die "Production .env changed while permissions were secured."
    archub_env_identity=$(stat -c '%a:%u' -- "$archub_env_path") || \
        archub_die "Could not verify production .env permissions."
    archub_env_mode=${archub_env_identity%%:*}
    archub_env_owner_uid=${archub_env_identity#*:}

    [ "$archub_env_mode" = '600' ] || \
        archub_die "Production .env permissions are not 600 after hardening."
    [ "$archub_env_owner_uid" = "$archub_expected_uid" ] || \
        archub_die "Production .env is not owned by the deployment user."
}

archub_require_server_layout() {
    local archub_helper_path=$1
    local archub_current_user
    local archub_backup_resolved
    local archub_private_resolved

    archub_current_user=$(id -un)
    [ "$archub_current_user" = "$ARCHUB_DEPLOY_USER" ] || \
        archub_die "Run as ${ARCHUB_DEPLOY_USER}, not ${archub_current_user}."

    archub_require_command flock
    archub_require_command chmod
    archub_require_command install
    archub_require_command mktemp
    archub_require_command realpath
    archub_require_command sha256sum
    archub_require_command stat
    archub_require_command tar

    [ -d "$ARCHUB_APP_ROOT" ] || archub_die "Application directory is missing."
    [ -d "$ARCHUB_DOCROOT" ] || archub_die "Domain document root is missing."
    [ -x "$ARCHUB_VENV_PYTHON" ] || archub_die "Virtualenv Python is missing or not executable."
    [ ! -L "$ARCHUB_APP_ROOT/.env" ] || archub_die "Production .env must not be a symlink."
    [ -f "$ARCHUB_APP_ROOT/.env" ] || archub_die "Production .env is missing."
    [ -f "$ARCHUB_DOCROOT/.htaccess" ] || archub_die "Domain .htaccess is missing."
    [ -f "$ARCHUB_APP_ROOT/requirements.txt" ] || archub_die "requirements.txt is missing."
    [ -d "$ARCHUB_APP_ROOT/static/uploads" ] || archub_die "Upload directory is missing."
    [ -f "$archub_helper_path" ] || archub_die "Python preflight helper is missing."

    [ ! -L "$ARCHUB_PRIVATE_ROOT" ] || archub_die "Private runtime root must not be a symlink."
    install -d -m 700 "$ARCHUB_PRIVATE_ROOT"
    archub_private_resolved=$(realpath "$ARCHUB_PRIVATE_ROOT")
    [ "$archub_private_resolved" = "$ARCHUB_PRIVATE_ROOT" ] || \
        archub_die "Private runtime root resolved to an unexpected path."
    chmod 700 "$ARCHUB_PRIVATE_ROOT"

    [ ! -L "$ARCHUB_BACKUP_ROOT" ] || archub_die "Backup root must not be a symlink."
    install -d -m 700 "$ARCHUB_BACKUP_ROOT"
    archub_backup_resolved=$(realpath "$ARCHUB_BACKUP_ROOT")
    [ "$archub_backup_resolved" = "$ARCHUB_BACKUP_ROOT" ] || \
        archub_die "Backup root resolved to an unexpected path."
    chmod 700 "$ARCHUB_BACKUP_ROOT"
}

archub_acquire_deploy_lock() {
    umask 077
    [ ! -L "$ARCHUB_LOCK_FILE" ] || archub_die "Deployment lock must not be a symlink."
    exec 9>"$ARCHUB_LOCK_FILE"
    chmod 600 "$ARCHUB_LOCK_FILE"
    flock -n 9 || archub_die "Another Archub preflight/deploy process holds the lock."
}

archub_create_backup() {
    local archub_helper_path=$1
    local archub_stamp
    local archub_db_status=0
    local archub_audit_status=0
    local archub_freeze_status=0
    local archub_artifact

    archub_secure_env_file "$ARCHUB_APP_ROOT/.env"

    archub_stamp=$(date -u '+%Y%m%dT%H%M%SZ')
    ARCHUB_BACKUP_DIR_RESULT=$(mktemp -d "${ARCHUB_BACKUP_ROOT}/archub-deploy-${archub_stamp}-XXXXXX") || \
        archub_die 'Could not create the private backup directory.'
    chmod 700 "$ARCHUB_BACKUP_DIR_RESULT" || \
        archub_die "Could not secure backup directory: ${ARCHUB_BACKUP_DIR_RESULT}"
    ARCHUB_PREFLIGHT_REPORT_RESULT="${ARCHUB_BACKUP_DIR_RESULT}/preflight-report.json"

    archub_log "Creating private backup: ${ARCHUB_BACKUP_DIR_RESULT}"

    if "$ARCHUB_VENV_PYTHON" "$archub_helper_path" backup-database \
        --app-root "$ARCHUB_APP_ROOT" \
        --home-root "$ARCHUB_HOME_ROOT" \
        --env-file "$ARCHUB_APP_ROOT/.env" \
        --destination "$ARCHUB_BACKUP_DIR_RESULT/database.db" \
        --report "$ARCHUB_PREFLIGHT_REPORT_RESULT"; then
        archub_db_status=0
    else
        archub_db_status=$?
        archub_warn "Database backup/report failed; other recoverable artifacts will still be saved."
    fi

    tar --create --gzip \
        --file="$ARCHUB_BACKUP_DIR_RESULT/code.tar.gz" \
        --directory="$ARCHUB_APP_ROOT" \
        --exclude='./.git' \
        --exclude='./.env' \
        --exclude='./.env.*' \
        --exclude='./database.db' \
        --exclude='./database.db-*' \
        --exclude='./rate_limits.db' \
        --exclude='./rate_limits.db-*' \
        --exclude='./static/uploads' \
        --exclude='./tmp' \
        --exclude='./logs' \
        --exclude='./venv' \
        --exclude='__pycache__' \
        --exclude='*.pyc' \
        --exclude='*.pyo' \
        . || archub_die "Code backup failed; partial backup remains at ${ARCHUB_BACKUP_DIR_RESULT}."

    tar --create --gzip \
        --file="$ARCHUB_BACKUP_DIR_RESULT/uploads.tar.gz" \
        --directory="$ARCHUB_APP_ROOT/static" \
        uploads || archub_die "Upload backup failed; partial backup remains at ${ARCHUB_BACKUP_DIR_RESULT}."

    install -m 600 "$ARCHUB_APP_ROOT/.env" "$ARCHUB_BACKUP_DIR_RESULT/.env" || \
        archub_die "Could not back up .env; partial backup remains at ${ARCHUB_BACKUP_DIR_RESULT}."
    install -m 600 "$ARCHUB_DOCROOT/.htaccess" "$ARCHUB_BACKUP_DIR_RESULT/.htaccess" || \
        archub_die "Could not back up .htaccess; partial backup remains at ${ARCHUB_BACKUP_DIR_RESULT}."

    if "$ARCHUB_VENV_PYTHON" -m pip freeze --all >"$ARCHUB_BACKUP_DIR_RESULT/pip-freeze.txt"; then
        chmod 600 "$ARCHUB_BACKUP_DIR_RESULT/pip-freeze.txt"
    else
        archub_freeze_status=$?
        archub_warn "Could not capture installed Python packages."
    fi

    # The upload audit is deliberately read-only and runs after DB/code/upload
    # backups exist. Readable format mismatches are warnings; missing, symlinked,
    # or unreadable files referenced by the database fail the preflight.
    if [ -f "$ARCHUB_BACKUP_DIR_RESULT/database.db" ] && \
       [ -f "$ARCHUB_PREFLIGHT_REPORT_RESULT" ]; then
        if "$ARCHUB_VENV_PYTHON" "$archub_helper_path" audit-uploads \
            --app-root "$ARCHUB_APP_ROOT" \
            --database "$ARCHUB_BACKUP_DIR_RESULT/database.db" \
            --report "$ARCHUB_PREFLIGHT_REPORT_RESULT"; then
            archub_audit_status=0
        else
            archub_audit_status=$?
        fi
    else
        archub_audit_status=1
        archub_warn "Upload audit skipped because the database backup/report is unavailable."
    fi

    (
        cd "$ARCHUB_BACKUP_DIR_RESULT"
        : > SHA256SUMS
        for archub_artifact in \
            database.db preflight-report.json code.tar.gz uploads.tar.gz \
            .env .htaccess pip-freeze.txt; do
            if [ -f "$archub_artifact" ]; then
                sha256sum -- "$archub_artifact" >> SHA256SUMS
            fi
        done
        chmod 600 SHA256SUMS
    ) || archub_die \
        "Could not create backup checksums: ${ARCHUB_BACKUP_DIR_RESULT}"

    printf 'BACKUP_DIR=%s\n' "$ARCHUB_BACKUP_DIR_RESULT"
    printf 'PREFLIGHT_REPORT=%s\n' "$ARCHUB_PREFLIGHT_REPORT_RESULT"

    if [ "$archub_db_status" -ne 0 ] || \
       [ "$archub_audit_status" -ne 0 ] || \
       [ "$archub_freeze_status" -ne 0 ]; then
        archub_warn "Preflight failed closed. Inspect the private backup/report before retrying."
        return 1
    fi

    archub_log "Backup and preflight completed successfully."
}
