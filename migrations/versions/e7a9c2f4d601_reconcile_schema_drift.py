"""Reconcile schema drift with the current models.

Revision ID: e7a9c2f4d601
Revises: b0967e071bee
Create Date: 2026-09-01 00:00:00.000000

Some deployed SQLite databases received these columns manually while their
Alembic revision remained on one side of the historical branch. This migration
is intentionally introspective so it works for both those databases and a
brand-new database built entirely from migration history.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'e7a9c2f4d601'
down_revision = 'b0967e071bee'
branch_labels = None
depends_on = None

RESET_TOKEN_INDEX_NAME = 'ux_user_reset_token'


def _column_names(table_name):
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def _reset_token_is_unique():
    inspector = sa.inspect(op.get_bind())
    target_columns = ('reset_token',)

    for constraint in inspector.get_unique_constraints('user'):
        if tuple(constraint.get('column_names') or ()) == target_columns:
            return True

    for index in inspector.get_indexes('user'):
        if (
            index.get('unique')
            and tuple(index.get('column_names') or ()) == target_columns
        ):
            return True

    return False


def _has_duplicate_reset_tokens():
    user_table = sa.table(
        'user',
        sa.column('reset_token', sa.String(length=100)),
    )
    duplicate_query = (
        sa.select(user_table.c.reset_token)
        .where(user_table.c.reset_token.is_not(None))
        .group_by(user_table.c.reset_token)
        .having(sa.func.count() > 1)
        .limit(1)
    )
    return op.get_bind().execute(duplicate_query).first() is not None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    for table_name in ('user', 'photo'):
        if not inspector.has_table(table_name):
            raise RuntimeError(f'Required table is missing: {table_name}')

    user_columns = _column_names('user')

    # Fail before non-transactional SQLite DDL if uniqueness cannot be added.
    if (
        'reset_token' in user_columns
        and not _reset_token_is_unique()
        and _has_duplicate_reset_tokens()
    ):
        raise RuntimeError(
            'Duplicate non-null user.reset_token values must be cleared '
            'before upgrading.'
        )

    missing_user_columns = (
        ('reset_token', sa.String(length=100)),
        ('reset_token_expiry', sa.DateTime()),
        ('first_name', sa.String(length=100)),
        ('last_name', sa.String(length=100)),
        ('phone', sa.String(length=50)),
    )
    for column_name, column_type in missing_user_columns:
        if column_name not in user_columns:
            op.add_column(
                'user',
                sa.Column(column_name, column_type, nullable=True),
            )

    photo_columns = _column_names('photo')
    if 'order' not in photo_columns:
        op.add_column(
            'photo',
            sa.Column(
                'order',
                sa.Integer(),
                nullable=True,
                server_default=sa.text('0'),
            ),
        )

    photo_table = sa.table(
        'photo',
        sa.column('order', sa.Integer()),
    )
    op.execute(
        photo_table.update()
        .where(photo_table.c.order.is_(None))
        .values(order=0)
    )

    if not _reset_token_is_unique():
        if _has_duplicate_reset_tokens():
            raise RuntimeError(
                'Duplicate non-null user.reset_token values must be cleared '
                'before upgrading.'
            )
        op.create_index(
            RESET_TOKEN_INDEX_NAME,
            'user',
            ['reset_token'],
            unique=True,
        )


def downgrade():
    # This revision reconciles columns that pre-existed outside Alembic on some
    # deployed databases. Dropping them could destroy user data. Restore a
    # pre-upgrade database backup for an operational rollback instead.
    pass
