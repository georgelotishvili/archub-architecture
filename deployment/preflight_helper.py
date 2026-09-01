#!/usr/bin/env python3
"""Secret-safe SQLite backup, schema report, and legacy upload audit."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import sqlite3
import stat
import sys
from datetime import datetime, timezone
from urllib.parse import quote, unquote
import warnings


REPORT_VERSION = 2
DEFAULT_SECRET_VALUES = {
    'archub-development-only-secret',
    'archub-secret-key-change-in-production',
}
EXPECTED_IMAGE_FORMATS = {
    '.jpg': 'JPEG',
    '.jpeg': 'JPEG',
    '.png': 'PNG',
    '.gif': 'GIF',
    '.webp': 'WEBP',
}
ENV_KEY_PATTERN = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')


class PreflightError(RuntimeError):
    """A safe-to-display preflight failure."""


def utc_now():
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def is_within(path, parent):
    try:
        path.relative_to(parent)
        return True
    except ValueError:
        return False


def quote_identifier(identifier):
    return '"' + identifier.replace('"', '""') + '"'


def sha256_file(path):
    digest = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest()


def write_json_atomic(path, payload):
    path = Path(path)
    temporary = path.with_name(path.name + '.tmp')
    if temporary.exists():
        raise PreflightError('A stale report temporary file already exists.')
    with temporary.open('x', encoding='utf-8') as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())
    os.chmod(temporary, 0o600)
    os.replace(temporary, path)
    os.chmod(path, 0o600)


def read_env_values(env_file):
    values = {}
    with env_file.open('r', encoding='utf-8-sig') as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith('#'):
                continue
            if line.startswith('export '):
                line = line[7:].lstrip()
            if '=' not in line:
                continue
            key, value = line.split('=', 1)
            key = key.strip()
            if not ENV_KEY_PATTERN.fullmatch(key):
                continue
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'\'', '"'}:
                value = value[1:-1]
            values[key] = value
    return values


def resolve_database_path(app_root, home_root, env_values):
    database_url = env_values.get('DATABASE_URL', '').strip()
    if not database_url:
        candidate = app_root / 'database.db'
    else:
        scheme, separator, location = database_url.partition(':///')
        if not separator or scheme not in {'sqlite', 'sqlite+pysqlite'}:
            raise PreflightError('DATABASE_URL must identify a local SQLite database.')
        location = location.split('?', 1)[0]
        if '#' in location:
            raise PreflightError('SQLite DATABASE_URL must not contain a fragment.')
        location = unquote(location)
        if not location or location == ':memory:':
            raise PreflightError('An on-disk SQLite database is required.')
        candidate = Path(location)
        if not candidate.is_absolute():
            candidate = app_root / candidate

    resolved = candidate.resolve(strict=True)
    if not is_within(resolved, home_root):
        raise PreflightError('The SQLite database resolved outside the account home.')
    if not resolved.is_file():
        raise PreflightError('The SQLite database is not a regular file.')

    expected_database_path = app_root / 'database.db'
    if resolved != expected_database_path:
        raise PreflightError(
            'Production SQLite database must resolve to app_root/database.db.'
        )
    return resolved


def sqlite_read_only_connection(path):
    encoded_path = quote(str(path), safe='/')
    connection = sqlite3.connect(
        f'file:{encoded_path}?mode=ro',
        uri=True,
        timeout=30,
    )
    connection.execute('PRAGMA busy_timeout = 30000')
    return connection


def schema_report(connection):
    table_names = [
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
        )
    ]
    tables = {}
    for table_name in table_names:
        quoted_table = quote_identifier(table_name)
        columns = []
        for row in connection.execute(f'PRAGMA table_info({quoted_table})'):
            columns.append({
                'name': row[1],
                'type': row[2],
                'not_null': bool(row[3]),
                'has_default': row[4] is not None,
                'primary_key_position': row[5],
            })

        indexes = []
        for row in connection.execute(f'PRAGMA index_list({quoted_table})'):
            index_name = row[1]
            quoted_index = quote_identifier(index_name)
            index_columns = [
                item[2]
                for item in connection.execute(f'PRAGMA index_info({quoted_index})')
            ]
            indexes.append({
                'name': index_name,
                'unique': bool(row[2]),
                'origin': row[3] if len(row) > 3 else None,
                'partial': bool(row[4]) if len(row) > 4 else False,
                'columns': index_columns,
            })

        foreign_keys = []
        for row in connection.execute(f'PRAGMA foreign_key_list({quoted_table})'):
            foreign_keys.append({
                'referenced_table': row[2],
                'from_column': row[3],
                'to_column': row[4],
                'on_update': row[5],
                'on_delete': row[6],
            })

        row_count = connection.execute(
            f'SELECT COUNT(*) FROM {quoted_table}'
        ).fetchone()[0]
        tables[table_name] = {
            'row_count': row_count,
            'columns': columns,
            'indexes': indexes,
            'foreign_keys': foreign_keys,
        }
    return tables


def table_has_columns(connection, table_name, required_columns):
    table_exists = connection.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
        (table_name,),
    ).fetchone()
    if not table_exists:
        return False
    columns = {
        row[1]
        for row in connection.execute(
            f'PRAGMA table_info({quote_identifier(table_name)})'
        )
    }
    return set(required_columns).issubset(columns)


def application_data_report(connection):
    """Report legacy relationship and normalized-email conflicts read-only."""
    skipped_checks = []
    orphan_checks = (
        (
            'photo_missing_project_count',
            'photo',
            {'project_id'},
            'project',
            {'id'},
            'SELECT COUNT(*) FROM "photo" AS child '
            'LEFT JOIN "project" AS parent ON parent.id = child.project_id '
            'WHERE parent.id IS NULL',
        ),
        (
            'project_like_missing_project_count',
            'project_likes',
            {'project_id'},
            'project',
            {'id'},
            'SELECT COUNT(*) FROM "project_likes" AS child '
            'LEFT JOIN "project" AS parent ON parent.id = child.project_id '
            'WHERE parent.id IS NULL',
        ),
        (
            'project_like_missing_user_count',
            'project_likes',
            {'user_id'},
            'user',
            {'id'},
            'SELECT COUNT(*) FROM "project_likes" AS child '
            'LEFT JOIN "user" AS parent ON parent.id = child.user_id '
            'WHERE parent.id IS NULL',
        ),
    )
    orphan_counts = {}
    for (
        check_name,
        child_table,
        child_columns,
        parent_table,
        parent_columns,
        query,
    ) in orphan_checks:
        if not table_has_columns(connection, child_table, child_columns):
            skipped_checks.append(check_name)
            orphan_counts[check_name] = None
            continue
        if not table_has_columns(connection, parent_table, parent_columns):
            skipped_checks.append(check_name)
            orphan_counts[check_name] = None
            continue
        orphan_counts[check_name] = connection.execute(query).fetchone()[0]

    duplicate_group_count = None
    duplicate_row_count = None
    duplicate_check_name = 'case_insensitive_duplicate_user_email'
    if table_has_columns(connection, 'user', {'email'}):
        duplicate_group_sizes = [
            row[0]
            for row in connection.execute(
                'SELECT COUNT(*) FROM "user" WHERE email IS NOT NULL '
                'GROUP BY lower(email) HAVING COUNT(*) > 1'
            )
        ]
        duplicate_group_count = len(duplicate_group_sizes)
        duplicate_row_count = sum(duplicate_group_sizes)
    else:
        skipped_checks.append(duplicate_check_name)

    orphan_reference_count = sum(
        count for count in orphan_counts.values() if count is not None
    )
    return {
        **orphan_counts,
        'orphan_reference_count': orphan_reference_count,
        'case_insensitive_duplicate_user_email_group_count': duplicate_group_count,
        'case_insensitive_duplicate_user_email_row_count': duplicate_row_count,
        'skipped_checks': skipped_checks,
    }


def foreign_key_violation_report(rows):
    return [
        {
            'table': row[0],
            'row_id': row[1],
            'referenced_table': row[2],
            'foreign_key_index': row[3],
        }
        for row in rows
    ]


def backup_database(args):
    app_root = Path(args.app_root).resolve(strict=True)
    home_root = Path(args.home_root).resolve(strict=True)
    env_file = Path(args.env_file).resolve(strict=True)
    destination = Path(args.destination)
    report_path = Path(args.report)

    if not is_within(app_root, home_root):
        raise PreflightError('Application root resolved outside the account home.')
    if not is_within(env_file, home_root):
        raise PreflightError('.env resolved outside the account home.')
    env_mode = stat.S_IMODE(env_file.stat().st_mode)
    env_permissions_private = not bool(env_mode & 0o077)

    env_values = read_env_values(env_file)
    secret_key = env_values.get('SECRET_KEY', '')
    secret_key_strong = (
        len(secret_key) >= 32 and secret_key not in DEFAULT_SECRET_VALUES
    )

    database_path = resolve_database_path(app_root, home_root, env_values)
    destination_parent = destination.parent.resolve(strict=True)
    report_parent = report_path.parent.resolve(strict=True)
    if destination.exists() or report_path.exists():
        raise PreflightError('Backup destination/report already exists.')
    if not is_within(destination_parent, home_root) or not is_within(report_parent, home_root):
        raise PreflightError('Backup destination/report resolved outside the account home.')

    descriptor = os.open(destination, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(descriptor)
    source_connection = sqlite_read_only_connection(database_path)
    destination_connection = sqlite3.connect(str(destination), timeout=30)
    try:
        source_connection.backup(destination_connection, pages=1024, sleep=0.05)
        destination_connection.commit()
    finally:
        destination_connection.close()
        source_connection.close()
    os.chmod(destination, 0o600)

    backup_connection = sqlite_read_only_connection(destination)
    try:
        integrity_rows = [row[0] for row in backup_connection.execute('PRAGMA integrity_check')]
        foreign_key_rows = list(backup_connection.execute('PRAGMA foreign_key_check'))
        foreign_key_violations = foreign_key_violation_report(foreign_key_rows)
        application_data = application_data_report(backup_connection)
        tables = schema_report(backup_connection)
        alembic_versions = []
        if 'alembic_version' in tables:
            alembic_versions = [
                row[0]
                for row in backup_connection.execute(
                    'SELECT version_num FROM alembic_version ORDER BY version_num'
                )
            ]
    finally:
        backup_connection.close()

    integrity_ok = integrity_rows == ['ok']
    report = {
        'report_version': REPORT_VERSION,
        'created_at_utc': utc_now(),
        'environment_checks': {
            'env_permissions_private': env_permissions_private,
            'secret_key_configured_and_strong': secret_key_strong,
            'database_kind': 'sqlite',
        },
        'database': {
            'source_path': str(database_path),
            'backup_filename': destination.name,
            'backup_size_bytes': destination.stat().st_size,
            'backup_sha256': sha256_file(destination),
            'sqlite_version': sqlite3.sqlite_version,
            'integrity_check': integrity_rows,
            'integrity_ok': integrity_ok,
            'foreign_key_violation_count': len(foreign_key_rows),
            'foreign_key_violations': foreign_key_violations,
            'application_data': application_data,
            'alembic_versions': alembic_versions,
            'tables': tables,
        },
        'upload_audit': None,
    }
    write_json_atomic(report_path, report)

    if not env_permissions_private:
        raise PreflightError(
            '.env must not be readable or writable by group/other users.'
        )
    if not secret_key_strong:
        raise PreflightError('Production SECRET_KEY is absent, weak, or a known default.')
    if not integrity_ok:
        raise PreflightError('SQLite integrity_check failed; see the private report.')
    if foreign_key_rows:
        raise PreflightError(
            f'SQLite foreign_key_check found {len(foreign_key_rows)} violation(s); '
            'deployment stopped. See the private report.'
        )
    if application_data['orphan_reference_count']:
        raise PreflightError(
            'Legacy relationship audit found '
            f"{application_data['orphan_reference_count']} orphan reference(s) "
            'in photo/project_likes; deployment stopped. See the private report.'
        )
    duplicate_group_count = application_data[
        'case_insensitive_duplicate_user_email_group_count'
    ]
    if duplicate_group_count:
        duplicate_row_count = application_data[
            'case_insensitive_duplicate_user_email_row_count'
        ]
        raise PreflightError(
            f'User email audit found {duplicate_group_count} case-insensitive '
            f'duplicate group(s) affecting {duplicate_row_count} row(s); '
            'deployment stopped. See the private report.'
        )
    return 0


def normalize_upload_reference(value):
    if not isinstance(value, str):
        return None
    normalized = value.strip().replace('\\', '/').lstrip('/')
    prefix = 'static/uploads/'
    if not normalized.startswith(prefix):
        return None
    relative = normalized[len(prefix):]
    path = PurePosixPath(relative)
    if not relative or path.is_absolute() or '..' in path.parts:
        return None
    if any(part in {'', '.'} for part in path.parts):
        return None
    return f'{prefix}{path.as_posix()}'


def database_upload_references(connection):
    table_columns = {
        table_name: {
            row[1]
            for row in connection.execute(
                f'PRAGMA table_info({quote_identifier(table_name)})'
            )
        }
        for table_name in ('project', 'photo', 'carousel_image')
        if connection.execute(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?",
            (table_name,),
        ).fetchone()
    }
    definitions = (
        ('project', 'main_image_url'),
        ('photo', 'url'),
        ('carousel_image', 'url'),
    )
    references = set()
    invalid = []
    for table_name, column_name in definitions:
        if column_name not in table_columns.get(table_name, set()):
            continue
        quoted_table = quote_identifier(table_name)
        quoted_column = quote_identifier(column_name)
        rows = connection.execute(
            f'SELECT id, {quoted_column} FROM {quoted_table} '
            f'WHERE {quoted_column} IS NOT NULL AND {quoted_column} != ?',
            ('',),
        )
        for row_id, value in rows:
            normalized = normalize_upload_reference(value)
            if normalized:
                references.add(normalized)
            else:
                invalid.append({
                    'source': f'{table_name}.{column_name}',
                    'row_id': row_id,
                })
    return references, invalid


def audit_uploads(args):
    from PIL import Image

    app_root = Path(args.app_root).resolve(strict=True)
    upload_root = (app_root / 'static' / 'uploads').resolve(strict=True)
    database = Path(args.database).resolve(strict=True)
    report_path = Path(args.report).resolve(strict=True)
    if not is_within(upload_root, app_root):
        raise PreflightError('Upload root resolved outside the application root.')

    connection = sqlite_read_only_connection(database)
    try:
        referenced_paths, invalid_references = database_upload_references(connection)
    finally:
        connection.close()

    scanned_paths = set()
    mismatches = []
    unsupported = []
    unreadable = []
    symlinks = []

    for candidate in sorted(upload_root.rglob('*')):
        relative = 'static/uploads/' + candidate.relative_to(upload_root).as_posix()
        if candidate.is_symlink():
            symlinks.append(relative)
            continue
        if not candidate.is_file():
            continue
        scanned_paths.add(relative)
        expected_format = EXPECTED_IMAGE_FORMATS.get(candidate.suffix.lower())
        try:
            with warnings.catch_warnings():
                warnings.simplefilter('error', Image.DecompressionBombWarning)
                with Image.open(candidate) as image:
                    detected_format = (image.format or 'UNKNOWN').upper()
                    image.verify()
        except Exception as error:  # Pillow exposes several format-specific errors.
            unreadable.append({
                'path': relative,
                'error_type': type(error).__name__,
            })
            continue

        if expected_format is None:
            unsupported.append({
                'path': relative,
                'extension': candidate.suffix.lower(),
                'detected_format': detected_format,
            })
        elif expected_format != detected_format:
            mismatches.append({
                'path': relative,
                'extension': candidate.suffix.lower(),
                'expected_format': expected_format,
                'detected_format': detected_format,
            })

    unreadable_paths = {item['path'] for item in unreadable}
    symlink_paths = set(symlinks)
    referenced_missing = sorted(referenced_paths - scanned_paths - symlink_paths)
    referenced_unreadable = sorted(referenced_paths & unreadable_paths)
    referenced_symlinks = sorted(referenced_paths & symlink_paths)
    referenced_problem_count = (
        len(referenced_missing)
        + len(referenced_unreadable)
        + len(referenced_symlinks)
        + len(invalid_references)
    )

    with report_path.open('r', encoding='utf-8') as handle:
        report = json.load(handle)
    report['upload_audit'] = {
        'audit_time_utc': utc_now(),
        'conversion_performed': False,
        'scanned_file_count': len(scanned_paths),
        'database_reference_count': len(referenced_paths),
        'format_mismatch_count': len(mismatches),
        'format_mismatches': mismatches,
        'unsupported_extension_count': len(unsupported),
        'unsupported_extensions': unsupported,
        'unreadable_file_count': len(unreadable),
        'unreadable_files': unreadable,
        'symlink_count': len(symlinks),
        'symlink_paths': sorted(symlinks),
        'invalid_database_reference_count': len(invalid_references),
        'invalid_database_references': invalid_references,
        'referenced_missing_count': len(referenced_missing),
        'referenced_missing_paths': referenced_missing,
        'referenced_unreadable_count': len(referenced_unreadable),
        'referenced_unreadable_paths': referenced_unreadable,
        'referenced_symlink_count': len(referenced_symlinks),
        'referenced_symlink_paths': referenced_symlinks,
        'referenced_problem_count': referenced_problem_count,
    }
    write_json_atomic(report_path, report)

    if mismatches:
        print(
            f'WARNING: {len(mismatches)} readable upload format mismatch(es); '
            'no files were changed. See the private report.',
            file=sys.stderr,
        )
    if unreadable:
        print(
            f'WARNING: {len(unreadable)} unreadable upload file(s); see the private report.',
            file=sys.stderr,
        )
    if referenced_problem_count:
        raise PreflightError(
            'Referenced upload files are missing, unreadable, symlinked, or invalid; '
            'see the private report.'
        )
    return 0


def check_health(args):
    try:
        with Path(args.file).open('r', encoding='utf-8') as handle:
            payload = json.load(handle)
    except (OSError, ValueError):
        return 1
    return 0 if isinstance(payload, dict) and payload.get('status') == 'ok' else 1


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__)
    subparsers = parser.add_subparsers(dest='command', required=True)

    backup_parser = subparsers.add_parser('backup-database')
    backup_parser.add_argument('--app-root', required=True)
    backup_parser.add_argument('--home-root', required=True)
    backup_parser.add_argument('--env-file', required=True)
    backup_parser.add_argument('--destination', required=True)
    backup_parser.add_argument('--report', required=True)
    backup_parser.set_defaults(handler=backup_database)

    audit_parser = subparsers.add_parser('audit-uploads')
    audit_parser.add_argument('--app-root', required=True)
    audit_parser.add_argument('--database', required=True)
    audit_parser.add_argument('--report', required=True)
    audit_parser.set_defaults(handler=audit_uploads)

    health_parser = subparsers.add_parser('check-health')
    health_parser.add_argument('--file', required=True)
    health_parser.set_defaults(handler=check_health)
    return parser


def main():
    args = build_parser().parse_args()
    try:
        return args.handler(args)
    except PreflightError as error:
        print(f'ERROR: {error}', file=sys.stderr)
        return 2
    except Exception as error:
        print(
            f'ERROR: preflight helper failed safely ({type(error).__name__}).',
            file=sys.stderr,
        )
        return 3


if __name__ == '__main__':
    raise SystemExit(main())
