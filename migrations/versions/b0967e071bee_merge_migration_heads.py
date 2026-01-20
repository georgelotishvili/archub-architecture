"""Merge migration heads

Revision ID: b0967e071bee
Revises: 01418a376da0, d1234567890a
Create Date: 2026-01-20 17:22:29.516004

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b0967e071bee'
down_revision = ('01418a376da0', 'd1234567890a')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
