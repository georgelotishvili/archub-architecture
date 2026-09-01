import json
import sqlite3
from pathlib import Path
from types import SimpleNamespace

import pytest

from deployment.preflight_helper import (
    PreflightError,
    application_data_report,
    backup_database,
    foreign_key_violation_report,
    resolve_database_path,
)


def create_database(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    sqlite3.connect(path).close()
    return path.resolve()


def create_layout(tmp_path):
    home_root = (tmp_path / 'home').resolve()
    app_root = home_root / 'public_html' / 'archub'
    app_root.mkdir(parents=True)
    database_path = create_database(app_root / 'database.db')
    return home_root, app_root, database_path


def sqlite_url(path, scheme='sqlite'):
    return f'{scheme}:///{path.resolve().as_posix()}'


def test_resolve_database_path_accepts_only_preserved_default_database(tmp_path):
    home_root, app_root, database_path = create_layout(tmp_path)

    assert resolve_database_path(app_root, home_root, {}) == database_path


@pytest.mark.parametrize('scheme', ['sqlite', 'sqlite+pysqlite'])
def test_resolve_database_path_accepts_explicit_url_for_preserved_database(
    tmp_path, scheme
):
    home_root, app_root, database_path = create_layout(tmp_path)

    resolved = resolve_database_path(
        app_root,
        home_root,
        {'DATABASE_URL': sqlite_url(database_path, scheme)},
    )

    assert resolved == database_path


@pytest.mark.parametrize(
    'relative_path',
    [Path('public_html/archub/data/production.sqlite'), Path('private/production.db')],
)
def test_resolve_database_path_rejects_database_not_preserved_by_deploy(
    tmp_path, relative_path
):
    home_root, app_root, _database_path = create_layout(tmp_path)
    alternate_database = create_database(home_root / relative_path)

    with pytest.raises(PreflightError, match='app_root/database.db'):
        resolve_database_path(
            app_root,
            home_root,
            {'DATABASE_URL': sqlite_url(alternate_database)},
        )


def create_legacy_application_schema(connection, with_foreign_keys=False):
    photo_constraint = (
        ' REFERENCES project(id)' if with_foreign_keys else ''
    )
    like_user_constraint = ' REFERENCES user(id)' if with_foreign_keys else ''
    like_project_constraint = (
        ' REFERENCES project(id)' if with_foreign_keys else ''
    )
    connection.executescript(
        f'''
        CREATE TABLE "user" (id INTEGER PRIMARY KEY, email TEXT);
        CREATE TABLE project (id INTEGER PRIMARY KEY);
        CREATE TABLE photo (
            id INTEGER PRIMARY KEY,
            project_id INTEGER{photo_constraint}
        );
        CREATE TABLE project_likes (
            user_id INTEGER{like_user_constraint},
            project_id INTEGER{like_project_constraint}
        );
        '''
    )


def backup_arguments(home_root, app_root):
    env_file = app_root / '.env'
    env_file.write_text(f'SECRET_KEY={"x" * 32}\n', encoding='utf-8')
    backup_root = home_root / 'backups' / 'preflight-test'
    backup_root.mkdir(parents=True)
    return SimpleNamespace(
        app_root=str(app_root),
        home_root=str(home_root),
        env_file=str(env_file),
        destination=str(backup_root / 'database.db'),
        report=str(backup_root / 'preflight-report.json'),
    )


def test_application_data_report_accepts_clean_legacy_data():
    connection = sqlite3.connect(':memory:')
    try:
        create_legacy_application_schema(connection)
        connection.execute(
            'INSERT INTO "user" (id, email) VALUES (?, ?)',
            (1, 'owner@example.com'),
        )
        connection.execute('INSERT INTO project (id) VALUES (?)', (10,))
        connection.execute(
            'INSERT INTO photo (id, project_id) VALUES (?, ?)',
            (100, 10),
        )
        connection.execute(
            'INSERT INTO project_likes (user_id, project_id) VALUES (?, ?)',
            (1, 10),
        )

        report = application_data_report(connection)
    finally:
        connection.close()

    assert report['orphan_reference_count'] == 0
    assert report['case_insensitive_duplicate_user_email_group_count'] == 0
    assert report['case_insensitive_duplicate_user_email_row_count'] == 0
    assert report['skipped_checks'] == []


def test_application_data_report_finds_orphans_without_foreign_key_constraints():
    connection = sqlite3.connect(':memory:')
    try:
        create_legacy_application_schema(connection)
        connection.execute(
            'INSERT INTO photo (id, project_id) VALUES (?, ?)',
            (100, 999),
        )
        connection.execute(
            'INSERT INTO project_likes (user_id, project_id) VALUES (?, ?)',
            (888, 999),
        )

        report = application_data_report(connection)
    finally:
        connection.close()

    assert report['photo_missing_project_count'] == 1
    assert report['project_like_missing_project_count'] == 1
    assert report['project_like_missing_user_count'] == 1
    assert report['orphan_reference_count'] == 3


def test_application_data_report_finds_case_insensitive_duplicate_emails():
    connection = sqlite3.connect(':memory:')
    try:
        create_legacy_application_schema(connection)
        connection.executemany(
            'INSERT INTO "user" (id, email) VALUES (?, ?)',
            (
                (1, 'Person@Example.com'),
                (2, 'person@example.com'),
                (3, 'unique@example.com'),
            ),
        )

        report = application_data_report(connection)
    finally:
        connection.close()

    assert report['case_insensitive_duplicate_user_email_group_count'] == 1
    assert report['case_insensitive_duplicate_user_email_row_count'] == 2


def test_foreign_key_violation_report_identifies_broken_relationship():
    connection = sqlite3.connect(':memory:')
    try:
        create_legacy_application_schema(connection, with_foreign_keys=True)
        connection.execute('PRAGMA foreign_keys = OFF')
        connection.execute(
            'INSERT INTO photo (id, project_id) VALUES (?, ?)',
            (100, 999),
        )
        rows = list(connection.execute('PRAGMA foreign_key_check'))
    finally:
        connection.close()

    assert foreign_key_violation_report(rows) == [
        {
            'table': 'photo',
            'row_id': 100,
            'referenced_table': 'project',
            'foreign_key_index': 0,
        }
    ]


def test_backup_database_fails_closed_on_foreign_key_violation(
    tmp_path, monkeypatch
):
    home_root, app_root, database_path = create_layout(tmp_path)
    with sqlite3.connect(database_path) as connection:
        create_legacy_application_schema(connection, with_foreign_keys=True)
        connection.execute(
            'INSERT INTO photo (id, project_id) VALUES (?, ?)',
            (100, 999),
        )
    args = backup_arguments(home_root, app_root)
    monkeypatch.setattr('deployment.preflight_helper.stat.S_IMODE', lambda _mode: 0o600)

    with pytest.raises(PreflightError, match='foreign_key_check found 1'):
        backup_database(args)

    report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    assert report['database']['foreign_key_violation_count'] == 1
    assert report['database']['foreign_key_violations'][0]['table'] == 'photo'


def test_backup_database_fails_closed_on_orphan_without_constraints(
    tmp_path, monkeypatch
):
    home_root, app_root, database_path = create_layout(tmp_path)
    with sqlite3.connect(database_path) as connection:
        create_legacy_application_schema(connection)
        connection.execute(
            'INSERT INTO project_likes (user_id, project_id) VALUES (?, ?)',
            (888, 999),
        )
    args = backup_arguments(home_root, app_root)
    monkeypatch.setattr('deployment.preflight_helper.stat.S_IMODE', lambda _mode: 0o600)

    with pytest.raises(PreflightError, match='2 orphan reference'):
        backup_database(args)

    report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    application_data = report['database']['application_data']
    assert report['database']['foreign_key_violation_count'] == 0
    assert application_data['project_like_missing_project_count'] == 1
    assert application_data['project_like_missing_user_count'] == 1


def test_backup_database_fails_closed_on_case_variant_email_duplicates(
    tmp_path, monkeypatch
):
    home_root, app_root, database_path = create_layout(tmp_path)
    with sqlite3.connect(database_path) as connection:
        create_legacy_application_schema(connection)
        connection.executemany(
            'INSERT INTO "user" (id, email) VALUES (?, ?)',
            ((1, 'Person@Example.com'), (2, 'person@example.com')),
        )
    args = backup_arguments(home_root, app_root)
    monkeypatch.setattr('deployment.preflight_helper.stat.S_IMODE', lambda _mode: 0o600)

    with pytest.raises(PreflightError, match='1 case-insensitive duplicate group'):
        backup_database(args)

    report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    application_data = report['database']['application_data']
    assert application_data[
        'case_insensitive_duplicate_user_email_group_count'
    ] == 1
    assert application_data['case_insensitive_duplicate_user_email_row_count'] == 2
