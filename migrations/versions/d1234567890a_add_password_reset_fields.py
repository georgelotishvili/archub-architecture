"""Add password reset fields to User model

Revision ID: d1234567890a
Revises: c606c068d633
Create Date: 2025-01-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd1234567890a'
down_revision = 'c606c068d633'
branch_labels = None
depends_on = None


def _column_names(table_name):
    """Read the live schema so this historical migration tolerates drift."""
    inspector = sa.inspect(op.get_bind())
    return {column['name'] for column in inspector.get_columns(table_name)}


def upgrade():
    # These columns were added manually to some deployed SQLite databases.
    # Inline UNIQUE is deliberately avoided because SQLite cannot add that
    # constraint with ALTER TABLE. A post-merge revision creates a named index.
    columns = _column_names('user')
    if 'reset_token' not in columns:
        op.add_column(
            'user',
            sa.Column('reset_token', sa.String(length=100), nullable=True),
        )
    if 'reset_token_expiry' not in columns:
        op.add_column(
            'user',
            sa.Column('reset_token_expiry', sa.DateTime(), nullable=True),
        )


def downgrade():
    columns = _column_names('user')
    if not {'reset_token', 'reset_token_expiry'} & columns:
        return

    inspector = sa.inspect(op.get_bind())
    index_names = {index['name'] for index in inspector.get_indexes('user')}
    if 'ux_user_reset_token' in index_names:
        op.drop_index('ux_user_reset_token', table_name='user')

    with op.batch_alter_table('user', schema=None) as batch_op:
        if 'reset_token_expiry' in columns:
            batch_op.drop_column('reset_token_expiry')
        if 'reset_token' in columns:
            batch_op.drop_column('reset_token')
