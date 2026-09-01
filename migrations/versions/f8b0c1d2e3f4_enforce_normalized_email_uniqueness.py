"""Enforce case-insensitive user email uniqueness.

Revision ID: f8b0c1d2e3f4
Revises: e7a9c2f4d601
Create Date: 2026-09-01 13:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = 'f8b0c1d2e3f4'
down_revision = 'e7a9c2f4d601'
branch_labels = None
depends_on = None

EMAIL_INDEX_NAME = 'ux_user_email_lower'


def _index_exists():
    connection = op.get_bind()
    if connection.dialect.name == 'sqlite':
        return connection.execute(
            sa.text(
                "SELECT 1 FROM sqlite_master "
                "WHERE type = 'index' AND name = :name"
            ),
            {'name': EMAIL_INDEX_NAME},
        ).first() is not None

    inspector = sa.inspect(connection)
    return any(
        index.get('name') == EMAIL_INDEX_NAME
        for index in inspector.get_indexes('user')
    )


def _has_case_insensitive_duplicates():
    user_table = sa.table(
        'user',
        sa.column('email', sa.String(length=150)),
    )
    duplicate_query = (
        sa.select(sa.func.lower(user_table.c.email))
        .where(user_table.c.email.is_not(None))
        .group_by(sa.func.lower(user_table.c.email))
        .having(sa.func.count() > 1)
        .limit(1)
    )
    return op.get_bind().execute(duplicate_query).first() is not None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table('user'):
        raise RuntimeError('Required table is missing: user')
    if 'email' not in {
        column['name'] for column in inspector.get_columns('user')
    }:
        raise RuntimeError('Required column is missing: user.email')
    if _has_case_insensitive_duplicates():
        raise RuntimeError(
            'Case-insensitive duplicate user emails must be resolved '
            'before upgrading.'
        )
    if not _index_exists():
        op.create_index(
            EMAIL_INDEX_NAME,
            'user',
            [sa.text('lower(email)')],
            unique=True,
        )


def downgrade():
    if _index_exists():
        op.drop_index(EMAIL_INDEX_NAME, table_name='user')
