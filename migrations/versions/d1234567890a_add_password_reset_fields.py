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


def upgrade():
    # Add reset_token and reset_token_expiry columns to user table
    op.add_column('user', sa.Column('reset_token', sa.String(100), unique=True, nullable=True))
    op.add_column('user', sa.Column('reset_token_expiry', sa.DateTime(), nullable=True))


def downgrade():
    # Remove reset_token and reset_token_expiry columns from user table
    op.drop_column('user', 'reset_token_expiry')
    op.drop_column('user', 'reset_token')
