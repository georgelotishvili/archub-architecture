#!/usr/bin/env bash
set -Eeuo pipefail

ARCHUB_SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
readonly ARCHUB_SCRIPT_DIR
# shellcheck source=common.sh
. "$ARCHUB_SCRIPT_DIR/common.sh"

ARCHUB_DEPLOY_SOURCE=''
ARCHUB_DEPLOY_MUTATED=0
ARCHUB_DEPLOY_SUCCEEDED=0
ARCHUB_DATABASE_MAY_HAVE_CHANGED=0
ARCHUB_SYNC_HELPER_PATH=''

archub_deploy_usage() {
    cat <<'EOF'
Usage: bash deployment/deploy.sh --source /absolute/path/to/release

The source must be a complete release tree inside /home/archubge. Runtime data
(.env, database.db, uploads, .htaccess) is always preserved. The live app tree
is not accepted as its own release source because that cannot be rolled back.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --source)
            [ "$#" -ge 2 ] || archub_die '--source requires a path.'
            ARCHUB_DEPLOY_SOURCE=$2
            shift 2
            ;;
        --help|-h)
            archub_deploy_usage
            exit 0
            ;;
        *)
            archub_deploy_usage >&2
            archub_die "Unknown argument: $1"
            ;;
    esac
done

[ -n "$ARCHUB_DEPLOY_SOURCE" ] || {
    archub_deploy_usage >&2
    archub_die '--source is required.'
}

archub_compile_tree() {
    local archub_tree=$1
    "$ARCHUB_VENV_PYTHON" -m compileall -q \
        "$archub_tree/app" \
        "$archub_tree/hosting" \
        "$archub_tree/migrations" \
        "$archub_tree/start.py" \
        "$archub_tree/passenger_wsgi.py"
}

archub_sync_code_tree() {
    local archub_source=$1
    local archub_destination=$2

    [ -n "$ARCHUB_SYNC_HELPER_PATH" ] && \
        [ -f "$ARCHUB_SYNC_HELPER_PATH" ] && \
        [ ! -L "$ARCHUB_SYNC_HELPER_PATH" ] || {
        archub_warn 'Immutable safe sync helper is unavailable.'
        return 1
    }
    "$ARCHUB_VENV_PYTHON" "$ARCHUB_SYNC_HELPER_PATH" \
        --source "$archub_source" \
        --destination "$archub_destination" \
        --home-root "$ARCHUB_HOME_ROOT"
}

archub_validate_code_tree() {
    local archub_source=$1
    local archub_destination=$2

    [ -n "$ARCHUB_SYNC_HELPER_PATH" ] && \
        [ -f "$ARCHUB_SYNC_HELPER_PATH" ] && \
        [ ! -L "$ARCHUB_SYNC_HELPER_PATH" ] || {
        archub_warn 'Immutable safe sync helper is unavailable.'
        return 1
    }
    "$ARCHUB_VENV_PYTHON" "$ARCHUB_SYNC_HELPER_PATH" \
        --source "$archub_source" \
        --destination "$archub_destination" \
        --home-root "$ARCHUB_HOME_ROOT" \
        --validate-only
}

archub_run_flask() {
    (
        unset DATABASE_URL SECRET_KEY BASE_URL CORS_ORIGIN FLASK_DEBUG
        export FLASK_ENV=production
        cd "$ARCHUB_APP_ROOT"
        "$ARCHUB_VENV_PYTHON" -m flask --app hosting.wsgi:application "$@"
    )
}

archub_smoke_live_wsgi() {
    (
        unset DATABASE_URL SECRET_KEY BASE_URL CORS_ORIGIN FLASK_DEBUG
        export FLASK_ENV=production
        cd "$ARCHUB_APP_ROOT"
        "$ARCHUB_VENV_PYTHON" -c \
            'from hosting.wsgi import application; assert application is not None'
    )
}

archub_wait_for_health() {
    local archub_helper_path=$1
    local archub_health_file
    local archub_health_code='000'
    local archub_attempt=1

    archub_require_command curl
    archub_health_file=$(mktemp "${ARCHUB_HOME_ROOT}/.archub-health.XXXXXX")
    chmod 600 "$archub_health_file"

    while [ "$archub_attempt" -le 5 ]; do
        if archub_health_code=$(curl \
            --silent --show-error \
            --connect-timeout 5 --max-time 10 \
            --output "$archub_health_file" \
            --write-out '%{http_code}' \
            'https://archub.ge/healthz'); then
            if [ "$archub_health_code" = '200' ] && \
               "$ARCHUB_VENV_PYTHON" "$archub_helper_path" check-health \
                   --file "$archub_health_file"; then
                rm -f -- "$archub_health_file"
                return 0
            fi
        fi
        archub_attempt=$((archub_attempt + 1))
        sleep 2
    done

    rm -f -- "$archub_health_file"
    archub_warn "Health check failed with last HTTP status ${archub_health_code}."
    return 1
}

archub_rollback_on_exit() {
    local archub_exit_status=$1
    local archub_backup_dir=${ARCHUB_BACKUP_DIR_RESULT:-}
    local archub_stage=''
    local archub_code_restored=0
    local archub_dependencies_restored=0
    local archub_compile_restored=0
    local archub_wsgi_import_restored=0
    local archub_restart_written=0
    local archub_rollback_failed=0

    trap - EXIT
    if [ "$archub_exit_status" -eq 0 ] || \
       [ "$ARCHUB_DEPLOY_SUCCEEDED" -eq 1 ] || \
       [ "$ARCHUB_DEPLOY_MUTATED" -eq 0 ]; then
        exit "$archub_exit_status"
    fi

    set +e
    archub_warn 'Deployment failed after mutation began; attempting best-effort code/dependency rollback.'
    archub_warn 'Overlay rollback does not delete files introduced only by the failed release; review stale files manually.'

    if [ ! -d "$archub_backup_dir" ] || \
       [ ! -f "$archub_backup_dir/SHA256SUMS" ]; then
        archub_warn 'Rollback backup is unavailable.'
        archub_rollback_failed=1
    elif ! (
        cd "$archub_backup_dir" &&
        sha256sum --check --status SHA256SUMS
    ); then
        archub_warn 'Rollback backup checksum verification failed; artifacts were not restored.'
        archub_rollback_failed=1
    else
        if ! archub_stage=$(mktemp -d "${ARCHUB_HOME_ROOT}/.archub-rollback.XXXXXX"); then
            archub_warn 'Could not create the rollback staging directory.'
            archub_rollback_failed=1
        elif ! tar --extract --gzip \
            --file="$archub_backup_dir/code.tar.gz" \
            --directory="$archub_stage"; then
            archub_warn 'Could not extract the code rollback artifact.'
            archub_rollback_failed=1
        elif archub_sync_code_tree "$archub_stage" "$ARCHUB_APP_ROOT"; then
            archub_code_restored=1
            archub_log 'Previous code tree restored from the verified backup.'
        else
            archub_warn 'Could not restore the previous code tree.'
            archub_rollback_failed=1
        fi

        if [ -f "$archub_backup_dir/pip-freeze.txt" ] && \
           "$ARCHUB_VENV_PYTHON" -m pip install \
               --disable-pip-version-check --no-input \
               --requirement "$archub_backup_dir/pip-freeze.txt" && \
           "$ARCHUB_VENV_PYTHON" -m pip check; then
            archub_dependencies_restored=1
            archub_log 'Previous pinned dependency versions restored (extra packages may remain).'
        else
            archub_warn 'Could not restore all previously pinned Python package versions.'
            archub_rollback_failed=1
        fi

        if [ "$archub_code_restored" -eq 1 ] && \
           archub_compile_tree "$ARCHUB_APP_ROOT"; then
            archub_compile_restored=1
        else
            archub_warn 'The restored live tree failed compilation.'
            archub_rollback_failed=1
        fi

        if [ "$archub_code_restored" -eq 1 ] && \
           [ "$archub_dependencies_restored" -eq 1 ] && \
           archub_smoke_live_wsgi; then
            archub_wsgi_import_restored=1
        else
            archub_warn 'The restored WSGI application failed its import smoke check.'
            archub_rollback_failed=1
        fi
    fi

    case "$archub_stage" in
        "$ARCHUB_HOME_ROOT"/.archub-rollback.*) rm -rf -- "$archub_stage" ;;
        '') ;;
        *)
            archub_warn 'Unexpected rollback staging path; it was not removed.'
            archub_rollback_failed=1
            ;;
    esac

    if [ "$ARCHUB_DATABASE_MAY_HAVE_CHANGED" -eq 1 ]; then
        archub_warn 'The database was NOT restored automatically; inspect migration state and the private snapshot.'
    fi

    if [ "$archub_code_restored" -eq 1 ] && \
       [ "$archub_dependencies_restored" -eq 1 ] && \
       [ "$archub_compile_restored" -eq 1 ] && \
       [ "$archub_wsgi_import_restored" -eq 1 ] && \
       install -d -m 755 "$ARCHUB_APP_ROOT/tmp" && \
       touch "$ARCHUB_APP_ROOT/tmp/restart.txt"; then
        archub_restart_written=1
        archub_log 'Passenger restart requested for the restored code.'
    else
        archub_warn 'Passenger was not restarted because code rollback was incomplete.'
        archub_rollback_failed=1
    fi

    if [ -d "$archub_backup_dir" ]; then
        {
            printf 'status=failed-deploy-rollback-attempted\n'
            printf 'original_exit_code=%s\n' "$archub_exit_status"
            printf 'code_restored=%s\n' "$archub_code_restored"
            printf 'dependencies_restored=%s\n' "$archub_dependencies_restored"
            printf 'compile_restored=%s\n' "$archub_compile_restored"
            printf 'wsgi_import_restored=%s\n' "$archub_wsgi_import_restored"
            printf 'restart_written=%s\n' "$archub_restart_written"
            printf 'database_restored=0\n'
            printf 'failed_release_only_files_removed=0\n'
            printf 'rollback_incomplete=%s\n' "$archub_rollback_failed"
        } >"$archub_backup_dir/rollback-result.txt"
        chmod 600 "$archub_backup_dir/rollback-result.txt"
    fi

    archub_warn "Rollback attempt finished. Backup: ${archub_backup_dir:-unavailable}"
    exit "$archub_exit_status"
}

trap 'archub_rollback_on_exit "$?"' EXIT

umask 077
archub_require_server_layout "$ARCHUB_SCRIPT_DIR/preflight_helper.py"
archub_require_command curl
archub_acquire_deploy_lock

ARCHUB_DEPLOY_SOURCE=$(realpath "$ARCHUB_DEPLOY_SOURCE") || \
    archub_die 'Release source does not exist or cannot be resolved.'
ARCHUB_EXPECTED_SCRIPT_DIR=$(realpath "$ARCHUB_DEPLOY_SOURCE/deployment") || \
    archub_die 'Release deployment directory cannot be resolved.'
[ "$ARCHUB_SCRIPT_DIR" = "$ARCHUB_EXPECTED_SCRIPT_DIR" ] || \
    archub_die 'Run deploy.sh from the release source, never from the live tree.'
case "$ARCHUB_DEPLOY_SOURCE/" in
    "$ARCHUB_HOME_ROOT/"*) ;;
    *) archub_die 'Release source must resolve inside /home/archubge.' ;;
esac
case "$ARCHUB_DEPLOY_SOURCE/" in
    "$ARCHUB_BACKUP_ROOT/"*) archub_die 'A backup directory cannot be used as a release source.' ;;
esac
case "$ARCHUB_DEPLOY_SOURCE/" in
    "$ARCHUB_APP_ROOT/"*) archub_die 'Release source must be outside the live application tree.' ;;
esac

[ -f "$ARCHUB_DEPLOY_SOURCE/app/__init__.py" ] || archub_die 'Release is missing app/__init__.py.'
[ -f "$ARCHUB_DEPLOY_SOURCE/hosting/wsgi.py" ] || archub_die 'Release is missing hosting/wsgi.py.'
[ -d "$ARCHUB_DEPLOY_SOURCE/migrations/versions" ] || archub_die 'Release is missing migrations.'
[ -f "$ARCHUB_DEPLOY_SOURCE/requirements.txt" ] || archub_die 'Release is missing requirements.txt.'

ARCHUB_RELEASE_SYMLINK=$(find "$ARCHUB_DEPLOY_SOURCE" \
    -path "$ARCHUB_DEPLOY_SOURCE/.git" -prune -o \
    -type l -print -quit)
if [ -n "$ARCHUB_RELEASE_SYMLINK" ]; then
    archub_die 'Release source contains a symlink; refusing to copy it.'
fi
# The same validated overlay helper is required for deploy and rollback.
[ -f "$ARCHUB_SCRIPT_DIR/sync_tree.py" ] || archub_die 'Safe sync helper is missing.'
"$ARCHUB_VENV_PYTHON" -m py_compile \
    "$ARCHUB_SCRIPT_DIR/preflight_helper.py" \
    "$ARCHUB_SCRIPT_DIR/sync_tree.py" || \
    archub_die 'Release deployment helpers failed compilation.'

archub_create_backup "$ARCHUB_SCRIPT_DIR/preflight_helper.py"

ARCHUB_SYNC_HELPER_PATH="$ARCHUB_BACKUP_DIR_RESULT/sync_tree.py"
install -m 600 "$ARCHUB_SCRIPT_DIR/sync_tree.py" "$ARCHUB_SYNC_HELPER_PATH" || \
    archub_die "Could not snapshot safe sync helper. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"
(
    cd "$ARCHUB_BACKUP_DIR_RESULT"
    sha256sum -- sync_tree.py >> SHA256SUMS
    sha256sum --check --status SHA256SUMS
) || archub_die "Could not authenticate deploy backup/helper. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Validating release and live tree before any dependency or code mutation.'
archub_validate_code_tree "$ARCHUB_DEPLOY_SOURCE" "$ARCHUB_APP_ROOT" || \
    archub_die "Safe code validation failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Compiling release source.'
archub_compile_tree "$ARCHUB_DEPLOY_SOURCE" || \
    archub_die "Release compilation failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

ARCHUB_DEPLOY_MUTATED=1
archub_log 'Installing pinned Python requirements into the existing virtualenv.'
"$ARCHUB_VENV_PYTHON" -m pip install \
    --disable-pip-version-check \
    --no-input \
    --requirement "$ARCHUB_DEPLOY_SOURCE/requirements.txt" || \
    archub_die "Dependency installation failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"
"$ARCHUB_VENV_PYTHON" -m pip check || \
    archub_die "Dependency consistency check failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Recompiling the exact release immediately before staging.'
archub_compile_tree "$ARCHUB_DEPLOY_SOURCE" || \
    archub_die "Release changed or failed compilation before overlay. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Overlaying validated code atomically per file while preserving runtime and stale files.'
archub_sync_code_tree "$ARCHUB_DEPLOY_SOURCE" "$ARCHUB_APP_ROOT" || \
    archub_die "Code synchronization failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Compiling the live tree.'
archub_compile_tree "$ARCHUB_APP_ROOT" || \
    archub_die "Live compilation failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Importing the live WSGI application before migration/restart.'
archub_smoke_live_wsgi || \
    archub_die "Live WSGI import failed. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_log 'Applying database migrations (upgrade only; no stamp).'
ARCHUB_DATABASE_MAY_HAVE_CHANGED=1
archub_run_flask db upgrade || \
    archub_die "Database migration failed. Restore the backup; do not stamp. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"
archub_run_flask db check || \
    archub_die "Model/migration drift remains after upgrade. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"
archub_run_flask db current

install -d -m 755 "$ARCHUB_APP_ROOT/tmp"
touch "$ARCHUB_APP_ROOT/tmp/restart.txt"

archub_log 'Waiting for HTTPS application/database health.'
archub_wait_for_health "$ARCHUB_SCRIPT_DIR/preflight_helper.py" || \
    archub_die "Deployment completed but health failed. Use rollback instructions. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

archub_root_status=$(curl \
    --silent --show-error \
    --connect-timeout 5 --max-time 15 \
    --output /dev/null \
    --write-out '%{http_code}' \
    'https://archub.ge/') || \
    archub_die "Homepage request failed after restart. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"
[ "$archub_root_status" = '200' ] || \
    archub_die "Homepage returned HTTP ${archub_root_status}. Backup: ${ARCHUB_BACKUP_DIR_RESULT}"

{
    printf 'status=success\n'
    printf 'completed_at_utc=%s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
    printf 'health_http=200\n'
    printf 'homepage_http=200\n'
} >"$ARCHUB_BACKUP_DIR_RESULT/deploy-result.txt"
chmod 600 "$ARCHUB_BACKUP_DIR_RESULT/deploy-result.txt"
ARCHUB_DEPLOY_SUCCEEDED=1

printf 'DEPLOY_STATUS=success\n'
printf 'BACKUP_DIR=%s\n' "$ARCHUB_BACKUP_DIR_RESULT"
printf 'HEALTH_HTTP=200\n'
printf 'HOMEPAGE_HTTP=200\n'
